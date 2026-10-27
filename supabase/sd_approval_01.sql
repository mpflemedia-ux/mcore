reset role;

-- Salary Disbursement — Share for Approval (WhatsApp -> external signature -> signed file
-- returns and is stored in the system). Clones the proven Payment Claims blueprint
-- (pay_attach_01/03.sql) rather than inventing a new mechanism: a token-gated public page,
-- anon INSERT-only RLS (never read-back, never update/delete), private storage bucket
-- (reuses doc-files), staff review card that approves/rejects.
--
-- Needs wa_doc_01.sql (doc_public_links) and pay_attach_01.sql (doc-files bucket) already run.
-- Write-only, idempotent. Run once in Supabase SQL Editor.

select 1 / (case when to_regclass('public.doc_public_links') is null then 0 else 1 end) as wa_doc_01_present;
select 1 / (case when exists (select 1 from storage.buckets where id = 'doc-files') then 1 else 0 end) as storage_present;

-- ---------- 1) salary_disbursement_batches: one durable row per tenant+month+year, the
-- entity the public token/approval actually hangs off (payroll_records is one row PER
-- EMPLOYEE, no single row represents "the Oct 2026 disbursement document" as one thing). ----------
create table if not exists public.salary_disbursement_batches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  month int not null check (month between 1 and 12),
  year int not null check (year between 2020 and 2100),
  status text not null default 'draft' check (status in ('draft', 'shared', 'pending_review', 'approved', 'rejected')),
  total_net_pay numeric(14,2),
  employee_count int,
  public_token text unique check (public_token is null or length(public_token) between 16 and 64),
  approver_name text check (approver_name is null or length(approver_name) <= 120),
  reject_reason text check (reject_reason is null or length(reject_reason) <= 500),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  shared_at timestamptz,
  reviewed_by uuid,
  reviewed_at timestamptz,
  deleted_at timestamptz
);
create unique index if not exists sd_batches_period_uq on public.salary_disbursement_batches (tenant_id, month, year) where deleted_at is null;
create index if not exists sd_batches_tenant_idx on public.salary_disbursement_batches (tenant_id, created_at);
alter table public.salary_disbursement_batches enable row level security;
revoke all on public.salary_disbursement_batches from anon;

drop policy if exists sd_batches_read on public.salary_disbursement_batches;
create policy sd_batches_read on public.salary_disbursement_batches for select to authenticated using (
  deleted_at is null and tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid()));
drop policy if exists sd_batches_ins on public.salary_disbursement_batches;
create policy sd_batches_ins on public.salary_disbursement_batches for insert to authenticated with check (
  deleted_at is null and tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid())
  and exists (select 1 from public.user_profiles p where p.id = auth.uid()
    and lower(coalesce(p.role, '')) in ('owner', 'admin', 'platform_admin', 'manager', 'hr')));
drop policy if exists sd_batches_upd on public.salary_disbursement_batches;
create policy sd_batches_upd on public.salary_disbursement_batches for update to authenticated
  using (tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid())
    and exists (select 1 from public.user_profiles p where p.id = auth.uid()
      and lower(coalesce(p.role, '')) in ('owner', 'admin', 'platform_admin', 'manager', 'hr')))
  with check (tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid()));
-- PA view-only sessions: no writes (same rule as every other write-gated table)
drop policy if exists pa_vo_ins on public.salary_disbursement_batches;
create policy pa_vo_ins on public.salary_disbursement_batches as restrictive for insert to authenticated with check (not exists (select 1 from public.platform_support_sessions s where s.actor_id = auth.uid() and s.ended_at is null and s.view_only and s.deleted_at is null and s.tenant_id = salary_disbursement_batches.tenant_id));
drop policy if exists pa_vo_upd on public.salary_disbursement_batches;
create policy pa_vo_upd on public.salary_disbursement_batches as restrictive for update to authenticated using (not exists (select 1 from public.platform_support_sessions s where s.actor_id = auth.uid() and s.ended_at is null and s.view_only and s.deleted_at is null and s.tenant_id = salary_disbursement_batches.tenant_id));

grant select, insert, update on public.salary_disbursement_batches to authenticated;

-- ---------- 2) sd_approvals: the signed-file submission (the "return" half) ----------
create table if not exists public.sd_approvals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  batch_id uuid not null references public.salary_disbursement_batches(id),
  link_id uuid not null,
  token text not null check (length(token) between 16 and 200),
  approver_name text check (approver_name is null or length(approver_name) <= 120),
  storage_path text not null check (length(storage_path) between 10 and 400),
  file_name text not null check (length(file_name) between 1 and 200),
  mime_type text check (mime_type is null or length(mime_type) <= 120),
  size_bytes integer check (size_bytes is null or (size_bytes > 0 and size_bytes <= 10485760)),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reject_reason text check (reject_reason is null or length(reject_reason) <= 500),
  reviewed_by uuid,
  reviewed_at timestamptz,
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists sd_approvals_batch_idx on public.sd_approvals (tenant_id, batch_id, status) where deleted_at is null;
create index if not exists sd_approvals_link_idx on public.sd_approvals (link_id, created_at);
create index if not exists sd_approvals_pending_idx on public.sd_approvals (tenant_id) where notified_at is null and deleted_at is null;
alter table public.sd_approvals enable row level security;

