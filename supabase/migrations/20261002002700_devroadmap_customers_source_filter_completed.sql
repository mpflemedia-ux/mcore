-- Roadmap: CRM Customers Source filter (multi-function unlocked by Mike)
-- WRITE-ONLY — run in Supabase SQL Editor after PR merge + bake.
-- Column customers.source already migrated (#870) — NO schema change.
-- Columns: title, description, module, stage, pr_url

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.dev_roadmap_items
    WHERE title ILIKE '%customer%source%filter%'
       OR title ILIKE '%CRM%Source%filter%'
       OR title ILIKE '%crm-source-filter%'
  ) THEN
    UPDATE public.dev_roadmap_items
    SET
      stage = 'completed',
      module = COALESCE(NULLIF(TRIM(module), ''), 'crm'),
      description = 'Customers list Source filter (#crm-source-filter). _crmState.source + exact .eq(source) in _crmLoad; dropdown options from distinct non-empty tenant sources. Bake-only via scripts/patch_crm_customer_source_filter.py. Does not touch search/sort options, form #cf-source, crm-scan, table-fit, public form, CSS, print, sidebar, openPage, localStorage, or SQL RPCs. Schema: customers.source already present (#870).',
      pr_url = 'https://github.com/mpflemedia-ux/mcore/pull/871'
    WHERE title ILIKE '%customer%source%filter%'
       OR title ILIKE '%CRM%Source%filter%'
       OR title ILIKE '%crm-source-filter%';
  ELSE
    INSERT INTO public.dev_roadmap_items (
      title, description, module, stage, pr_url
    ) VALUES (
      'CRM: Customers Source filter (#crm-source-filter)',
      'Customers list Source filter (#crm-source-filter). _crmState.source + exact .eq(source) in _crmLoad; dropdown options from distinct non-empty tenant sources. Bake-only via scripts/patch_crm_customer_source_filter.py. Does not touch search/sort options, form #cf-source, crm-scan, table-fit, public form, CSS, print, sidebar, openPage, localStorage, or SQL RPCs. Schema: customers.source already present (#870).',
      'crm',
      'completed',
      'https://github.com/mpflemedia-ux/mcore/pull/871'
    );
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN
  RAISE NOTICE 'dev_roadmap schema variant; skip: %', SQLERRM;
END $$;
