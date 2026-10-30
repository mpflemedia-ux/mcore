-- FFM: move FFM accounts that a Platform Admin saved in Support mode into their OWN tenant by mistake → Brzky Empire.
-- WRITE-ONLY, idempotent (2nd run moves 0 rows). Keys move with the account (ffm_account_secrets), so no re-typing.
-- Scope: active ffm_accounts created by a platform_admin, in a tenant NOT enabled in ffm_tenant_access, label not already used in Brzky.
DO $$
DECLARE v_brzky uuid; v_ids uuid[]; v_n int;
BEGIN
  SELECT array_agg(id) INTO v_ids FROM public.tenants
  WHERE deleted_at IS NULL AND (name ILIKE 'brzky empire%' OR name ILIKE 'brozky empire%');
  IF coalesce(array_length(v_ids, 1), 0) <> 1 THEN
    RAISE NOTICE 'Brzky Empire match count = % — nothing moved', coalesce(array_length(v_ids, 1), 0); RETURN;
  END IF;
  v_brzky := v_ids[1];
  WITH m AS (
    SELECT a.id FROM public.ffm_accounts a
    JOIN public.user_profiles p ON p.id = a.created_by AND lower(p.role) = 'platform_admin'
    WHERE a.deleted_at IS NULL AND a.tenant_id <> v_brzky
      AND NOT EXISTS (SELECT 1 FROM public.ffm_tenant_access x WHERE x.tenant_id = a.tenant_id AND x.enabled AND x.deleted_at IS NULL)
      AND NOT EXISTS (SELECT 1 FROM public.ffm_accounts b WHERE b.tenant_id = v_brzky AND b.deleted_at IS NULL AND lower(b.label) = lower(a.label))
  ), u AS (
    UPDATE public.ffm_accounts a SET tenant_id = v_brzky, updated_at = now() FROM m WHERE a.id = m.id RETURNING a.id
  )
  UPDATE public.ffm_account_secrets s SET tenant_id = v_brzky, updated_at = now() FROM u WHERE s.account_id = u.id;
  SELECT count(*) INTO v_n FROM public.ffm_accounts WHERE tenant_id = v_brzky AND deleted_at IS NULL;
  RAISE NOTICE 'Brzky Empire now has % FFM account(s)', v_n;
END $$;
