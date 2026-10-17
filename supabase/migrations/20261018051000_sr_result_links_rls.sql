-- Allow tenant members to insert/select service_result_links for their tenant
DROP POLICY IF EXISTS result_links_tenant ON public.service_result_links;
CREATE POLICY result_links_tenant ON public.service_result_links
  FOR ALL
  USING (
    tenant_id = (SELECT tenant_id FROM public.user_profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'platform_admin')
  )
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM public.user_profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'platform_admin')
  );

-- Same for shares log
DROP POLICY IF EXISTS shares_tenant ON public.service_request_shares;
CREATE POLICY shares_tenant ON public.service_request_shares
  FOR ALL
  USING (
    tenant_id = (SELECT tenant_id FROM public.user_profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'platform_admin')
  )
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM public.user_profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'platform_admin')
  );
