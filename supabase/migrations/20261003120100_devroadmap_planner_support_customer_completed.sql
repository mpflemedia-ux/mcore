-- Roadmap: Planner support-mode client dropdown uses CRM customers
-- WRITE-ONLY. Run in Supabase SQL Editor after the column migration.
-- Columns: title, description, module, stage, pr_url

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.dev_roadmap_items
    WHERE title ILIKE '%planner%support%customer%'
       OR title ILIKE '%platform_activities.customer_id%'
  ) THEN
    UPDATE public.dev_roadmap_items
    SET
      stage = 'completed',
      module = COALESCE(NULLIF(TRIM(module), ''), 'planner'),
      description = 'Nullable platform_activities.customer_id (FK to customers.id when that uuid column exists). Support mode (sessionStorage mcore_support_session) makes Planner #pl-tenant list customers for APP.tenant.id and save customer_id. Outside support, #pl-tenant still lists tenants into related_tenant_id. No customer uuid is written to related_tenant_id.',
      pr_url = 'https://github.com/mpflemedia-ux/mcore/blob/main/supabase/migrations/20261003120000_platform_activities_customer_id.sql'
    WHERE title ILIKE '%planner%support%customer%'
       OR title ILIKE '%platform_activities.customer_id%';
  ELSE
    INSERT INTO public.dev_roadmap_items (
      title, description, module, stage, pr_url
    ) VALUES (
      'Planner: support-mode client is CRM customer (platform_activities.customer_id)',
      'Nullable platform_activities.customer_id (FK to customers.id when that uuid column exists). Support mode (sessionStorage mcore_support_session) makes Planner #pl-tenant list customers for APP.tenant.id and save customer_id. Outside support, #pl-tenant still lists tenants into related_tenant_id. No customer uuid is written to related_tenant_id.',
      'planner',
      'completed',
      'https://github.com/mpflemedia-ux/mcore/blob/main/supabase/migrations/20261003120000_platform_activities_customer_id.sql'
    );
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN
  RAISE NOTICE 'dev_roadmap schema variant; skip: %', SQLERRM;
END $$;
