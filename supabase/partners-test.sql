-- Test for partners.sql. It changes NOTHING: it ends with an error on purpose, which undoes
-- every change it made. Run AFTER partners.sql. Paste into Supabase: SQL Editor > New query > Run.
-- You need at least two accounts (any logins). Look for:
-- "PARTNERS TEST (nothing was saved): 1 PASS, 2 PASS, ... 10 PASS"

do $$
declare
  u  uuid := (select id from auth.users order by created_at limit 1);
  u2 uuid := (select id from auth.users order by created_at offset 1 limit 1);
  it uuid; v uuid; v_other uuid; it2 uuid; v2 uuid;
  deal_lead uuid; replied_lead uuid; other_lead uuid; amt numeric; disc numeric;
  run uuid;
  r1 text := 'FAIL'; r2 text := 'FAIL'; r3 text := 'FAIL'; r4 text := 'FAIL'; r5 text := 'FAIL';
  r6 text := 'FAIL'; r7 text := 'FAIL'; r8 text := 'FAIL'; r9 text := 'FAIL'; r10 text := 'FAIL';
begin
  if u is null or u2 is null then
    raise exception 'Make two accounts first, then run this test.';
  end if;

  -- Test catalog: an item with a $100 option and a $40 option; the other account has its own.
  insert into public.catalog_items (user_id, name) values (u, 'Partners test massage') returning id into it;
  insert into public.catalog_variants (user_id, item_id, label, price, is_default) values (u, it, '60 min', 100, true) returning id into v;
  insert into public.catalog_variants (user_id, item_id, label, price) values (u, it, '30 min', 40) returning id into v_other;
  insert into public.catalog_items (user_id, name) values (u2, 'Partners test other') returning id into it2;
  insert into public.catalog_variants (user_id, item_id, label, price, is_default) values (u2, it2, '', 50, true) returning id into v2;

  -- Businesses: one at deal (15% off), one only at replied, one belonging to the other account.
  insert into public.outreach_leads (user_id, category, name, stage, saved, deal_type, deal_value)
  values (u, 'gyms', 'Partners test gym', 'deal', true, 'percent', 15) returning id into deal_lead;
  insert into public.outreach_leads (user_id, category, name, stage, saved) values (u, 'gyms', 'Partners test studio', 'replied', true) returning id into replied_lead;
  insert into public.outreach_leads (user_id, category, name, stage, saved, deal_type, deal_value)
  values (u2, 'gyms', 'Partners test not yours', 'deal', true, 'percent', 50) returning id into other_lead;

  -- 1. From a partner at the deal stage: the database takes 15% off $100 = $85 (+ $10 tip = $95),
  --    ignoring the amount and discount the browser sent.
  insert into public.transactions (user_id, date, kind, amount, label, category, item_id, variant_id, quantity, unit_price, discount, tip, partner_lead_id)
  values (u, current_date, 'income', 1, 'x', 'Session', it, v, 1, 100, 99, 10, deal_lead) returning amount, discount into amt, disc;
  if amt = 95 and disc = 15 then r1 := 'PASS'; else r1 := 'FAIL (' || amt || ')'; end if;

  -- 2. Another account's partner is rejected (even though it's at the deal stage).
  begin
    insert into public.transactions (user_id, date, kind, amount, label, category, item_id, variant_id, unit_price, partner_lead_id)
    values (u, current_date, 'income', 1, 'x', 'Session', it, v, 100, other_lead);
  exception when foreign_key_violation then r2 := 'PASS';
  end;

  -- 3. A partner that isn't at the deal stage yet is rejected.
  begin
    insert into public.transactions (user_id, date, kind, amount, label, category, item_id, variant_id, unit_price, partner_lead_id)
    values (u, current_date, 'income', 1, 'x', 'Session', it, v, 100, replied_lead);
  exception when foreign_key_violation then r3 := 'PASS';
  end;

  -- 4. A deal can't point at another account's catalog option.
  begin
    update public.outreach_leads set deal_variant_id = v2 where id = deal_lead;
  exception when others then r4 := 'PASS';
  end;

  -- 5. Percent over 100 is rejected.
  begin
    update public.outreach_leads set deal_type = 'percent', deal_value = 150 where id = deal_lead;
  exception when check_violation then r5 := 'PASS';
  end;

  -- 6. $ off bigger than the price is capped: $60 off a $40 option → discount $40, total = the $5 tip.
  update public.outreach_leads set deal_type = 'amount_off', deal_value = 60, deal_variant_id = null where id = deal_lead;
  insert into public.transactions (user_id, date, kind, amount, label, category, item_id, variant_id, quantity, unit_price, tip, partner_lead_id)
  values (u, current_date, 'income', 1, 'x', 'Session', it, v_other, 1, 40, 5, deal_lead) returning amount, discount into amt, disc;
  if amt = 5 and disc = 40 then r6 := 'PASS'; else r6 := 'FAIL (' || amt || ')'; end if;

  -- 7. Never below $0: a free visit (100% off, no tip) is rejected instead of saving $0 or less.
  update public.outreach_leads set deal_type = 'percent', deal_value = 100 where id = deal_lead;
  begin
    insert into public.transactions (user_id, date, kind, amount, label, category, item_id, variant_id, unit_price, partner_lead_id)
    values (u, current_date, 'income', 1, 'x', 'Session', it, v, 100, deal_lead);
  exception when check_violation then r7 := 'PASS';
  end;

  -- 8. A deal on one option doesn't discount another option: 15% off the 60 min only, entry is 30 min → $40.
  update public.outreach_leads set deal_type = 'percent', deal_value = 15, deal_variant_id = v where id = deal_lead;
  insert into public.transactions (user_id, date, kind, amount, label, category, item_id, variant_id, quantity, unit_price, partner_lead_id)
  values (u, current_date, 'income', 1, 'x', 'Session', it, v_other, 1, 40, deal_lead) returning amount into amt;
  if amt = 40 then r8 := 'PASS'; else r8 := 'FAIL (' || amt || ')'; end if;

  -- 9. One matches run per person per week (two tabs can't both run it).
  insert into public.match_runs (user_id, week_start) values (u, date '2000-01-03') returning id into run;
  begin
    insert into public.match_runs (user_id, week_start) values (u, date '2000-01-03');
  exception when unique_violation then r9 := 'PASS';
  end;

  -- 10. Backfill: no saved business with an old status is left at the wrong stage.
  if not exists (select 1 from public.outreach_leads where status = 'contacted' and stage = 'found')
     and not exists (select 1 from public.outreach_leads where status = 'replied' and stage = 'found') then
    r10 := 'PASS';
  end if;

  raise exception 'PARTNERS TEST (nothing was saved): 1 %, 2 %, 3 %, 4 %, 5 %, 6 %, 7 %, 8 %, 9 %, 10 %', r1, r2, r3, r4, r5, r6, r7, r8, r9, r10;
end $$;
