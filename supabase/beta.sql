-- Beta sign-ups from the public page at /beta.
-- Paste into Supabase: SQL Editor > New query > Run. Safe to run more than once.
--
-- Who can do what:
--   - Anonymous visitors can ONLY add a row. They can't read, change, or delete any.
--   - Logged-in app users get no access at all.
--   - You read the list in the dashboard: Table Editor > beta_signups.

create table if not exists public.beta_signups (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  name          text not null check (char_length(btrim(name)) between 1 and 100),
  email         text not null check (
                  char_length(email) <= 254
                  and email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
                ),
  business_name text check (business_name is null or char_length(business_name) <= 120),
  business_type text not null check (business_type in ('massage', 'food', 'fitness', 'beauty', 'home', 'photo', 'other')),
  town          text not null check (char_length(btrim(town)) between 1 and 100),
  stage         text not null check (stage in ('running', 'starting', 'curious'))
);

-- One sign-up per email, ignoring capital letters.
create unique index if not exists beta_signups_email_key on public.beta_signups (lower(email));

-- Start from nothing, then allow exactly one thing: anonymous visitors adding a row.
-- Only these columns can be filled in, so nobody can fake the id or the date.
revoke all on public.beta_signups from anon, authenticated;
grant insert (name, email, business_name, business_type, town, stage) on public.beta_signups to anon;

alter table public.beta_signups enable row level security;

drop policy if exists "Anyone can sign up" on public.beta_signups;
create policy "Anyone can sign up"
  on public.beta_signups
  for insert
  to anon
  with check (true);

-- No select, update, or delete policies on purpose: the list can't be read from the browser.
