-- Second: calendar events (plus the "show sample content" switch).
-- Paste all of this into Supabase: SQL Editor > New query > Run.
-- Safe to run more than once.

-- From the "remove placeholder data" update. Does nothing if it's already there.
alter table public.businesses add column if not exists show_samples boolean not null default false;

-- ---------- Calendar events ----------
-- Timed events store exact moments (starts_at / ends_at, with time zone).
-- All-day events store plain dates (start_date / end_date) so they never slide a day.
create table if not exists public.events (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title           text not null check (char_length(title) between 1 and 200),
  type            text not null check (type in ('appointment', 'business', 'deadline', 'reminder')),
  all_day         boolean not null default false,
  starts_at       timestamptz,
  ends_at         timestamptz,
  start_date      date,
  end_date        date,
  -- Where it was made, like 'America/New_York', so weekly repeats keep the same local time
  time_zone       text not null default 'UTC',
  client_name     text,
  price           numeric(12, 2) check (price is null or price >= 0),
  location        text,
  notes           text,
  repeats_weekly  boolean not null default false,
  -- Last day a weekly repeat happens (inclusive). Empty = keeps going.
  repeat_until    date,
  source          text not null default 'manual' check (source in ('manual', 'roadmap', 'second')),
  roadmap_task_id text,
  created_at      timestamptz not null default now(),
  constraint events_has_time check (
    (all_day and start_date is not null and end_date is not null and end_date >= start_date)
    or (not all_day and starts_at is not null and ends_at is not null and ends_at >= starts_at)
  )
);
create index if not exists events_user_starts on public.events (user_id, starts_at);
create index if not exists events_user_start_date on public.events (user_id, start_date);

-- Only signed-in people, never anonymous visitors.
revoke all on public.events from anon;
grant select, insert, update, delete on public.events to authenticated;

-- Row level security: each person sees only their own events.
alter table public.events enable row level security;
drop policy if exists "Read own rows" on public.events;
drop policy if exists "Add own rows" on public.events;
drop policy if exists "Change own rows" on public.events;
drop policy if exists "Delete own rows" on public.events;
create policy "Read own rows" on public.events for select to authenticated using ((select auth.uid()) = user_id);
create policy "Add own rows" on public.events for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Change own rows" on public.events for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Delete own rows" on public.events for delete to authenticated using ((select auth.uid()) = user_id);
