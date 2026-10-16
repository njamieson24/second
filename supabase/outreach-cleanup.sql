-- One-time cleanup: the Outreach page now only lists businesses saved from Chat with Second.
-- Before that, every map search on the Outreach page put all its results in the list. This takes
-- those untouched search results OUT of the list (saved = false). Nothing is deleted: they stay
-- as the 30-day search cache, and chat can still find and show them.
--
-- Kept in the list: anything the owner touched or chose:
--   saved from a chat card, added by hand, has a note or a draft, a status they changed
--   (Drafted, Contacted, Replied, Not interested), or an email they looked up.
--
-- Run AFTER chat-outreach.sql. Paste into Supabase: SQL Editor > New query > Run.
-- Safe to run more than once.

update public.outreach_leads l
set saved = false
where l.saved = true
  and l.source = 'osm'
  and l.status in ('new', 'email_found')
  and l.note is null
  and l.draft_body is null
  -- an email the map already had doesn't count as touched; one they looked up does
  and (l.email is null or l.email_source = 'openstreetmap')
  and not exists (select 1 from public.chat_business_cards c where c.lead_id = l.id)
  and not exists (select 1 from public.outreach_lookups k where k.lead_id = l.id);
