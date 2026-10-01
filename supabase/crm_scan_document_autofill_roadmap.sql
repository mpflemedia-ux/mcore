-- Roadmap: CRM Add Customer Scan document autofill (card / social / SSM)
-- WRITE-ONLY — Mike runs in Supabase SQL Editor after PR merge.
-- Also: redeploy Edge Function `ai-proxy` after wire workflow updates index.ts
--   so live scan_customer_document prompt includes notes + social/SSM rules.
-- No schema migration — reuses customers.* form fields + existing ai-proxy action.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.dev_roadmap_items
    WHERE title ILIKE '%Scan document%customer%'
       OR title ILIKE '%crm-scan%autofill%'
       OR title ILIKE '%Add Customer%Scan document%'
  ) THEN
    UPDATE public.dev_roadmap_items
    SET
      stage = 'completed',
      module = COALESCE(NULLIF(TRIM(module), ''), 'crm'),
      description = 'crm-scan.js V2 + ai-proxy scan_customer_document: vision autofill Name/Email/Phone/Address/City/Postcode/State/Notes from business card, TikTok/IG screenshot, SSM, or PDF. Bake ?v=2. Mike redeploy ai-proxy.',
      pr_url = 'https://github.com/mpflemedia-ux/mcore/pull/865'
    WHERE title ILIKE '%Scan document%customer%'
       OR title ILIKE '%crm-scan%autofill%'
       OR title ILIKE '%Add Customer%Scan document%';
  ELSE
    INSERT INTO public.dev_roadmap_items (
      title, description, module, stage, pr_url
    ) VALUES (
      'CRM: Add Customer Scan document autofill',
      'crm-scan.js V2 + ai-proxy scan_customer_document: vision autofill Name/Email/Phone/Address/City/Postcode/State/Notes from business card, TikTok/IG screenshot, SSM, or PDF. Bake ?v=2. Mike redeploy ai-proxy.',
      'crm',
      'completed',
      'https://github.com/mpflemedia-ux/mcore/pull/865'
    );
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN
  RAISE NOTICE 'dev_roadmap schema variant; skip: %', SQLERRM;
END $$;
