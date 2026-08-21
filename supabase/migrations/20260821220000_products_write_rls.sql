-- products: RLS enabled with SELECT-only policy (dashboard migration).
-- INSERT/UPDATE had no policy → "new row violates row-level security policy for table products"
-- Same fix pattern as 20260819020000_employees_write_rls.sql

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS products_select_tenant ON public.products;
CREATE POLICY products_select_tenant ON public.products
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id());

DROP POLICY IF EXISTS products_insert_tenant ON public.products;
CREATE POLICY products_insert_tenant ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_my_tenant_id());

DROP POLICY IF EXISTS products_update_tenant ON public.products;
CREATE POLICY products_update_tenant ON public.products
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());

-- Soft-delete uses UPDATE (deleted_at). No hard DELETE policy needed unless app adds one.
