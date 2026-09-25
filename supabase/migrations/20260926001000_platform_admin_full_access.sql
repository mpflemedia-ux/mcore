-- Platform admin full read/write on every tenant-scoped table.
-- Support session already points user_profiles.tenant_id at the target.
-- get_my_tenant_id() must follow that column so module write policies pass.
-- Extra FOR ALL policy: is_platform_admin() — covers tables whose old
-- policies never listed platform_admin (chart_of_accounts seed 42501).

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND lower(coalesce(role, '')) = 'platform_admin'
  );
$fn$;

CREATE OR REPLACE FUNCTION public.get_my_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT tenant_id FROM public.user_profiles WHERE id = auth.uid();
$fn$;

REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_tenant_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_tenant_id() TO authenticated;

DO $fn$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND c.column_name = 'tenant_id'
      AND t.table_type = 'BASE TABLE'
      AND c.table_name NOT IN ('platform_admin_audit')
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.table_name);
    EXECUTE format('DROP POLICY IF EXISTS platform_admin_all ON public.%I', r.table_name);
    EXECUTE format(
      'CREATE POLICY platform_admin_all ON public.%I FOR ALL TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin())',
      r.table_name
    );
  END LOOP;
END;
$fn$;
