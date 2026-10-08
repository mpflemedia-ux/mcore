drop policy if exists project_tags_tenant on public.project_tags;
create policy project_tags_tenant on public.project_tags
  for all to authenticated
  using (tenant_id = public.get_my_tenant_id() or public.is_platform_admin())
  with check (tenant_id = public.get_my_tenant_id() or public.is_platform_admin());
