reset role;

-- Follow-up to attendance_kawalan_01.sql: that migration replaced policy
-- "attendance_select_own_tenant" but missed a SECOND, differently-named policy on the same
-- table — "attendance_select_tenant" (from 20260815010000_dashboard_tenant_select_rls.sql,
-- added later to fix empty Dashboard KPIs for non-admin staff). Postgres RLS policies are
-- OR'd together, so that second policy alone still granted every tenant member full
-- tenant-wide SELECT on attendance (notes, GPS, everything) — completely neutralizing the
-- self-or-admin restriction from kawalan_01, confirmed live by testing with a real "staff"
-- role account (saw every other staff's attendance).
--
-- Fix: drop that second policy outright (closes the loophole), and give the 3 Dashboard
-- widgets that legitimately need a team-wide "who's in today" view a narrow, SECURITY
-- DEFINER RPC instead — attendance_team_status(from,to) returns ONLY employee_id/date/
-- status/clock_in/clock_out/created_at (no notes, no GPS, no office code, no work_mode) to
-- any authenticated tenant member. The sensitive full-detail attendance log stays restricted
-- to self-or-admin via the direct table RLS from kawalan_01 (unchanged, still correct).
-- Write-only, idempotent, run once in Supabase SQL Editor — run AFTER attendance_kawalan_01.sql.

DROP POLICY IF EXISTS attendance_select_tenant ON public.attendance;

CREATE OR REPLACE FUNCTION public.attendance_team_status(p_from date, p_to date)
RETURNS TABLE(id uuid, employee_id uuid, date date, status text, clock_in time, clock_out time, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.id, a.employee_id, a.date, a.status, a.clock_in, a.clock_out, a.created_at
  FROM public.attendance a
  WHERE a.tenant_id = public.get_my_tenant_id()
    AND a.deleted_at IS NULL
    AND a.date BETWEEN p_from AND p_to;
$$;

REVOKE ALL ON FUNCTION public.attendance_team_status(date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.attendance_team_status(date, date) TO authenticated;

COMMENT ON FUNCTION public.attendance_team_status(date, date) IS
  'Minimal team-presence read for Dashboard widgets (status/clock times only, no notes/GPS) — any tenant member, bypasses the self-or-admin attendance RLS by design.';

-- System Development
update public.dev_roadmap_items set stage = 'completed', module = 'hr',
  description = 'Follow-up to Attendance Control/Governance Hardening: a second, differently-named RLS policy (attendance_select_tenant, added earlier for Dashboard KPIs) was still granting every tenant member full tenant-wide SELECT on attendance, neutralizing the self-or-admin restriction. Dropped that policy; Dashboard''s 3 team-presence widgets now read through a new minimal RPC (attendance_team_status — status/clock times only, no notes/GPS) instead of the raw table, so the Dashboard "who''s in today" feature keeps working for every tenant member while the sensitive full attendance log stays restricted to self-or-admin.'
  where title = 'Attendance Control/Governance Hardening — RLS loophole fix';
insert into public.dev_roadmap_items (title, description, module, stage)
  select 'Attendance Control/Governance Hardening — RLS loophole fix', 'Follow-up to Attendance Control/Governance Hardening: a second, differently-named RLS policy (attendance_select_tenant, added earlier for Dashboard KPIs) was still granting every tenant member full tenant-wide SELECT on attendance, neutralizing the self-or-admin restriction. Dropped that policy; Dashboard''s 3 team-presence widgets now read through a new minimal RPC (attendance_team_status — status/clock times only, no notes/GPS) instead of the raw table, so the Dashboard "who''s in today" feature keeps working for every tenant member while the sensitive full attendance log stays restricted to self-or-admin.', 'hr', 'completed'
  where not exists (select 1 from public.dev_roadmap_items where title = 'Attendance Control/Governance Hardening — RLS loophole fix');
