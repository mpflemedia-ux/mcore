-- Admin Team / roster: allow SELECT all profiles in same tenant (not only self)
-- Uses get_my_tenant_id() to avoid recursive RLS on user_profiles.

CREATE OR REPLACE FUNCTION public.get_my_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.user_profiles WHERE id = auth.uid() LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_tenant_id() TO authenticated;

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Drop overly-narrow self-only policies if present (names may vary)
DROP POLICY IF EXISTS user_profiles_select ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_select_own ON public.user_profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
DROP POLICY IF EXISTS users_select_own ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_select_tenant ON public.user_profiles;

CREATE POLICY user_profiles_select_tenant ON public.user_profiles
FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR tenant_id = public.get_my_tenant_id()
);

-- Ensure tenant admins can update other members (role/status/delete soft)
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
        AND lower(coalesce(me.role, '')) IN ('owner', 'admin')
        AND me.deleted_at IS NULL
    )
  )
)
WITH CHECK (
  id = auth.uid()
  OR tenant_id = public.get_my_tenant_id()
);
