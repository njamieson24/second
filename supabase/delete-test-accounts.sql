-- Deletes ONLY the test accounts made by the automated test script, and all their data.
-- Test accounts always use addresses like: second-test-1759312345678@example.com
-- Paste into Supabase: SQL Editor > New query > Run.

-- 1. See which accounts will be deleted (run this first if you want to check):
select id, email, created_at
from auth.users
where email like 'second-test-%@example.com'
order by created_at;

-- 2. Delete them. Their businesses, roadmap progress, money plans and money
--    entries are removed automatically too.
delete from auth.users
where email like 'second-test-%@example.com';

-- 3. Delete test beta sign-ups from the /beta page (same kind of address).
delete from public.beta_signups
where email like 'second-test-%@example.com';
