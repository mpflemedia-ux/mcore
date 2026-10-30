-- FFM v2 move: put FFM accounts saved under the wrong company into Brzky Empire (tenant id starts c60f2b).
-- WRITE-ONLY, idempotent (2nd run moves 0). Replaces 20261030140000 (that one required name match + platform_admin role join + non-enabled tenant).
-- Scope: active ffm_accounts NOT under Brzky, created in the last 2 days; one per label (newest); label not already used in Brzky. Keys move too.
DO $$
DECLARE v_ids uuid[]; v_brzky uuid; v_moved int := 0; v_total int;
BEGIN
  SELECT array_agg(id) INTO v_ids FROM public.tenants WHERE id::text LIKE 'c60f2b%';
  IF coalesce(array_length(v_ids, 1), 0) <> 1 THEN
    SELECT array_agg(id) INTO v_ids FROM public.tenants WHERE deleted_at IS NULL AND (name ILIKE '%brzky%' OR name ILIKE '%brozky%');
  END IF;
  IF coalesce(array_length(v_ids, 1), 0) <> 1 THEN
    RAISE NOTICE 'Brzky tenant match count = % — nothing moved', coalesce(array_length(v_ids, 1), 0); RETURN;
  END IF;
  v_brzky := v_ids[1];
  WITH m AS (
    SELECT DISTINCT ON (lower(a.label)) a.id FROM public.ffm_accounts a
    WHERE a.deleted_at IS NULL AND a.tenant_id <> v_brzky AND a.created_at > now() - interval '2 days'
      AND NOT EXISTS (SELECT 1 FROM public.ffm_accounts b WHERE b.tenant_id = v_brzky AND b.deleted_at IS NULL AND lower(b.label) = lower(a.label))
    ORDER BY lower(a.label), a.created_at DESC
  ), u AS (
    UPDATE public.ffm_accounts a SET tenant_id = v_brzky, updated_at = now() FROM m WHERE a.id = m.id RETURNING a.id
  ), s AS (
    UPDATE public.ffm_account_secrets x SET tenant_id = v_brzky, updated_at = now() FROM u WHERE x.account_id = u.id RETURNING x.account_id
  )
  SELECT count(*) INTO v_moved FROM u;
  SELECT count(*) INTO v_total FROM public.ffm_accounts WHERE tenant_id = v_brzky AND deleted_at IS NULL;
  RAISE NOTICE 'Brzky % : moved % account(s); now has % active FFM account(s)', v_brzky, v_moved, v_total;
END $$;
