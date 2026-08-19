-- Fix: employees table has RLS enabled (20260813160000) but only ever got
-- SELECT policies (employees_select_own_tenant, then employees_select_tenant
-- from 20260815010000) — confirmed via grep across every migration file,
-- no INSERT or UPDATE policy for employees exists anywhere. The earlier
-- migration even left itself a note about this ("Optional: allow tenant
-- members to update/insert only if policies missing") but never followed
-- through. With RLS enabled and no permissive write policy, every "Save
-- New Employee" (INSERT) and "Edit Employee" (UPDATE) has been silently
-- blocked for every tenant, always — the client-side .eq('tenant_id', ...)
-- filters app/index.html already applies are correct but irrelevant here;
-- RLS runs regardless and had nothing to grant the write.
--
-- No DELETE policy added: confirmed via grep that app/index.html never
-- issues a hard .delete() against employees — the "delete" flow (line
-- ~22082) is a soft delete via .update({deleted_at: ...}), which the new
-- UPDATE policy below already covers. No separate hard-delete call exists
-- to flag.
--
-- Reuses public.get_my_tenant_id() (SECURITY DEFINER, already the current
-- convention — see its use in employees_select_tenant from
-- 20260815010000_dashboard_tenant_select_rls.sql) rather than a new helper
-- or the older inline-subquery style from 20260813160000.

DROP POLICY IF EXISTS employees_insert_tenant ON public.employees;
CREATE POLICY employees_insert_tenant ON public.employees
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_my_tenant_id());

DROP POLICY IF EXISTS employees_update_tenant ON public.employees;
CREATE POLICY employees_update_tenant ON public.employees
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());
