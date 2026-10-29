-- Roadmap: FFM restricted to Platform Admin + Brzky Empire. WRITE-ONLY — run after 20261029130000_ffm_tenant_access.sql.
DO $$
DECLARE
  v_title text := 'Logistics: FFM access — Platform Admin + Brzky Empire only';
  v_desc text := 'Flash Fulfillment hidden for all other tenants: platform-managed ffm_tenant_access (Brzky Empire enabled by name lookup). Client hides Logistics → Flash Fulfillment button/hub, DO FFM card, PO ASN card; ffm-api returns 403, ffm-cron skips, ffm-webhook acks without updates/notifications for non-enabled tenants. Platform Admin always allowed.';
  v_url text := 'https://github.com/mpflemedia-ux/mcore/commit/beb0322c518b5ddb3c0f18768510f41570e29da7';
BEGIN
  IF EXISTS (SELECT 1 FROM public.dev_roadmap_items WHERE title ILIKE 'Logistics: FFM access%') THEN
    UPDATE public.dev_roadmap_items SET stage = 'completed', module = 'logistics', description = v_desc, pr_url = v_url
    WHERE title ILIKE 'Logistics: FFM access%';
  ELSE
    INSERT INTO public.dev_roadmap_items (title, description, module, stage, pr_url)
    VALUES (v_title, v_desc, 'logistics', 'completed', v_url);
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN
  RAISE NOTICE 'dev_roadmap schema variant; skip: %', SQLERRM;
END $$;
