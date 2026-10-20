-- ============================================================================
-- DEMO TENANT — introspection (read-only, changes nothing)
-- Run this to get the exact CHECK constraint text for sales_plan_weeks.code
-- (and the related sales_plan_milestones.code / sales_plan_batches.code,
-- same risk since Part 3c also writes those), then send the result back.
-- ============================================================================
select conrelid::regclass as table_name, conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where contype = 'c'
  and connamespace = 'public'::regnamespace
  and conrelid::regclass::text in ('sales_plan_weeks','sales_plan_milestones','sales_plan_batches','sales_plan_periods','sales_plans')
order by table_name;
