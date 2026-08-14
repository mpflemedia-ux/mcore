-- Allow re-join via invite when profile was soft-deleted / inactive (all tenants)
CREATE OR REPLACE FUNCTION public.join_tenant_by_invite(p_token text, p_full_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv public.team_invites%ROWTYPE;
  uid uuid := auth.uid();
  v_name text := NULLIF(trim(p_full_name), '');
  existing public.user_profiles%ROWTYPE;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Full name is required';
  END IF;

  SELECT * INTO inv
  FROM public.team_invites
  WHERE token = p_token
    AND (expires_at IS NULL OR expires_at > now())
    AND (max_uses IS NULL OR COALESCE(use_count, 0) < max_uses)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid, expired, or fully used invite';
  END IF;

  SELECT * INTO existing FROM public.user_profiles WHERE id = uid;

  IF FOUND THEN
    -- Already active on THIS tenant → idempotent success
    IF existing.tenant_id IS NOT DISTINCT FROM inv.tenant_id
       AND existing.deleted_at IS NULL
       AND COALESCE(existing.is_active, true) = true THEN
      RETURN jsonb_build_object(
        'tenant_id', inv.tenant_id,
        'role', existing.role,
        'module_override', existing.module_override,
        'already_member', true
      );
    END IF;

    -- Soft-deleted or inactive → revive into invite tenant (re-invite path)
    IF existing.deleted_at IS NOT NULL OR COALESCE(existing.is_active, true) = false THEN
      UPDATE public.user_profiles SET
        tenant_id = inv.tenant_id,
        role = inv.role,
        full_name = COALESCE(v_name, full_name),
        module_override = inv.module_override,
        is_active = true,
        deleted_at = NULL,
        updated_at = now()
      WHERE id = uid;

      UPDATE public.team_invites
      SET use_count = COALESCE(use_count, 0) + 1,
          used_at = COALESCE(used_at, now()),
          used_by = COALESCE(used_by, uid)
      WHERE id = inv.id;

      RETURN jsonb_build_object(
        'tenant_id', inv.tenant_id,
        'role', inv.role,
        'module_override', inv.module_override,
        'revived', true
      );
    END IF;

    -- Active on another tenant
    RAISE EXCEPTION 'User already belongs to a tenant';
  END IF;

  INSERT INTO public.user_profiles (id, tenant_id, full_name, role, is_active, language, module_override)
  VALUES (uid, inv.tenant_id, v_name, inv.role, true, 'en', inv.module_override);

  UPDATE public.team_invites
  SET use_count = COALESCE(use_count, 0) + 1,
      used_at = COALESCE(used_at, now()),
      used_by = COALESCE(used_by, uid)
  WHERE id = inv.id;

  RETURN jsonb_build_object(
    'tenant_id', inv.tenant_id,
    'role', inv.role,
    'module_override', inv.module_override
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_tenant_by_invite(text, text) TO authenticated;
