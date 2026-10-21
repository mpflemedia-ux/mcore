-- M-Core payment attachments, Phase 1: slips / receipts / any document on customer payments + supplier bill payments,
-- bank ref + cheque no. + notes + channel (DuitNow / e-wallet / cheque) on payments, private bucket doc-files.
-- Write-only; run in Supabase SQL Editor. Rerun-safe. Plain SQL only (no new functions, no dollar quoting, no pgcrypto).
-- RUN ORDER: pay_attach_01.sql (THIS) -> pay_attach_02.sql -> pay_attach_03.sql -> pay_attach_04.sql.
-- Until this runs, the app hides every attachment control and the new fields (it probes doc_attachments).
-- Every change is additive: new table, new nullable columns, new bucket. Existing payment_method values are untouched
-- (DuitNow / e-wallet are saved as online_banking + pay_channel, cheque as bank_transfer + pay_channel, so the journal
-- mapping cash -> Cash, everything else -> Bank stays exactly as it is).

-- 1) Attachments (generic: entity_type + entity_id; soft delete only)
create table if not exists public.doc_attachments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  entity_type text not null check (entity_type in ('payment', 'supplier_payment', 'payment_claim')),
  entity_id uuid not null,
  invoice_id uuid,
  bill_id uuid,
  storage_path text not null check (length(storage_path) between 10 and 400),
  file_name text not null check (length(file_name) between 1 and 200),
  mime_type text check (mime_type is null or length(mime_type) <= 120),
  size_bytes integer check (size_bytes is null or (size_bytes > 0 and size_bytes <= 10485760)),
  sha256 text check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  source text not null default 'staff' check (source in ('staff', 'customer', 'gateway')),
  uploaded_by uuid,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid);
create index if not exists doc_attachments_entity_idx on public.doc_attachments (tenant_id, entity_type, entity_id) where deleted_at is null;
create index if not exists doc_attachments_inv_idx on public.doc_attachments (tenant_id, invoice_id) where deleted_at is null;
create index if not exists doc_attachments_sha_idx on public.doc_attachments (tenant_id, sha256) where deleted_at is null;
create index if not exists doc_attachments_month_idx on public.doc_attachments (tenant_id, created_at);
alter table public.doc_attachments enable row level security;
revoke all on public.doc_attachments from anon;

-- read: same tenant, or platform admin
drop policy if exists doc_attachments_read on public.doc_attachments;
create policy doc_attachments_read on public.doc_attachments for select to authenticated using (
  tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid())
  or exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin'));
-- insert: into your own tenant; uploaded_by is you, or NULL for a platform admin (silent support, no name shown to the tenant)
drop policy if exists doc_attachments_ins on public.doc_attachments;
create policy doc_attachments_ins on public.doc_attachments for insert to authenticated with check (
  deleted_at is null
  and tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid())
  and (uploaded_by = auth.uid()
    or (uploaded_by is null and exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin'))));
-- update (soft delete only, see column grant): the uploader, owner / admin, or platform admin
drop policy if exists doc_attachments_upd on public.doc_attachments;
create policy doc_attachments_upd on public.doc_attachments for update to authenticated
  using (tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid())
    and (uploaded_by = auth.uid()
      or exists (select 1 from public.user_profiles p where p.id = auth.uid() and lower(coalesce(p.role, '')) in ('owner', 'admin', 'platform_admin'))))
  with check (tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid()));
-- no delete policy: files are never hard-deleted from the app
grant select, insert on public.doc_attachments to authenticated;
grant update (deleted_at, deleted_by) on public.doc_attachments to authenticated;
-- PA view-only sessions: no writes (same rule as pa_enter_01.sql)
drop policy if exists pa_vo_ins on public.doc_attachments;
create policy pa_vo_ins on public.doc_attachments as restrictive for insert to authenticated with check (not exists (select 1 from public.platform_support_sessions s where s.actor_id = auth.uid() and s.ended_at is null and s.view_only and s.deleted_at is null and s.tenant_id = doc_attachments.tenant_id));
drop policy if exists pa_vo_upd on public.doc_attachments;
create policy pa_vo_upd on public.doc_attachments as restrictive for update to authenticated using (not exists (select 1 from public.platform_support_sessions s where s.actor_id = auth.uid() and s.ended_at is null and s.view_only and s.deleted_at is null and s.tenant_id = doc_attachments.tenant_id));

-- 2) New nullable payment fields (additive only)
alter table public.payments add column if not exists bank_ref text check (bank_ref is null or length(bank_ref) <= 80);
alter table public.payments add column if not exists cheque_no text check (cheque_no is null or length(cheque_no) <= 40);
alter table public.payments add column if not exists memo text check (memo is null or length(memo) <= 500);
alter table public.payments add column if not exists pay_channel text check (pay_channel is null or pay_channel in ('duitnow', 'ewallet', 'cheque'));
alter table public.supplier_payments add column if not exists bank_ref text check (bank_ref is null or length(bank_ref) <= 80);
alter table public.supplier_payments add column if not exists cheque_no text check (cheque_no is null or length(cheque_no) <= 40);
alter table public.supplier_payments add column if not exists memo text check (memo is null or length(memo) <= 500);
alter table public.supplier_payments add column if not exists pay_channel text check (pay_channel is null or pay_channel in ('duitnow', 'ewallet', 'cheque'));
create index if not exists payments_bank_ref_idx on public.payments (tenant_id, bank_ref) where bank_ref is not null;

-- 3) Private bucket doc-files: {tenant_id}/payments/{payment_id}/..., {tenant_id}/supplier-payments/{id}/..., {tenant_id}/claims/{token}/...
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('doc-files', 'doc-files', false, 10485760, array[
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv', 'text/plain'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists doc_files_read on storage.objects;
create policy doc_files_read on storage.objects for select to authenticated using (
  bucket_id = 'doc-files' and (
    (storage.foldername(name))[1] = (select p.tenant_id::text from public.user_profiles p where p.id = auth.uid())
    or exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin')));
drop policy if exists doc_files_ins on storage.objects;
create policy doc_files_ins on storage.objects for insert to authenticated with check (
  bucket_id = 'doc-files'
  and (storage.foldername(name))[1] = (select p.tenant_id::text from public.user_profiles p where p.id = auth.uid())
  and (storage.foldername(name))[2] in ('payments', 'supplier-payments'));
-- no update / delete policy on doc-files: removal in the app is a soft delete of the doc_attachments row

notify pgrst, 'reload schema';

-- 4) System Development
update public.dev_roadmap_items set stage = 'completed', module = 'sales',
  description = 'Payment attachments Phase 1: slips / receipts / any document (images incl. HEIC, PDF, Office, CSV, TXT; 10 MB, 10 per payment) on invoice payments and supplier bill payments, camera or file, photo compression, duplicate-slip warning, view / download / add to past payments / soft remove; bank ref, cheque no., notes, DuitNow / e-wallet / cheque; receipt no. in history; mobile layout fix; Activity Log (PA silent).'
where title = 'Payment attachments (Phase 1)';
insert into public.dev_roadmap_items (title, description, module, stage)
select 'Payment attachments (Phase 1)', 'Payment attachments Phase 1: slips / receipts / any document (images incl. HEIC, PDF, Office, CSV, TXT; 10 MB, 10 per payment) on invoice payments and supplier bill payments, camera or file, photo compression, duplicate-slip warning, view / download / add to past payments / soft remove; bank ref, cheque no., notes, DuitNow / e-wallet / cheque; receipt no. in history; mobile layout fix; Activity Log (PA silent).', 'sales', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Payment attachments (Phase 1)');
