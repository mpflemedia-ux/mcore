-- Fix: platform_admin (added after these policies/functions were written)
-- is silently rejected by pre-existing hardcoded role lists that predate
-- it — a platform_admin acting within their OWN tenant (not cross-tenant;
-- every check below is already tenant_id-scoped to the caller's own
-- tenant) gets a 403/exception on actions a tenant owner/admin can do.
--
-- FULL AUDIT — every `role IN (...)` / `role = '...'` hardcoded role list
-- found across supabase/migrations/*.sql (grepped 'owner'/'admin' case-
-- insensitively, not just the exact team_invites pattern), with what was
-- done about each:
--
-- 1. team_invites_insert/update/delete (20260804000000_team_invites.sql,
--    lines 33/44/55) — role IN ('owner','admin'). FIXED below: this gates
--    inviting a new team member into the caller's own tenant — a genuine
--    tenant-admin action platform_admin should reasonably do for their own
--    tenant (MP Workspace), same as any other owner/admin.
-- 2. period_lock trigger (20260809010000_period_lock_trigger.sql, line
--    260) — caller_role NOT IN ('owner','admin','platform_admin'). Already
--    correct, no change.
-- 3. POS PIN shift flow (20260812000000_pos_pin_shift_flow.sql, line 38)
--    — same three-role list. Already correct, no change.
-- 4. user_profiles_update_tenant (20260814230000_user_profiles_select_tenant.sql,
--    line 44) — me.role IN ('owner','admin'). FIXED below: this gates a
--    tenant admin updating ANOTHER member's profile (role/status/soft-
--    delete) within the caller's own tenant — same reasoning as #1.
-- 5. delete_team_member() caller check (20260814240000_delete_team_member.sql,
--    line 21) — caller_role NOT IN ('owner','admin'). FIXED below: same
--    reasoning as #1/#4 — deleting a team member within the caller's own
--    tenant.
-- 6. delete_team_member() TARGET check (20260814240000_delete_team_member.sql,
--    line 38) — target.role = 'owner' (raises "Cannot delete owner").
--    LEFT AS-IS, not a platform_admin gap: this checks the role of the
--    person being deleted, not the caller's permission to act — it exists
--    to stop anyone (including platform_admin) from deleting a tenant's
--    owner account, which is correct regardless of who's asking.
--
-- No other hardcoded role list found anywhere else in migrations/.

-- ---------- 1) team_invites: insert/update/delete ----------
DROP POLICY IF EXISTS team_invites_insert ON team_invites;
CREATE POLICY team_invites_insert ON team_invites
  FOR INSERT WITH CHECK (
    tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND role IN ('owner','admin','platform_admin')
    )
  );

DROP POLICY IF EXISTS team_invites_update ON team_invites;
CREATE POLICY team_invites_update ON team_invites
  FOR UPDATE USING (
    tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND role IN ('owner','admin','platform_admin')
    )
  );

DROP POLICY IF EXISTS team_invites_delete ON team_invites;
CREATE POLICY team_invites_delete ON team_invites
  FOR DELETE USING (
    tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND role IN ('owner','admin','platform_admin')
    )
  );

-- ---------- 2) user_profiles_update_tenant ----------
-- tenant_id scoping (both the outer USING/WITH CHECK and the EXISTS
-- subquery's own tenant match) reproduced unchanged from
-- 20260814230000_user_profiles_select_tenant.sql — only the role list grows.
DROP POLICY IF EXISTS user_profiles_update_tenant ON public.user_profiles;
CREATE POLICY user_profiles_update_tenant ON public.user_profiles
FOR UPDATE TO authenticated
USING (
  id = auth.uid()
  OR (
    tenant_id = public.get_my_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.user_profiles me
      WHERE me.id = auth.uid()
        AND me.tenant_id = user_profiles.tenant_id
        AND lower(coalesce(me.role, '')) IN ('owner', 'admin', 'platform_admin')
        AND me.deleted_at IS NULL
    )
  )
)
WITH CHECK (
  id = auth.uid()
  OR tenant_id = public.get_my_tenant_id()
);

-- ---------- 3) delete_team_member(): caller role check ----------
-- Reproduced verbatim from 20260814240000_delete_team_member.sql with only
-- the caller-role check widened; the target-role "cannot delete owner"
-- guard (see audit note #6 above) is untouched.
CREATE OR REPLACE FUNCTION public.delete_team_member(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  caller_role text;
  caller_tenant uuid;
  target public.user_profiles%ROWTYPE;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role, tenant_id INTO caller_role, caller_tenant
  FROM public.user_profiles WHERE id = caller_id;

  IF caller_tenant IS NULL OR lower(coalesce(caller_role,'')) NOT IN ('owner','admin','platform_admin') THEN
    RAISE EXCEPTION 'Only owner/admin can delete team members';
  END IF;

  IF p_user_id = caller_id THEN
    RAISE EXCEPTION 'Cannot delete yourself';
  END IF;

  SELECT * INTO target FROM public.user_profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  IF target.tenant_id IS DISTINCT FROM caller_tenant THEN
    RAISE EXCEPTION 'User is not in your tenant';
  END IF;

  IF lower(coalesce(target.role,'')) = 'owner' THEN
    RAISE EXCEPTION 'Cannot delete owner';
  END IF;

  BEGIN
    UPDATE public.audit_logs SET user_id = NULL WHERE user_id = p_user_id;
  EXCEPTION WHEN undefined_column OR undefined_table THEN NULL;
  END;
  BEGIN
    UPDATE public.team_invites SET created_by = NULL WHERE created_by = p_user_id;
    UPDATE public.team_invites SET used_by = NULL WHERE used_by = p_user_id;
  EXCEPTION WHEN undefined_column OR undefined_table THEN NULL;
  END;
  BEGIN
    UPDATE public.expense_claims SET claimed_by = NULL WHERE claimed_by = p_user_id;
  EXCEPTION WHEN undefined_column OR undefined_table THEN NULL;
  END;
  BEGIN
    UPDATE public.payment_vouchers SET created_by = NULL WHERE created_by = p_user_id;
  EXCEPTION WHEN undefined_column OR undefined_table THEN NULL;
  END;
  BEGIN
    UPDATE public.payment_voucher_batches SET created_by = NULL WHERE created_by = p_user_id;
  EXCEPTION WHEN undefined_column OR undefined_table THEN NULL;
  END;

  DELETE FROM public.user_profiles WHERE id = p_user_id;
  DELETE FROM auth.users WHERE id = p_user_id;

  RETURN jsonb_build_object('ok', true, 'deleted_user_id', p_user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_team_member(uuid) TO authenticated;
