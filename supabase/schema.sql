-- Second: database tables for accounts.
-- Paste all of this into Supabase: SQL Editor > New query > Run.
-- Safe to run more than once.
-- The calendar (events table) is in calendar.sql. Run both on a new project.
--
-- Every table has row level security (RLS) on, with rules that let a signed-in
-- person see and change ONLY their own rows. Deleting a user deletes their data.

-- ---------- Business profile (one row per person) ----------
create table if not exists public.businesses (
  user_id       uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  mode          text check (mode in ('launch', 'running')),
  -- Profile fields stay empty until setup is finished
  owner_name    text,
  business_name text not null default '',
  type          text,
  type_label    text,
  area          text,
  services      jsonb not null default '[]'::jsonb,
  pay_goal      numeric(12, 2) not null default 0 check (pay_goal >= 0),
  goal_note     text,
  opening_day   date,
  launched_at   timestamptz,
  -- Turned on only by "Load demo data" (screenshots and videos)
  show_samples  boolean not null default false,
  created_at    timestamptz not null default now()
);
alter table public.businesses add column if not exists show_samples boolean not null default false;

-- ---------- Roadmap progress (one row per finished task) ----------
create table if not exists public.roadmap_tasks (
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  task_id      text not null,
  completed_at timestamptz not null default now(),
  primary key (user_id, task_id)
);

-- ---------- Money plan (one row per person) ----------
create table if not exists public.money_plans (
  user_id       uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  monthly_costs jsonb not null default '[]'::jsonb,
  startup_costs jsonb not null default '[]'::jsonb,
  saved         numeric(12, 2) not null default 0 check (saved >= 0)
);

-- ---------- Money in and out ----------
create table if not exists public.transactions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date       date not null,
  kind       text not null check (kind in ('income', 'expense')),
  amount     numeric(12, 2) not null check (amount > 0),
  label      text not null,
  category   text not null,
  created_at timestamptz not null default now()
);
create index if not exists transactions_user_date on public.transactions (user_id, date);

-- ---------- Who can touch these tables ----------
-- Only signed-in people, never anonymous visitors.
revoke all on public.businesses, public.roadmap_tasks, public.money_plans, public.transactions from anon;
grant select, insert, update, delete
  on public.businesses, public.roadmap_tasks, public.money_plans, public.transactions
  to authenticated;

-- ---------- Row level security: each person sees only their own rows ----------
do $$
declare
  t text;
begin
  foreach t in array array['businesses', 'roadmap_tasks', 'money_plans', 'transactions'] loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists "Read own rows" on public.%I', t);
    execute format('drop policy if exists "Add own rows" on public.%I', t);
    execute format('drop policy if exists "Change own rows" on public.%I', t);
    execute format('drop policy if exists "Delete own rows" on public.%I', t);

    execute format(
      'create policy "Read own rows" on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t);
    execute format(
      'create policy "Add own rows" on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t);
    execute format(
      'create policy "Change own rows" on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format(
      'create policy "Delete own rows" on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t);
  end loop;
end $$;
