-- Roadmap: Flash Fulfillment (FFM) Malaysia connector — pilot Brzky Empire.
-- WRITE-ONLY — run in Supabase SQL Editor AFTER
--   supabase/migrations/20261029120000_ffm_connector.sql
--   supabase/migrations/20261029120100_ffm_cron.sql

DO $$
DECLARE
  v_desc text := 'Flash Fulfillment MY connector: per-tenant FFM accounts (e.g. Brzky own stock + Funded/Sales Plan), keys write-only in service_role table, all calls via edge fns (ffm-api/ffm-webhook/ffm-cron, Algorithm 2 signing). Product sync by barcode, Send via FFM on DO (account picker, address validation), status webhook (HMAC + idempotent) + 30-min polling, label, tracking + WhatsApp link, cancel before packing, FFM stock kept separate from products.stock_qty with low-stock alerts, daily reconciliation, ASN from PO (stock counts only on FFM receipt), returns, FFM fee to journal (Dr expense / Cr AP, reversal on cancel), Funded read-only view linked to Sales Plan.';
  v_url text := 'https://github.com/mpflemedia-ux/mcore/commit/55d4d1ce0446f682f05d85924ad0d1ba988cfebf';
BEGIN
  IF EXISTS (SELECT 1 FROM public.dev_roadmap_items WHERE title ILIKE '%flash fulfillment%' OR title ILIKE '%ffm connector%') THEN
    UPDATE public.dev_roadmap_items
    SET stage = 'completed', module = COALESCE(NULLIF(TRIM(module), ''), 'logistics'), description = v_desc, pr_url = v_url
    WHERE title ILIKE '%flash fulfillment%' OR title ILIKE '%ffm connector%';
  ELSE
    INSERT INTO public.dev_roadmap_items (title, description, module, stage, pr_url)
    VALUES ('Logistics: Flash Fulfillment (FFM) Malaysia connector', v_desc, 'logistics', 'completed', v_url);
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN
  RAISE NOTICE 'dev_roadmap schema variant; skip: %', SQLERRM;
END $$;
