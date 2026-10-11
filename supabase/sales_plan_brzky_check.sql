-- READ-ONLY check (Supabase SQL Editor): every non-deleted sales plan whose name matches brzky/berzky (case-insensitive),
-- with what already exists under it. Run before sales_plan_brzky_import.sql (import needs EXACTLY ONE row with
-- importable = true) and again afterwards to see the result. Writes nothing.
-- wb_* columns compare the plan with the workbook the way the import matches rows (week code, else start date;
-- period label, else start date): wb_weeks_skipped / wb_periods_skipped rows would NOT be imported, and
-- wb_weeks_code_date_differs = matched by code but the plan week starts on another date (targets land on that plan week).
WITH wbw(code, sd) AS (VALUES ('W01','2026-10-20'::date),('W02','2026-10-26'::date),('W03','2026-11-01'::date),('W04','2026-11-08'::date),('W05','2026-11-15'::date),('W06','2026-11-22'::date),('W07','2026-11-29'::date),('W08','2026-12-01'::date),('W09','2026-12-08'::date),('W10','2026-12-15'::date),('W11','2026-12-22'::date),('W12','2027-01-01'::date),('W13','2027-01-08'::date),('W14','2027-01-15'::date),('W15','2027-01-22'::date),('W16','2027-02-01'::date),('W17','2027-02-08'::date),('W18','2027-02-15'::date),('W19','2027-02-22'::date),('W20','2027-03-01'::date),('W21','2027-03-04'::date),('W22','2027-03-07'::date)),
 wbp(nl, sd) AS (VALUES ('oct26','2026-10-20'::date),('nov26','2026-11-01'::date),('dec26','2026-12-01'::date),('jan27','2027-01-01'::date),('feb27','2027-02-01'::date),('rayasprint','2027-03-01'::date))
SELECT
  t.name                                   AS tenant_name,
  s.tenant_id,
  s.id                                     AS plan_id,
  s.name                                   AS plan_name,
  s.status,
  s.is_template,
  (NOT s.is_template AND s.status <> 'archived') AS importable,
  s.currency,
  s.sales_source                           AS sales_source_mode,
  s.start_date,
  s.end_date,
  s.financing_enabled,
  s.tenure_days,
  (SELECT count(*) FROM public.user_profiles u WHERE u.tenant_id = s.tenant_id
     AND lower(coalesce(u.role, '')) IN ('owner', 'admin'))                      AS owner_admin_users,
  pe.periods, pe.periods_with_targets, pe.period_labels, pe.periods_gmv_target,
  wk.weeks, wk.weeks_with_targets, wk.first_week, wk.last_week, wk.weeks_gmv_target, wk.weeks_with_manual_actuals,
  mi.milestones, mi.milestone_codes,
  ba.batches, ba.batch_codes, ba.batches_drawn,
  al.wb_weeks_skipped, al.wb_weeks_code_date_differs, al.wb_periods_skipped
FROM public.sales_plans s
LEFT JOIN public.tenants t ON t.id = s.tenant_id
LEFT JOIN LATERAL (
  SELECT count(*) AS periods,
         count(*) FILTER (WHERE x.gmv_target > 0 OR x.units_target > 0 OR x.orders_target > 0) AS periods_with_targets,
         string_agg(x.label, ', ' ORDER BY x.start_date) AS period_labels,
         coalesce(sum(x.gmv_target), 0) AS periods_gmv_target
  FROM public.sales_plan_periods x
  WHERE x.plan_id = s.id AND x.tenant_id = s.tenant_id AND x.deleted_at IS NULL) pe ON true
LEFT JOIN LATERAL (
  SELECT count(*) AS weeks,
         count(*) FILTER (WHERE x.gmv_target > 0 OR x.units_target > 0 OR x.orders_target > 0) AS weeks_with_targets,
         min(x.code || ' ' || x.start_date) AS first_week,
         max(x.code || ' ' || x.start_date) AS last_week,
         coalesce(sum(x.gmv_target), 0) AS weeks_gmv_target,
         count(*) FILTER (WHERE x.gmv_manual IS NOT NULL OR x.units_manual IS NOT NULL OR x.orders_manual IS NOT NULL) AS weeks_with_manual_actuals
  FROM public.sales_plan_weeks x
  WHERE x.plan_id = s.id AND x.tenant_id = s.tenant_id AND x.deleted_at IS NULL) wk ON true
LEFT JOIN LATERAL (
  SELECT count(*) AS milestones, string_agg(x.code, ', ' ORDER BY x.code) AS milestone_codes
  FROM public.sales_plan_milestones x
  WHERE x.plan_id = s.id AND x.tenant_id = s.tenant_id AND x.deleted_at IS NULL) mi ON true
LEFT JOIN LATERAL (
  SELECT count(*) AS batches, string_agg(x.code, ', ' ORDER BY x.code) AS batch_codes,
         count(*) FILTER (WHERE x.actual_principal IS NOT NULL) AS batches_drawn
  FROM public.sales_plan_batches x
  WHERE x.plan_id = s.id AND x.tenant_id = s.tenant_id AND x.deleted_at IS NULL) ba ON true
LEFT JOIN LATERAL (
  SELECT string_agg(w.code, ', ' ORDER BY w.code) FILTER (WHERE NOT EXISTS (SELECT 1 FROM public.sales_plan_weeks x WHERE x.plan_id = s.id
           AND x.deleted_at IS NULL AND (x.code = w.code OR x.start_date = w.sd))) AS wb_weeks_skipped,
         string_agg(w.code, ', ' ORDER BY w.code) FILTER (WHERE EXISTS (SELECT 1 FROM public.sales_plan_weeks x WHERE x.plan_id = s.id
           AND x.deleted_at IS NULL AND x.code = w.code AND x.start_date <> w.sd)) AS wb_weeks_code_date_differs,
         (SELECT string_agg(pp.nl, ', ') FROM wbp pp WHERE NOT EXISTS (SELECT 1 FROM public.sales_plan_periods x WHERE x.plan_id = s.id
           AND x.deleted_at IS NULL AND (regexp_replace(lower(x.label), '[^a-z0-9]', '', 'g') = pp.nl OR x.start_date = pp.sd))) AS wb_periods_skipped
  FROM wbw w) al ON true
WHERE s.deleted_at IS NULL
  AND (s.name ILIKE '%brzky%' OR s.name ILIKE '%berzky%')
ORDER BY importable DESC, t.name, s.name;
