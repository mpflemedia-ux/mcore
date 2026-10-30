-- Roadmap: FFM Base URL mobile auto-capital fix. WRITE-ONLY — no schema change; safe to re-run.
DO $$
DECLARE
  v_title text := 'Logistics: FFM Base URL auto-capital fix';
  v_desc text := 'Logistics → Flash Fulfillment → Add/Edit FFM account: phone keyboard auto-capitalised Base URL (Https://Open.Flashfulfillment.My) and ffm-api rejected it with "base_url must be https" (case-sensitive check). Inputs now autocapitalize/autocorrect/spellcheck off (+ inputmode=url); client and ffm-api trim + lowercase scheme/host + strip trailing slash BEFORE the https check; ffm-core normalises at call time too. Tracking link host lowercased the same way. Scripts cache-bust v=5.';
  v_url text := 'https://github.com/mpflemedia-ux/mcore/commit/5e20cca857aaad1383372dd0852f39bd2396fe94';
BEGIN
  IF EXISTS (SELECT 1 FROM public.dev_roadmap_items WHERE title ILIKE 'Logistics: FFM Base URL auto-capital%') THEN
    UPDATE public.dev_roadmap_items SET stage = 'completed', module = 'logistics', description = v_desc, pr_url = v_url
    WHERE title ILIKE 'Logistics: FFM Base URL auto-capital%';
  ELSE
    INSERT INTO public.dev_roadmap_items (title, description, module, stage, pr_url)
    VALUES (v_title, v_desc, 'logistics', 'completed', v_url);
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN
  RAISE NOTICE 'dev_roadmap schema variant; skip: %', SQLERRM;
END $$;
