-- Product images: single image_url column on products (no separate gallery
-- table — matches the existing tenants.logo_url single-column pattern), plus
-- a dedicated Storage bucket mirroring company-assets' tenant-scoped RLS.

alter table products add column if not exists image_url text;

-- ---------- Storage: product-images bucket ----------
-- Public read (so <img src> works directly in POS/Inventory without a signed
-- URL — a product photo isn't sensitive), write/update tenant-scoped via RLS
-- on storage.objects, keyed off a `{tenant_id}/...` path prefix (the app
-- uploads to `{tenant_id}/products/{random}.png`).
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "product_images_public_read" on storage.objects;
create policy "product_images_public_read" on storage.objects
  for select using (bucket_id = 'product-images');

drop policy if exists "product_images_tenant_insert" on storage.objects;
create policy "product_images_tenant_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = (select tenant_id::text from user_profiles where id = auth.uid())
  );

drop policy if exists "product_images_tenant_update" on storage.objects;
create policy "product_images_tenant_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = (select tenant_id::text from user_profiles where id = auth.uid())
  );
