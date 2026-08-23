-- POS shift open fails: "new row violates row-level security policy for table pos_sessions"
-- Cause: RLS enabled without INSERT/UPDATE policies for authenticated tenant users.

ALTER TABLE public.pos_sessions ENABLE ROW LEVEL SECURITY;

-- SELECT: own tenant
DROP POLICY IF EXISTS pos_sessions_select_tenant ON public.pos_sessions;
CREATE POLICY pos_sessions_select_tenant ON public.pos_sessions
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id());

-- INSERT: own tenant; cashier is self (or any tenant member starting a shift)
DROP POLICY IF EXISTS pos_sessions_insert_tenant ON public.pos_sessions;
CREATE POLICY pos_sessions_insert_tenant ON public.pos_sessions
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.get_my_tenant_id()
    AND (cashier_id IS NULL OR cashier_id = auth.uid())
  );

-- UPDATE: own tenant (close shift, set closing cash, etc.)
DROP POLICY IF EXISTS pos_sessions_update_tenant ON public.pos_sessions;
CREATE POLICY pos_sessions_update_tenant ON public.pos_sessions
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());

-- Optional DELETE soft-path (rare)
DROP POLICY IF EXISTS pos_sessions_delete_tenant ON public.pos_sessions;
CREATE POLICY pos_sessions_delete_tenant ON public.pos_sessions
  FOR DELETE TO authenticated
  USING (tenant_id = public.get_my_tenant_id());

-- Ensure pos_transactions can insert for sales under open shift
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'pos_transactions'
  ) THEN
    EXECUTE 'ALTER TABLE public.pos_transactions ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS pos_transactions_select_tenant ON public.pos_transactions';
    EXECUTE 'CREATE POLICY pos_transactions_select_tenant ON public.pos_transactions FOR SELECT TO authenticated USING (tenant_id = public.get_my_tenant_id())';
    EXECUTE 'DROP POLICY IF EXISTS pos_transactions_insert_tenant ON public.pos_transactions';
    EXECUTE 'CREATE POLICY pos_transactions_insert_tenant ON public.pos_transactions FOR INSERT TO authenticated WITH CHECK (tenant_id = public.get_my_tenant_id())';
    EXECUTE 'DROP POLICY IF EXISTS pos_transactions_update_tenant ON public.pos_transactions';
    EXECUTE 'CREATE POLICY pos_transactions_update_tenant ON public.pos_transactions FOR UPDATE TO authenticated USING (tenant_id = public.get_my_tenant_id()) WITH CHECK (tenant_id = public.get_my_tenant_id())';
  END IF;
END $$;
