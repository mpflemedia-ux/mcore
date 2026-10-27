reset role;

-- Phase 1+2 of the OT automation roadmap (foundation — must run before any later phase):
--
-- Phase 1 — Auto clock-out: attendance.clock_out_auto flags a row where the system filled
-- clock_out itself (shift/work end + 2h buffer passed, no log) because actual hours-worked
-- is the base input every later OT phase needs and must never be blocked on a missing log.
-- Staff can correct the estimated time themselves afterwards (banner on the Attendance page).
--
-- Phase 2 — Shift-aware Attendance Rate: no schema change (shifts/shift_hours config already
-- exist) — _attEmployeeSummary/_attComputeLate now check the shifts.js roster per employee
-- per day before falling back to the tenant-wide work_days/work_start pattern.
--
-- Also closes a gap found while building Phase 1's staff self-correction feature: attendance
-- INSERT/UPDATE RLS was tenant-wide (any staff could write to ANY other staff's row via direct
-- API calls, even though the UI never exposed this) — tightened to self-or-admin, same pattern
-- as the SELECT fix in attendance_kawalan_01/02.sql. DELETE stays admin-only (matches the
-- existing _attendanceDelete() UI gate — deleting isn't something a self-correction flow needs).
--
-- Write-only, idempotent, run once in Supabase SQL Editor — run AFTER attendance_kawalan_01.sql
-- and attendance_kawalan_02.sql.

ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS clock_out_auto boolean DEFAULT false;
COMMENT ON COLUMN public.attendance.clock_out_auto IS 'true = clock_out was system-estimated (shift/work end + 2h, no log), not entered by the employee or admin.';

DROP POLICY IF EXISTS attendance_insert_own_tenant ON public.attendance;
CREATE POLICY attendance_insert_own_tenant ON public.attendance
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM public.user_profiles WHERE id = auth.uid())
    AND (
      EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid()
          AND lower(trim(coalesce(up.role, ''))) IN ('owner', 'admin', 'platform_admin', 'manager', 'hr')
      )
      OR employee_id IN (SELECT id FROM public.my_employee_row())
    )
  );

DROP POLICY IF EXISTS attendance_update_own_tenant ON public.attendance;
CREATE POLICY attendance_update_own_tenant ON public.attendance
  FOR UPDATE TO authenticated
  USING (
    tenant_id = (SELECT tenant_id FROM public.user_profiles WHERE id = auth.uid())
    AND (
      EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid()
          AND lower(trim(coalesce(up.role, ''))) IN ('owner', 'admin', 'platform_admin', 'manager', 'hr')
      )
      OR employee_id IN (SELECT id FROM public.my_employee_row())
    )
  )
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM public.user_profiles WHERE id = auth.uid())
    AND (
      EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid()
          AND lower(trim(coalesce(up.role, ''))) IN ('owner', 'admin', 'platform_admin', 'manager', 'hr')
      )
      OR employee_id IN (SELECT id FROM public.my_employee_row())
    )
  );

-- DELETE stays admin-only (not self) — matches the existing _attendanceDelete() UI gate.
DROP POLICY IF EXISTS attendance_delete_own_tenant ON public.attendance;
CREATE POLICY attendance_delete_own_tenant ON public.attendance
  FOR DELETE TO authenticated
  USING (
    tenant_id = (SELECT tenant_id FROM public.user_profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND lower(trim(coalesce(up.role, ''))) IN ('owner', 'admin', 'platform_admin', 'manager', 'hr')
    )
  );

-- System Development
update public.dev_roadmap_items set stage = 'completed', module = 'hr',
  description = 'OT automation roadmap Phase 1+2: (1) Auto clock-out — a row with clock_in but no clock_out, past shift/work end + 2h buffer, is auto-filled and flagged clock_out_auto so hours-worked is never blocked; staff get a banner to self-correct the estimate. (2) Shift-aware Attendance Rate — Expected Working Days and lateness threshold now follow the employee''s actual shifts.js roster (per employee, per day) when they have one, falling back to the tenant-wide work_days/work_start pattern only for employees with no shift rows at all. Also tightened attendance INSERT/UPDATE RLS to self-or-admin (was tenant-wide) — found while building the self-correction flow; DELETE stays admin-only.'
  where title = 'Attendance: Auto Clock-Out + Shift-Aware Rate (OT roadmap Phase 1+2)';
insert into public.dev_roadmap_items (title, description, module, stage)
  select 'Attendance: Auto Clock-Out + Shift-Aware Rate (OT roadmap Phase 1+2)', 'OT automation roadmap Phase 1+2: (1) Auto clock-out — a row with clock_in but no clock_out, past shift/work end + 2h buffer, is auto-filled and flagged clock_out_auto so hours-worked is never blocked; staff get a banner to self-correct the estimate. (2) Shift-aware Attendance Rate — Expected Working Days and lateness threshold now follow the employee''s actual shifts.js roster (per employee, per day) when they have one, falling back to the tenant-wide work_days/work_start pattern only for employees with no shift rows at all. Also tightened attendance INSERT/UPDATE RLS to self-or-admin (was tenant-wide) — found while building the self-correction flow; DELETE stays admin-only.', 'hr', 'completed'
  where not exists (select 1 from public.dev_roadmap_items where title = 'Attendance: Auto Clock-Out + Shift-Aware Rate (OT roadmap Phase 1+2)');
