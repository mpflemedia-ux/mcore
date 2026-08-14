-- Option A: Delete team member removes profile + auth.users so email can re-register
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

  IF caller_tenant IS NULL OR lower(coalesce(caller_role,'')) NOT IN ('owner','admin') THEN
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
