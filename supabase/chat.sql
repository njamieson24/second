-- Chat with Second: saved messages and token use.
-- Paste into Supabase: SQL Editor > New query > Run. Safe to run more than once.
--
-- Who can do what:
--   - Logged-in people can READ and ADD only their own messages.
--   - Nobody can change or delete messages from the app (so the daily limit can't be reset).
--   - Anonymous visitors get no access.
-- Known trade-off (see CLAUDE.md "Before public launch"): the server saves AS the person,
-- so a technical person could add fake rows to their OWN history. They can't see anyone
-- else's messages or get around their daily limit.

create table if not exists public.chat_messages (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  role          text not null check (role in ('user', 'assistant')),
  content       text not null check (char_length(content) between 1 and 20000),
  created_at    timestamptz not null default now(),
  -- Filled in on Second's replies, so you can see what each one cost:
  model         text,
  input_tokens  integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  cache_read_tokens  integer check (cache_read_tokens is null or cache_read_tokens >= 0),
  cache_write_tokens integer check (cache_write_tokens is null or cache_write_tokens >= 0),
  stop_reason   text
);

create index if not exists chat_messages_user_time on public.chat_messages (user_id, created_at desc);

revoke all on public.chat_messages from anon, authenticated;
grant select, insert on public.chat_messages to authenticated;

alter table public.chat_messages enable row level security;

drop policy if exists "Read own rows" on public.chat_messages;
create policy "Read own rows"
  on public.chat_messages for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Add own rows" on public.chat_messages;
create policy "Add own rows"
  on public.chat_messages for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- No update or delete policies on purpose.

-- ---------------------------------------------------------------------------
-- To see what chat is costing you, run this (not part of the setup above):
--
-- select date_trunc('day', created_at) as day,
--        model,
--        count(*)            as replies,
--        sum(input_tokens)   as input_tokens,
--        sum(output_tokens)  as output_tokens
-- from public.chat_messages
-- where role = 'assistant'
-- group by 1, 2
-- order by 1 desc;
