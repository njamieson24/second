-- Partners: finding local partners is the main thing Second does. This adds the pipeline stage
-- (found -> emailed -> replied -> deal), deal terms, the "From a partner?" tag on money entries,
-- and the weekly matches on Home. Nothing is removed.
--
-- Run AFTER outreach.sql, chat-outreach.sql, catalog.sql and catalog-b.sql.
-- Paste into Supabase: SQL Editor > New query > Run. Safe to run more than once.

-- ---------- 1. Pipeline stage and deal terms on outreach_leads ----------
alter table public.outreach_leads add column if not exists stage text not null default 'found';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'outreach_leads_stage_check') then
    alter table public.outreach_leads add constraint outreach_leads_stage_check check (stage in ('found', 'emailed', 'replied', 'deal'));
  end if;
end $$;

alter table public.outreach_leads add column if not exists emailed_at   timestamptz;
alter table public.outreach_leads add column if not exists follow_up_on date;
alter table public.outreach_leads add column if not exists replied_at   timestamptz;
alter table public.outreach_leads add column if not exists deal_at      timestamptz;
-- Deal terms: percent off, dollars off, or something else (custom, no automatic discount).
alter table public.outreach_leads add column if not exists deal_type    text;
alter table public.outreach_leads add column if not exists deal_value   numeric;
-- Optional: the one catalog option the deal applies to (null = everything)
alter table public.outreach_leads add column if not exists deal_variant_id uuid references public.catalog_variants (id) on delete set null;
alter table public.outreach_leads add column if not exists deal_note    text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'outreach_leads_deal_check') then
    alter table public.outreach_leads add constraint outreach_leads_deal_check check (
      (deal_type is null or deal_type in ('percent', 'amount_off', 'custom'))
      and (deal_note is null or char_length(deal_note) <= 200)
      and (deal_value is null or (deal_value >= 0 and deal_value = round(deal_value, 2)))
      -- percent: 0 to 100. Dollars off: up to $10,000 (and capped at the price when used).
      and (deal_type is distinct from 'percent' or (deal_value is not null and deal_value <= 100))
      and (deal_type is distinct from 'amount_off' or (deal_value is not null and deal_value <= 10000))
    );
  end if;
end $$;
create index if not exists outreach_leads_stage on public.outreach_leads (user_id, stage);

-- Backfill the stage from the old status, so current leads land in the right column:
--   new, email_found, drafted -> found;  contacted -> emailed;  replied -> replied.
-- (not_interested keeps its status and stays out of the pipeline, under "Not interested".)
update public.outreach_leads set stage = 'emailed', emailed_at = coalesce(emailed_at, updated_at)
  where status = 'contacted' and stage = 'found';
update public.outreach_leads set stage = 'replied', replied_at = coalesce(replied_at, updated_at)
  where status = 'replied' and stage = 'found';

-- A deal can only point at the owner's own catalog option (a foreign key alone doesn't check
-- whose row it is, and row level security doesn't stop referencing someone else's row by ID).
create or replace function public.outreach_leads_check_deal()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.deal_variant_id is not null and not exists (
    select 1 from public.catalog_variants v where v.id = new.deal_variant_id and v.user_id = new.user_id
  ) then
    raise exception 'Unknown catalog option for this deal.' using errcode = '23503';
  end if;
  return new;
end;
$$;
revoke execute on function public.outreach_leads_check_deal() from public, anon;
drop trigger if exists outreach_leads_check_deal on public.outreach_leads;
create trigger outreach_leads_check_deal before insert or update on public.outreach_leads
  for each row execute function public.outreach_leads_check_deal();

-- ---------- 2. "From a partner?" on money entries ----------
alter table public.transactions add column if not exists partner_lead_id uuid references public.outreach_leads (id) on delete set null;
create index if not exists transactions_partner on public.transactions (user_id, partner_lead_id) where partner_lead_id is not null;

-- The total rule (from catalog.sql), now with partner deals. The DATABASE works out the deal
-- discount from the stored deal; any discount the browser sends with a partner tag is ignored.
-- The partner must be the owner's own lead AND at the deal stage. The total never goes below $0:
-- dollars off is capped at the price, percent is 0 to 100 (see the deal check above).
create or replace function public.transactions_from_parts()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  d record;
  base numeric;
