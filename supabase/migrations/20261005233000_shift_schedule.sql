-- Shift schedule. Run in Supabase SQL Editor. Do not auto-run.
CREATE TABLE IF NOT EXISTS public.shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  employee_id uuid NULL,
  shift_date date NOT NULL,
  kind text NOT NULL CHECK (kind IN ('morning', 'mid', 'closing', 'off', 'open')),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);
CREATE TABLE IF NOT EXISTS public.shift_swaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  from_employee_id uuid NOT NULL,
  to_employee_id uuid NOT NULL,
  shift_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS shifts_emp_day_uidx ON public.shifts (tenant_id, employee_id, shift_date) WHERE deleted_at IS NULL AND employee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS shifts_tenant_date_idx ON public.shifts (tenant_id, shift_date) WHERE deleted_at IS NULL;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_swaps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS shifts_tenant_all ON public.shifts;
CREATE POLICY shifts_tenant_all ON public.shifts
  FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id() OR public.is_platform_admin())
  WITH CHECK (tenant_id = public.get_my_tenant_id() OR public.is_platform_admin());
DROP POLICY IF EXISTS shift_swaps_tenant_all ON public.shift_swaps;
CREATE POLICY shift_swaps_tenant_all ON public.shift_swaps
  FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id() OR public.is_platform_admin())
  WITH CHECK (tenant_id = public.get_my_tenant_id() OR public.is_platform_admin());

INSERT INTO public.shifts (tenant_id, employee_id, shift_date, kind)
SELECT t.id, e.id, v.shift_date, v.kind
FROM public.tenants t
JOIN public.employees e ON e.tenant_id = t.id AND e.deleted_at IS NULL
JOIN (
  VALUES
    (0, DATE '2026-10-05', 'morning'),
    (0, DATE '2026-10-06', 'morning'),
    (0, DATE '2026-10-07', 'off'),
    (1, DATE '2026-10-05', 'mid'),
    (1, DATE '2026-10-06', 'closing'),
    (1, DATE '2026-10-07', 'morning'),
    (2, DATE '2026-10-05', 'closing'),
    (2, DATE '2026-10-08', 'off'),
    (3, DATE '2026-10-06', 'morning'),
    (3, DATE '2026-10-09', 'mid')
) AS v(n, shift_date, kind) ON v.n = (
  SELECT count(*) FROM public.employees e2
  WHERE e2.tenant_id = t.id AND e2.deleted_at IS NULL AND e2.id < e.id
)
WHERE t.code = 'MPFREE1' AND t.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.shifts s
    WHERE s.tenant_id = t.id AND s.employee_id = e.id AND s.shift_date = v.shift_date AND s.deleted_at IS NULL
  );

INSERT INTO public.dev_roadmap_items (title, description, module, stage)
SELECT 'Shift schedule', 'Weekly shift grid linked to employees and approved leave. Tables shifts + shift_swaps.', 'hr', 'completed'
WHERE NOT EXISTS (SELECT 1 FROM public.dev_roadmap_items WHERE title = 'Shift schedule');
