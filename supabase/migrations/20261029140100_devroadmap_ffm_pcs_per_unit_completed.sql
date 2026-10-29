-- Roadmap: FFM per-account barcode + pcs per unit. WRITE-ONLY — run after 20261029140000_ffm_pcs_per_unit.sql.
DO $$
DECLARE
  v_title text := 'Logistics: FFM per-account barcode + pcs per unit';
  v_desc text := 'Logistics → Flash Fulfillment → Products: barcode set per FFM account (Brzky vs Funded) + pcs per FFM unit (e.g. 1 carton = 24 pcs). Sync/stock use the account barcode; DO/PO pcs → FFM units (blocked if not whole, EN/BM); Stock/DO/Recon show units + pcs; recon, low stock and Funded use pcs. products.stock_qty untouched.';
  v_url text := 'https://github.com/mpflemedia-ux/mcore/commit/5f02ca09a4cc7dcf3e427e6cabcef2866482728c';
BEGIN
  IF EXISTS (SELECT 1 FROM public.dev_roadmap_items WHERE title ILIKE 'Logistics: FFM per-account barcode%') THEN
    UPDATE public.dev_roadmap_items SET stage = 'completed', module = 'logistics', description = v_desc, pr_url = v_url
    WHERE title ILIKE 'Logistics: FFM per-account barcode%';
  ELSE
    INSERT INTO public.dev_roadmap_items (title, description, module, stage, pr_url)
    VALUES (v_title, v_desc, 'logistics', 'completed', v_url);
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN
  RAISE NOTICE 'dev_roadmap schema variant; skip: %', SQLERRM;
END $$;
