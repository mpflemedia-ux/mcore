drop policy if exists "company_assets_tenant_delete" on storage.objects;

create policy "company_assets_tenant_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'company-assets'
    and (
      (storage.foldername(name))[1] = (select tenant_id::text from user_profiles where id = auth.uid())
      or public.is_platform_admin()
    )
  );