begin
  if new.partner_lead_id is not null then
    select l.user_id, l.stage, l.deal_type, l.deal_value, l.deal_variant_id into d
    from public.outreach_leads l where l.id = new.partner_lead_id;
    if not found or d.user_id <> new.user_id or d.stage <> 'deal' then
      raise exception 'That partner isn''t one of your deals.' using errcode = '23503';
    end if;
    if new.unit_price is not null then
      base := new.unit_price * coalesce(new.quantity, 1);
      if d.deal_variant_id is not null and new.variant_id is distinct from d.deal_variant_id then
        new.discount := 0; -- the deal is for a different option
      elsif d.deal_type = 'percent' then
        new.discount := round(base * least(greatest(coalesce(d.deal_value, 0), 0), 100) / 100, 2);
      elsif d.deal_type = 'amount_off' then
        new.discount := least(greatest(coalesce(d.deal_value, 0), 0) * coalesce(new.quantity, 1), base);
      else
        new.discount := 0; -- custom terms: nothing taken off automatically
      end if;
    end if;
  end if;
  if new.unit_price is not null then
    new.quantity := coalesce(new.quantity, 1);
    -- Never below $0: the discount can't be more than the price.
    new.discount := least(coalesce(new.discount, 0), new.unit_price * new.quantity);
    new.amount := round(new.unit_price * new.quantity - new.discount + coalesce(new.tip, 0), 2);
    if new.amount <= 0 then
      raise exception 'The total has to be more than $0.' using errcode = '23514';
    end if;
  end if;
  if new.item_id is not null and not exists (select 1 from public.catalog_items i where i.id = new.item_id and i.user_id = new.user_id) then
    raise exception 'Unknown item.' using errcode = '23503';
  end if;
  if new.variant_id is not null and not exists (
    select 1 from public.catalog_variants v
    where v.id = new.variant_id and v.user_id = new.user_id and (new.item_id is null or v.item_id = new.item_id)
  ) then
    raise exception 'Unknown variant.' using errcode = '23503';
  end if;
  if new.event_id is not null and not exists (select 1 from public.events e where e.id = new.event_id and e.user_id = new.user_id) then
    raise exception 'Unknown appointment.' using errcode = '23503';
  end if;
  return new;
end;
$$;
revoke execute on function public.transactions_from_parts() from public, anon;
-- (The trigger itself was created by catalog.sql and keeps pointing at this function.)

-- ---------- 3. Weekly matches on Home ----------
-- One run per person per week (map search + 1 Haiku call). The unique key means refreshing or
-- two tabs can never run (or pay for) it twice. Onboarding's 3 picks count as that week's run.
create table if not exists public.match_runs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  week_start    date not null,
  status        text not null default 'pending' check (status in ('pending', 'ready', 'failed')),
  source        text not null default 'weekly' check (source in ('weekly', 'onboarding')),
  category      text check (category is null or char_length(category) <= 40),
  model         text check (model is null or char_length(model) <= 80),
  input_tokens  integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  created_at    timestamptz not null default now(),
  unique (user_id, week_start)
);
revoke all on public.match_runs from anon, authenticated;
grant select, insert on public.match_runs to authenticated;
grant update (status, category, model, input_tokens, output_tokens) on public.match_runs to authenticated;
alter table public.match_runs enable row level security;
drop policy if exists "Read own rows" on public.match_runs;
create policy "Read own rows" on public.match_runs for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Add own rows" on public.match_runs;
create policy "Add own rows" on public.match_runs for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Change own rows" on public.match_runs;
create policy "Change own rows" on public.match_runs for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- The matches themselves: which business, why it fits, the deal idea.
create table if not exists public.partner_matches (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  run_id      uuid not null references public.match_runs (id) on delete cascade,
  lead_id     uuid not null references public.outreach_leads (id) on delete cascade,
  position    integer not null check (position between 0 and 20),
  why         text not null check (char_length(why) between 1 and 400),
  deal_idea   text not null check (char_length(deal_idea) between 1 and 400),
  distance_mi real check (distance_mi is null or distance_mi between 0 and 50),
  created_at  timestamptz not null default now(),
  unique (run_id, lead_id)
);
create index if not exists partner_matches_run on public.partner_matches (run_id, position);
revoke all on public.partner_matches from anon, authenticated;
grant select, insert, delete on public.partner_matches to authenticated;
alter table public.partner_matches enable row level security;
drop policy if exists "Read own rows" on public.partner_matches;
create policy "Read own rows" on public.partner_matches for select to authenticated using ((select auth.uid()) = user_id);
-- A match can only point at your own run and your own lead.
drop policy if exists "Add own rows" on public.partner_matches;
create policy "Add own rows" on public.partner_matches for insert to authenticated with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.match_runs r where r.id = run_id and r.user_id = (select auth.uid()))
  and exists (select 1 from public.outreach_leads l where l.id = lead_id and l.user_id = (select auth.uid()))
);
drop policy if exists "Delete own rows" on public.partner_matches;
create policy "Delete own rows" on public.partner_matches for delete to authenticated using ((select auth.uid()) = user_id);
