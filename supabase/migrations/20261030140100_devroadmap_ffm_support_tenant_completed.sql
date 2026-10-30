-- Roadmap: FFM Support-mode tenant fix. WRITE-ONLY — no schema change; safe to re-run.
DO $$
DECLARE
  v_title text := 'Logistics: FFM Support-mode tenant fix';
  v_desc text := 'Platform Admin in Support mode (e.g. Brzky Empire) saved FFM accounts into his own tenant: client never sent tenant_id to ffm-api, so the server fell back to user_profiles.tenant_id while the list reads APP.tenant.id → "No FFM account yet". Every ffm-api call now sends the active tenant_id (honoured for platform_admin only). Mis-saved accounts moved to Brzky Empire with their keys. Scripts cache-bust v=7.';
  v_url text := 'https://github.com/mpflemedia-ux/mcore/commit/3300546a4250caf58dc49011af17b644f2c6a5cd';
BEGIN
  IF EXISTS (SELECT 1 FROM public.dev_roadmap_items WHERE title ILIKE 'Logistics: FFM Support-mode tenant%') THEN
    UPDATE public.dev_roadmap_items SET stage = 'completed', module = 'logistics', description = v_desc, pr_url = v_url
    WHERE title ILIKE 'Logistics: FFM Support-mode tenant%';
  ELSE
    INSERT INTO public.dev_roadmap_items (title, description, module, stage, pr_url)
    VALUES (v_title, v_desc, 'logistics', 'completed', v_url);
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN
  RAISE NOTICE 'dev_roadmap schema variant; skip: %', SQLERRM;
END $$;
