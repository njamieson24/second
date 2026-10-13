-- Test for the 900-a-month Tavily guard. It changes NOTHING.
-- Run AFTER outreach.sql. Paste into Supabase: SQL Editor > New query > Run.
-- You need at least one account (any login).
--
-- The results come back as an "error" message on purpose: ending with an error makes Postgres
-- undo every change this test made. Look for: "TEST RESULTS (nothing was saved): 1 PASS, 2 PASS, 3 PASS".

do $$
declare
  someone uuid := (select id from auth.users order by created_at limit 1);
  other   uuid := (select id from auth.users order by created_at desc limit 1);
  month_start timestamptz := (date_trunc('month', now() at time zone 'utc') at time zone 'utc');
  used    integer;
  r1 boolean; r2 boolean; r3 boolean;
begin
  if someone is null then
    raise exception 'Make one account first, then run this test.';
  end if;
  -- Act as a signed-in user, the way the app calls the guard.
  perform set_config('request.jwt.claims', json_build_object('sub', someone, 'role', 'authenticated')::text, true);

  -- 1. Under the limit: the guard says yes (and records one call).
  r1 := public.claim_tavily_search();

  -- 2. Fill this month up to 900 calls in total (dated a couple of days back, so the 25-a-day
  --    per-person cap isn't what stops it). Then the guard must say no.
  used := (select count(*) from public.tavily_calls where created_at >= month_start);
  insert into public.tavily_calls (user_id, created_at)
  select other, greatest(month_start, now() - interval '2 days')
  from generate_series(1, greatest(0, 900 - used));
  r2 := public.claim_tavily_search();

  -- 3. No extra call was recorded past 900.
  r3 := (select count(*) from public.tavily_calls where created_at >= month_start) = 900;

  raise exception 'TEST RESULTS (nothing was saved): 1 %, 2 %, 3 %',
    case when r1 then 'PASS' else 'FAIL (under 900 should be allowed)' end,
    case when not r2 then 'PASS' else 'FAIL (900 should be refused)' end,
    case when r3 then 'PASS' else 'FAIL (a call was recorded past 900)' end;
end $$;
