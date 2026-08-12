-- Phase 2 of the Admin Team invite modal: lets an invite carry a per-user
-- module-access override instead of always inheriting the role's default
-- set (from tenants.config->'roles' or the client's _DEFAULT_ROLE_MODULES
-- fallback). Nullable on both tables — null means "no override, follow the
-- role default", which is the existing/only behavior every row had before
-- this migration, so nothing already in either table changes meaning.
--
-- RLS: no new policies needed. Both columns are read/written through the
-- exact same rows the existing team_invites/user_profiles policies already
-- gate (team_invites_insert requires owner/admin of the same tenant;
-- user_profiles' own existing policies are untouched here) — a new column
-- on an already-protected row doesn't need its own policy.

alter table team_invites add column if not exists module_override jsonb;
alter table user_profiles add column if not exists module_override jsonb;

-- Same function as 20260804000000_team_invites.sql, with exactly one
-- behavioral change: the new user_profiles row now carries the invite's
-- module_override forward verbatim (including when it's null, which is
-- every invite created before this migration, or any invite where the
-- admin left "use role default" on) — so an old invite still produces
-- a user with module_override = null, identical to today's behavior.
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

  INSERT INTO user_profiles (id, tenant_id, full_name, role, is_active, language, module_override)
  VALUES (uid, inv.tenant_id, v_name, inv.role, true, 'en', inv.module_override);

  UPDATE team_invites
  SET used_at = now(), used_by = uid
  WHERE id = inv.id;

  RETURN jsonb_build_object(
    'tenant_id', inv.tenant_id,
    'role', inv.role,
    'module_override', inv.module_override
  );
END;
$$;

GRANT EXECUTE ON FUNCTION join_tenant_by_invite(text, text) TO authenticated;
