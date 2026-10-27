reset role;

-- OT automation roadmap Phase 3: let tenant admins manage their OWN public_holidays rows
-- (state/company-specific extra holidays on top of the Malaysia federal defaults seeded in
-- attendance_rate_accurate_01.sql). The SELECT policy from that file already reads
-- tenant_id IS NULL OR tenant_id = own tenant, so no change needed there — this only adds the
-- write side. The existing public_holidays_admin_write policy (platform_admin only) is left
-- untouched and still covers editing the GLOBAL (tenant_id IS NULL) defaults — RLS policies
-- are OR'd, so this is additive, not a replacement.
--
-- Write-only, idempotent, run once in Supabase SQL Editor.

DROP POLICY IF EXISTS public_holidays_tenant_write ON public.public_holidays;
CREATE POLICY public_holidays_tenant_write ON public.public_holidays
  FOR ALL TO authenticated
  USING (
    tenant_id IS NOT NULL
    AND tenant_id = (SELECT tenant_id FROM public.user_profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND lower(trim(coalesce(up.role, ''))) IN ('owner', 'admin', 'platform_admin', 'manager', 'hr')
    )
  )
  WITH CHECK (
    tenant_id IS NOT NULL
    AND tenant_id = (SELECT tenant_id FROM public.user_profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND lower(trim(coalesce(up.role, ''))) IN ('owner', 'admin', 'platform_admin', 'manager', 'hr')
    )
  );

-- System Development
update public.dev_roadmap_items set stage = 'completed', module = 'hr',
  description = 'OT automation roadmap Phase 3: tenant admins can now add/remove their own public_holidays rows (state or company-specific extras on top of the Malaysia federal defaults) via a new Attendance Controls panel section — automatically picked up by the existing Attendance Rate and OT day-type engines, which already read tenant_id IS NULL OR own tenant. Global defaults stay platform_admin-only.'
  where title = 'Attendance: Tenant-Specific Public Holidays (OT roadmap Phase 3)';
insert into public.dev_roadmap_items (title, description, module, stage)
  select 'Attendance: Tenant-Specific Public Holidays (OT roadmap Phase 3)', 'OT automation roadmap Phase 3: tenant admins can now add/remove their own public_holidays rows (state or company-specific extras on top of the Malaysia federal defaults) via a new Attendance Controls panel section — automatically picked up by the existing Attendance Rate and OT day-type engines, which already read tenant_id IS NULL OR own tenant. Global defaults stay platform_admin-only.', 'hr', 'completed'
  where not exists (select 1 from public.dev_roadmap_items where title = 'Attendance: Tenant-Specific Public Holidays (OT roadmap Phase 3)');
