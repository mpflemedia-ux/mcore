reset role;

-- OT automation roadmap Phase 4: "Tetapan Gaji & OT" settings panel — a tenant-editable
-- table of OT rules, defaulting to Akta Kerja 1955 (Employment Act 1955) figures:
--   - normal_hours_week 45, normal_hours_day 8 (max since Jan 2023)
--   - ot_divisor 26 (Ordinary Rate of Pay: daily rate = monthly salary / 26, hourly rate =
--     daily rate / normal_hours_day — the standard formula, NOT salary x12/52/hours)
--   - ot_multiplier_normal 1.5x; rest-day tiered (<=half day = 0.5x daily wage, >half-to-full
--     day = 1.0x daily wage, excess = 2.0x hourly); public holiday worked = +1.0x daily wage
--     on top of holiday pay already in salary, excess = 3.0x hourly
--   - ot_eligible_wage_threshold RM4,000/month (manual-labourer exception not modelled —
--     use the per-employee employees.ot_eligible override below for that case)
--   - ot_auto_detect: tenant can turn off auto-detection from Attendance entirely
--
-- Also adds employees.ot_eligible (nullable boolean) — null = follow the wage threshold
-- above, true/false = explicit per-employee override (e.g. manual labourer exception,
-- or a senior staff member who should never get OT regardless of wage).
--
-- Write-only, idempotent, run once in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.tenant_ot_settings (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  normal_hours_week numeric NOT NULL DEFAULT 45,
  normal_hours_day numeric NOT NULL DEFAULT 8,
  ot_divisor numeric NOT NULL DEFAULT 26,
  ot_multiplier_normal numeric NOT NULL DEFAULT 1.5,
  ot_multiplier_restday_half numeric NOT NULL DEFAULT 0.5,
  ot_multiplier_restday_full numeric NOT NULL DEFAULT 1.0,
  ot_multiplier_restday_excess numeric NOT NULL DEFAULT 2.0,
  ot_multiplier_holiday_worked numeric NOT NULL DEFAULT 1.0,
  ot_multiplier_holiday_excess numeric NOT NULL DEFAULT 3.0,
  ot_eligible_wage_threshold numeric NOT NULL DEFAULT 4000,
  ot_auto_detect boolean NOT NULL DEFAULT true,
  updated_at timestamptz DEFAULT now()
);
COMMENT ON TABLE public.tenant_ot_settings IS 'Tenant-editable OT rules. Defaults mirror Akta Kerja 1955 (Employment Act 1955); tenant can override any figure.';

ALTER TABLE public.tenant_ot_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_ot_settings_select ON public.tenant_ot_settings;
CREATE POLICY tenant_ot_settings_select ON public.tenant_ot_settings
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT tenant_id FROM public.user_profiles WHERE id = auth.uid()));

-- Write restricted to Owner/Admin — payroll-sensitive, stricter than the Attendance Controls
-- gate (manager/hr) used for public_holidays/work hours.
DROP POLICY IF EXISTS tenant_ot_settings_admin_write ON public.tenant_ot_settings;
CREATE POLICY tenant_ot_settings_admin_write ON public.tenant_ot_settings
  FOR ALL TO authenticated
  USING (
    tenant_id = (SELECT tenant_id FROM public.user_profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND lower(trim(coalesce(up.role, ''))) IN ('owner', 'admin', 'platform_admin')
    )
  )
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM public.user_profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND lower(trim(coalesce(up.role, ''))) IN ('owner', 'admin', 'platform_admin')
    )
  );

ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS ot_eligible boolean;
COMMENT ON COLUMN public.employees.ot_eligible IS 'null = follow tenant_ot_settings.ot_eligible_wage_threshold; true/false = explicit per-employee override.';

-- System Development
update public.dev_roadmap_items set stage = 'completed', module = 'hr',
  description = 'OT automation roadmap Phase 4: Tetapan Gaji & OT settings panel (owner/admin only) — tenant_ot_settings table holds editable normal hours, OT divisor, and all multipliers, defaulting to Akta Kerja 1955 figures. employees.ot_eligible lets an admin override the wage-threshold eligibility rule per employee (e.g. manual-labourer exception).'
  where title = 'HR: Tetapan Gaji & OT Settings Panel (OT roadmap Phase 4)';
insert into public.dev_roadmap_items (title, description, module, stage)
  select 'HR: Tetapan Gaji & OT Settings Panel (OT roadmap Phase 4)', 'OT automation roadmap Phase 4: Tetapan Gaji & OT settings panel (owner/admin only) — tenant_ot_settings table holds editable normal hours, OT divisor, and all multipliers, defaulting to Akta Kerja 1955 figures. employees.ot_eligible lets an admin override the wage-threshold eligibility rule per employee (e.g. manual-labourer exception).', 'hr', 'completed'
  where not exists (select 1 from public.dev_roadmap_items where title = 'HR: Tetapan Gaji & OT Settings Panel (OT roadmap Phase 4)');
