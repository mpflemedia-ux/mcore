-- M-Core payment attachments, Phase 3: customer sends a payment slip from the public invoice link (payment_claims) + staff review.
-- Write-only; run in Supabase SQL Editor. Rerun-safe. Plain SQL only (no new functions, no dollar quoting, no pgcrypto; sha256() is core Postgres).
-- RUN ORDER: pay_attach_01.sql -> pay_attach_02.sql -> pay_attach_03.sql (THIS) -> pay_attach_04.sql.
-- Needs wa_doc_01.sql (doc_public_links). The first statements stop here with "division by zero" if pay_attach_01 / wa_doc_01 are missing.
-- Until this runs, the public "I have paid" box and the staff review card stay hidden.
-- Safety: anon may only INSERT a claim (never read it back beyond id/status/time) and only while holding a live invoice token
-- (hash match, not revoked, not expired, same tenant + invoice); max 3 claims per link per 10 minutes. Files go to the private bucket
-- doc-files under {tenant}/claims/{token}/..., allowed only when that token is a live invoice link of that tenant. Nothing is public.
select 1 / (case when to_regclass('public.doc_attachments') is null then 0 else 1 end) as pay_attach_01_present;
select 1 / (case when to_regclass('public.doc_public_links') is null then 0 else 1 end) as wa_doc_01_present;

create table if not exists public.payment_claims (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  link_id uuid not null,
  invoice_id uuid not null,
  token text not null check (length(token) between 16 and 200),
  amount numeric(14,2) not null check (amount > 0 and amount < 100000000),
  paid_on date,
  bank_ref text check (bank_ref is null or length(bank_ref) <= 80),
  payer_name text check (payer_name is null or length(payer_name) <= 120),
  note text check (note is null or length(note) <= 500),
  files jsonb not null default '[]'::jsonb check (jsonb_typeof(files) = 'array' and jsonb_array_length(files) <= 10),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reject_reason text check (reject_reason is null or length(reject_reason) <= 500),
  payment_id uuid,
  reviewed_by uuid,
  reviewed_at timestamptz,
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists payment_claims_inv_idx on public.payment_claims (tenant_id, invoice_id, status) where deleted_at is null;
create index if not exists payment_claims_link_idx on public.payment_claims (link_id, created_at);
create index if not exists payment_claims_pending_idx on public.payment_claims (tenant_id) where notified_at is null and deleted_at is null;
alter table public.payment_claims enable row level security;

drop policy if exists payment_claims_public_ins on public.payment_claims;
create policy payment_claims_public_ins on public.payment_claims for insert to anon, authenticated with check (
  status = 'pending' and payment_id is null and reviewed_by is null and reviewed_at is null and notified_at is null and deleted_at is null and reject_reason is null
  and exists (select 1 from public.doc_public_links l
    where l.id = payment_claims.link_id and l.tenant_id = payment_claims.tenant_id and l.doc_type = 'inv' and l.doc_id = payment_claims.invoice_id
      and l.token_hash = encode(sha256(convert_to(payment_claims.token, 'UTF8')), 'hex')
      and l.revoked_at is null and l.deleted_at is null and l.expires_at > now())
  and (select count(*) from public.payment_claims c where c.link_id = payment_claims.link_id and c.created_at > now() - interval '10 minutes') < 3);
-- anon sees only (id, link_id, status, created_at): the public page can say "slip sent, waiting for confirmation"; the rate limit can count
drop policy if exists payment_claims_anon_read on public.payment_claims;
create policy payment_claims_anon_read on public.payment_claims for select to anon using (deleted_at is null);
drop policy if exists payment_claims_read on public.payment_claims;
create policy payment_claims_read on public.payment_claims for select to authenticated using (
  deleted_at is null and (tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid())
    or exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin')));
drop policy if exists payment_claims_upd on public.payment_claims;
create policy payment_claims_upd on public.payment_claims for update to authenticated
  using (tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid()))
  with check (tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid()));
drop policy if exists pa_vo_upd on public.payment_claims;
create policy pa_vo_upd on public.payment_claims as restrictive for update to authenticated using (not exists (select 1 from public.platform_support_sessions s where s.actor_id = auth.uid() and s.ended_at is null and s.view_only and s.deleted_at is null and s.tenant_id = payment_claims.tenant_id));

grant select, insert on public.payment_claims to authenticated;
grant update (status, reject_reason, payment_id, reviewed_by, reviewed_at, notified_at) on public.payment_claims to authenticated;
grant select (id, link_id, status, created_at, deleted_at) on public.payment_claims to anon;
grant insert (tenant_id, link_id, invoice_id, token, amount, paid_on, bank_ref, payer_name, note, files) on public.payment_claims to anon;

-- doc_attachments: allow the customer-slip kind (approved claims re-point their files to the new payment)
-- (entity_type already allows 'payment'; source 'customer' is already allowed by pay_attach_01)

-- storage: customer slip upload into doc-files/{tenant}/claims/{token}/{file} while the token is a live invoice link of that tenant
drop policy if exists doc_files_claim_ins on storage.objects;
create policy doc_files_claim_ins on storage.objects for insert to anon, authenticated with check (
  bucket_id = 'doc-files'
  and (storage.foldername(name))[2] = 'claims'
  and exists (select 1 from public.doc_public_links l
    where l.tenant_id::text = (storage.foldername(name))[1] and l.doc_type = 'inv'
      and l.token_hash = encode(sha256(convert_to((storage.foldername(name))[3], 'UTF8')), 'hex')
      and l.revoked_at is null and l.deleted_at is null and l.expires_at > now()));
-- staff read of claims/ files is already covered by doc_files_read (tenant folder). No anon read, no update, no delete.

notify pgrst, 'reload schema';

update public.dev_roadmap_items set stage = 'completed', module = 'sales',
  description = 'Payment attachments Phase 3: customer sends the payment slip from the public invoice link (payment_claims, token-hash RLS, private files), staff bell + review card on the invoice (Approve opens Record Payment prefilled and moves the files to the payment, Reject asks a reason), PDF receipt per payment + WhatsApp thank-you/receipt via the share sheet, AI slip reading fills amount/date.'
where title = 'Payment attachments (Phase 3)';
insert into public.dev_roadmap_items (title, description, module, stage)
select 'Payment attachments (Phase 3)', 'Payment attachments Phase 3: customer sends the payment slip from the public invoice link (payment_claims, token-hash RLS, private files), staff bell + review card on the invoice (Approve opens Record Payment prefilled and moves the files to the payment, Reject asks a reason), PDF receipt per payment + WhatsApp thank-you/receipt via the share sheet, AI slip reading fills amount/date.', 'sales', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Payment attachments (Phase 3)');
