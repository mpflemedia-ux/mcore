-- Roadmap: FFM Add account form prefilled. WRITE-ONLY — no schema change; safe to re-run.
DO $$
DECLARE
  v_title text := 'Logistics: FFM Add account form prefilled';
  v_desc text := 'Logistics → Flash Fulfillment → Accounts → Add FFM account opens prefilled with non-secret defaults: Base URL https://open.flashfulfillment.my, Sign mode JSON (Algorithm 2), API path prefix empty, Amount unit sen (×100), Fee source FFM order fee API, payment Bank transfer, platform Line, low-stock alerts on. Label suggests Brzky (own stock) when none exists, else Funded (Funded ticked, Sales Plan preselected when only one). mchId / API key / webhook keys never prefilled; Edit keeps saved values. Scripts cache-bust v=6.';
  v_url text := 'https://github.com/mpflemedia-ux/mcore/commit/fa35c302e573f93fa647553e8ef35e7074dc57d5';
BEGIN
  IF EXISTS (SELECT 1 FROM public.dev_roadmap_items WHERE title ILIKE 'Logistics: FFM Add account form prefilled%') THEN
    UPDATE public.dev_roadmap_items SET stage = 'completed', module = 'logistics', description = v_desc, pr_url = v_url
    WHERE title ILIKE 'Logistics: FFM Add account form prefilled%';
  ELSE
    INSERT INTO public.dev_roadmap_items (title, description, module, stage, pr_url)
    VALUES (v_title, v_desc, 'logistics', 'completed', v_url);
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN
  RAISE NOTICE 'dev_roadmap schema variant; skip: %', SQLERRM;
END $$;
