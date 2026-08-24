-- Tenant-scoped planner (paid plans): isolate per client via tenant_id
ALTER TABLE public.platform_activities
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;

UPDATE public.platform_activities pa
SET tenant_id = up.tenant_id
FROM public.user_profiles up
WHERE pa.tenant_id IS NULL
  AND up.id = pa.owner_user_id
  AND up.tenant_id IS NOT NULL;

UPDATE public.platform_activities
SET tenant_id = related_tenant_id
WHERE tenant_id IS NULL AND related_tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS platform_activities_tenant_idx
  ON public.platform_activities (tenant_id, status)
  WHERE deleted_at IS NULL;

DROP POLICY IF EXISTS platform_activities_owner_all ON public.platform_activities;
DROP POLICY IF EXISTS platform_activities_tenant_all ON public.platform_activities;

-- Shared within tenant; isolated across tenants
CREATE POLICY platform_activities_tenant_all
  ON public.platform_activities
  FOR ALL
  TO authenticated
  USING (
    tenant_id IS NOT NULL
    AND tenant_id = public.get_my_tenant_id()
  )
  WITH CHECK (
    tenant_id IS NOT NULL
    AND tenant_id = public.get_my_tenant_id()
  );
