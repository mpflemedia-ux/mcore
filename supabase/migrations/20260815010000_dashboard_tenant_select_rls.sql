-- Dashboard KPIs: all active members of a tenant can READ operational data (same tenant).
-- Fixes empty dashboard for invited staff / non-owner roles (all tenants).

CREATE OR REPLACE FUNCTION public.get_my_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.user_profiles
  WHERE id = auth.uid() AND deleted_at IS NULL
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_tenant_id() TO authenticated;

-- Helper: recreate SELECT policy for a table (tenant-scoped)
-- invoices
ALTER TABLE IF EXISTS public.invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS invoices_select_tenant ON public.invoices;
CREATE POLICY invoices_select_tenant ON public.invoices
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id());

-- payments / invoice payments
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='payments') THEN
    EXECUTE 'ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS payments_select_tenant ON public.payments';
    EXECUTE 'CREATE POLICY payments_select_tenant ON public.payments FOR SELECT TO authenticated USING (tenant_id = public.get_my_tenant_id())';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='invoice_payments') THEN
    EXECUTE 'ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS invoice_payments_select_tenant ON public.invoice_payments';
    EXECUTE 'CREATE POLICY invoice_payments_select_tenant ON public.invoice_payments FOR SELECT TO authenticated USING (tenant_id = public.get_my_tenant_id())';
  END IF;
END $$;

-- pos_transactions
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='pos_transactions') THEN
    EXECUTE 'ALTER TABLE public.pos_transactions ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS pos_transactions_select_tenant ON public.pos_transactions';
    EXECUTE 'CREATE POLICY pos_transactions_select_tenant ON public.pos_transactions FOR SELECT TO authenticated USING (tenant_id = public.get_my_tenant_id())';
  END IF;
END $$;

-- customers
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='customers') THEN
    EXECUTE 'ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS customers_select_tenant ON public.customers';
    EXECUTE 'CREATE POLICY customers_select_tenant ON public.customers FOR SELECT TO authenticated USING (tenant_id = public.get_my_tenant_id())';
  END IF;
END $$;

-- products (top product)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='products') THEN
    EXECUTE 'ALTER TABLE public.products ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS products_select_tenant ON public.products';
    EXECUTE 'CREATE POLICY products_select_tenant ON public.products FOR SELECT TO authenticated USING (tenant_id = public.get_my_tenant_id())';
  END IF;
END $$;

-- employees (people / attendance already often open)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='employees') THEN
    EXECUTE 'ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS employees_select_tenant ON public.employees';
    EXECUTE 'CREATE POLICY employees_select_tenant ON public.employees FOR SELECT TO authenticated USING (tenant_id = public.get_my_tenant_id())';
  END IF;
END $$;

-- attendance
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='attendance') THEN
    EXECUTE 'ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS attendance_select_tenant ON public.attendance';
    EXECUTE 'CREATE POLICY attendance_select_tenant ON public.attendance FOR SELECT TO authenticated USING (tenant_id = public.get_my_tenant_id())';
  END IF;
END $$;
