-- Brzky Empire (exact plan + tenant below). ONE transaction, all-or-nothing:
--  1. creates the KeraPlus workbook's 6 periods (Oct-26..Feb-27 = month, Raya Sprint = custom) and 22 weeks W01..W22 with the
--     workbook's own dates, sort order and period link (as the app's Targets step writes them), with the workbook targets;
--  2. switches financing on (plan %/fee/tenure kept: defaults = workbook 90% / 7% / 30 days); status unchanged;
--  3. adds batches A-C and milestones M01-M12 exactly as the live 2d import would for this plan. NO funding draws and NO
--     journal entries: record "Draw funding" in the app so Accounting gets the journal.
-- Insert-only: rows that already exist (same week code / period label / batch code / milestone code) are left as they are,
-- so a re-run changes nothing and never overwrites edits made in the app. Stops, writing nothing, if the plan is missing,
-- deleted or a template, or already has weeks/periods that differ from the workbook.
-- auth.uid() is set transaction-locally to an Owner/Admin of the tenant (guard triggers, audit). Supersedes
-- sales_plan_brzky_import.sql (that one only updates existing weeks/periods, and this plan has none).
DO $seed$
DECLARE
 pid uuid := '10c84447-adfd-4631-b291-7e205d6eacdd'; t uuid := 'c60f2b79-7132-48ed-b35d-72b0dfd9a973';
 wk jsonb := '[["W01","2026-10-20","2026-10-25",10000,175,175],["W02","2026-10-26","2026-10-31",10000,175,175],["W03","2026-11-01","2026-11-07",21000,350,350],["W04","2026-11-08","2026-11-14",21000,350,350],["W05","2026-11-15","2026-11-21",21000,350,350],["W06","2026-11-22","2026-11-28",21000,350,350],["W07","2026-11-29","2026-11-30",6000,100,100],["W08","2026-12-01","2026-12-07",12000,160,160],["W09","2026-12-08","2026-12-14",12000,160,160],["W10","2026-12-15","2026-12-21",12000,160,160],["W11","2026-12-22","2026-12-31",19000,270,270],["W12","2027-01-01","2027-01-07",50000,730,385],["W13","2027-01-08","2027-01-14",55000,800,423],["W14","2027-01-15","2027-01-21",60000,875,462],["W15","2027-01-22","2027-01-31",85000,1245,653],["W16","2027-02-01","2027-02-07",70000,1030,460],["W17","2027-02-08","2027-02-14",80000,1180,526],["W18","2027-02-15","2027-02-21",90000,1320,592],["W19","2027-02-22","2027-02-28",120000,1770,790],["W20","2027-03-01","2027-03-03",60000,890,358],["W21","2027-03-04","2027-03-06",75000,1110,446],["W22","2027-03-07","2027-03-10",115000,1700,684]]';
 pe jsonb := '[["Oct-26","month","2026-10-20","2026-10-31",20000,350,350],["Nov-26","month","2026-11-01","2026-11-30",90000,1500,1500],["Dec-26","month","2026-12-01","2026-12-31",55000,750,750],["Jan-27","month","2027-01-01","2027-01-31",250000,3650,1923],["Feb-27","month","2027-02-01","2027-02-28",360000,5300,2368],["Raya Sprint","custom","2027-03-01","2027-03-10",250000,3700,1488]]';
 bt jsonb := '[["A",[{"product_id":null,"name":"Moisturizer","qty":2500}],"2026-10-20",2500,null,"2026-11-19",0,0],["B",[{"product_id":null,"name":"Shampoo","qty":3000},{"product_id":null,"name":"Leave-in","qty":3000}],"2026-12-29",6000,70000,"2027-01-28",63000,67410],["C",[{"product_id":null,"name":"each SKU","qty":3000}],"2027-01-28",9000,105000,"2027-02-27",94500,101115]]';
 ms jsonb := '[["M01","Moisturizer inbound","2026-10-20","units",2500,"PIC KeraVive"],["M02","October GMV","2026-10-31","rm",20000,"PIC KeraVive"],["M03","November unit target","2026-11-30","units",1500,"PIC KeraVive"],["M04","November GMV","2026-11-30","rm",90000,"PIC KeraVive"],["M05","Batch B funding drawn","2026-11-20","rm",63000,"PIC KeraVive"],["M06","Batch B inbound","2026-12-31","units",6000,"PIC KeraVive"],["M07","January GMV","2027-01-31","rm",250000,"PIC KeraVive"],["M08","Batch C funding drawn","2027-01-15","rm",94500,"PIC KeraVive"],["M09","Batch C inbound","2027-01-31","units",9000,"PIC KeraVive"],["M10","February GMV","2027-02-28","rm",360000,"PIC KeraVive"],["M11","Raya Sprint GMV","2027-03-10","rm",250000,"PIC KeraVive"],["M12","Rolling 30-day GMV","2027-03-10","rm",500000,"PIC KeraVive"]]';
 p sales_plans%ROWTYPE; uid uuid; bad text; so int; cf int; cp int; cw int; cb int; cm int;
