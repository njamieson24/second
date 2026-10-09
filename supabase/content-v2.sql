-- Content page v2: each idea is a short creative brief (format, shots to take, hook).
-- Run AFTER content.sql. Paste into Supabase: SQL Editor > New query > Run. Safe to run more than once.
--
-- Row level security is unchanged (the policies in content.sql cover these columns).
-- The server adds format, shots and hook as the owner when it makes a batch of ideas.
-- Owners can edit the hook (checked by the server before saving); shots and format stay read-only.
-- The old template columns (template, template_size, template_text) and the brand columns on
-- businesses (brand_primary, brand_accent) are left in place, unused.

alter table public.content_posts add column if not exists format text
  check (format is null or format in ('photo', 'carousel', 'reel'));
alter table public.content_posts add column if not exists shots jsonb
  check (shots is null or (jsonb_typeof(shots) = 'array' and jsonb_array_length(shots) between 1 and 3));
alter table public.content_posts add column if not exists hook text
  check (hook is null or char_length(hook) between 1 and 150);

-- Owners can change: the day, status, caption, posted date (as before) and now the hook.
grant update (hook) on public.content_posts to authenticated;
