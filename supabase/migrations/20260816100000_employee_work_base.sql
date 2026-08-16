-- Employee work base: office (geofence) | field (WFH) — all tenants
-- Safe to re-run

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS work_base text DEFAULT 'office';

COMMENT ON COLUMN public.employees.work_base IS 'office = geofence applies; field = WFH/field, no office radius block';

-- Optional check constraint (ignore if fails on existing odd values)
DO $$
BEGIN
  ALTER TABLE public.employees
    ADD CONSTRAINT employees_work_base_check
    CHECK (work_base IS NULL OR work_base IN ('office', 'field'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
