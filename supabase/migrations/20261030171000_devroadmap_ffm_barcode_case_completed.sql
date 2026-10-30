-- Roadmap: FFM barcode exact case + add-only sync. WRITE-ONLY — no schema change; safe to re-run.
DO $$
DECLARE
  v_title text := 'Logistics: FFM barcode exact case + add-only sync';
  v_desc text := 'Barcode fields (Inventory product barcode, FFM link barcode) no longer auto title-cased (KRVKL001 stayed KRVKL001, not Krvkl001). Sync products is add-only: if FFM already has the barcode (1309) it is linked, never edited, so merchant-created/draft goods in the FFM portal are not overwritten. ffm scripts v=10, title-case-inputs v=3.';
BEGIN
  IF EXISTS (SELECT 1 FROM public.dev_roadmap_items WHERE title ILIKE 'Logistics: FFM barcode exact case%') THEN
    UPDATE public.dev_roadmap_items SET stage = 'completed', module = 'logistics', description = v_desc
    WHERE title ILIKE 'Logistics: FFM barcode exact case%';
  ELSE
    INSERT INTO public.dev_roadmap_items (title, description, module, stage)
    VALUES (v_title, v_desc, 'logistics', 'completed');
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN
  RAISE NOTICE 'dev_roadmap schema variant; skip: %', SQLERRM;
END $$;
