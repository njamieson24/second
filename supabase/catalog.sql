-- The catalog: what each business sells (services, menu items or products), each with one or
-- more variants (30/60/90 min, small/large) and a price. The one source of truth for prices:
-- businesses.services is left in place but nothing writes to it anymore.
--
-- Money entries can now come from the catalog (item + variant + quantity, tip, discount) and
-- from a calendar appointment ("Got paid"). The database works out the total, never trusting a
-- total sent by the browser.
--
-- Run AFTER schema.sql, calendar.sql and week.sql. Paste into Supabase: SQL Editor > New query >
-- Run. Safe to run more than once (it never makes duplicate items).

-- ---------- Catalog items ----------
create table if not exists public.catalog_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 80),
  kind        text not null default 'service' check (kind in ('service', 'menu_item', 'product')),
  -- Deleting hides it (active = false), so past money entries still show what they were.
  active      boolean not null default true,
  position    integer not null default 0 check (position between 0 and 1000),
  -- Where it came from, so the move from businesses.services never runs twice
  source_key  text check (source_key is null or char_length(source_key) <= 120),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists catalog_items_source on public.catalog_items (user_id, source_key) where source_key is not null;
create index if not exists catalog_items_user on public.catalog_items (user_id, position);

-- ---------- Variants (every item has at least one; one price = one default variant) ----------
create table if not exists public.catalog_variants (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id     uuid not null references public.catalog_items (id) on delete cascade,
  -- "60 min", "Large". Empty for the single default variant of a one-price item.
  label       text not null default '' check (char_length(label) <= 40),
  minutes     integer check (minutes is null or minutes between 1 and 1440),
  -- $0 is allowed (free consults). Max $10,000, at most 2 decimals.
  -- Plain numeric (not numeric(10,2)), so 9.999 is REJECTED by the check instead of quietly rounded.
  price       numeric not null check (price >= 0 and price <= 10000 and price = round(price, 2)),
  is_default  boolean not null default false,
  active      boolean not null default true,
  position    integer not null default 0 check (position between 0 and 100),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (item_id, label)
);
create index if not exists catalog_variants_item on public.catalog_variants (item_id, position);

-- If an earlier version of this file made these numeric(10,2)/(12,2) (which quietly rounds
-- 9.999 to 10.00), switch them to plain numeric so the 2-decimal checks reject it instead.
alter table public.catalog_variants alter column price type numeric;

-- ---------- Owner-only access ----------
revoke all on public.catalog_items, public.catalog_variants from anon, authenticated;
grant select, insert, update, delete on public.catalog_items, public.catalog_variants to authenticated;
alter table public.catalog_items enable row level security;
alter table public.catalog_variants enable row level security;

drop policy if exists "Read own rows" on public.catalog_items;
create policy "Read own rows" on public.catalog_items for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Add own rows" on public.catalog_items;
create policy "Add own rows" on public.catalog_items for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Change own rows" on public.catalog_items;
create policy "Change own rows" on public.catalog_items for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Delete own rows" on public.catalog_items;
create policy "Delete own rows" on public.catalog_items for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Read own rows" on public.catalog_variants;
create policy "Read own rows" on public.catalog_variants for select to authenticated using ((select auth.uid()) = user_id);
-- A variant can only belong to one of your own items.
drop policy if exists "Add own rows" on public.catalog_variants;
create policy "Add own rows" on public.catalog_variants for insert to authenticated
  with check ((select auth.uid()) = user_id and exists (select 1 from public.catalog_items i where i.id = item_id and i.user_id = (select auth.uid())));
