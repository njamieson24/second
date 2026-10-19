-- Test for catalog.sql. It changes NOTHING: it ends with an error on purpose, which undoes
-- every change it made. Run AFTER catalog.sql. Paste into Supabase: SQL Editor > New query > Run.
-- You need at least one account (any login). Look for:
-- "CATALOG TEST (nothing was saved): 1 PASS, 2 PASS, ... 9 PASS"

do $$
declare
  u uuid := (select id from auth.users order by created_at limit 1);
  items_before int; variants_before int;
  it uuid; v uuid; ev uuid; t uuid;
  amt numeric;
  r1 text := 'FAIL'; r2 text := 'FAIL'; r3 text := 'FAIL'; r4 text := 'FAIL'; r5 text := 'FAIL';
  r6 text := 'FAIL'; r7 text := 'FAIL'; r8 text := 'FAIL'; r9 text := 'FAIL';
begin
  if u is null then
    raise exception 'Make one account first, then run this test.';
  end if;

  -- 1. Moving businesses.services again makes no duplicates (safe to run twice).
  items_before := (select count(*) from public.catalog_items);
  variants_before := (select count(*) from public.catalog_variants);
  insert into public.catalog_items (user_id, name, kind, position, source_key)
  select b.user_id, left(btrim(s.value ->> 'name'), 80), case when b.type = 'food' then 'menu_item' else 'service' end, (s.ord - 1)::int,
         'service:' || coalesce(nullif(s.value ->> 'id', ''), lower(btrim(s.value ->> 'name')))
  from public.businesses b
  cross join lateral jsonb_array_elements(coalesce(b.services, '[]'::jsonb)) with ordinality as s(value, ord)
  where char_length(btrim(coalesce(s.value ->> 'name', ''))) between 1 and 80 and s.ord <= 100
  on conflict (user_id, source_key) where source_key is not null do nothing;
  insert into public.catalog_variants (user_id, item_id, label, minutes, price, is_default, position)
  select i.user_id, i.id, '', null, 0, true, 0
  from public.catalog_items i
  where i.source_key is not null and not exists (select 1 from public.catalog_variants x where x.item_id = i.id);
  if (select count(*) from public.catalog_items) = items_before and (select count(*) from public.catalog_variants) = variants_before then r1 := 'PASS'; end if;

  -- A test item with a 60 min variant at $120.
  insert into public.catalog_items (user_id, name) values (u, 'Catalog test aromatherapy') returning id into it;
  insert into public.catalog_variants (user_id, item_id, label, minutes, price, is_default) values (u, it, '60 min', 60, 120, true) returning id into v;

  -- 2. The database works out the total itself: 120 x 2 - 10 + 15 = 245 (the 1 sent is ignored).
  insert into public.transactions (user_id, date, kind, amount, label, category, item_id, variant_id, quantity, unit_price, discount, tip)
  values (u, current_date, 'income', 1, 'Catalog test aromatherapy, 60 min', 'Session', it, v, 2, 120, 10, 15) returning id, amount into t, amt;
  if amt = 245 then r2 := 'PASS'; end if;

  -- 3. Changing the catalog price doesn't change the old entry.
  update public.catalog_variants set price = 130 where id = v;
  if (select amount from public.transactions where id = t) = 245 then r3 := 'PASS'; end if;

  -- 4. Hiding the item keeps the old entry (and its name).
  update public.catalog_items set active = false where id = it;
  if (select label from public.transactions where id = t) = 'Catalog test aromatherapy, 60 min' and (select item_id from public.transactions where id = t) = it then r4 := 'PASS'; end if;

  -- 5. A price over $10,000 is rejected; $0 (free consult) is fine.
  begin
    insert into public.catalog_variants (user_id, item_id, label, price) values (u, it, 'too much', 10000.01);
  exception when check_violation then r5 := 'PASS';
  end;
  begin
    insert into public.catalog_variants (user_id, item_id, label, price) values (u, it, 'free consult', 0);
  exception when others then r5 := 'FAIL ($0 rejected)';
  end;

  -- 6. More than 2 decimals is rejected (not quietly rounded), in the catalog and on an entry.
  begin
    insert into public.catalog_variants (user_id, item_id, label, price) values (u, it, 'odd', 9.999);
  exception when check_violation then r6 := 'PASS';
  end;
  if r6 = 'PASS' then
    begin
      insert into public.transactions (user_id, date, kind, amount, label, category, item_id, variant_id, unit_price)
      values (u, current_date, 'income', 1, 'x', 'Session', it, v, 9.999);
      r6 := 'FAIL (entry price 9.999 accepted)';
    exception when check_violation then null;
    end;
  end if;

  -- 7. "Got paid": the same appointment on the same day can only be logged once.
  insert into public.events (user_id, title, type, all_day, starts_at, ends_at, time_zone, source)
  values (u, 'Catalog test appointment', 'appointment', false, now() - interval '2 hours', now() - interval '1 hour', 'America/New_York', 'manual')
  returning id into ev;
  insert into public.transactions (user_id, date, kind, amount, label, category, event_id, event_date)
  values (u, current_date, 'income', 100, 'Catalog test appointment', 'Session', ev, current_date);
  begin
    insert into public.transactions (user_id, date, kind, amount, label, category, event_id, event_date)
    values (u, current_date, 'income', 100, 'Catalog test appointment', 'Session', ev, current_date);
  exception when unique_violation then r7 := 'PASS';
  end;

  -- 8. An entry can't point at an item that isn't the owner's.
  begin
    insert into public.transactions (user_id, date, kind, amount, label, category, item_id, unit_price)
    values (u, current_date, 'income', 1, 'x', 'Session', gen_random_uuid(), 10);
  exception when others then r8 := 'PASS';
  end;

  -- 9. A single entry over $100,000 is rejected.
  begin
    insert into public.transactions (user_id, date, kind, amount, label, category) values (u, current_date, 'income', 100000.01, 'x', 'Session');
  exception when check_violation then r9 := 'PASS';
  end;

  raise exception 'CATALOG TEST (nothing was saved): 1 %, 2 %, 3 %, 4 %, 5 %, 6 %, 7 %, 8 %, 9 %', r1, r2, r3, r4, r5, r6, r7, r8, r9;
end $$;
