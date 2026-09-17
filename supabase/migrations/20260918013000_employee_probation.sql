-- Employee probation / permanent status
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS employment_status text NOT NULL DEFAULT 'probation',
  ADD COLUMN IF NOT EXISTS probation_months integer NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS probation_start_date date,
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

-- Existing staff already in system treated as permanent (new hires keep default probation)
UPDATE public.employees
SET employment_status = 'permanent',
    confirmed_at = COALESCE(confirmed_at, created_at, now())
WHERE employment_status = 'probation'
  AND created_at < now() - interval '1 day';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='employees' AND column_name='probation_end_date'
  ) THEN
    ALTER TABLE public.employees
      ADD COLUMN probation_end_date date
      GENERATED ALWAYS AS ((probation_start_date + (probation_months::text || ' months')::interval)::date) STORED;
  END IF;
END $$;

ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_employment_status_chk;
ALTER TABLE public.employees
  ADD CONSTRAINT employees_employment_status_chk
  CHECK (employment_status IN ('probation','permanent'));

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

CREATE OR REPLACE FUNCTION public.check_probation_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
  days_left int;
  milestone text;
  title text;
  body text;
  owner record;
  n int := 0;
  notify_emp boolean;
BEGIN
  FOR rec IN
    SELECT e.*, t.config
    FROM public.employees e
    JOIN public.tenants t ON t.id = e.tenant_id
    WHERE e.employment_status = 'probation'
      AND e.confirmed_at IS NULL
      AND COALESCE(t.deleted_at, NULL) IS NULL
  LOOP
    days_left := rec.probation_end_date - CURRENT_DATE;
    milestone := NULL;
    IF days_left = 14 THEN milestone := 'h14';
    ELSIF days_left = 7 THEN milestone := 'h7';
    ELSIF days_left = 3 THEN milestone := 'h3';
    ELSIF days_left = 1 THEN milestone := 'h1';
    ELSIF days_left <= 0 THEN milestone := 'overdue';
    END IF;
    IF milestone IS NULL THEN CONTINUE; END IF;
    IF EXISTS (
      SELECT 1 FROM public.employee_probation_reminders r
      WHERE r.employee_id = rec.id AND r.milestone = milestone AND r.sent_on = CURRENT_DATE
    ) THEN CONTINUE; END IF;

    IF milestone = 'overdue' THEN
      title := 'OVERDUE — '||rec.name||'''s probation ended without action';
      body := 'Risk of automatic confirmation by conduct under Employment Act. Act now.';
    ELSE
      title := rec.name||' — probation ends in '||days_left||' day(s)';
      body := 'Probation ends '||to_char(rec.probation_end_date,'DD/MM/YYYY')||'. Confirm or extend.';
    END IF;

    FOR owner IN
      SELECT id FROM public.user_profiles
      WHERE tenant_id = rec.tenant_id AND lower(COALESCE(role,'')) IN ('owner','admin')
    LOOP
      BEGIN
        INSERT INTO public.notifications (user_id, title, body, category)
        VALUES (owner.id, title, body, 'hr');
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END LOOP;

    notify_emp := COALESCE((rec.config->>'probation_notify_employee')::boolean, false);
    IF notify_emp AND rec.email IS NOT NULL THEN
      BEGIN
        INSERT INTO public.notifications (user_id, title, body, category)
        SELECT up.id, title, body, 'hr'
        FROM public.user_profiles up
        WHERE up.tenant_id = rec.tenant_id AND lower(up.email) = lower(rec.email)
        LIMIT 1;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;

    INSERT INTO public.employee_probation_reminders (tenant_id, employee_id, milestone, sent_on)
    VALUES (rec.tenant_id, rec.id, milestone, CURRENT_DATE)
    ON CONFLICT (employee_id, milestone, sent_on) DO NOTHING;
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_probation_reminders() TO authenticated;
