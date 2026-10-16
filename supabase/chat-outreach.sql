-- Chat with Second can find local businesses (the same map search as Outreach) and show its
-- picks as cards. Run AFTER outreach.sql and memory.sql. Paste into Supabase: SQL Editor >
-- New query > Run. Safe to run more than once.

-- Businesses found in chat are saved as leads (that's the 30-day cache), but they only show in
-- the owner's Outreach list after they tap "Save to Outreach". Everything saved before this
-- stays in the list (default true).
alter table public.outreach_leads add column if not exists saved boolean not null default true;

-- Second's picks in chat: which business, why, the deal idea, and the next step.
-- Written by the server AS the owner, read by the owner. Deleted with the lead (Start over).
create table if not exists public.chat_business_cards (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  message_id  uuid not null,
  lead_id     uuid not null references public.outreach_leads (id) on delete cascade,
  why         text not null check (char_length(why) between 1 and 400),
  deal_idea   text not null check (char_length(deal_idea) between 1 and 400),
  next_step   text not null check (char_length(next_step) between 1 and 200),
  distance_mi real check (distance_mi is null or distance_mi between 0 and 50),
  created_at  timestamptz not null default now()
);
create index if not exists chat_business_cards_user on public.chat_business_cards (user_id, created_at desc);
create index if not exists chat_business_cards_message on public.chat_business_cards (message_id);

revoke all on public.chat_business_cards from anon, authenticated;
grant select, insert on public.chat_business_cards to authenticated;
alter table public.chat_business_cards enable row level security;
drop policy if exists "Read own rows" on public.chat_business_cards;
create policy "Read own rows" on public.chat_business_cards for select to authenticated using ((select auth.uid()) = user_id);
-- A card may only point at one of your own leads.
drop policy if exists "Add own rows" on public.chat_business_cards;
create policy "Add own rows" on public.chat_business_cards for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.outreach_leads l where l.id = lead_id and l.user_id = (select auth.uid()))
  );
