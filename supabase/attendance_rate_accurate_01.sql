reset role;

-- Attendance Rate (Share WhatsApp) — upgrade from "proxy" (logged records only) to a true
-- rate against expected working days: tenant working-days-of-week, Malaysia public holidays
-- (proper table, replaces the old Planner-notes-marker hack which was 2026-only and fragile),
-- and approved leave_requests (not attendance.status='on_leave', which is just an ad-hoc
-- manual field). Write-only, idempotent, run once in Supabase SQL Editor.

-- 1) Tenant working-days-of-week setting (reuses tenant_attendance_settings, same table as
--    Work start / Grace minutes). 0=Sun..6=Sat (matches JS Date.getDay()). Default Mon-Fri.
ALTER TABLE public.tenant_attendance_settings ADD COLUMN IF NOT EXISTS work_days int[] DEFAULT '{1,2,3,4,5}';
COMMENT ON COLUMN public.tenant_attendance_settings.work_days IS 'JS Date.getDay() values that are working days: 0=Sun..6=Sat. Default Mon-Fri. Used only for Attendance Rate calculation.';

-- 2) Proper public holidays table — tenant_id NULL = global default (applies to every tenant),
--    a non-null tenant_id would be a tenant-specific override (no editor UI ships with this
--    task; the column exists so a future per-tenant holiday list doesn't need a migration).
CREATE TABLE IF NOT EXISTS public.public_holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  holiday_date date NOT NULL,
  title_en text NOT NULL,
  title_bm text NOT NULL,
  created_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_public_holidays_date ON public.public_holidays(holiday_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_public_holidays_tenant ON public.public_holidays(tenant_id) WHERE deleted_at IS NULL;

ALTER TABLE public.public_holidays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_holidays_select ON public.public_holidays;
CREATE POLICY public_holidays_select ON public.public_holidays
  FOR SELECT USING (
    tenant_id IS NULL
    OR tenant_id IN (SELECT tenant_id FROM public.user_profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS public_holidays_admin_write ON public.public_holidays;
CREATE POLICY public_holidays_admin_write ON public.public_holidays
  FOR ALL USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

-- 3) Seed Malaysia federal public holidays 2026 as global defaults (tenant_id NULL).
--    Same 16 dates as the old seed_malaysia_public_holidays_2026() Planner-events seed — that
--    old function/data is left untouched (still visible in Planner as before, no regression),
--    this table is simply the new, clean, queryable source the Attendance Rate calc reads.
--    2027+ needs a similar INSERT run once the official gazette is published — not automatic.
INSERT INTO public.public_holidays (tenant_id, holiday_date, title_en, title_bm)
SELECT NULL, d::date, t_en, t_bm FROM (VALUES
  ('2026-01-01', 'New Year''s Day', 'Hari Tahun Baru'),
  ('2026-02-01', 'Federal Territory Day', 'Hari Wilayah Persekutuan'),
  ('2026-02-17', 'Chinese New Year', 'Tahun Baru Cina'),
  ('2026-02-18', 'Chinese New Year (Day 2)', 'Tahun Baru Cina (Hari 2)'),
  ('2026-03-21', 'Hari Raya Aidilfitri', 'Hari Raya Aidilfitri'),
  ('2026-03-22', 'Hari Raya Aidilfitri (Day 2)', 'Hari Raya Aidilfitri (Hari 2)'),
  ('2026-05-01', 'Labour Day', 'Hari Pekerja'),
  ('2026-05-27', 'Hari Raya Aidiladha', 'Hari Raya Aidiladha'),
  ('2026-05-31', 'Wesak Day', 'Hari Wesak'),
  ('2026-06-01', 'Yang di-Pertuan Agong''s Birthday', 'Hari Keputeraan YDPA'),
  ('2026-06-17', 'Awal Muharram', 'Awal Muharram'),
  ('2026-08-25', 'Maulidur Rasul', 'Maulidur Rasul'),
  ('2026-08-31', 'National Day (Merdeka)', 'Hari Kebangsaan'),
  ('2026-09-16', 'Malaysia Day', 'Hari Malaysia'),
  ('2026-11-08', 'Deepavali', 'Deepavali'),
  ('2026-12-25', 'Christmas Day', 'Hari Krismas')
) AS v(d, t_en, t_bm)
WHERE NOT EXISTS (
  SELECT 1 FROM public.public_holidays h WHERE h.tenant_id IS NULL AND h.holiday_date = v.d::date
);

-- System Development
update public.dev_roadmap_items set stage = 'completed', module = 'hr',
  description = 'Attendance Rate in the Share WhatsApp summary upgraded from a proxy (% of logged records) to a true rate against expected working days: new tenant "working days of week" setting (Attendance Controls panel), a proper public_holidays table (replaces the old 2026-only Planner-notes-marker hack), and approved leave_requests (not the manual attendance.status=on_leave field). Half-day = 0.5 credit, late reclassifies a stray present+is_late row without double-counting, unlogged expected days count as Absent (staff with zero records no longer vanish from the report), employees joined mid-period are bounded by join_date, broadcast summary caps at 25 staff with a "+N more" note. No change to Print (still a literal filtered export of the log).'
  where title = 'Attendance: Accurate Attendance Rate Calculation';
insert into public.dev_roadmap_items (title, description, module, stage)
  select 'Attendance: Accurate Attendance Rate Calculation', 'Attendance Rate in the Share WhatsApp summary upgraded from a proxy (% of logged records) to a true rate against expected working days: new tenant "working days of week" setting (Attendance Controls panel), a proper public_holidays table (replaces the old 2026-only Planner-notes-marker hack), and approved leave_requests (not the manual attendance.status=on_leave field). Half-day = 0.5 credit, late reclassifies a stray present+is_late row without double-counting, unlogged expected days count as Absent (staff with zero records no longer vanish from the report), employees joined mid-period are bounded by join_date, broadcast summary caps at 25 staff with a "+N more" note. No change to Print (still a literal filtered export of the log).', 'hr', 'completed'
  where not exists (select 1 from public.dev_roadmap_items where title = 'Attendance: Accurate Attendance Rate Calculation');