BEGIN
 SELECT * INTO p FROM sales_plans WHERE id = pid AND tenant_id = t;
 IF NOT FOUND THEN RAISE EXCEPTION 'Plan % not found in tenant %; nothing written', pid, t; END IF;
 IF p.deleted_at IS NOT NULL OR p.is_template THEN RAISE EXCEPTION 'Plan "%" is deleted or a template; nothing written', p.name; END IF;
 SELECT string_agg(z, ', ') INTO bad FROM (
  SELECT x.code || ' ' || x.start_date || '..' || x.end_date z FROM sales_plan_weeks x WHERE x.plan_id = pid AND x.tenant_id = t AND x.deleted_at IS NULL
   AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(wk) e WHERE e->>0 = x.code AND (e->>1)::date = x.start_date AND (e->>2)::date = x.end_date)
  UNION ALL
  SELECT x.label || ' ' || x.start_date || '..' || x.end_date FROM sales_plan_periods x WHERE x.plan_id = pid AND x.tenant_id = t AND x.deleted_at IS NULL
   AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(pe) e WHERE e->>0 = x.label AND (e->>2)::date = x.start_date AND (e->>3)::date = x.end_date)) q;
 IF bad IS NOT NULL THEN
  RAISE EXCEPTION 'Plan already has weeks/periods that differ from the workbook: %. Nothing written - tell the owner, do not guess.', bad;
 END IF;
 SELECT u.id INTO uid FROM user_profiles u WHERE u.tenant_id = t AND lower(coalesce(u.role, '')) IN ('owner', 'admin')
  ORDER BY (lower(u.role) = 'owner') DESC, u.id LIMIT 1;
 IF uid IS NULL THEN RAISE EXCEPTION 'No Owner/Admin in tenant %; nothing written', t; END IF;
 PERFORM set_config('request.jwt.claim.sub', uid::text, true);
 PERFORM set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
 RAISE NOTICE 'Plan "%" status % currency % source %', p.name, p.status, p.currency, p.sales_source;
 IF upper(p.currency) <> 'SGD' THEN RAISE WARNING 'Workbook contract currency is SGD, plan is %: amounts imported as-is (no conversion).', p.currency; END IF;

 -- 2. Financing on (only if off). Plan %/fee/tenure are not changed.
 UPDATE sales_plans x SET financing_enabled = true WHERE x.id = pid AND x.tenant_id = t AND NOT x.financing_enabled;
 GET DIAGNOSTICS cf = ROW_COUNT;
 IF (p.financed_pct, p.fee_pct, p.tenure_days) IS DISTINCT FROM (90::numeric, 7::numeric, 30) THEN
  RAISE WARNING 'Plan financing terms are % / % / % (workbook 90 / 7 / 30) - left unchanged.', p.financed_pct, p.fee_pct, p.tenure_days;
 END IF;

 -- 1a. Periods
 INSERT INTO sales_plan_periods (id, tenant_id, plan_id, kind, label, start_date, end_date, gmv_target, units_target, orders_target, sort_order)
 SELECT gen_random_uuid(), t, pid, e->>1, e->>0, (e->>2)::date, (e->>3)::date, coalesce((e->>4)::numeric, 0), coalesce((e->>5)::numeric, 0),
   coalesce((e->>6)::numeric, 0), o - 1
 FROM jsonb_array_elements(pe) WITH ORDINALITY q(e, o)
 WHERE NOT EXISTS (SELECT 1 FROM sales_plan_periods x WHERE x.plan_id = pid AND x.tenant_id = t AND x.deleted_at IS NULL AND x.label = e->>0);
 GET DIAGNOSTICS cp = ROW_COUNT;

 -- 1b. Weeks; period_id like the app (SP.periodFor): custom period containing the start date first, else the month
 INSERT INTO sales_plan_weeks (id, tenant_id, plan_id, period_id, code, start_date, end_date, gmv_target, units_target, orders_target, sort_order)
 SELECT gen_random_uuid(), t, pid,
   (SELECT x.id FROM sales_plan_periods x WHERE x.plan_id = pid AND x.tenant_id = t AND x.deleted_at IS NULL AND (e->>1)::date BETWEEN x.start_date AND x.end_date
     ORDER BY (x.kind = 'custom') DESC, x.sort_order, x.start_date LIMIT 1),
   e->>0, (e->>1)::date, (e->>2)::date, coalesce((e->>3)::numeric, 0), coalesce((e->>4)::numeric, 0), coalesce((e->>5)::numeric, 0), o - 1
 FROM jsonb_array_elements(wk) WITH ORDINALITY q(e, o)
 WHERE NOT EXISTS (SELECT 1 FROM sales_plan_weeks x WHERE x.plan_id = pid AND x.tenant_id = t AND x.deleted_at IS NULL AND x.code = e->>0);
 GET DIAGNOSTICS cw = ROW_COUNT;

 -- 3a. Batches (import rules for a new batch: financed % = principal / cost, fee % = repayment / principal - 1, only when
 --     cost > 0; otherwise self-funded 0 / 0; tenure = plan tenure). No draw, no journal.
 SELECT count(*) INTO so FROM sales_plan_batches x WHERE x.plan_id = pid AND x.tenant_id = t AND x.deleted_at IS NULL;
 INSERT INTO sales_plan_batches (id, tenant_id, plan_id, sort_order, code, product_mix, target_inbound, target_qty, target_cost, target_due_date,
   financed_pct, fee_pct, tenure_days)
 SELECT gen_random_uuid(), t, pid, so + row_number() OVER (ORDER BY o) - 1, c, e->1, (e->>2)::date, (e->>3)::numeric, cost, (e->>5)::date,
   CASE WHEN cost > 0 AND pr IS NOT NULL THEN round(pr / cost * 100, 2) ELSE 0 END,
   CASE WHEN cost > 0 AND pr > 0 AND rp > 0 THEN round((rp / pr - 1) * 100, 2) ELSE 0 END,
   coalesce(nullif(p.tenure_days, 0), 30)
 FROM jsonb_array_elements(bt) WITH ORDINALITY q(e, o),
   LATERAL (SELECT e->>0 c, (e->>4)::numeric cost, (e->>6)::numeric pr, (e->>7)::numeric rp) v
 WHERE NOT EXISTS (SELECT 1 FROM sales_plan_batches x WHERE x.plan_id = pid AND x.tenant_id = t AND x.deleted_at IS NULL AND upper(x.code) = c);
 GET DIAGNOSTICS cb = ROW_COUNT;

 -- 3b. Milestones (new = link_type manual, as the import does; relink in the app if wanted)
 SELECT count(*) INTO so FROM sales_plan_milestones x WHERE x.plan_id = pid AND x.tenant_id = t AND x.deleted_at IS NULL;
 INSERT INTO sales_plan_milestones (id, tenant_id, plan_id, sort_order, code, title, due_date, metric, target, owner_name, link_type)
 SELECT gen_random_uuid(), t, pid, so + row_number() OVER (ORDER BY o) - 1, e->>0, e->>1, (e->>2)::date, coalesce(e->>3, 'rm'),
   coalesce((e->>4)::numeric, 0), e->>5, 'manual'
 FROM jsonb_array_elements(ms) WITH ORDINALITY q(e, o)
 WHERE NOT EXISTS (SELECT 1 FROM sales_plan_milestones x WHERE x.plan_id = pid AND x.tenant_id = t AND x.deleted_at IS NULL AND upper(x.code) = e->>0);
 GET DIAGNOSTICS cm = ROW_COUNT;

 RAISE NOTICE 'Done: financing switched on %, periods added %, weeks added %, batches added %, milestones added %', cf, cp, cw, cb, cm;
 SELECT string_agg(z, ' | ') INTO bad FROM (
  SELECT 'periods ' || count(*) || ': GMV ' || sum(gmv_target) || ', units ' || sum(units_target) || ', orders ' || sum(orders_target) z
  FROM sales_plan_periods x WHERE x.plan_id = pid AND x.tenant_id = t AND x.deleted_at IS NULL
  UNION ALL
  SELECT 'weeks ' || count(*) || ': GMV ' || sum(gmv_target) || ', units ' || sum(units_target) || ', orders ' || sum(orders_target)
   || ', without period ' || count(*) FILTER (WHERE x.period_id IS NULL) FROM sales_plan_weeks x WHERE x.plan_id = pid AND x.tenant_id = t AND x.deleted_at IS NULL) q;
 RAISE NOTICE 'Totals: % (expected 6 / 22, GMV 1025000, units 15250, orders 8379)', bad;
END
$seed$;
