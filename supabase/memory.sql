-- Memory for Chat with Second: suggested updates (cards), business notes, and notes passes.
-- Run AFTER supabase/chat.sql. Paste into Supabase: SQL Editor > New query > Run.
-- Safe to run more than once.
--
-- Who can do what (anonymous visitors get nothing on any of these):
--   chat_proposals : read and add your own; change ONLY the status of your own; delete your own (Start over).
--   business_notes : read, add, edit and delete your own (Settings > What Second knows).
--   memory_runs    : read and add your own; never change or delete (it's the daily cap).
-- Same trade-off as chat (see CLAUDE.md "Before public launch"): the server saves AS the
-- person, so a technical person could add fake rows to their OWN account only.

-- ---------- Suggested updates ----------
create table if not exists public.chat_proposals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  message_id  uuid not null references public.chat_messages (id) on delete cascade,
  kind        text not null check (kind in ('set_price', 'add_service', 'remove_service', 'set_pay_goal', 'add_event', 'move_event', 'cancel_event')),
  details     jsonb not null,
  summary     text not null check (char_length(summary) between 1 and 300),
  status      text not null default 'pending' check (status in ('pending', 'approved', 'ignored', 'stale')),
  created_at  timestamptz not null default now(),
  decided_at  timestamptz
);
create index if not exists chat_proposals_user_time on public.chat_proposals (user_id, created_at desc);

revoke all on public.chat_proposals from anon, authenticated;
grant select, insert on public.chat_proposals to authenticated;
grant update (status, decided_at) on public.chat_proposals to authenticated;
alter table public.chat_proposals enable row level security;

drop policy if exists "Read own rows" on public.chat_proposals;
create policy "Read own rows" on public.chat_proposals for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "Add own rows" on public.chat_proposals;
create policy "Add own rows" on public.chat_proposals for insert to authenticated
  with check ((select auth.uid()) = user_id and status = 'pending');
drop policy if exists "Change own rows" on public.chat_proposals;
create policy "Change own rows" on public.chat_proposals for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- "Start over" in Settings deletes the person's own cards (and notes, below). memory_runs is never deleted.
grant delete on public.chat_proposals to authenticated;
drop policy if exists "Delete own rows" on public.chat_proposals;
create policy "Delete own rows" on public.chat_proposals for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------- Business notes ----------
create table if not exists public.business_notes (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  note              text not null check (char_length(btrim(note)) between 1 and 200),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  source_message_id uuid references public.chat_messages (id) on delete set null
);
create index if not exists business_notes_user_time on public.business_notes (user_id, updated_at desc);

revoke all on public.business_notes from anon, authenticated;
grant select, insert, delete on public.business_notes to authenticated;
grant update (note, updated_at) on public.business_notes to authenticated;
alter table public.business_notes enable row level security;

drop policy if exists "Read own rows" on public.business_notes;
create policy "Read own rows" on public.business_notes for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "Add own rows" on public.business_notes;
create policy "Add own rows" on public.business_notes for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists "Change own rows" on public.business_notes;
create policy "Change own rows" on public.business_notes for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists "Delete own rows" on public.business_notes;
create policy "Delete own rows" on public.business_notes for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------- Notes passes (cost log, "last checked" marker, daily cap) ----------
create table if not exists public.memory_runs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at    timestamptz not null default now(),
  covered_until timestamptz not null,
  model         text not null,
  input_tokens  integer not null check (input_tokens >= 0),
  output_tokens integer not null check (output_tokens >= 0),
  notes_changed integer not null default 0 check (notes_changed between 0 and 3)
);
create index if not exists memory_runs_user_time on public.memory_runs (user_id, created_at desc);

revoke all on public.memory_runs from anon, authenticated;
grant select, insert on public.memory_runs to authenticated;
alter table public.memory_runs enable row level security;

drop policy if exists "Read own rows" on public.memory_runs;
create policy "Read own rows" on public.memory_runs for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "Add own rows" on public.memory_runs;
create policy "Add own rows" on public.memory_runs for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- All AI costs per day: chat, notes, weekly plans and drafts (plans and drafts need week.sql).
-- Not part of the setup above:
--
-- select day, kind, model, count(*) as calls, sum(input_tokens) as input_tokens, sum(output_tokens) as output_tokens
-- from (
--   select date_trunc('day', created_at) as day, 'chat' as kind, model, input_tokens, output_tokens
--   from public.chat_messages where role = 'assistant'
--   union all
--   select date_trunc('day', created_at), 'notes', model, input_tokens, output_tokens from public.memory_runs
--   union all
--   select date_trunc('day', created_at), 'plan', model, input_tokens, output_tokens from public.weekly_plans where not fallback
--   union all
--   select date_trunc('day', created_at), 'draft', model, input_tokens, output_tokens from public.draft_runs
-- ) t
-- group by 1, 2, 3
-- order by 1 desc, 2;
