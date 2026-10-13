-- Outreach: find local businesses (OpenStreetMap), find their public email, draft an email the
-- owner copies and sends themselves. Run AFTER week.sql. Paste into Supabase: SQL Editor > New
-- query > Run. Safe to run more than once.
--
-- Every table: row level security on, owner-only. Anonymous visitors get nothing.
--   outreach_leads    : read, add, change and delete your own.
--   outreach_towns    : read and add your own (town lookup cache, per person).
--   outreach_searches : read and add your own; never change or delete (search cache + daily cap).
--   outreach_lookups  : read and add your own; never change or delete (email lookup daily cap).
--   tavily_calls      : read your own; nobody adds rows directly (only claim_tavily_search()).
--   nominatim_clock   : nobody can touch it directly (only claim_nominatim_slot()).
-- Outreach email drafts are logged in draft_runs (week.sql) as 'outreach_email'.
-- Same trade-off as chat (see CLAUDE.md "Before public launch").

-- ---------- Leads ----------
create table if not exists public.outreach_leads (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  source         text not null default 'osm' check (source in ('osm', 'manual')),
  osm_type       text check (osm_type is null or osm_type in ('node', 'way', 'relation')),
  osm_id         bigint,
  area_id        bigint,
  town           text check (town is null or char_length(town) <= 120),
  category       text not null check (char_length(category) between 1 and 40),
  name           text not null check (char_length(btrim(name)) between 1 and 200),
  address        text check (address is null or char_length(address) <= 300),
  website        text check (website is null or char_length(website) <= 500),
  phone          text check (phone is null or char_length(phone) <= 60),
  email          text check (email is null or char_length(email) <= 254),
  -- Where the email was found (a page address, "openstreetmap", or "added by you")
  email_source   text check (email_source is null or char_length(email_source) <= 500),
  contact_page   text check (contact_page is null or char_length(contact_page) <= 500),
  instagram      text check (instagram is null or char_length(instagram) <= 500),
  facebook       text check (facebook is null or char_length(facebook) <= 500),
  -- Tagged as a chain on the map (brand); hidden when "Hide chains" is on
  chain          boolean not null default false,
  status         text not null default 'new' check (status in ('new', 'email_found', 'drafted', 'contacted', 'replied', 'not_interested')),
  note           text check (note is null or char_length(note) <= 500),
  draft_subject  text check (draft_subject is null or char_length(draft_subject) <= 200),
  draft_body     text check (draft_body is null or char_length(draft_body) <= 3000),
  email_checked_at timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- One lead per map place per person (manual leads have no map id)
  unique (user_id, osm_type, osm_id)
);
create index if not exists outreach_leads_user on public.outreach_leads (user_id, area_id, category);

revoke all on public.outreach_leads from anon, authenticated;
grant select, insert, update, delete on public.outreach_leads to authenticated;
alter table public.outreach_leads enable row level security;

drop policy if exists "Read own rows" on public.outreach_leads;
create policy "Read own rows" on public.outreach_leads for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Add own rows" on public.outreach_leads;
create policy "Add own rows" on public.outreach_leads for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Change own rows" on public.outreach_leads;
create policy "Change own rows" on public.outreach_leads for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Delete own rows" on public.outreach_leads;
create policy "Delete own rows" on public.outreach_leads for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------- Town lookups (per person cache) ----------
create table if not exists public.outreach_towns (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  query_key    text not null check (char_length(query_key) between 1 and 200),
  relation_id  bigint not null,
  display_name text check (display_name is null or char_length(display_name) <= 300),
  created_at   timestamptz not null default now(),
  unique (user_id, query_key)
);
revoke all on public.outreach_towns from anon, authenticated;
grant select, insert on public.outreach_towns to authenticated;
alter table public.outreach_towns enable row level security;
drop policy if exists "Read own rows" on public.outreach_towns;
create policy "Read own rows" on public.outreach_towns for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Add own rows" on public.outreach_towns;
create policy "Add own rows" on public.outreach_towns for insert to authenticated with check ((select auth.uid()) = user_id);

