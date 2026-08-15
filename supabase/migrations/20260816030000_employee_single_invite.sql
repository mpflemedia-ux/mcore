-- Single-person employee invites: store name/email/employee_id + public preview
ALTER TABLE public.team_invites
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS employee_id uuid;

CREATE OR REPLACE FUNCTION public.preview_team_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv public.team_invites%ROWTYPE;
  tname text;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) < 4 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid');
  END IF;

  SELECT * INTO inv
  FROM public.team_invites
  WHERE token = trim(p_token)
    AND (expires_at IS NULL OR expires_at > now())
    AND (max_uses IS NULL OR COALESCE(use_count, 0) < max_uses);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  SELECT name INTO tname FROM public.tenants WHERE id = inv.tenant_id;

  RETURN jsonb_build_object(
    'ok', true,
    'email', inv.email,
    'full_name', inv.full_name,
    'role', inv.role,
    'company', tname,
    'tenant_id', inv.tenant_id,
    'single_use', (inv.max_uses = 1)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.preview_team_invite(text) TO anon, authenticated;
