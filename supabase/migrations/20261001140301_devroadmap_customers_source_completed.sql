-- Roadmap: CRM Customer Source / Sumber
-- WRITE-ONLY — run in Supabase SQL Editor after PR merge + bake.
-- Columns: title, description, module, stage, pr_url

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.dev_roadmap_items
    WHERE title ILIKE '%customer%source%Sumber%'
       OR title ILIKE '%CRM%Source%Sumber%'
       OR title ILIKE '%customers.source%'
  ) THEN
    UPDATE public.dev_roadmap_items
    SET
      stage = 'completed',
      module = COALESCE(NULLIF(TRIM(module), ''), 'crm'),
      description = 'customers.source (text) + optional tenant/source index. CRM form #cf-source free-text + list column via bake of renderCustomerForm / _crmSave / _crmLoad only. Label Source/Sumber. No public form RPC, crm-scan, detail/SOA, global CSS, or overlay JS.',
      pr_url = 'https://github.com/mpflemedia-ux/mcore/pull/PLACEHOLDER'
    WHERE title ILIKE '%customer%source%Sumber%'
       OR title ILIKE '%CRM%Source%Sumber%'
       OR title ILIKE '%customers.source%';
  ELSE
    INSERT INTO public.dev_roadmap_items (
      title, description, module, stage, pr_url
    ) VALUES (
      'CRM: Customer Source / Sumber (customers.source)',
      'customers.source (text) + optional tenant/source index. CRM form #cf-source free-text + list column via bake of renderCustomerForm / _crmSave / _crmLoad only. Label Source/Sumber. No public form RPC, crm-scan, detail/SOA, global CSS, or overlay JS.',
      'crm',
      'completed',
      'https://github.com/mpflemedia-ux/mcore/pull/PLACEHOLDER'
    );
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN
  RAISE NOTICE 'dev_roadmap schema variant; skip: %', SQLERRM;
END $$;
