-- Multi-use team invites: one link, many staff, until expires_at (or max_uses)
ALTER TABLE public.team_invites
  ADD COLUMN IF NOT EXISTS max_uses integer,
  ADD COLUMN IF NOT EXISTS use_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.team_invites.max_uses IS 'NULL = unlimited until expires_at; else max successful joins';
COMMENT ON COLUMN public.team_invites.use_count IS 'Successful join_tenant_by_invite count';

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
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Full name is required';
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_profiles WHERE id = uid) THEN
    RAISE EXCEPTION 'User already belongs to a tenant';
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

  INSERT INTO public.user_profiles (id, tenant_id, full_name, role, is_active, language, module_override)
  VALUES (uid, inv.tenant_id, v_name, inv.role, true, 'en', inv.module_override);

  UPDATE public.team_invites
  SET
    use_count = COALESCE(use_count, 0) + 1,
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
