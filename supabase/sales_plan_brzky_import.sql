-- Import the KeraPlus workbook into the ONE plan named like brzky/berzky (Supabase SQL Editor; run the check SQL before/after).
-- Same rules as the live 2d import (app/sales-plan-import-map.js) run as Owner/Admin. Blank cells never overwrite; re-run = no-op.
-- NO draws/journals. One DO block = one transaction; 0 or >1 matching plans = error, nothing written. auth.uid() is set
-- transaction-locally to an Owner/Admin of the plan's tenant (guard triggers).
DO $imp$
DECLARE
 p sales_plans%ROWTYPE; t uuid; pid uuid; n int; k int; uid uuid; auto boolean; fin boolean; fp numeric; fe numeric; so int;
 r record; b sales_plan_batches%ROWTYPE; m sales_plan_milestones%ROWTYPE; xid uuid; sm boolean;
 wauto boolean := false; sk text[] := '{}'; cw int := 0; cp int := 0; cbu int := 0; cbi int := 0; cmu int := 0; cmi int := 0;
BEGIN
 SELECT count(*), (array_agg(s.id))[1] INTO n, xid FROM sales_plans s WHERE s.deleted_at IS NULL AND NOT s.is_template
  AND s.status <> 'archived' AND (s.name ILIKE '%brzky%' OR s.name ILIKE '%berzky%');
 IF n <> 1 THEN RAISE EXCEPTION '% plans match brzky/berzky (need 1); nothing written', n; END IF;
 SELECT * INTO p FROM sales_plans WHERE id = xid; t := p.tenant_id; pid := p.id;
 SELECT u.id INTO uid FROM user_profiles u WHERE u.tenant_id = t AND lower(coalesce(u.role,'')) IN ('owner','admin')
  ORDER BY (lower(u.role) = 'owner') DESC, u.id LIMIT 1;
 IF uid IS NULL THEN RAISE EXCEPTION 'No Owner/Admin in tenant %; nothing written', t; END IF;
 PERFORM set_config('request.jwt.claim.sub', uid::text, true);
 PERFORM set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
 auto := p.sales_source = 'auto';
 RAISE NOTICE 'Plan "%" (%) tenant % currency % source %', p.name, pid, t, p.currency, p.sales_source;
 IF upper(p.currency) <> 'SGD' THEN RAISE WARNING 'File currency SGD, plan %: amounts imported as-is.', p.currency; END IF;

 -- Weeks
 FOR r IN SELECT v.code, v.sd, v.gt, v.ut, v.ot, NULL::numeric AS ga, NULL::numeric AS ua, NULL::numeric AS oa, NULL::text AS nt FROM (VALUES
('W01'::text,'2026-10-20'::date,10000::numeric,175::numeric,175::numeric),
('W02','2026-10-26',10000,175,175),
('W03','2026-11-01',21000,350,350),
('W04','2026-11-08',21000,350,350),
('W05','2026-11-15',21000,350,350),
('W06','2026-11-22',21000,350,350),
('W07','2026-11-29',6000,100,100),
('W08','2026-12-01',12000,160,160),
('W09','2026-12-08',12000,160,160),
('W10','2026-12-15',12000,160,160),
('W11','2026-12-22',19000,270,270),
('W12','2027-01-01',50000,730,385),
('W13','2027-01-08',55000,800,423),
('W14','2027-01-15',60000,875,462),
('W15','2027-01-22',85000,1245,653),
('W16','2027-02-01',70000,1030,460),
('W17','2027-02-08',80000,1180,526),
('W18','2027-02-15',90000,1320,592),
('W19','2027-02-22',120000,1770,790),
('W20','2027-03-01',60000,890,358),
('W21','2027-03-04',75000,1110,446),
('W22','2027-03-07',115000,1700,684)
) v(code, sd, gt, ut, ot) LOOP
  SELECT w.id INTO xid FROM sales_plan_weeks w WHERE w.plan_id = pid AND w.tenant_id = t AND w.deleted_at IS NULL
   AND (w.code = r.code OR w.start_date = r.sd) ORDER BY (w.code = r.code) DESC, w.sort_order, w.start_date LIMIT 1;
  IF NOT FOUND THEN IF coalesce(r.ga, r.ua, r.oa, r.gt) IS NOT NULL THEN sk := sk || (r.code || ': no such week in this plan'); END IF; CONTINUE; END IF;
  IF auto AND r.ga IS NOT NULL THEN wauto := true; r.ga := NULL; r.ua := NULL; r.oa := NULL; ELSIF auto THEN r.ua := NULL; r.oa := NULL; END IF;
  UPDATE sales_plan_weeks w SET gmv_target = coalesce(r.gt, w.gmv_target), units_target = coalesce(r.ut, w.units_target),
   orders_target = coalesce(r.ot, w.orders_target), gmv_manual = coalesce(r.ga, w.gmv_manual), units_manual = coalesce(r.ua, w.units_manual),
   orders_manual = coalesce(r.oa, w.orders_manual), pic_notes = coalesce(r.nt, w.pic_notes)
  WHERE w.id = xid AND w.tenant_id = t AND w.plan_id = pid AND (coalesce(r.gt,w.gmv_target),coalesce(r.ut,w.units_target),coalesce(r.ot,w.orders_target),coalesce(r.ga,w.gmv_manual),coalesce(r.ua,w.units_manual),coalesce(r.oa,w.orders_manual),coalesce(r.nt,trim(w.pic_notes))) IS DISTINCT FROM (w.gmv_target,w.units_target,w.orders_target,w.gmv_manual,w.units_manual,w.orders_manual,trim(w.pic_notes));
  GET DIAGNOSTICS k = ROW_COUNT; cw := cw + k;
 END LOOP;
 IF wauto THEN RAISE WARNING 'Auto sales plan: actual sales columns skipped.'; END IF;

 -- Monthly KPI
 FOR r IN SELECT v.label, v.nl, v.sd, v.gt, v.ut, v.ot FROM (VALUES
('Oct-26'::text,'oct26'::text,'2026-10-20'::date,20000::numeric,350::numeric,350::numeric),
('Nov-26','nov26','2026-11-01',90000,1500,1500),
('Dec-26','dec26','2026-12-01',55000,750,750),
('Jan-27','jan27','2027-01-01',250000,3650,1923),
('Feb-27','feb27','2027-02-01',360000,5300,2368),
('Raya Sprint','rayasprint','2027-03-01',250000,3700,1488)
) v(label, nl, sd, gt, ut, ot) LOOP
  SELECT x.id INTO xid FROM sales_plan_periods x WHERE x.plan_id = pid AND x.tenant_id = t AND x.deleted_at IS NULL
   AND (regexp_replace(lower(x.label), '[^a-z0-9]', '', 'g') = r.nl OR x.start_date = r.sd)
   ORDER BY (regexp_replace(lower(x.label), '[^a-z0-9]', '', 'g') = r.nl) DESC, x.sort_order, x.start_date LIMIT 1;
  IF NOT FOUND THEN sk := sk || (r.label || ': no such period in this plan'); CONTINUE; END IF;
  UPDATE sales_plan_periods x SET gmv_target = coalesce(r.gt, x.gmv_target), units_target = coalesce(r.ut, x.units_target),
   orders_target = coalesce(r.ot, x.orders_target)
  WHERE x.id = xid AND x.tenant_id = t AND x.plan_id = pid
   AND (coalesce(r.gt,x.gmv_target),coalesce(r.ut,x.units_target),coalesce(r.ot,x.orders_target)) IS DISTINCT FROM (x.gmv_target,x.units_target,x.orders_target);
  GET DIAGNOSTICS k = ROW_COUNT; cp := cp + k;
 END LOOP;

 -- Batches
 SELECT count(*) INTO so FROM sales_plan_batches x WHERE x.plan_id = pid AND x.tenant_id = t AND x.deleted_at IS NULL;
 FOR r IN SELECT v.code, v.mix, v.tin, v.tqty, v.tcost, v.tdue, NULL::date AS ain, NULL::numeric AS aqty, NULL::numeric AS acost, v.pr, v.rp, NULL::numeric AS apr, v.mn FROM (VALUES
('A'::text,'[{"product_id":null,"name":"Moisturizer","qty":2500}]'::jsonb,'2026-10-20'::date,2500::numeric,NULL::numeric,'2026-11-19'::date,0::numeric,0::numeric,'[["Moisturizer",2500]]'::jsonb),
('B','[{"product_id":null,"name":"Shampoo","qty":3000},{"product_id":null,"name":"Leave-in","qty":3000}]','2026-12-29',6000,70000,'2027-01-28',63000,67410,'[["Shampoo",3000],["Leave-in",3000]]'),
('C','[{"product_id":null,"name":"each SKU","qty":3000}]','2027-01-28',9000,105000,'2027-02-27',94500,101115,'[["each SKU",3000]]')
) v(code, mix, tin, tqty, tcost, tdue, pr, rp, mn) LOOP
  b := NULL;
  SELECT * INTO b FROM sales_plan_batches x WHERE x.plan_id = pid AND x.tenant_id = t AND x.deleted_at IS NULL
   AND upper(x.code) = r.code ORDER BY x.sort_order LIMIT 1;
  fin := b.actual_principal IS NULL AND coalesce(r.tcost, 0) > 0 AND r.pr IS NOT NULL;
  fp := CASE WHEN fin THEN round(r.pr / r.tcost * 100, 2) END;
  fe := CASE WHEN fin THEN CASE WHEN r.pr > 0 AND coalesce(r.rp, 0) > 0 THEN round((r.rp / r.pr - 1) * 100, 2) ELSE 0 END END;
  IF coalesce(r.apr, 0) > 0 AND b.actual_principal IS NULL THEN sk := sk || ('Batch ' || r.code || ': actual principal ignored - use Draw funding in the app'); END IF;
  IF b.id IS NULL THEN
   INSERT INTO sales_plan_batches (id, tenant_id, plan_id, sort_order, code, product_mix, target_inbound, target_qty, target_cost,
    target_due_date, actual_inbound, actual_qty, actual_cost, financed_pct, fee_pct, tenure_days)
   VALUES (gen_random_uuid(), t, pid, so, r.code, coalesce(r.mix, '[]'), r.tin, r.tqty, r.tcost, r.tdue, r.ain, r.aqty, r.acost,
    coalesce(fp, 0), coalesce(fe, 0), coalesce(nullif(p.tenure_days, 0), 30));
   so := so + 1; cbi := cbi + 1;
  ELSE
   IF r.mix IS NOT NULL AND (SELECT coalesce(jsonb_agg(jsonb_build_array(e->>'name',CASE WHEN e->>'qty' ~ '^[0-9]+(\.[0-9]+)?$' THEN (e->>'qty')::numeric ELSE 0 END) ORDER BY o),'[]') FROM jsonb_array_elements(b.product_mix) WITH ORDINALITY q(e,o)) = r.mn THEN r.mix := NULL; END IF;
   UPDATE sales_plan_batches x SET product_mix = coalesce(r.mix, x.product_mix), target_inbound = coalesce(r.tin, x.target_inbound),
    target_qty = coalesce(r.tqty, x.target_qty), target_cost = coalesce(r.tcost, x.target_cost), target_due_date = coalesce(r.tdue, x.target_due_date),
    actual_inbound = coalesce(r.ain, x.actual_inbound), actual_qty = coalesce(r.aqty, x.actual_qty), actual_cost = coalesce(r.acost, x.actual_cost),
    financed_pct = coalesce(fp, x.financed_pct), fee_pct = coalesce(fe, x.fee_pct)
   WHERE x.id = b.id AND x.tenant_id = t AND x.plan_id = pid AND (r.mix IS NOT NULL OR (coalesce(r.tin,x.target_inbound),coalesce(r.tqty,x.target_qty),coalesce(r.tcost,x.target_cost),coalesce(r.tdue,x.target_due_date),coalesce(r.ain,x.actual_inbound),coalesce(r.aqty,x.actual_qty),coalesce(r.acost,x.actual_cost),coalesce(fp,x.financed_pct),coalesce(fe,x.fee_pct)) IS DISTINCT FROM (x.target_inbound,x.target_qty,x.target_cost,x.target_due_date,x.actual_inbound,x.actual_qty,x.actual_cost,x.financed_pct,x.fee_pct));
   GET DIAGNOSTICS k = ROW_COUNT; cbu := cbu + k;
  END IF;
 END LOOP;

 -- Milestones
 SELECT count(*) INTO so FROM sales_plan_milestones x WHERE x.plan_id = pid AND x.tenant_id = t AND x.deleted_at IS NULL;
 FOR r IN SELECT v.code, v.title, v.due, v.mm, NULL::text AS ml, v.tg, NULL::numeric AS act, v.own, NULL::text AS nt FROM (VALUES
('M01'::text,'Moisturizer inbound'::text,'2026-10-20'::date,'units'::text,2500::numeric,'PIC KeraVive'::text),
('M02','October GMV','2026-10-31','rm',20000,'PIC KeraVive'),
('M03','November unit target','2026-11-30','units',1500,'PIC KeraVive'),
('M04','November GMV','2026-11-30','rm',90000,'PIC KeraVive'),
('M05','Batch B funding drawn','2026-11-20','rm',63000,'PIC KeraVive'),
('M06','Batch B inbound','2026-12-31','units',6000,'PIC KeraVive'),
('M07','January GMV','2027-01-31','rm',250000,'PIC KeraVive'),
('M08','Batch C funding drawn','2027-01-15','rm',94500,'PIC KeraVive'),
('M09','Batch C inbound','2027-01-31','units',9000,'PIC KeraVive'),
('M10','February GMV','2027-02-28','rm',360000,'PIC KeraVive'),
('M11','Raya Sprint GMV','2027-03-10','rm',250000,'PIC KeraVive'),
('M12','Rolling 30-day GMV','2027-03-10','rm',500000,'PIC KeraVive')
) v(code, title, due, mm, tg, own) LOOP
  m := NULL;
  SELECT * INTO m FROM sales_plan_milestones x WHERE x.plan_id = pid AND x.tenant_id = t AND x.deleted_at IS NULL
   AND upper(x.code) = r.code ORDER BY x.sort_order LIMIT 1;
  IF m.id IS NULL THEN
   IF r.due IS NULL THEN sk := sk || (r.code || ': invalid due_date'); CONTINUE; END IF;
   INSERT INTO sales_plan_milestones (id, tenant_id, plan_id, sort_order, code, title, due_date, metric, metric_label, target,
    actual_manual, owner_name, pic_notes, link_type)
   VALUES (gen_random_uuid(), t, pid, so, r.code, r.title, r.due, coalesce(r.mm, 'rm'), CASE WHEN r.mm = 'custom' THEN r.ml END,
    coalesce(r.tg, 0), r.act, r.own, r.nt, 'manual');
   so := so + 1; cmi := cmi + 1;
  ELSE
   IF NOT (m.link_type IS NULL OR m.link_type = 'manual') THEN r.act := NULL; END IF;
   sm := r.mm IS NOT NULL AND m.metric IS DISTINCT FROM r.mm;
   UPDATE sales_plan_milestones x SET title = coalesce(r.title, x.title), due_date = coalesce(r.due, x.due_date),
    target = coalesce(r.tg, x.target), owner_name = coalesce(r.own, x.owner_name), pic_notes = coalesce(r.nt, x.pic_notes),
    actual_manual = coalesce(r.act, x.actual_manual), metric = CASE WHEN sm THEN r.mm ELSE x.metric END,
    metric_label = CASE WHEN sm AND r.mm = 'custom' THEN r.ml ELSE x.metric_label END
   WHERE x.id = m.id AND x.tenant_id = t AND x.plan_id = pid AND (sm OR (coalesce(r.title,trim(x.title)),coalesce(r.due,x.due_date),coalesce(r.tg,x.target),coalesce(r.own,trim(x.owner_name)),coalesce(r.nt,trim(x.pic_notes)),coalesce(r.act,x.actual_manual)) IS DISTINCT FROM (trim(x.title),x.due_date,x.target,trim(x.owner_name),trim(x.pic_notes),x.actual_manual));
   GET DIAGNOSTICS k = ROW_COUNT; cmu := cmu + k;
  END IF;
 END LOOP;

 RAISE NOTICE 'Done: weeks upd %, periods upd %, batches ins %/upd %, miles ins %/upd %', cw, cp, cbi, cbu, cmi, cmu;
 IF cardinality(sk) > 0 THEN RAISE WARNING 'Skipped (%): %', cardinality(sk), array_to_string(sk, ' | '); END IF;
END
$imp$;
