-- tenants has no tenant_id column so platform_admin_all loop skipped it.
-- Date/plan edits from All Clients were silent 0-row updates.

DROP POLICY IF EXISTS tenants_platform_admin_all ON public.tenants;
CREATE POLICY tenants_platform_admin_all ON public.tenants
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());
