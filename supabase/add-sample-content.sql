-- Adds the "show sample content" switch used by "Load demo data" on /settings.
-- Paste into Supabase: SQL Editor > New query > Run. Safe to run more than once.
alter table public.businesses add column if not exists show_samples boolean not null default false;
