-- Roadmap: FFM stock refresh no longer fails the whole batch on one unknown barcode. WRITE-ONLY — no schema change; safe to re-run.
DO $$
DECLARE
  v_title text := 'Logistics: FFM stock refresh per-barcode + honest Synced';
  v_desc text := 'Refresh from FFM: when FFM rejects the batch (e.g. 1608 goods not exist / not enabled) each barcode is retried alone so valid ones still load; the toast names the rejected barcode(s) and the reason is shown under the product on the Products tab. Sync products now confirms each barcode in FFM /goods/list after add/edit; an empty result marks it Error instead of Synced. Edge functions redeployed; scripts cache-bust v=9.';
BEGIN
  IF EXISTS (SELECT 1 FROM public.dev_roadmap_items WHERE title ILIKE 'Logistics: FFM stock refresh per-barcode%') THEN
    UPDATE public.dev_roadmap_items SET stage = 'completed', module = 'logistics', description = v_desc
    WHERE title ILIKE 'Logistics: FFM stock refresh per-barcode%';
  ELSE
    INSERT INTO public.dev_roadmap_items (title, description, module, stage)
    VALUES (v_title, v_desc, 'logistics', 'completed');
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN
  RAISE NOTICE 'dev_roadmap schema variant; skip: %', SQLERRM;
END $$;
