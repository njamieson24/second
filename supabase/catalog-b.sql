-- Part B: logging money from chat ("Log income" cards) and "Find prices Second already knows".
-- Run AFTER catalog.sql and memory.sql. Paste into Supabase: SQL Editor > New query > Run.
-- Safe to run more than once.

-- Chat cards can now also be "Log income" (saved only when the owner taps Approve).
-- The old rule had no name of its own, so find it by what it checks and drop it.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.chat_proposals'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%kind%'
  loop
    raise notice 'Dropped the old card-type rule: %', c.conname;
    execute format('alter table public.chat_proposals drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.chat_proposals add constraint chat_proposals_kind_check
  check (kind in ('set_price', 'add_service', 'remove_service', 'set_pay_goal', 'add_event', 'move_event', 'cancel_event', 'log_income'));

-- "Find prices Second already knows": one row per run (Haiku). The daily cap counts these.
-- Read and add your own; never change or delete (same as memory_runs / draft_runs).
create table if not exists public.catalog_runs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  model         text not null check (char_length(model) <= 80),
  input_tokens  integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  -- How many draft lines Second offered, and how many the server dropped
  offered       integer not null default 0 check (offered between 0 and 200),
  dropped       integer not null default 0 check (dropped between 0 and 200),
  created_at    timestamptz not null default now()
);
create index if not exists catalog_runs_user on public.catalog_runs (user_id, created_at desc);
revoke all on public.catalog_runs from anon, authenticated;
grant select, insert on public.catalog_runs to authenticated;
alter table public.catalog_runs enable row level security;
drop policy if exists "Read own rows" on public.catalog_runs;
create policy "Read own rows" on public.catalog_runs for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Add own rows" on public.catalog_runs;
create policy "Add own rows" on public.catalog_runs for insert to authenticated with check ((select auth.uid()) = user_id);
