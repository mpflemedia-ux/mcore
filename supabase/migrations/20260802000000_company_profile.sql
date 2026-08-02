-- ============================================================================
-- Migration: Company Profile (extends existing tenants table)
-- NOTE: Supabase Edge Functions/migrations do NOT auto-deploy from GitHub —
-- run this manually in Supabase Dashboard -> SQL Editor.
--
-- No new table — extends the existing `tenants` table per CLAUDE.md.
--
-- Several of these columns likely ALREADY exist (register_tenant/
-- complete_onboarding already read/write name, ssm_no, entity_type, address,
-- city, postcode, state, phone, email, website, currency going by the
-- onboarding wizard code) but were never confirmed against a migration file
-- in this repo (the original schema was set up directly in the Supabase
-- dashboard, not tracked here). Every ALTER below uses `add column if not
-- exists`, so this is safe to run regardless of what already exists — columns
-- that are already there are a no-op, only genuinely missing ones get added.
-- ============================================================================

alter table tenants add column if not exists logo_url text;
alter table tenants add column if not exists ssm_no text;
alter table tenants add column if not exists incorporation_date date;
alter table tenants add column if not exists address text;
alter table tenants add column if not exists address_line2 text;
alter table tenants add column if not exists city text;
alter table tenants add column if not exists postcode text;
alter table tenants add column if not exists state text;
alter table tenants add column if not exists country text default 'Malaysia';
alter table tenants add column if not exists email text;
alter table tenants add column if not exists phone text;
alter table tenants add column if not exists fax text;
alter table tenants add column if not exists website text;
alter table tenants add column if not exists bank_name text;
alter table tenants add column if not exists account_number text;
alter table tenants add column if not exists account_name text;
alter table tenants add column if not exists sst_gst_no text;
alter table tenants add column if not exists tax_type text;
alter table tenants add column if not exists currency text default 'MYR';
alter table tenants add column if not exists invoice_terms text;

-- ---------- Storage: company-assets bucket (for logo upload) ----------
-- Public read (so <img src> works directly without a signed URL — a company
-- logo isn't sensitive), but write/update is tenant-scoped via RLS on
-- storage.objects, keyed off a `{tenant_id}/...` path prefix convention (the
-- app uploads to `{tenant_id}/logo.png`).
insert into storage.buckets (id, name, public)
values ('company-assets', 'company-assets', true)
on conflict (id) do nothing;

create policy "company_assets_public_read" on storage.objects
  for select using (bucket_id = 'company-assets');

create policy "company_assets_tenant_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'company-assets'
    and (storage.foldername(name))[1] = (select tenant_id::text from user_profiles where id = auth.uid())
  );

create policy "company_assets_tenant_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'company-assets'
    and (storage.foldername(name))[1] = (select tenant_id::text from user_profiles where id = auth.uid())
  );
