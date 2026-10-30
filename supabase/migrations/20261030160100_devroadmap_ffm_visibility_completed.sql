-- Roadmap: FFM account visibility + save errors. WRITE-ONLY — no schema change; safe to re-run.
DO $$
DECLARE
  v_title text := 'Logistics: FFM account visibility & save errors';
  v_desc text := 'FFM Add-account: save errors now toast + scroll into view (were hidden at the bottom of the long mobile form); save refuses to report success if the row lands in another company; Platform Admin sees FFM accounts that sit under other companies on an empty Accounts tab; FFM fields skip global title-case-inputs.js (store code, URLs, prefix, source-from). v2 move SQL (tenant id c60f2b). Scripts cache-bust v=8.';
  v_url text := 'https://github.com/mpflemedia-ux/mcore/commit/5b30e51ed3768b6844fc7fe7c0f8894782cf75c4';
BEGIN
  IF EXISTS (SELECT 1 FROM public.dev_roadmap_items WHERE title ILIKE 'Logistics: FFM account visibility%') THEN
    UPDATE public.dev_roadmap_items SET stage = 'completed', module = 'logistics', description = v_desc, pr_url = v_url
    WHERE title ILIKE 'Logistics: FFM account visibility%';
  ELSE
    INSERT INTO public.dev_roadmap_items (title, description, module, stage, pr_url)
    VALUES (v_title, v_desc, 'logistics', 'completed', v_url);
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN
  RAISE NOTICE 'dev_roadmap schema variant; skip: %', SQLERRM;
END $$;