drop policy if exists "Change own rows" on public.catalog_variants;
create policy "Change own rows" on public.catalog_variants for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and exists (select 1 from public.catalog_items i where i.id = item_id and i.user_id = (select auth.uid())));
drop policy if exists "Delete own rows" on public.catalog_variants;
create policy "Delete own rows" on public.catalog_variants for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------- Money entries from the catalog and the calendar ----------
alter table public.transactions add column if not exists item_id    uuid references public.catalog_items (id) on delete set null;
alter table public.transactions add column if not exists variant_id uuid references public.catalog_variants (id) on delete set null;
alter table public.transactions add column if not exists quantity   integer check (quantity is null or quantity between 1 and 1000);
-- The price used for this entry (a snapshot: changing the catalog never changes past entries)
alter table public.transactions add column if not exists unit_price numeric check (unit_price is null or (unit_price >= 0 and unit_price <= 100000 and unit_price = round(unit_price, 2)));
alter table public.transactions add column if not exists discount   numeric not null default 0 check (discount >= 0 and discount <= 100000 and discount = round(discount, 2));
-- Tips are kept separate: they're income, but not part of the price
alter table public.transactions add column if not exists tip        numeric not null default 0 check (tip >= 0 and tip <= 100000 and tip = round(tip, 2));
-- "Got paid" on a calendar appointment (event_date = which day, for weekly repeats)
alter table public.transactions add column if not exists event_id   uuid references public.events (id) on delete set null;
alter table public.transactions add column if not exists event_date date;
alter table public.transactions alter column unit_price type numeric;
alter table public.transactions alter column discount type numeric;
alter table public.transactions alter column tip type numeric;
-- The same appointment (on the same day) can only be logged once.
create unique index if not exists transactions_event_once on public.transactions (user_id, event_id, event_date) where event_id is not null;

-- Single entries and daily totals up to $100,000, at most 2 decimals.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'transactions_amount_limit') then
    -- not valid: checks new and changed entries only, so an odd old entry can't block this file.
    alter table public.transactions add constraint transactions_amount_limit check (amount <= 100000 and amount = round(amount, 2)) not valid;
  end if;
end $$;

-- The database works out the total from the parts (price x quantity - discount + tip) and
-- checks that the item, variant and appointment are the owner's own.
create or replace function public.transactions_from_parts()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.unit_price is not null then
    new.quantity := coalesce(new.quantity, 1);
    new.amount := round(new.unit_price * new.quantity - coalesce(new.discount, 0) + coalesce(new.tip, 0), 2);
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
drop trigger if exists transactions_from_parts on public.transactions;
create trigger transactions_from_parts before insert or update on public.transactions
  for each row execute function public.transactions_from_parts();

-- ---------- Move businesses.services into the catalog (once; safe to run again) ----------
-- Each service becomes an item with one default variant (still one tap). Food businesses get
-- menu items. Prices are kept as they were (clamped to $0 to $10,000).
insert into public.catalog_items (user_id, name, kind, position, source_key)
select b.user_id,
       left(btrim(s.value ->> 'name'), 80),
       case when b.type = 'food' then 'menu_item' else 'service' end,
       (s.ord - 1)::int,
       'service:' || coalesce(nullif(s.value ->> 'id', ''), lower(btrim(s.value ->> 'name')))
from public.businesses b
cross join lateral jsonb_array_elements(coalesce(b.services, '[]'::jsonb)) with ordinality as s(value, ord)
where char_length(btrim(coalesce(s.value ->> 'name', ''))) between 1 and 80
  and s.ord <= 100
on conflict (user_id, source_key) where source_key is not null do nothing;

insert into public.catalog_variants (user_id, item_id, label, minutes, price, is_default, position)
select i.user_id,
       i.id,
       '',
       case when (s.value ->> 'minutes') ~ '^[0-9]+$' and (s.value ->> 'minutes')::int between 1 and 1440 then (s.value ->> 'minutes')::int end,
       round(least(greatest(coalesce(nullif(s.value ->> 'price', '')::numeric, 0), 0), 10000), 2),
       true,
       0
from public.catalog_items i
join public.businesses b on b.user_id = i.user_id
cross join lateral jsonb_array_elements(coalesce(b.services, '[]'::jsonb)) as s(value)
where i.source_key = 'service:' || coalesce(nullif(s.value ->> 'id', ''), lower(btrim(s.value ->> 'name')))
  and not exists (select 1 from public.catalog_variants v where v.item_id = i.id);
