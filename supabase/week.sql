-- "This Week": the weekly game plan, its 3 actions, and "Do it with Second" drafts.
-- Run AFTER chat.sql and memory.sql. Paste into Supabase: SQL Editor > New query > Run.
-- Safe to run more than once.
--
-- Who can do what (anonymous visitors get nothing on any of these):
--   weekly_plans : read and add your own; change only the token counts and status of your own;
--                  never delete (it's the cost log and the redo cap).
--   plan_actions : read, add and delete your own (Start over); change ONLY status, decided time and draft.
--   draft_runs   : read and add your own; never change or delete (cost log and daily draft cap).
-- Same trade-off as chat (see CLAUDE.md "Before public launch").

-- ---------- Who paid: optional client name on money entries ----------
alter table public.transactions add column if not exists client_name text
  check (client_name is null or char_length(btrim(client_name)) between 1 and 80);

-- ---------- Plans: one row per try ----------
create table if not exists public.weekly_plans (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  week_start    date not null,
  mode          text not null check (mode in ('launch', 'running')),
  attempt       integer not null check (attempt between 1 and 20),
  -- true = made by plain code (no AI, no tokens, doesn't use up a try)
  fallback      boolean not null default false,
  status        text not null default 'pending' check (status in ('pending', 'ready')),
  created_at    timestamptz not null default now(),
  model         text,
  input_tokens  integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  -- Two tabs or a fast reload can't make (or pay for) two plans: the second insert fails.
  unique (user_id, week_start, attempt)
);
create index if not exists weekly_plans_user_week on public.weekly_plans (user_id, week_start desc, attempt desc);

revoke all on public.weekly_plans from anon, authenticated;
grant select, insert on public.weekly_plans to authenticated;
grant update (status, model, input_tokens, output_tokens) on public.weekly_plans to authenticated;
alter table public.weekly_plans enable row level security;

drop policy if exists "Read own rows" on public.weekly_plans;
create policy "Read own rows" on public.weekly_plans for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "Add own rows" on public.weekly_plans;
create policy "Add own rows" on public.weekly_plans for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists "Change own rows" on public.weekly_plans;
create policy "Change own rows" on public.weekly_plans for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------- The 3 actions in a plan ----------
create table if not exists public.plan_actions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plan_id      uuid not null references public.weekly_plans (id) on delete cascade,
  position     integer not null check (position between 1 and 3),
  type         text not null check (type in ('post', 'client_message', 'collab_idea', 'roadmap_step', 'money', 'other')),
  title        text not null check (char_length(title) between 1 and 100),
  why          text not null check (char_length(why) between 1 and 200),
  -- client_message only: the client's FIRST name (never contact details)
  client_first_name text check (client_first_name is null or char_length(client_first_name) between 1 and 40),
  draft        text check (draft is null or char_length(draft) <= 3000),
  status       text not null default 'open' check (status in ('open', 'done', 'skipped')),
  decided_at   timestamptz,
  created_at   timestamptz not null default now(),
  unique (plan_id, position)
);
create index if not exists plan_actions_user on public.plan_actions (user_id, created_at desc);

revoke all on public.plan_actions from anon, authenticated;
grant select, insert, delete on public.plan_actions to authenticated;
grant update (status, decided_at, draft) on public.plan_actions to authenticated;
alter table public.plan_actions enable row level security;

drop policy if exists "Read own rows" on public.plan_actions;
create policy "Read own rows" on public.plan_actions for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "Add own rows" on public.plan_actions;
create policy "Add own rows" on public.plan_actions for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists "Change own rows" on public.plan_actions;
create policy "Change own rows" on public.plan_actions for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists "Delete own rows" on public.plan_actions;
create policy "Delete own rows" on public.plan_actions for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------- Drafts made: cost log and daily cap ----------
create table if not exists public.draft_runs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  action_type   text not null,
  created_at    timestamptz not null default now(),
  model         text not null,
  input_tokens  integer not null check (input_tokens >= 0),
  output_tokens integer not null check (output_tokens >= 0)
);
create index if not exists draft_runs_user_time on public.draft_runs (user_id, created_at desc);

revoke all on public.draft_runs from anon, authenticated;
grant select, insert on public.draft_runs to authenticated;
alter table public.draft_runs enable row level security;

drop policy if exists "Read own rows" on public.draft_runs;
create policy "Read own rows" on public.draft_runs for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "Add own rows" on public.draft_runs;
create policy "Add own rows" on public.draft_runs for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- All AI costs per day: chat, notes, weekly plans, drafts and captions, content ideas (needs content.sql).
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
--   select date_trunc('day', created_at), case when action_type = 'caption' then 'caption' else 'draft' end, model, input_tokens, output_tokens from public.draft_runs
--   union all
--   select date_trunc('day', created_at), 'content ideas', model, input_tokens, output_tokens from public.content_weeks where not fallback
-- ) t
-- group by 1, 2, 3
-- order by 1 desc, 2;