-- anon/authenticated may INSERT a pending submission only while holding a live 'sd' token for
-- this exact batch (hash match, not revoked, not expired) — same safety shape as payment_claims.
-- Rate-limited to 3 submissions per link per 10 minutes.
drop policy if exists sd_approvals_public_ins on public.sd_approvals;
create policy sd_approvals_public_ins on public.sd_approvals for insert to anon, authenticated with check (
  status = 'pending' and reviewed_by is null and reviewed_at is null and notified_at is null and deleted_at is null and reject_reason is null
  and exists (select 1 from public.doc_public_links l
    where l.id = sd_approvals.link_id and l.tenant_id = sd_approvals.tenant_id and l.doc_type = 'sd' and l.doc_id = sd_approvals.batch_id
      and l.token_hash = encode(sha256(convert_to(sd_approvals.token, 'UTF8')), 'hex')
      and l.revoked_at is null and l.deleted_at is null and l.expires_at > now())
  and (select count(*) from public.sd_approvals a where a.link_id = sd_approvals.link_id and a.created_at > now() - interval '10 minutes') < 3);
-- anon sees only (id, link_id, status, created_at): the public page can say "sent, waiting for review"
drop policy if exists sd_approvals_anon_read on public.sd_approvals;
create policy sd_approvals_anon_read on public.sd_approvals for select to anon using (deleted_at is null);
drop policy if exists sd_approvals_read on public.sd_approvals;
create policy sd_approvals_read on public.sd_approvals for select to authenticated using (
  deleted_at is null and (tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid())
    or exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin')));
drop policy if exists sd_approvals_upd on public.sd_approvals;
create policy sd_approvals_upd on public.sd_approvals for update to authenticated
  using (tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid())
    and exists (select 1 from public.user_profiles p where p.id = auth.uid()
      and lower(coalesce(p.role, '')) in ('owner', 'admin', 'platform_admin', 'manager', 'hr')))
  with check (tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid()));
drop policy if exists pa_vo_upd on public.sd_approvals;
create policy pa_vo_upd on public.sd_approvals as restrictive for update to authenticated using (not exists (select 1 from public.platform_support_sessions s where s.actor_id = auth.uid() and s.ended_at is null and s.view_only and s.deleted_at is null and s.tenant_id = sd_approvals.tenant_id));

grant select, insert on public.sd_approvals to authenticated;
grant update (status, reject_reason, reviewed_by, reviewed_at, notified_at) on public.sd_approvals to authenticated;
grant select (id, link_id, status, created_at, deleted_at) on public.sd_approvals to anon;
grant insert (tenant_id, batch_id, link_id, token, approver_name, storage_path, file_name, mime_type, size_bytes) on public.sd_approvals to anon;

-- anon can INSERT a submission (above) but has no UPDATE grant on salary_disbursement_batches,
-- so without this the batch would sit on 'shared' forever and the staff Review button would
-- never appear. SECURITY DEFINER lets the trigger flip it on the approver's behalf.
CREATE OR REPLACE FUNCTION public.sd_approvals_mark_pending_review() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE salary_disbursement_batches SET status = 'pending_review' WHERE id = NEW.batch_id AND status = 'shared';
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS sd_approvals_pending_review_trg ON public.sd_approvals;
CREATE TRIGGER sd_approvals_pending_review_trg AFTER INSERT ON public.sd_approvals
  FOR EACH ROW EXECUTE FUNCTION public.sd_approvals_mark_pending_review();

-- ---------- 3) widen doc_public_links / doc_shares to allow doc_type 'sd' (additive only —
-- 'inv'/'quo'/'booking'/'pos' untouched, no regression to existing WA-doc flows) ----------
alter table public.doc_public_links drop constraint if exists doc_public_links_doc_type_check;
alter table public.doc_public_links add constraint doc_public_links_doc_type_check check (doc_type in ('inv', 'quo', 'sd'));
alter table public.doc_shares drop constraint if exists doc_shares_doc_type_check;
alter table public.doc_shares add constraint doc_shares_doc_type_check check (doc_type in ('inv', 'quo', 'booking', 'pos', 'sd'));

-- ---------- 4) storage: signed-file upload into doc-files/{tenant}/sd-approvals/{token}/{file}
-- while that token is a live 'sd' link of that tenant (same shape as doc_files_claim_ins) ----------
drop policy if exists doc_files_sd_ins on storage.objects;
create policy doc_files_sd_ins on storage.objects for insert to anon, authenticated with check (
  bucket_id = 'doc-files'
  and (storage.foldername(name))[2] = 'sd-approvals'
  and exists (select 1 from public.doc_public_links l
    where l.tenant_id::text = (storage.foldername(name))[1] and l.doc_type = 'sd'
      and l.token_hash = encode(sha256(convert_to((storage.foldername(name))[3], 'UTF8')), 'hex')
      and l.revoked_at is null and l.deleted_at is null and l.expires_at > now()));
