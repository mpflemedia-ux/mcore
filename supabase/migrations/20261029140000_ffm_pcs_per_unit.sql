-- FFM: per-account barcode + pcs per FFM unit. WRITE-ONLY, idempotent. Run after 20261029120000_ffm_connector.sql.
-- ffm_product_links.barcode = the barcode used on THAT FFM account (falls back to products.barcode when no link row yet).
-- pcs_per_unit: 1 FFM unit = N M-Core pcs (e.g. carton of 24 x 150ml = 24). products.stock_qty is untouched (stays pcs).
ALTER TABLE public.ffm_product_links ADD COLUMN IF NOT EXISTS pcs_per_unit integer NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ffm_product_links_pcs_chk') THEN
    ALTER TABLE public.ffm_product_links ADD CONSTRAINT ffm_product_links_pcs_chk CHECK (pcs_per_unit > 0);
  END IF;
END $$;

-- One barcode per FFM account (active rows). Skips with a NOTICE if existing data already has duplicates.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'ffm_product_links_bc_uidx') THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.ffm_product_links WHERE deleted_at IS NULL GROUP BY account_id, barcode HAVING count(*) > 1) THEN
    RAISE NOTICE 'ffm_product_links has duplicate (account_id, barcode) rows — fix them in Logistics → Flash Fulfillment → Products, then re-run this file';
  ELSE
    CREATE UNIQUE INDEX ffm_product_links_bc_uidx ON public.ffm_product_links (account_id, barcode) WHERE deleted_at IS NULL;
  END IF;
END $$;

-- Tenant RLS unchanged: tenant read (ffm_product_links_tenant_read), writes via service role (ffm-api) only.
ALTER TABLE public.ffm_product_links ENABLE ROW LEVEL SECURITY;

COMMENT ON COLUMN public.ffm_product_links.pcs_per_unit IS 'M-Core pcs in 1 FFM unit for this account (DO/PO pcs ÷ this = FFM num; FFM stock × this = pcs). No rounding.';
