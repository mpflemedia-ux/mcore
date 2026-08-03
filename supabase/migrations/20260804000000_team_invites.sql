-- Team invites: allow additional users to join an existing tenant
CREATE TABLE IF NOT EXISTS team_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'staff',
  email text,
  created_by uuid,
  expires_at timestamptz,
  used_at timestamptz,
  used_by uuid,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS team_invites_tenant_idx ON team_invites(tenant_id);
CREATE INDEX IF NOT EXISTS team_invites_token_idx ON team_invites(token);

ALTER TABLE team_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS team_invites_select ON team_invites;
CREATE POLICY team_invites_select ON team_invites
  FOR SELECT USING (
    tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS team_invites_insert ON team_invites;
CREATE POLICY team_invites_insert ON team_invites
  FOR INSERT WITH CHECK (
    tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND role IN ('owner','admin')
    )
  );

DROP POLICY IF EXISTS team_invites_update ON team_invites;
CREATE POLICY team_invites_update ON team_invites
  FOR UPDATE USING (
    tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND role IN ('owner','admin')
    )
  );

DROP POLICY IF EXISTS team_invites_delete ON team_invites;
CREATE POLICY team_invites_delete ON team_invites
  FOR DELETE USING (
    tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND role IN ('owner','admin')
    )
  );

-- Join existing tenant via invite token (bypasses normal register_tenant)
CREATE OR REPLACE FUNCTION join_tenant_by_invite(p_token text, p_full_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv team_invites%ROWTYPE;
  uid uuid := auth.uid();
  v_name text := NULLIF(trim(p_full_name), '');
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Full name is required';
  END IF;
  IF EXISTS (SELECT 1 FROM user_profiles WHERE id = uid) THEN
    RAISE EXCEPTION 'User already belongs to a tenant';
  END IF;

  SELECT * INTO inv
  FROM team_invites
  WHERE token = p_token
    AND used_at IS NULL
    AND (expires_at IS NULL OR expires_at > now())
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invite';
  END IF;

  INSERT INTO user_profiles (id, tenant_id, full_name, role, is_active, language)
  VALUES (uid, inv.tenant_id, v_name, inv.role, true, 'en');

  UPDATE team_invites
  SET used_at = now(), used_by = uid
  WHERE id = inv.id;

  RETURN jsonb_build_object(
    'tenant_id', inv.tenant_id,
    'role', inv.role
  );
END;
$$;

GRANT EXECUTE ON FUNCTION join_tenant_by_invite(text, text) TO authenticated;
