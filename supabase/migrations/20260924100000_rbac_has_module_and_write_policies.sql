-- RBAC server parity: role module helpers + tighten write policies
-- Mirror client _rpModulesForCurrentUser / canAccess roughly.
-- Owner/admin/platform_admin → all modules (never lock out Owner).

CREATE OR REPLACE FUNCTION public.get_my_role_modules()
RETURNS text[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r text;
  ov jsonb;
  tid uuid;
  cfg jsonb;
  mods text[];
BEGIN
  SELECT lower(trim(coalesce(role, ''))), module_override, tenant_id
    INTO r, ov, tid
  FROM public.user_profiles
  WHERE id = auth.uid();

  IF r IS NULL OR r = '' THEN
    RETURN ARRAY[]::text[];
  END IF;

  IF r IN ('owner', 'admin', 'platform_admin') THEN
    RETURN ARRAY['*']::text[];
  END IF;

  IF ov IS NOT NULL AND jsonb_typeof(ov) = 'array' THEN
    SELECT coalesce(array_agg(x), ARRAY[]::text[])
      INTO mods
    FROM jsonb_array_elements_text(ov) AS t(x);
    RETURN mods;
  END IF;

  IF tid IS NULL THEN
    tid := public.get_my_tenant_id();
  END IF;

  SELECT t.config -> 'roles' -> r INTO cfg
  FROM public.tenants t
  WHERE t.id = tid;

  IF cfg IS NULL THEN
    -- try underscore-normalized key
    SELECT t.config -> 'roles' -> replace(r, ' ', '_') INTO cfg
    FROM public.tenants t
    WHERE t.id = tid;
  END IF;

  IF cfg IS NOT NULL AND jsonb_typeof(cfg) = 'array' THEN
    SELECT coalesce(array_agg(x), ARRAY[]::text[])
      INTO mods
    FROM jsonb_array_elements_text(cfg) AS t(x);
    RETURN mods;
  END IF;

  RETURN ARRAY[]::text[];
END;
$$;

CREATE OR REPLACE FUNCTION public.has_module(p_module text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mods text[];
  m text := lower(trim(coalesce(p_module, '')));
BEGIN
  IF m = '' THEN
    RETURN false;
  END IF;
  mods := public.get_my_role_modules();
  IF mods @> ARRAY['*']::text[] THEN
    RETURN true;
  END IF;
  IF m = ANY (mods) THEN
    RETURN true;
  END IF;
  -- HR parent grants children (mirror client canAccess)
  IF m = 'hr' AND EXISTS (
    SELECT 1 FROM unnest(mods) x WHERE x = 'hr' OR x LIKE 'hr_%'
  ) THEN
    RETURN true;
  END IF;
  IF m LIKE 'hr_%' AND 'hr' = ANY (mods) THEN
    RETURN true;
  END IF;
  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_role_modules() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_module(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_role_modules() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_module(text) TO authenticated;

COMMENT ON FUNCTION public.get_my_role_modules() IS
  'Modules for auth.uid() from module_override or tenants.config.roles; owner/admin → {*}';
COMMENT ON FUNCTION public.has_module(text) IS
  'True if caller has module (or owner/admin *). Used by write RLS policies.';

-- ---------- customers: SELECT stays tenant-wide; writes require crm ----------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'customers'
  ) THEN
    EXECUTE 'ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS customers_insert_tenant ON public.customers';
    EXECUTE 'DROP POLICY IF EXISTS customers_update_tenant ON public.customers';
    EXECUTE 'DROP POLICY IF EXISTS customers_delete_tenant ON public.customers';
    EXECUTE 'DROP POLICY IF EXISTS customers_insert_module ON public.customers';
    EXECUTE 'DROP POLICY IF EXISTS customers_update_module ON public.customers';
    EXECUTE 'DROP POLICY IF EXISTS customers_delete_module ON public.customers';
    EXECUTE 'DROP POLICY IF EXISTS customers_tenant_all ON public.customers';
    EXECUTE 'DROP POLICY IF EXISTS customers_all_tenant ON public.customers';

    EXECUTE $p$
      CREATE POLICY customers_insert_module ON public.customers
        FOR INSERT TO authenticated
        WITH CHECK (
          tenant_id = public.get_my_tenant_id()
          AND public.has_module('crm')
        )
    $p$;

    EXECUTE $p$
      CREATE POLICY customers_update_module ON public.customers
        FOR UPDATE TO authenticated
        USING (
          tenant_id = public.get_my_tenant_id()
          AND public.has_module('crm')
        )
        WITH CHECK (
          tenant_id = public.get_my_tenant_id()
          AND public.has_module('crm')
        )
    $p$;

    -- Soft-delete is UPDATE; hard DELETE rare — still gate it
    EXECUTE $p$
      CREATE POLICY customers_delete_module ON public.customers
        FOR DELETE TO authenticated
        USING (
          tenant_id = public.get_my_tenant_id()
          AND public.has_module('crm')
        )
    $p$;
  END IF;
END $$;

-- ---------- payment_vouchers: replace FOR ALL with select + module writes ----------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'payment_vouchers'
  ) THEN
    EXECUTE 'ALTER TABLE public.payment_vouchers ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS payment_vouchers_tenant_all ON public.payment_vouchers';
    EXECUTE 'DROP POLICY IF EXISTS payment_vouchers_select_tenant ON public.payment_vouchers';
    EXECUTE 'DROP POLICY IF EXISTS payment_vouchers_write_module ON public.payment_vouchers';

    EXECUTE $p$
      CREATE POLICY payment_vouchers_select_tenant ON public.payment_vouchers
        FOR SELECT TO authenticated
        USING (tenant_id = public.get_my_tenant_id())
    $p$;

    EXECUTE $p$
      CREATE POLICY payment_vouchers_write_module ON public.payment_vouchers
        FOR ALL TO authenticated
        USING (
          tenant_id = public.get_my_tenant_id()
          AND public.has_module('vouchers')
        )
        WITH CHECK (
          tenant_id = public.get_my_tenant_id()
          AND public.has_module('vouchers')
        )
    $p$;
  END IF;
END $$;

-- ---------- sales_commissions: require sales_commission module for writes ----------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'sales_commissions'
  ) THEN
    EXECUTE 'ALTER TABLE public.sales_commissions ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS sales_commissions_tenant ON public.sales_commissions';
    EXECUTE 'DROP POLICY IF EXISTS sales_commissions_select_tenant ON public.sales_commissions';
    EXECUTE 'DROP POLICY IF EXISTS sales_commissions_write_module ON public.sales_commissions';

    EXECUTE $p$
      CREATE POLICY sales_commissions_select_tenant ON public.sales_commissions
        FOR SELECT TO authenticated
        USING (tenant_id = public.get_my_tenant_id())
    $p$;

    EXECUTE $p$
      CREATE POLICY sales_commissions_write_module ON public.sales_commissions
        FOR ALL TO authenticated
        USING (
          tenant_id = public.get_my_tenant_id()
          AND public.has_module('sales_commission')
        )
        WITH CHECK (
          tenant_id = public.get_my_tenant_id()
          AND public.has_module('sales_commission')
        )
    $p$;
  END IF;
END $$;
