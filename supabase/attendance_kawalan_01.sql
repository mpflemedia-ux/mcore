reset role;

-- Attendance control/governance hardening, per audit:
-- 1) RLS SELECT on attendance was tenant-wide (any logged-in user saw every staff's
--    attendance) — tighten to: owner/admin/platform_admin/manager/hr see everyone in the
--    tenant (unchanged for them), everyone else sees only their own row (matches the app's
--    own existing intent — "Staff with HR module: attendance... self only" — which the RLS
--    never actually enforced). Scope: base role check only, NOT a full replica of granular
--    module_override permissions (hr_employees/hr_payroll per-tenant custom config) — the
--    client-side default-role-module fallback has no server equivalent, so replicating it
--    fully risks blocking a legitimately-granted custom role. If a tenant relies on a custom
--    role config for HR access rather than the manager/hr role string, flag it and this
--    policy will need a tenant-specific case added.
-- 2) tenant_attendance_settings.work_days: reject 7/7 (no rest day), per Employment Act 1955
--    minimum 1 rest day/week. Defense-in-depth alongside the client-side check already added
--    in _attSavePolicy().
-- Write-only, idempotent, run once in Supabase SQL Editor.

DROP POLICY IF EXISTS attendance_select_own_tenant ON public.attendance;
CREATE POLICY attendance_select_own_tenant ON public.attendance
  FOR SELECT TO authenticated
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
  );

ALTER TABLE public.tenant_attendance_settings DROP CONSTRAINT IF EXISTS tas_min_rest_day;
ALTER TABLE public.tenant_attendance_settings ADD CONSTRAINT tas_min_rest_day
  CHECK (work_days IS NULL OR array_length(work_days, 1) IS NULL OR array_length(work_days, 1) < 7);

-- System Development
update public.dev_roadmap_items set stage = 'completed', module = 'hr',
  description = 'Attendance control/governance hardening: (1) attendance SELECT RLS was tenant-wide — any staff could see every other staff''s attendance log; tightened so only owner/admin/platform_admin/manager/hr see everyone, others see only their own row. (2) auditLog() on attendance create/update/delete now captures old_data/new_data (was action+table+id only — an edit happened but not what changed). (3) "Hari bekerja seminggu" rejects 7/7 (no rest day), client validation + DB CHECK constraint, per Employment Act 1955 minimum 1 rest day/week.'
  where title = 'Attendance Control/Governance Hardening';
insert into public.dev_roadmap_items (title, description, module, stage)
  select 'Attendance Control/Governance Hardening', 'Attendance control/governance hardening: (1) attendance SELECT RLS was tenant-wide — any staff could see every other staff''s attendance log; tightened so only owner/admin/platform_admin/manager/hr see everyone, others see only their own row. (2) auditLog() on attendance create/update/delete now captures old_data/new_data (was action+table+id only — an edit happened but not what changed). (3) "Hari bekerja seminggu" rejects 7/7 (no rest day), client validation + DB CHECK constraint, per Employment Act 1955 minimum 1 rest day/week.', 'hr', 'completed'
  where not exists (select 1 from public.dev_roadmap_items where title = 'Attendance Control/Governance Hardening');