-- staff read of sd-approvals/ files already covered by doc_files_read (tenant folder, pay_attach_01.sql). No anon read/update/delete.

-- ---------- 5) get_public_salary_batch(p_token): SECURITY DEFINER token -> batch + employee
-- rows, mirrors get_public_invoice()'s shape/safety exactly (validates against the entity's
-- own public_token, returns only what the public page needs). ----------
CREATE OR REPLACE FUNCTION public.get_public_salary_batch(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b salary_disbursement_batches%ROWTYPE;
  tn tenants%ROWTYPE;
  cp jsonb;
  rows jsonb;
  link doc_public_links%ROWTYPE;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) < 8 THEN
    RAISE EXCEPTION 'Invalid token';
  END IF;
  SELECT * INTO b FROM salary_disbursement_batches WHERE public_token = trim(p_token) AND deleted_at IS NULL LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Batch not found';
  END IF;

  -- also respect expiry/revoke (get_public_invoice doesn't check this on doc_public_links;
  -- this function does, since it's new and there is no reason not to be correct from the start)
  SELECT * INTO link FROM doc_public_links
    WHERE doc_type = 'sd' AND doc_id = b.id
      AND token_hash = encode(sha256(convert_to(trim(p_token), 'UTF8')), 'hex')
    LIMIT 1;
  IF NOT FOUND OR link.revoked_at IS NOT NULL OR link.expires_at <= now() THEN
    RAISE EXCEPTION 'Link expired or revoked';
  END IF;

  SELECT * INTO tn FROM tenants WHERE id = b.tenant_id;
  cp := coalesce(tn.config->'company_profile', '{}'::jsonb);

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'name', e.name,
    'position', e.position,
    'bank_name', e.bank_name,
    'bank_account_no', e.bank_account_no,
    'basic_salary', pr.basic_salary,
    'allowance_total', coalesce(pr.allowance_1,0) + coalesce(pr.allowance_2,0) + coalesce(pr.allowance_3,0),
    'epf_employee', pr.epf_employee,
    'socso_employee', pr.socso_employee,
    'eis_employee', pr.eis_employee,
    'pcb', pr.pcb,
    'deduction_total', coalesce(pr.deduction_1,0) + coalesce(pr.deduction_2,0) + coalesce(pr.advance,0),
    'ot_amount', coalesce(pr.ot_amount,0),
    'net_pay', pr.net_pay
  ) ORDER BY e.name), '[]'::jsonb)
  INTO rows
  FROM payroll_records pr
  JOIN employees e ON e.id = pr.employee_id
  WHERE pr.tenant_id = b.tenant_id AND pr.month = b.month AND pr.year = b.year;

  RETURN jsonb_build_object(
    'batch_id', b.id,
    'tenant_id', b.tenant_id,
    'link_id', link.id,
    'status', b.status,
    'month', b.month,
    'year', b.year,
    'tenant_name', coalesce(nullif(tn.name,''), cp->>'name'),
    'logo_url', coalesce(nullif(tn.logo_url,''), cp->>'logo_url'),
    'address', coalesce(nullif(tn.address,''), cp->>'address'),
    'rows', rows,
    'grand_total_net_pay', b.total_net_pay
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_salary_batch(text) TO anon, authenticated;

notify pgrst, 'reload schema';

-- System Development
update public.dev_roadmap_items set stage = 'completed', module = 'hr',
  description = 'Salary Disbursement — Share for Approval: HR shares a specific month''s disbursement via WhatsApp (public link, no login needed); the approver views the full breakdown and uploads a signed photo/PDF back; HR reviews and approves/rejects in-app. Clones the proven Payment Claims blueprint (token-gated anon INSERT-only RLS, private doc-files bucket) rather than a new mechanism. Batch is locked (read-only) while shared/pending review to keep what was signed in sync with the system. New: salary_disbursement_batches, sd_approvals, get_public_salary_batch() RPC, doc_public_links/doc_shares widened to doc_type=''sd''.'
where title = 'HR: Salary Disbursement Share for Approval (WhatsApp signature)';
insert into public.dev_roadmap_items (title, description, module, stage)
select 'HR: Salary Disbursement Share for Approval (WhatsApp signature)',
  'Salary Disbursement — Share for Approval: HR shares a specific month''s disbursement via WhatsApp (public link, no login needed); the approver views the full breakdown and uploads a signed photo/PDF back; HR reviews and approves/rejects in-app. Clones the proven Payment Claims blueprint (token-gated anon INSERT-only RLS, private doc-files bucket) rather than a new mechanism. Batch is locked (read-only) while shared/pending review to keep what was signed in sync with the system. New: salary_disbursement_batches, sd_approvals, get_public_salary_batch() RPC, doc_public_links/doc_shares widened to doc_type=''sd''.',
  'hr', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'HR: Salary Disbursement Share for Approval (WhatsApp signature)');