-- ---------- Map searches (cache marker + 20 a day) ----------
create table if not exists public.outreach_searches (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  area_id      bigint not null,
  category     text not null,
  hide_chains  boolean not null,
  result_count integer not null default 0 check (result_count >= 0),
  created_at   timestamptz not null default now()
);
create index if not exists outreach_searches_user on public.outreach_searches (user_id, created_at desc);
revoke all on public.outreach_searches from anon, authenticated;
grant select, insert on public.outreach_searches to authenticated;
alter table public.outreach_searches enable row level security;
drop policy if exists "Read own rows" on public.outreach_searches;
create policy "Read own rows" on public.outreach_searches for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Add own rows" on public.outreach_searches;
create policy "Add own rows" on public.outreach_searches for insert to authenticated with check ((select auth.uid()) = user_id);

-- ---------- Email lookups (25 a day) ----------
create table if not exists public.outreach_lookups (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  lead_id       uuid references public.outreach_leads (id) on delete set null,
  used_tavily   boolean not null default false,
  pages_fetched integer not null default 0 check (pages_fetched between 0 and 10),
  found         boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists outreach_lookups_user on public.outreach_lookups (user_id, created_at desc);
revoke all on public.outreach_lookups from anon, authenticated;
grant select, insert on public.outreach_lookups to authenticated;
alter table public.outreach_lookups enable row level security;
drop policy if exists "Read own rows" on public.outreach_lookups;
create policy "Read own rows" on public.outreach_lookups for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Add own rows" on public.outreach_lookups;
create policy "Add own rows" on public.outreach_lookups for insert to authenticated with check ((select auth.uid()) = user_id);

-- ---------- Tavily: global monthly guard (900 for everyone) ----------
create table if not exists public.tavily_calls (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists tavily_calls_time on public.tavily_calls (created_at);
revoke all on public.tavily_calls from anon, authenticated;
grant select on public.tavily_calls to authenticated;   -- own rows only (policy below); no insert
alter table public.tavily_calls enable row level security;
drop policy if exists "Read own rows" on public.tavily_calls;
create policy "Read own rows" on public.tavily_calls for select to authenticated using ((select auth.uid()) = user_id);

-- Returns true and records one call if this month (UTC) has fewer than 900 Tavily calls across
-- ALL users and this person made fewer than 25 in the last 24 hours. Otherwise false.
-- Runs with the owner's rights so it can count everyone's calls; a lock stops two requests from
-- both slipping past 900 at the same moment.
create or replace function public.claim_tavily_search()
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    return false;
  end if;
  perform pg_advisory_xact_lock(hashtext('public.tavily_calls'));
  if (select count(*) from public.tavily_calls
      where created_at >= (date_trunc('month', now() at time zone 'utc') at time zone 'utc')) >= 900 then
    return false;
  end if;
  if (select count(*) from public.tavily_calls
      where user_id = me and created_at > now() - interval '1 day') >= 25 then
    return false;
  end if;
  insert into public.tavily_calls (user_id) values (me);
  return true;
end;
$$;
revoke execute on function public.claim_tavily_search() from public, anon;
grant execute on function public.claim_tavily_search() to authenticated;

-- ---------- Nominatim: at most 1 town lookup per second for the whole app ----------
create table if not exists public.nominatim_clock (
  id        integer primary key check (id = 1),
  last_call timestamptz not null default 'epoch'
);
insert into public.nominatim_clock (id) values (1) on conflict (id) do nothing;
revoke all on public.nominatim_clock from anon, authenticated;
alter table public.nominatim_clock enable row level security;   -- no policies: nobody touches it directly

-- Waits until at least 1 second has passed since the last lookup (across every server), then
-- records this one. The row lock makes callers take turns.
create or replace function public.claim_nominatim_slot()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  last timestamptz;
  wait double precision;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  select last_call into last from public.nominatim_clock where id = 1 for update;
  wait := 1.0 - extract(epoch from (clock_timestamp() - last));
  if wait > 0 then
    perform pg_sleep(least(wait, 1.0));
  end if;
  update public.nominatim_clock set last_call = clock_timestamp() where id = 1;
end;
$$;
revoke execute on function public.claim_nominatim_slot() from public, anon;
grant execute on function public.claim_nominatim_slot() to authenticated;
