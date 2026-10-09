-- Content page: weekly post ideas, captions, branded templates and the content calendar.
-- Run AFTER week.sql. Paste into Supabase: SQL Editor > New query > Run. Safe to run more than once.
--
-- Who can do what (anonymous visitors get nothing on any of these):
--   content_weeks : read and add your own; change only status and token counts; never delete
--                   (it's the cost log and the "New ideas" cap).
--   content_posts : read, add and delete your own (Start over); change only the day, status,
--                   caption, template fields and posted date.
--   Captions are logged in draft_runs (week.sql) with action_type 'caption', so they share the
--   daily draft limit.
-- Same trade-off as chat (see CLAUDE.md "Before public launch").

-- ---------- Brand and tone (the owner's own colors for their posts) ----------
alter table public.businesses add column if not exists brand_primary text
  check (brand_primary is null or brand_primary ~ '^#[0-9a-fA-F]{6}$');
alter table public.businesses add column if not exists brand_accent text
  check (brand_accent is null or brand_accent ~ '^#[0-9a-fA-F]{6}$');
alter table public.businesses add column if not exists content_tone text not null default 'warm'
  check (content_tone in ('warm', 'fun', 'professional'));

-- ---------- Idea batches: one row per try ----------
create table if not exists public.content_weeks (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  week_start    date not null,
  mode          text not null check (mode in ('launch', 'running')),
  attempt       integer not null check (attempt between 1 and 20),
  fallback      boolean not null default false,
  status        text not null default 'pending' check (status in ('pending', 'ready')),
  created_at    timestamptz not null default now(),
  model         text,
  input_tokens  integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  unique (user_id, week_start, attempt)
);
create index if not exists content_weeks_user_week on public.content_weeks (user_id, week_start desc, attempt desc);

revoke all on public.content_weeks from anon, authenticated;
grant select, insert on public.content_weeks to authenticated;
grant update (status, model, input_tokens, output_tokens) on public.content_weeks to authenticated;
alter table public.content_weeks enable row level security;

drop policy if exists "Read own rows" on public.content_weeks;
create policy "Read own rows" on public.content_weeks for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "Add own rows" on public.content_weeks;
create policy "Add own rows" on public.content_weeks for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists "Change own rows" on public.content_weeks;
create policy "Change own rows" on public.content_weeks for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------- Ideas, captions and posts ----------
create table if not exists public.content_posts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  batch_id       uuid references public.content_weeks (id) on delete set null,
  week_start     date not null,
  position       integer not null default 0,
  type           text not null check (type in ('promo', 'tip', 'behind_the_scenes', 'client_love', 'slow_day', 'launch_countdown', 'other')),
  title          text not null check (char_length(title) between 1 and 100),
  why            text not null check (char_length(why) between 1 and 200),
  -- 'ai' = from an idea batch, 'this_week' = the post action from This Week, 'fallback' = plain code
  source         text not null default 'ai' check (source in ('ai', 'this_week', 'fallback')),
  plan_action_id uuid references public.plan_actions (id) on delete set null,
  day            date not null,
  status         text not null default 'idea' check (status in ('idea', 'drafted', 'ready', 'posted')),
  caption        text check (caption is null or char_length(caption) <= 3000),
  template       text,
  template_size  text check (template_size is null or template_size in ('square', 'story')),
  -- { "headline": "...", "line": "...", ... } shown on the template; the owner can edit it
  template_text  jsonb,
  posted_at      timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists content_posts_user_day on public.content_posts (user_id, day);

revoke all on public.content_posts from anon, authenticated;
grant select, insert, delete on public.content_posts to authenticated;
grant update (day, status, caption, template, template_size, template_text, posted_at) on public.content_posts to authenticated;
alter table public.content_posts enable row level security;

drop policy if exists "Read own rows" on public.content_posts;
create policy "Read own rows" on public.content_posts for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "Add own rows" on public.content_posts;
create policy "Add own rows" on public.content_posts for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists "Change own rows" on public.content_posts;
create policy "Change own rows" on public.content_posts for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists "Delete own rows" on public.content_posts;
create policy "Delete own rows" on public.content_posts for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- All AI costs per day: chat, notes, weekly plans, drafts and captions, content ideas.
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
