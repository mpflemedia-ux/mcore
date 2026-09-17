-- Full probation schema (no generated column — PG rejects interval expr as immutable)
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS employment_status text NOT NULL DEFAULT 'probation',
  ADD COLUMN IF NOT EXISTS probation_months integer NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS probation_start_date date,
  ADD COLUMN IF NOT EXISTS probation_end_date date,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS probation_extension_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS probation_max_months_cap integer NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS allow_leave_during_probation boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_medical_claim_during_probation boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_sales_commission_during_probation boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_full_access_during_probation boolean NOT NULL DEFAULT false;

UPDATE public.employees
SET probation_start_date = COALESCE(probation_start_date, created_at::date, CURRENT_DATE)
WHERE probation_start_date IS NULL;

ALTER TABLE public.employees
  ALTER COLUMN probation_start_date SET DEFAULT CURRENT_DATE,
  ALTER COLUMN probation_start_date SET NOT NULL;

UPDATE public.employees
SET employment_status = 'permanent',
    confirmed_at = COALESCE(confirmed_at, created_at, now())
WHERE employment_status = 'probation'
  AND created_at < now() - interval '1 day';

UPDATE public.employees
SET probation_end_date = (
  COALESCE(probation_start_date, created_at::date, CURRENT_DATE)
  + make_interval(months => COALESCE(probation_months, 6))
)::date
WHERE probation_end_date IS NULL;

ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_employment_status_chk;
ALTER TABLE public.employees
  ADD CONSTRAINT employees_employment_status_chk
  CHECK (employment_status IN ('probation','permanent'));

CREATE OR REPLACE FUNCTION public.tg_employees_probation_end()
RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF NEW.probation_start_date IS NOT NULL THEN
    NEW.probation_end_date := (
      NEW.probation_start_date
      + make_interval(months => COALESCE(NEW.probation_months, 6))
    )::date;
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_employees_probation_end ON public.employees;
CREATE TRIGGER trg_employees_probation_end
BEFORE INSERT OR UPDATE OF probation_start_date, probation_months
ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.tg_employees_probation_end();

CREATE TABLE IF NOT EXISTS public.employee_probation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('confirmed','extended')),
  reason text NOT NULL,
  previous_months integer,
  new_months integer,
  acted_by uuid,
  acted_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.employee_probation_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  milestone text NOT NULL,
  sent_on date NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE (employee_id, milestone, sent_on)
);

ALTER TABLE public.employee_probation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_probation_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS epl_select ON public.employee_probation_log;
CREATE POLICY epl_select ON public.employee_probation_log FOR SELECT TO authenticated
  USING (tenant_id = (SELECT tenant_id FROM public.user_profiles WHERE id = auth.uid()));
DROP POLICY IF EXISTS epl_write ON public.employee_probation_log;
CREATE POLICY epl_write ON public.employee_probation_log FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (SELECT tenant_id FROM public.user_profiles WHERE id = auth.uid()));
DROP POLICY IF EXISTS epr_select ON public.employee_probation_reminders;
CREATE POLICY epr_select ON public.employee_probation_reminders FOR SELECT TO authenticated
  USING (tenant_id = (SELECT tenant_id FROM public.user_profiles WHERE id = auth.uid()));
DROP POLICY IF EXISTS epr_write ON public.employee_probation_reminders;
CREATE POLICY epr_write ON public.employee_probation_reminders FOR ALL TO authenticated
  USING (tenant_id = (SELECT tenant_id FROM public.user_profiles WHERE id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM public.user_profiles WHERE id = auth.uid()));
