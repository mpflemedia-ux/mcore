-- M-Core Payment Vouchers revamp (PV + PV Disbursement / PVD) — payroll-style cards, 4 signatures, WhatsApp sign link,
-- payee picker, per-line paid status + receipt, bank CSV, SD import, duplicate batch, reminders, GL category.
-- WRITE-ONLY: Mike runs this in Supabase SQL Editor. Rerun-safe (idempotent). Run AFTER sd_signatures_01.sql + payslip_share_01.sql.
-- Optional afterwards: supabase/pv_revamp_02_cron.sql (pg_cron hourly reminder). The app also runs the reminder on open.
--   1) Columns: PVD lines (bank_account_no, payee_type, payee_id, phone, category, gl_account_id, pay_status, paid_date, receipt_path, source)
--      PVD batches (created_by, status check, signing columns, source), payment_vouchers (bank_account_no, payee_id, phone, category, batch link, created_by)
--   2) pv_settings (per tenant): signature threshold (default < RM5,000 = 3 signatures, >= RM5,000 = 4), reminder hours, bank CSV layout, GL map
--   3) pv_sign_links (hash only) + pv_signatures (doc_kind pvd | pv), RPCs pv_sign_app / pv_sign_link_create / get_public_pv_sign / pv_sign_public / pv_sign_reset
--      All required signed -> auto-approve; PVD also auto-creates approved single PVs carrying the signatures. Bell + push per signature, NO amounts.
--   4) Back to draft -> void signatures + revoke links. Status 'approved' only via signatures or approver roles (trigger gate).
--   5) RLS: PVD batches + lines get has_module('vouchers') on writes (was tenant only).
--   6) pv_import_sd (approved Salary Disbursement -> new PVD draft), pv_remind_pending (24h reminder), doc_shares widened (pvd / pv).
--   7) Storage doc-files: {tenant}/pv-signatures/..., {tenant}/pv-sign/{hash}/..., {tenant}/pv-receipts/...
--   8) dev_roadmap_items rows (completed).
reset role;
select 1 / (case when to_regclass('public.payment_voucher_batches') is null then 0 else 1 end) as pv_batches_present;
select 1 / (case when to_regclass('public.payment_vouchers') is null then 0 else 1 end) as payment_vouchers_present;

-- ---------- 1) columns ----------
alter table public.payment_voucher_batch_lines
  add column if not exists voucher_id uuid,
  add column if not exists bank_account_no text,
  add column if not exists payee_type text,
  add column if not exists payee_id uuid,
  add column if not exists phone text,
  add column if not exists category text,
  add column if not exists gl_account_id uuid,
  add column if not exists pay_status text not null default 'unpaid',
  add column if not exists paid_date date,
  add column if not exists pay_ref text,
  add column if not exists fail_reason text,
  add column if not exists receipt_path text,
  add column if not exists source text,
  add column if not exists source_ref uuid,
  add column if not exists updated_at timestamptz default now();
alter table public.payment_voucher_batch_lines drop constraint if exists pvd_lines_pay_status_check;
alter table public.payment_voucher_batch_lines add constraint pvd_lines_pay_status_check check (pay_status in ('unpaid', 'paid', 'failed')) not valid;
alter table public.payment_voucher_batch_lines drop constraint if exists pvd_lines_payee_type_check;
alter table public.payment_voucher_batch_lines add constraint pvd_lines_payee_type_check check (payee_type is null or payee_type in ('supplier', 'employee', 'other')) not valid;
alter table public.payment_voucher_batch_lines drop constraint if exists pvd_lines_category_check;
alter table public.payment_voucher_batch_lines add constraint pvd_lines_category_check check (category is null or category in ('supplier', 'salary', 'commission', 'statutory', 'utility', 'other')) not valid;
alter table public.payment_voucher_batch_lines drop constraint if exists pvd_lines_len_check;
alter table public.payment_voucher_batch_lines add constraint pvd_lines_len_check check (
  coalesce(length(bank_account_no), 0) <= 40 and coalesce(length(phone), 0) <= 30 and coalesce(length(pay_ref), 0) <= 120
  and coalesce(length(fail_reason), 0) <= 300 and coalesce(length(receipt_path), 0) <= 400) not valid;
create index if not exists pvd_lines_payee_idx on public.payment_voucher_batch_lines (tenant_id, lower(payee_name), amount);
create index if not exists pvd_lines_voucher_idx on public.payment_voucher_batch_lines (voucher_id);

alter table public.payment_voucher_batches
  add column if not exists deleted_at timestamptz,
  add column if not exists first_approved_by text,
  add column if not exists created_by uuid default auth.uid(),
  add column if not exists required_sigs int,
  add column if not exists shared_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists pvs_created_at timestamptz,
  add column if not exists last_reminded_at timestamptz,
  add column if not exists reset_reason text,
  add column if not exists source text,
  add column if not exists source_ref uuid;
alter table public.payment_voucher_batches drop constraint if exists pvd_batches_status_check;
alter table public.payment_voucher_batches add constraint pvd_batches_status_check
  check (status is null or status in ('draft', 'shared', 'pending', 'approved', 'converted', 'paid', 'void')) not valid;
create unique index if not exists pvd_batches_sd_src_uq on public.payment_voucher_batches (tenant_id, source_ref) where source = 'sd' and deleted_at is null;

alter table public.payment_vouchers
  add column if not exists bank_account_no text,
  add column if not exists payee_id uuid,
  add column if not exists phone text,
  add column if not exists category text,
  add column if not exists gl_account_id uuid,
  add column if not exists batch_id uuid,
  add column if not exists batch_line_id uuid,
  add column if not exists receipt_path text,
  add column if not exists created_by uuid default auth.uid(),
  add column if not exists approved_at timestamptz,
  add column if not exists last_reminded_at timestamptz,
  add column if not exists source text;
alter table public.payment_vouchers drop constraint if exists payment_vouchers_category_check;
alter table public.payment_vouchers add constraint payment_vouchers_category_check check (category is null or category in ('supplier', 'salary', 'commission', 'statutory', 'utility', 'other')) not valid;
create index if not exists payment_vouchers_batch_idx on public.payment_vouchers (batch_id);

do $$ begin
  if to_regclass('public.suppliers') is not null then
    alter table public.suppliers add column if not exists bank_name text, add column if not exists bank_account_no text;
  end if;
end $$;

-- ---------- 2) settings (per tenant) ----------
-- Module guard: uses has_module() when the RBAC migration is installed; otherwise keeps today's
-- tenant-member access (PVD was tenant FOR ALL). Avoids 42883 on DBs without has_module(text).
create or replace function public.pv__can(p_module text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare ok boolean;
begin
  if exists (select 1 from public.user_profiles where id = auth.uid() and lower(coalesce(role, '')) in ('owner', 'admin', 'platform_admin')) then
    return true;
  end if;
  begin
    execute 'select public.has_module($1)' into ok using p_module;
    return coalesce(ok, false);
  exception when undefined_function then
    return exists (select 1 from public.user_profiles where id = auth.uid() and tenant_id = public.get_my_tenant_id());
  end;
end;
$fn$;
revoke all on function public.pv__can(text) from public;
grant execute on function public.pv__can(text) to authenticated;

create table if not exists public.pv_settings (
  tenant_id uuid primary key,
  sig_threshold numeric(14,2) not null default 5000 check (sig_threshold >= 0),
  low_sig_count int not null default 3 check (low_sig_count between 1 and 4),
  reminder_hours int not null default 24 check (reminder_hours between 1 and 720),
  bank_formats jsonb not null default '{}'::jsonb,
  gl_map jsonb not null default '{}'::jsonb,
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now()
);
alter table public.pv_settings enable row level security;
revoke all on public.pv_settings from anon;
drop policy if exists pv_settings_read on public.pv_settings;
create policy pv_settings_read on public.pv_settings for select to authenticated using (tenant_id = public.get_my_tenant_id());
drop policy if exists pv_settings_write on public.pv_settings;
create policy pv_settings_write on public.pv_settings for all to authenticated
  using (tenant_id = public.get_my_tenant_id() and public.pv__can('vouchers')
    and exists (select 1 from public.user_profiles p where p.id = auth.uid() and lower(coalesce(p.role, '')) in ('owner', 'admin', 'platform_admin', 'finance', 'accountant')))
  with check (tenant_id = public.get_my_tenant_id() and public.pv__can('vouchers')
    and exists (select 1 from public.user_profiles p where p.id = auth.uid() and lower(coalesce(p.role, '')) in ('owner', 'admin', 'platform_admin', 'finance', 'accountant')));
grant select, insert, update on public.pv_settings to authenticated;

-- ---------- 3) RLS: PVD batches + lines need the vouchers module to write ----------
drop policy if exists pvd_batches_tenant on public.payment_voucher_batches;
drop policy if exists pvd_batches_select on public.payment_voucher_batches;
drop policy if exists pvd_batches_write on public.payment_voucher_batches;
create policy pvd_batches_select on public.payment_voucher_batches for select to authenticated using (tenant_id = public.get_my_tenant_id());
create policy pvd_batches_write on public.payment_voucher_batches for all to authenticated
  using (tenant_id = public.get_my_tenant_id() and public.pv__can('vouchers'))
  with check (tenant_id = public.get_my_tenant_id() and public.pv__can('vouchers'));
drop policy if exists pvd_lines_tenant on public.payment_voucher_batch_lines;
drop policy if exists pvd_lines_select on public.payment_voucher_batch_lines;
drop policy if exists pvd_lines_write on public.payment_voucher_batch_lines;
create policy pvd_lines_select on public.payment_voucher_batch_lines for select to authenticated using (tenant_id = public.get_my_tenant_id());
create policy pvd_lines_write on public.payment_voucher_batch_lines for all to authenticated
  using (tenant_id = public.get_my_tenant_id() and public.pv__can('vouchers'))
  with check (tenant_id = public.get_my_tenant_id() and public.pv__can('vouchers'));

-- ---------- 4) role links (hash only) + signatures ----------
create table if not exists public.pv_sign_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  doc_kind text not null check (doc_kind in ('pvd', 'pv')),
  doc_id uuid not null,
  role text not null check (role in ('prepared', 'checked', 'first', 'second')),
  token_hash text not null unique check (length(token_hash) = 64),
  expires_at timestamptz not null default now() + interval '30 days',
  revoked_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists pv_sign_links_doc_idx on public.pv_sign_links (tenant_id, doc_kind, doc_id, role);
alter table public.pv_sign_links enable row level security;
revoke all on public.pv_sign_links from anon;
drop policy if exists pv_sign_links_read on public.pv_sign_links;
create policy pv_sign_links_read on public.pv_sign_links for select to authenticated using (tenant_id = public.get_my_tenant_id());
grant select on public.pv_sign_links to authenticated;

create table if not exists public.pv_signatures (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  doc_kind text not null check (doc_kind in ('pvd', 'pv')),
  doc_id uuid not null,
  role text not null check (role in ('prepared', 'checked', 'first', 'second')),
  signer_name text not null check (length(btrim(signer_name)) between 1 and 120),
  signer_user_id uuid,
  storage_path text not null check (length(storage_path) between 10 and 400),
  attachment_path text check (attachment_path is null or length(attachment_path) <= 400),
  signed_via text not null check (signed_via in ('app', 'link', 'batch')),
  link_id uuid references public.pv_sign_links(id) on delete set null,
  signed_at timestamptz not null default now(),
  voided_at timestamptz,
  void_reason text check (void_reason is null or length(void_reason) <= 500),
  created_at timestamptz not null default now()
);
create unique index if not exists pv_signatures_active_uq on public.pv_signatures (doc_kind, doc_id, role) where voided_at is null;
create index if not exists pv_signatures_tenant_idx on public.pv_signatures (tenant_id, doc_kind, doc_id);
alter table public.pv_signatures enable row level security;
revoke all on public.pv_signatures from anon;
drop policy if exists pv_signatures_read on public.pv_signatures;
create policy pv_signatures_read on public.pv_signatures for select to authenticated using (
  tenant_id = public.get_my_tenant_id()
  or exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin'));
-- no insert / update / delete grants: every write goes through the RPCs below
grant select on public.pv_signatures to authenticated;

-- ---------- 5) helpers (not callable by clients) ----------
create or replace function public.pv__role_label(p_role text, p_bm boolean)
returns text language sql immutable set search_path = public as $$
  select case p_role
    when 'prepared' then case when p_bm then 'Disediakan Oleh' else 'Prepared By' end
    when 'checked' then case when p_bm then 'Disemak Oleh' else 'Checked By' end
    when 'first' then case when p_bm then 'Kelulusan Pertama' else 'First Approval' end
    else case when p_bm then 'Kelulusan Kedua' else 'Second Approval' end end
$$;

-- required roles for an amount: >= threshold -> all 4, else the first low_sig_count roles (default 3: prepared, checked, first)
create or replace function public.pv__required_roles(p_tenant uuid, p_amount numeric)
returns text[] language plpgsql stable security definer set search_path = public as $$
declare
  thr numeric := 5000;
  low int := 3;
  roles text[] := array['prepared', 'checked', 'first', 'second'];
begin
  select s.sig_threshold, s.low_sig_count into thr, low from public.pv_settings s where s.tenant_id = p_tenant;
  thr := coalesce(thr, 5000); low := coalesce(low, 3);
  if coalesce(p_amount, 0) >= thr then return roles; end if;
  return roles[1:greatest(1, least(4, low))];
end;
$$;

-- one doc (PVD batch or single PV) as a uniform record
create or replace function public.pv__doc(p_kind text, p_doc uuid)
returns table (tenant_id uuid, status text, amount numeric, ref_no text, title text, created_by uuid, doc_date date)
language plpgsql stable security definer set search_path = public as $$
begin
  if p_kind = 'pvd' then
    return query select b.tenant_id, coalesce(b.status, 'draft'), coalesce(b.total_amount, 0)::numeric, b.ref_no, b.title, b.created_by, b.batch_date
      from public.payment_voucher_batches b where b.id = p_doc and b.deleted_at is null;
  elsif p_kind = 'pv' then
    return query select v.tenant_id, coalesce(v.status, 'draft'), coalesce(v.amount, 0)::numeric, v.ref_no, v.payee_name, v.created_by, v.voucher_date
      from public.payment_vouchers v where v.id = p_doc and v.deleted_at is null;
  end if;
end;
$$;

create or replace function public.pv__slots(p_kind text, p_doc uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  d record;
  req text[];
  res jsonb;
begin
  select * into d from public.pv__doc(p_kind, p_doc);
  if not found then return '[]'::jsonb; end if;
  req := public.pv__required_roles(d.tenant_id, d.amount);
  select coalesce(jsonb_agg(jsonb_build_object(
    'role', r.role,
    'required', r.role = any(req),
    'signed', s.id is not null,
    'signer_name', s.signer_name,
    'signed_at', s.signed_at,
    'signed_via', s.signed_via
  ) order by r.ord), '[]'::jsonb) into res
  from (values ('prepared', 1), ('checked', 2), ('first', 3), ('second', 4)) r(role, ord)
  left join public.pv_signatures s on s.doc_kind = p_kind and s.doc_id = p_doc and s.role = r.role and s.voided_at is null;
  return res;
end;
$$;

-- next PV-0001 style ref (same format as the app's _genFallbackRefNo); serialised per tenant
create or replace function public.pv__next_ref(p_tenant uuid, p_prefix text)
returns text language plpgsql security definer set search_path = public as $$
declare n int;
begin
  perform pg_advisory_xact_lock(hashtext(p_tenant::text || ':' || p_prefix));
  if p_prefix = 'PVD' then
    select coalesce(max((substring(ref_no from '^PVD-(\d+)$'))::int), 0) into n from public.payment_voucher_batches where tenant_id = p_tenant and ref_no ~ '^PVD-\d+$';
  else
    select coalesce(max((substring(ref_no from '^PV-(\d+)$'))::int), 0) into n from public.payment_vouchers where tenant_id = p_tenant and ref_no ~ '^PV-\d+$';
  end if;
  return p_prefix || '-' || lpad((n + 1)::text, 4, '0');
end;
$$;

-- bell + push (push-send webhook on notifications) to voucher approvers + creator, actor excluded. NEVER carries amounts.
create or replace function public.pv__notify(p_tenant uuid, p_actor uuid, p_extra uuid, p_en text, p_bm text, p_body_en text, p_body_bm text,
  p_type text, p_priority int, p_link jsonb, p_ref_table text, p_ref_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare n int := 0;
begin
  begin
    insert into public.notifications (tenant_id, user_id, actor_id, title, body, category, kind, type, priority, link, ref_table, ref_id)
    select p_tenant, u.id, p_actor,
      left(case when u.language = 'bm' then p_bm else p_en end, 200),
      left(case when u.language = 'bm' then p_body_bm else p_body_en end, 500),
      'approval', 'for_you', p_type, coalesce(p_priority, 0), p_link, p_ref_table, p_ref_id
    from public.user_profiles u
    where u.tenant_id = p_tenant and coalesce(u.is_active, true)
      and (lower(coalesce(u.role, '')) in ('owner', 'admin', 'finance', 'accountant', 'manager') or u.id = p_extra)
      and u.id is distinct from p_actor;
    get diagnostics n = row_count;
  exception when others then
    raise warning 'pv__notify skipped: %', sqlerrm;
  end;
  return n;
end;
$$;

-- PVD approved -> one approved single PV per line (lines that already have a voucher are kept), signatures carried over
create or replace function public.pv__create_pvs(p_batch uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  b public.payment_voucher_batches%rowtype;
  l public.payment_voucher_batch_lines%rowtype;
  vid uuid;
  n int := 0;
begin
  select * into b from public.payment_voucher_batches where id = p_batch;
  if not found then return 0; end if;
  perform set_config('mcore.pv_rpc', '1', true);
  for l in select * from public.payment_voucher_batch_lines where batch_id = p_batch and voucher_id is null order by sort_order, created_at loop
    insert into public.payment_vouchers (tenant_id, ref_no, voucher_date, payee_name, payee_type, payee_id, supplier_id, bill_id, amount,
      payment_method, bank_name, bank_account_no, cheque_no, phone, description, status, prepared_by, checked_by, approved_by,
      category, gl_account_id, batch_id, batch_line_id, created_by, approved_at, source, created_at, updated_at)
    values (b.tenant_id, public.pv__next_ref(b.tenant_id, 'PV'), coalesce(b.batch_date, current_date), l.payee_name,
      coalesce(l.payee_type, 'other'), l.payee_id, case when l.payee_type = 'supplier' then l.payee_id end, l.bill_id, coalesce(l.amount, 0),
      l.payment_method, l.bank_name, l.bank_account_no, l.cheque_no, l.phone, coalesce(nullif(l.description, ''), b.title), 'approved',
      b.prepared_by, b.checked_by, coalesce(b.approved_by, b.first_approved_by), l.category, l.gl_account_id, b.id, l.id, b.created_by, now(),
      case when l.source = 'sd' then 'sd' else 'pvd' end, now(), now())
    returning id into vid;
    update public.payment_voucher_batch_lines set voucher_id = vid, updated_at = now() where id = l.id;
    insert into public.pv_signatures (tenant_id, doc_kind, doc_id, role, signer_name, signer_user_id, storage_path, attachment_path, signed_via, link_id, signed_at)
    select s.tenant_id, 'pv', vid, s.role, s.signer_name, s.signer_user_id, s.storage_path, s.attachment_path, 'batch', null, s.signed_at
    from public.pv_signatures s where s.doc_kind = 'pvd' and s.doc_id = b.id and s.voided_at is null
    on conflict do nothing;
    n := n + 1;
  end loop;
  update public.payment_voucher_batches set pvs_created_at = now(), updated_at = now() where id = b.id;
  return n;
end;
$$;

-- after each signature: draft/shared -> pending; all required signed -> approved (+ PVD: single PVs created). Bell + push, no amounts.
create or replace function public.pv__after_sign(p_kind text, p_doc uuid, p_role text, p_signer text, p_via text, p_actor uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  d record;
  req text[];
  n int;
  need int;
  ok boolean := false;
  made int := 0;
  lnk jsonb;
  nm_en text; nm_bm text;
begin
  if p_kind = 'pvd' then perform 1 from public.payment_voucher_batches where id = p_doc for update;
  else perform 1 from public.payment_vouchers where id = p_doc for update; end if;
  select * into d from public.pv__doc(p_kind, p_doc);
  req := public.pv__required_roles(d.tenant_id, d.amount);
  need := coalesce(array_length(req, 1), 4);
  select count(*) into n from public.pv_signatures where doc_kind = p_kind and doc_id = p_doc and voided_at is null and role = any(req);
  perform set_config('mcore.pv_rpc', '1', true);
  if n >= need then
    ok := true;
    if p_kind = 'pvd' then
      update public.payment_voucher_batches set status = 'approved', approved_at = now(), required_sigs = need, shared_at = coalesce(shared_at, now()), updated_at = now()
        where id = p_doc and coalesce(status, 'draft') in ('draft', 'shared', 'pending');
      made := public.pv__create_pvs(p_doc);
    else
      update public.payment_vouchers set status = 'approved', approved_at = now(), updated_at = now() where id = p_doc and coalesce(status, 'draft') in ('draft', 'shared', 'pending');
    end if;
  else
    if p_kind = 'pvd' then
      update public.payment_voucher_batches set status = 'pending', required_sigs = need, shared_at = coalesce(shared_at, now()), updated_at = now()
        where id = p_doc and coalesce(status, 'draft') in ('draft', 'shared');
    else
      update public.payment_vouchers set status = 'pending', updated_at = now() where id = p_doc and coalesce(status, 'draft') in ('draft', 'shared');
    end if;
  end if;
  nm_en := case when p_kind = 'pvd' then 'PV Disbursement ' else 'Payment voucher ' end || coalesce(d.ref_no, '');
  nm_bm := case when p_kind = 'pvd' then 'Penyaluran PV ' else 'Baucar bayaran ' end || coalesce(d.ref_no, '');
  lnk := jsonb_build_object('page', 'vouchers', 'params', jsonb_build_object('view', case when p_kind = 'pvd' then 'pvd-detail' else 'pv-detail' end, 'id', p_doc),
    'icon', case when ok then 'ti-circle-check' else 'ti-signature' end);
  perform public.pv__notify(d.tenant_id, p_actor, d.created_by,
    case when ok then nm_en || ' approved (' || n || '/' || need || ')' else public.pv__role_label(p_role, false) || ' signed (' || n || '/' || need || ') · ' || nm_en end,
    case when ok then nm_bm || ' diluluskan (' || n || '/' || need || ')' else public.pv__role_label(p_role, true) || ' ditandatangani (' || n || '/' || need || ') · ' || nm_bm end,
    left(coalesce(p_signer, ''), 80) || ' signed ' || case when p_via = 'link' then 'via WhatsApp link' else 'in the app' end
      || case when ok and p_kind = 'pvd' then '. All signatures done — ' || made || ' payment voucher(s) created, ready to pay.' when ok then '. All signatures done — ready to pay.' else '.' end,
    left(coalesce(p_signer, ''), 80) || ' tandatangan ' || case when p_via = 'link' then 'melalui pautan WhatsApp' else 'dalam aplikasi' end
      || case when ok and p_kind = 'pvd' then '. Semua tandatangan lengkap — ' || made || ' baucar dicipta, sedia untuk dibayar.' when ok then '. Semua tandatangan lengkap — sedia untuk dibayar.' else '.' end,
    case when ok then 'approval.pv_approved' else 'approval.pv_signed' end, case when ok then 1 else 0 end, lnk,
    case when p_kind = 'pvd' then 'payment_voucher_batches' else 'payment_vouchers' end, p_doc);
  return jsonb_build_object('signed', n, 'required', need, 'approved', ok, 'created', made, 'slots', public.pv__slots(p_kind, p_doc));
end;
$$;

-- storage policy helper: is {tenant}/pv-sign/{hash}/ a live role link of that tenant?
create or replace function public.pv_sign_path_ok(p_tenant text, p_hash text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.pv_sign_links l
    where l.tenant_id::text = p_tenant and l.token_hash = p_hash and l.revoked_at is null and l.expires_at > now())
$$;

create or replace function public.pv__view_only(p_tenant uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  return exists (select 1 from public.platform_support_sessions s where s.actor_id = auth.uid() and s.ended_at is null and s.view_only and s.deleted_at is null and s.tenant_id = p_tenant);
exception when undefined_table or undefined_column then return false;
end;
$$;

-- ---------- 6) RPCs ----------
-- staff, in the app: sign one slot with a PNG already uploaded to {tenant}/pv-signatures/{doc}/ . Any order; anyone with the vouchers module.
create or replace function public.pv_sign_app(p_kind text, p_doc uuid, p_role text, p_name text, p_path text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me public.user_profiles%rowtype;
  d record;
  nm text := left(btrim(coalesce(p_name, '')), 120);
  pre text;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if p_kind is null or p_kind not in ('pvd', 'pv') then raise exception 'Invalid document'; end if;
  select * into me from public.user_profiles where id = auth.uid();
  select * into d from public.pv__doc(p_kind, p_doc);
  if not found or (me.tenant_id is distinct from d.tenant_id and lower(coalesce(me.role, '')) <> 'platform_admin') then raise exception 'Voucher not found'; end if;
  if d.tenant_id is distinct from public.get_my_tenant_id() then raise exception 'Voucher not found'; end if;
  if not public.pv__can('vouchers') then raise exception 'No access to Payment Vouchers'; end if;
  if public.pv__view_only(d.tenant_id) then raise exception 'View-only support session'; end if;
  if p_role is null or p_role not in ('prepared', 'checked', 'first', 'second') then raise exception 'Invalid role'; end if;
  if d.status not in ('draft', 'shared', 'pending') then raise exception 'Already approved — locked'; end if;
  if nm = '' then raise exception 'Name required'; end if;
  pre := d.tenant_id::text || '/pv-signatures/' || p_doc::text || '/';
  if p_path is null or left(p_path, length(pre)) <> pre or p_path !~* '\.png$' then raise exception 'Invalid signature file'; end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'doc-files' and o.name = p_path) then raise exception 'Signature file not uploaded'; end if;
  begin
    insert into public.pv_signatures (tenant_id, doc_kind, doc_id, role, signer_name, signer_user_id, storage_path, signed_via)
    values (d.tenant_id, p_kind, p_doc, p_role, nm, auth.uid(), p_path, 'app');
  exception when unique_violation then raise exception 'This slot is already signed';
  end;
  perform set_config('mcore.pv_rpc', '1', true);
  if p_kind = 'pvd' then
    update public.payment_voucher_batches set
      prepared_by = case when p_role = 'prepared' then nm else prepared_by end,
      checked_by = case when p_role = 'checked' then nm else checked_by end,
      first_approved_by = case when p_role = 'first' then nm else first_approved_by end,
      approved_by = case when p_role = 'second' then nm else approved_by end
    where id = p_doc;
  else
    update public.payment_vouchers set
      prepared_by = case when p_role = 'prepared' then nm else prepared_by end,
      checked_by = case when p_role = 'checked' then nm else checked_by end,
      approved_by = case when p_role in ('first', 'second') then nm else approved_by end
    where id = p_doc;
  end if;
  return public.pv__after_sign(p_kind, p_doc, p_role, nm, 'app', auth.uid());
end;
$$;

-- new WhatsApp link for one role (raw token returned once; only its SHA-256 is stored). draft -> shared.
create or replace function public.pv_sign_link_create(p_kind text, p_doc uuid, p_role text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  d record;
  tok text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  l public.pv_sign_links%rowtype;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if p_kind is null or p_kind not in ('pvd', 'pv') then raise exception 'Invalid document'; end if;
  select * into d from public.pv__doc(p_kind, p_doc);
  if not found or d.tenant_id is distinct from public.get_my_tenant_id() then raise exception 'Voucher not found'; end if;
  if not public.pv__can('vouchers') then raise exception 'No access to Payment Vouchers'; end if;
  if public.pv__view_only(d.tenant_id) then raise exception 'View-only support session'; end if;
  if p_role is null or p_role not in ('prepared', 'checked', 'first', 'second') then raise exception 'Invalid role'; end if;
  if d.status not in ('draft', 'shared', 'pending') then raise exception 'Already approved — locked'; end if;
  if exists (select 1 from public.pv_signatures s where s.doc_kind = p_kind and s.doc_id = p_doc and s.role = p_role and s.voided_at is null) then raise exception 'This slot is already signed'; end if;
  insert into public.pv_sign_links (tenant_id, doc_kind, doc_id, role, token_hash, created_by)
  values (d.tenant_id, p_kind, p_doc, p_role, encode(sha256(convert_to(tok, 'UTF8')), 'hex'), auth.uid())
  returning * into l;
  perform set_config('mcore.pv_rpc', '1', true);
  if p_kind = 'pvd' then
    update public.payment_voucher_batches set status = 'shared', shared_at = coalesce(shared_at, now()), updated_at = now() where id = p_doc and coalesce(status, 'draft') = 'draft';
  else
    update public.payment_vouchers set status = 'shared', updated_at = now() where id = p_doc and coalesce(status, 'draft') = 'draft';
  end if;
  return jsonb_build_object('token', tok, 'link_id', l.id, 'expires_at', l.expires_at, 'role', p_role);
end;
$$;

-- public page (no login): voucher view for one role link + all slots. No bank account numbers, no phones.
create or replace function public.get_public_pv_sign(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  l public.pv_sign_links%rowtype;
  d record;
  tn public.tenants%rowtype;
  cp jsonb;
  v_rows jsonb;
begin
  if p_token is null or length(btrim(p_token)) < 32 then raise exception 'Invalid token'; end if;
  select * into l from public.pv_sign_links where token_hash = encode(sha256(convert_to(btrim(p_token), 'UTF8')), 'hex');
  if not found or l.revoked_at is not null or l.expires_at <= now() then raise exception 'Link expired or revoked'; end if;
  select * into d from public.pv__doc(l.doc_kind, l.doc_id);
  if not found then raise exception 'Voucher not found'; end if;
  if l.doc_kind = 'pvd' then
    select coalesce(jsonb_agg(jsonb_build_object('payee', x.payee_name, 'method', x.payment_method, 'bank', x.bank_name,
      'description', x.description, 'category', x.category, 'amount', x.amount) order by x.sort_order, x.created_at), '[]'::jsonb) into v_rows
    from public.payment_voucher_batch_lines x where x.batch_id = l.doc_id;
  else
    select jsonb_build_array(jsonb_build_object('payee', v.payee_name, 'method', v.payment_method, 'bank', v.bank_name,
      'description', v.description, 'category', v.category, 'amount', v.amount)) into v_rows
    from public.payment_vouchers v where v.id = l.doc_id;
  end if;
  select * into tn from public.tenants where id = d.tenant_id;
  cp := coalesce(tn.config->'company_profile', '{}'::jsonb);
  return jsonb_build_object(
    'mode', 'sign', 'kind', l.doc_kind, 'doc_id', l.doc_id, 'tenant_id', d.tenant_id, 'link_id', l.id, 'role', l.role, 'expires_at', l.expires_at,
    'status', d.status, 'ref_no', d.ref_no, 'title', d.title, 'date', d.doc_date, 'total', d.amount,
    'tenant_name', coalesce(nullif(tn.name, ''), cp->>'name'),
    'logo_url', coalesce(nullif(tn.logo_url, ''), cp->>'logo_url'),
    'address', coalesce(nullif(tn.address, ''), cp->>'address'),
    'rows', v_rows,
    'slots', public.pv__slots(l.doc_kind, l.doc_id));
end;
$$;

-- public page: sign this link's slot with a PNG already uploaded to {tenant}/pv-sign/{token_hash}/ (+ optional photo/PDF there)
create or replace function public.pv_sign_public(p_token text, p_name text, p_path text, p_attach_path text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  h text;
  l public.pv_sign_links%rowtype;
  d record;
  nm text := left(btrim(coalesce(p_name, '')), 120);
  pre text;
begin
  if p_token is null or length(btrim(p_token)) < 32 then raise exception 'Invalid token'; end if;
  h := encode(sha256(convert_to(btrim(p_token), 'UTF8')), 'hex');
  select * into l from public.pv_sign_links where token_hash = h for update;
  if not found or l.revoked_at is not null or l.expires_at <= now() then raise exception 'Link expired or revoked'; end if;
  select * into d from public.pv__doc(l.doc_kind, l.doc_id);
  if not found then raise exception 'Voucher not found'; end if;
  if d.status not in ('draft', 'shared', 'pending') then raise exception 'Already approved — locked'; end if;
  if nm = '' then raise exception 'Name required'; end if;
  pre := d.tenant_id::text || '/pv-sign/' || h || '/';
  if p_path is null or left(p_path, length(pre)) <> pre or p_path !~* '\.png$' then raise exception 'Invalid signature file'; end if;
  if p_attach_path is not null and left(p_attach_path, length(pre)) <> pre then raise exception 'Invalid attachment'; end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'doc-files' and o.name = p_path) then raise exception 'Signature file not uploaded'; end if;
  if p_attach_path is not null and not exists (select 1 from storage.objects o where o.bucket_id = 'doc-files' and o.name = p_attach_path) then raise exception 'Attachment not uploaded'; end if;
  begin
    insert into public.pv_signatures (tenant_id, doc_kind, doc_id, role, signer_name, storage_path, attachment_path, signed_via, link_id)
    values (d.tenant_id, l.doc_kind, l.doc_id, l.role, nm, p_path, p_attach_path, 'link', l.id);
  exception when unique_violation then raise exception 'This slot is already signed';
  end;
  perform set_config('mcore.pv_rpc', '1', true);
  if l.doc_kind = 'pvd' then
    update public.payment_voucher_batches set
      prepared_by = case when l.role = 'prepared' then nm else prepared_by end,
      checked_by = case when l.role = 'checked' then nm else checked_by end,
      first_approved_by = case when l.role = 'first' then nm else first_approved_by end,
      approved_by = case when l.role = 'second' then nm else approved_by end
    where id = l.doc_id;
  else
    update public.payment_vouchers set
      prepared_by = case when l.role = 'prepared' then nm else prepared_by end,
      checked_by = case when l.role = 'checked' then nm else checked_by end,
      approved_by = case when l.role in ('first', 'second') then nm else approved_by end
    where id = l.doc_id;
  end if;
  update public.pv_sign_links set revoked_at = now() where id = l.id;
  return public.pv__after_sign(l.doc_kind, l.doc_id, l.role, nm, 'link', null);
end;
$$;

-- approvers: reset while signing is in progress -> back to draft (the triggers below void all signatures + revoke links)
create or replace function public.pv_sign_reset(p_kind text, p_doc uuid, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me public.user_profiles%rowtype;
  d record;
  n int;
  rsn text := coalesce(nullif(left(btrim(coalesce(p_reason, '')), 500), ''), 'reset');
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if p_kind is null or p_kind not in ('pvd', 'pv') then raise exception 'Invalid document'; end if;
  select * into me from public.user_profiles where id = auth.uid();
  select * into d from public.pv__doc(p_kind, p_doc);
  if not found or d.tenant_id is distinct from public.get_my_tenant_id() then raise exception 'Voucher not found'; end if;
  if lower(coalesce(me.role, '')) not in ('owner', 'admin', 'platform_admin', 'finance', 'accountant', 'manager') then raise exception 'Only approvers can reset signatures'; end if;
  if public.pv__view_only(d.tenant_id) then raise exception 'View-only support session'; end if;
  if d.status not in ('draft', 'shared', 'pending', 'approved') then raise exception 'Paid or converted vouchers cannot be reset'; end if;
  if p_kind = 'pvd' and exists (select 1 from public.payment_voucher_batch_lines x join public.payment_vouchers v on v.id = x.voucher_id
      where x.batch_id = p_doc and v.deleted_at is null and v.status = 'paid') then
    raise exception 'A line is already paid — void that payment first'; end if;
  select count(*) into n from public.pv_signatures where doc_kind = p_kind and doc_id = p_doc and voided_at is null;
  perform set_config('mcore.pv_rpc', '1', true);
  if p_kind = 'pvd' then
    -- approved batch: unpaid auto-created single PVs are voided and unlinked so a re-sign makes fresh ones
    update public.payment_vouchers v set status = 'void', updated_at = now()
      from public.payment_voucher_batch_lines x where x.batch_id = p_doc and x.voucher_id = v.id and v.status in ('draft', 'shared', 'pending', 'approved');
    update public.payment_voucher_batch_lines set voucher_id = null, pay_status = 'unpaid', paid_date = null, updated_at = now() where batch_id = p_doc;
    update public.payment_voucher_batches set status = 'draft', reset_reason = rsn, approved_at = null, pvs_created_at = null, updated_at = now() where id = p_doc;
  else
    update public.payment_vouchers set status = 'draft', approved_at = null, updated_at = now() where id = p_doc;
  end if;
  update public.pv_signatures set voided_at = now(), void_reason = rsn where doc_kind = p_kind and doc_id = p_doc and voided_at is null;
  update public.pv_sign_links set revoked_at = now() where doc_kind = p_kind and doc_id = p_doc and revoked_at is null;
  return jsonb_build_object('voided', n, 'id', p_doc, 'status', 'draft');
end;
$$;

-- Approved Salary Disbursement -> new PVD draft (employees as payees, net pay, category salary). One PVD per SD batch.
create or replace function public.pv_import_sd(p_sd_batch uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s public.salary_disbursement_batches%rowtype;
  me public.user_profiles%rowtype;
  bid uuid;
  n int;
  tot numeric;
  mon text;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select * into me from public.user_profiles where id = auth.uid();
  select * into s from public.salary_disbursement_batches where id = p_sd_batch and deleted_at is null;
  if not found or s.tenant_id is distinct from public.get_my_tenant_id() then raise exception 'Salary disbursement not found'; end if;
  if not public.pv__can('vouchers') then raise exception 'No access to Payment Vouchers'; end if;
  if public.pv__view_only(s.tenant_id) then raise exception 'View-only support session'; end if;
  if s.status <> 'approved' then raise exception 'Salary disbursement is not approved yet'; end if;
  select id into bid from public.payment_voucher_batches where tenant_id = s.tenant_id and source = 'sd' and source_ref = s.id and deleted_at is null limit 1;
  if bid is not null then return jsonb_build_object('id', bid, 'existing', true); end if;
  mon := (array['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'])[s.month] || ' ' || s.year;
  insert into public.payment_voucher_batches (tenant_id, ref_no, batch_date, title, status, prepared_by, created_by, source, source_ref, created_at, updated_at)
  values (s.tenant_id, public.pv__next_ref(s.tenant_id, 'PVD'), current_date, 'Salary ' || mon, 'draft', me.full_name, auth.uid(), 'sd', s.id, now(), now())
  returning id into bid;
  insert into public.payment_voucher_batch_lines (tenant_id, batch_id, sort_order, payee_name, amount, payment_method, bank_name, bank_account_no,
    description, payee_type, payee_id, phone, category, source, source_ref)
  select s.tenant_id, bid, row_number() over (order by e.name), e.name, pr.net_pay, 'Bank Transfer', e.bank_name, e.bank_account_no,
    'Salary ' || mon, 'employee', e.id, e.phone, 'salary', 'sd', pr.id
  from public.payroll_records pr join public.employees e on e.id = pr.employee_id
  where pr.tenant_id = s.tenant_id and pr.month = s.month and pr.year = s.year and coalesce(pr.net_pay, 0) > 0;
  get diagnostics n = row_count;
  select coalesce(sum(amount), 0) into tot from public.payment_voucher_batch_lines where batch_id = bid;
  update public.payment_voucher_batches set total_amount = tot, line_count = n where id = bid;
  return jsonb_build_object('id', bid, 'existing', false, 'lines', n);
end;
$$;

-- reminder: shared / pending vouchers older than reminder_hours (default 24h) -> one bell + push per window, no amounts.
-- Logged-in user: own tenant only (the app calls this on open). Cron (no auth.uid): every tenant. Returns docs reminded.
create or replace function public.pv_remind_pending()
returns int language plpgsql security definer set search_path = public as $$
declare
  r record;
  tid uuid := case when auth.uid() is null then null else public.get_my_tenant_id() end;
  k int := 0;
  miss text;
begin
  if auth.uid() is not null and tid is null then return 0; end if;
  perform set_config('mcore.pv_rpc', '1', true);
  for r in
    select 'pvd'::text kind, b.id, b.tenant_id, b.ref_no, b.created_by, coalesce(b.total_amount, 0) amt
    from public.payment_voucher_batches b left join public.pv_settings st on st.tenant_id = b.tenant_id
    where b.deleted_at is null and b.status in ('shared', 'pending') and (tid is null or b.tenant_id = tid)
      and coalesce(b.last_reminded_at, b.shared_at, b.updated_at, b.created_at) < now() - make_interval(hours => coalesce(st.reminder_hours, 24))
    union all
    select 'pv', v.id, v.tenant_id, v.ref_no, v.created_by, coalesce(v.amount, 0)
    from public.payment_vouchers v left join public.pv_settings st on st.tenant_id = v.tenant_id
    where v.deleted_at is null and v.status in ('shared', 'pending') and (tid is null or v.tenant_id = tid)
      and coalesce(v.last_reminded_at, v.updated_at, v.created_at) < now() - make_interval(hours => coalesce(st.reminder_hours, 24))
  loop
    select string_agg(public.pv__role_label(x.role, false), ', ' order by x.ord) into miss
    from unnest(public.pv__required_roles(r.tenant_id, r.amt)) with ordinality x(role, ord)
    where not exists (select 1 from public.pv_signatures s where s.doc_kind = r.kind and s.doc_id = r.id and s.role = x.role and s.voided_at is null);
    perform public.pv__notify(r.tenant_id, null, r.created_by,
      'Signature reminder · ' || coalesce(r.ref_no, ''), 'Peringatan tandatangan · ' || coalesce(r.ref_no, ''),
      'Still waiting: ' || coalesce(miss, '-') || '. Tap to sign or resend the WhatsApp link.',
      'Masih menunggu: ' || coalesce(miss, '-') || '. Ketik untuk tandatangan atau hantar semula pautan WhatsApp.',
      'approval.pv_remind', 1,
      jsonb_build_object('page', 'vouchers', 'params', jsonb_build_object('view', case when r.kind = 'pvd' then 'pvd-detail' else 'pv-detail' end, 'id', r.id), 'icon', 'ti-bell-ringing'),
      case when r.kind = 'pvd' then 'payment_voucher_batches' else 'payment_vouchers' end, r.id);
    if r.kind = 'pvd' then update public.payment_voucher_batches set last_reminded_at = now() where id = r.id;
    else update public.payment_vouchers set last_reminded_at = now() where id = r.id; end if;
    k := k + 1;
  end loop;
  return k;
end;
$$;

-- ---------- 7) triggers: back to draft voids signatures; 'approved' only via signatures or approver roles ----------
create or replace function public.pv__void_on_draft()
returns trigger language plpgsql security definer set search_path = public as $$
declare k text := case when tg_table_name = 'payment_voucher_batches' then 'pvd' else 'pv' end;
begin
  update public.pv_signatures set voided_at = now(), void_reason = 'returned to draft' where doc_kind = k and doc_id = new.id and voided_at is null;
  update public.pv_sign_links set revoked_at = now() where doc_kind = k and doc_id = new.id and revoked_at is null;
  return new;
end;
$$;
drop trigger if exists pvd_batches_void_sigs_trg on public.payment_voucher_batches;
create trigger pvd_batches_void_sigs_trg after update of status on public.payment_voucher_batches
  for each row when (new.status = 'draft' and old.status is distinct from 'draft') execute function public.pv__void_on_draft();
drop trigger if exists pv_vouchers_void_sigs_trg on public.payment_vouchers;
create trigger pv_vouchers_void_sigs_trg after update of status on public.payment_vouchers
  for each row when (new.status = 'draft' and old.status is distinct from 'draft') execute function public.pv__void_on_draft();

create or replace function public.pv__approve_gate()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or coalesce(current_setting('mcore.pv_rpc', true), '') = '1' then return new; end if;
  if exists (select 1 from public.user_profiles p where p.id = auth.uid() and lower(coalesce(p.role, '')) in ('owner', 'admin', 'platform_admin', 'finance', 'accountant', 'manager')) then return new; end if;
  raise exception 'Only owner / admin / finance / manager can approve a payment voucher directly — collect the signatures instead';
end;
$$;
drop trigger if exists pv_vouchers_approve_gate_trg on public.payment_vouchers;
create trigger pv_vouchers_approve_gate_trg before update of status on public.payment_vouchers
  for each row when (new.status = 'approved' and old.status is distinct from 'approved') execute function public.pv__approve_gate();
drop trigger if exists pvd_batches_approve_gate_trg on public.payment_voucher_batches;
create trigger pvd_batches_approve_gate_trg before update of status on public.payment_voucher_batches
  for each row when (new.status = 'approved' and old.status is distinct from 'approved') execute function public.pv__approve_gate();

-- ---------- 8) storage (bucket doc-files, private; staff read via existing doc_files_read) ----------
drop policy if exists doc_files_pvsig_app_ins on storage.objects;
create policy doc_files_pvsig_app_ins on storage.objects for insert to authenticated with check (
  bucket_id = 'doc-files'
  and (storage.foldername(name))[1] = (select public.get_my_tenant_id()::text)
  and (storage.foldername(name))[2] in ('pv-signatures', 'pv-receipts'));
drop policy if exists doc_files_pvsig_pub_ins on storage.objects;
create policy doc_files_pvsig_pub_ins on storage.objects for insert to anon, authenticated with check (
  bucket_id = 'doc-files'
  and (storage.foldername(name))[2] = 'pv-sign'
  and public.pv_sign_path_ok((storage.foldername(name))[1], (storage.foldername(name))[3]));
drop policy if exists doc_files_pv_read on storage.objects;
create policy doc_files_pv_read on storage.objects for select to authenticated using (
  bucket_id = 'doc-files'
  and (storage.foldername(name))[1] = (select public.get_my_tenant_id()::text)
  and (storage.foldername(name))[2] in ('pv-signatures', 'pv-sign', 'pv-receipts'));

-- ---------- 9) widen existing checks (keeps whatever values are already allowed; never adds a check that was not there) ----------
-- doc_shares (WhatsApp share log): doc_type + pvd / pv, template + pv_sign / pv_remind.
-- payment_vouchers payee_type (only if such a check exists): + supplier / employee / other.
do $$
declare
  r record; c record; vals text[];
begin
  for r in
    select * from (values
      ('public.doc_shares', 'doc_type', array['pvd', 'pv']),
      ('public.doc_shares', 'template', array['pv_sign', 'pv_remind']),
      ('public.payment_vouchers', 'payee_type', array['supplier', 'employee', 'other'])
    ) as t(tbl, colname, add_vals)
  loop
    if to_regclass(r.tbl) is null then continue; end if;
    for c in
      select pg_get_constraintdef(k.oid) as def, k.conname from pg_constraint k
      where k.conrelid = r.tbl::regclass and k.contype = 'c'
        and pg_get_constraintdef(k.oid) ~ ('\m' || r.colname || '\M')
        and pg_get_constraintdef(k.oid) !~* 'length'
    loop
      select array_agg(distinct m[1]) into vals from regexp_matches(c.def, '''([^'']+)''', 'g') m;
      if vals is null then continue; end if;
      if (select bool_and(x = any(vals)) from unnest(r.add_vals) x) then continue; end if;
      vals := (select array_agg(distinct x) from unnest(vals || r.add_vals) x);
      execute format('alter table %s drop constraint %I', r.tbl, c.conname);
      execute format('alter table %s add constraint %I check (%I is null or %I in (%s)) not valid', r.tbl, c.conname, r.colname, r.colname,
        (select string_agg(quote_literal(x), ', ' order by x) from unnest(vals) x));
    end loop;
  end loop;
end $$;

-- ---------- 10) grants ----------
revoke all on function public.pv__role_label(text, boolean) from public, anon, authenticated;
revoke all on function public.pv__required_roles(uuid, numeric) from public, anon, authenticated;
revoke all on function public.pv__doc(text, uuid) from public, anon, authenticated;
revoke all on function public.pv__slots(text, uuid) from public, anon, authenticated;
revoke all on function public.pv__next_ref(uuid, text) from public, anon, authenticated;
revoke all on function public.pv__notify(uuid, uuid, uuid, text, text, text, text, text, int, jsonb, text, uuid) from public, anon, authenticated;
revoke all on function public.pv__create_pvs(uuid) from public, anon, authenticated;
revoke all on function public.pv__after_sign(text, uuid, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.pv__view_only(uuid) from public, anon, authenticated;
revoke all on function public.pv__void_on_draft() from public, anon, authenticated;
revoke all on function public.pv__approve_gate() from public, anon, authenticated;
revoke all on function public.pv_sign_path_ok(text, text) from public;
revoke all on function public.pv_sign_app(text, uuid, text, text, text) from public, anon;
revoke all on function public.pv_sign_link_create(text, uuid, text) from public, anon;
revoke all on function public.pv_sign_reset(text, uuid, text) from public, anon;
revoke all on function public.pv_import_sd(uuid) from public, anon;
revoke all on function public.pv_remind_pending() from public, anon;
revoke all on function public.get_public_pv_sign(text) from public;
revoke all on function public.pv_sign_public(text, text, text, text) from public;
grant execute on function public.pv_sign_path_ok(text, text) to anon, authenticated;
grant execute on function public.pv_sign_app(text, uuid, text, text, text) to authenticated;
grant execute on function public.pv_sign_link_create(text, uuid, text) to authenticated;
grant execute on function public.pv_sign_reset(text, uuid, text) to authenticated;
grant execute on function public.pv_import_sd(uuid) to authenticated;
grant execute on function public.pv_remind_pending() to authenticated;
grant execute on function public.get_public_pv_sign(text) to anon, authenticated;
grant execute on function public.pv_sign_public(text, text, text, text) to anon, authenticated;

-- ---------- 11) roadmap (completed) ----------
do $$
declare
  r record;
  pr text := 'https://github.com/mpflemedia-ux/mcore/compare/62e18977388b8a017c3f369349b5af0ea1f77b67...pv-revamp';
begin
  for r in select * from (values
    ('PV revamp: card view PVD + PV detail', 'PV Disbursement and single PV detail use payroll-style cards at every width (payee, bank · account no, amount, chips, accordion), sticky Total + Save footer, inline edit while draft (replaces the 900px table form), locked once shared/approved. No more clipped 720px preview on phones.'),
    ('PV revamp: payee picker (Suppliers / Employees)', 'Line payee picker searches Suppliers and Employees and fills bank, account no and phone; free-text payee still allowed. New line columns bank_account_no, payee_type, payee_id, phone, category.'),
    ('PV revamp: 4 signatures + WhatsApp sign link', 'Prepared / Checked / First / Second Approval drawn signatures (pv_signatures, pv_sign_links hash only, RPCs pv_sign_app, pv_sign_link_create, get_public_pv_sign, pv_sign_public, pv_sign_reset). Any order, in the app or via public-pv.html link. All required signed -> auto-approved; PVD auto-creates approved single PVs carrying the signatures. Back to draft voids signatures and revokes links. Bell + push per signature, no amounts.'),
    ('PV revamp: approval threshold', 'pv_settings per tenant: below RM5,000 needs 3 signatures (Prepared, Checked, First), RM5,000 and above needs 4. Threshold and low count configurable in the PV settings sheet.'),
    ('PV revamp: A4 print + PDF with signatures', 'Light A4 print layout and pdf-lib PDF (signature images embedded) for PVD and single PV, shared via WhatsApp (WAD) with the sign link.'),
    ('PV revamp: per-line payment status + receipt', 'Each PVD line: unpaid / paid / failed with paid date and reference, bank slip / receipt upload to doc-files/{tenant}/pv-receipts. Paid goes through the single PV mark-paid so money posts once.'),
    ('PV revamp: bank bulk payment CSV', 'Export Public Bank and RHB bulk payment CSV from a PVD (assumed column layout, configurable per tenant in pv_settings.bank_formats). Missing account numbers are flagged before download.'),
    ('PV revamp: import from Salary Disbursement', 'pv_import_sd: approved Salary Disbursement month -> new PVD draft (employees as payees, net pay, category salary, bank + account from employee). One PVD per SD month.'),
    ('PV revamp: duplicate payee warning', 'Warns when the same payee and amount appear in another PVD or PV in the same month, before save.'),
    ('PV revamp: 24h signature reminder', 'pv_remind_pending: shared / pending vouchers older than 24h (configurable) get one bell + push reminder per window, listing the missing signatures. Runs on app open (own tenant) and optionally hourly via pg_cron (pv_revamp_02_cron.sql).'),
    ('PV revamp: category + GL on mark paid', 'Category per line (Supplier, Salary, Commission, KWSP/SOCSO, Utility, Other) with optional GL account. Mark paid: supplier bill Dr AP; salary / payroll commission no second journal (payroll journal already credits Cash); KWSP/SOCSO Dr the payable; others Dr the mapped expense. No double expense.'),
    ('PV revamp: duplicate batch + method summary chips', 'Duplicate copies a PVD as a new draft; summary chips by payment method with totals at the top of the batch.'),
    ('PV revamp: fixes', 'PV notifications no longer read user_profiles.email (roles + created_by), no amounts in push; convert keeps first_approved_by and only marks converted when every line converted; bank account no saved to the right PV (not the latest); Approve gated to owner / admin / finance (UI + DB trigger); PVD RLS needs has_module(vouchers); EN + BM strings.')
  ) as t(title, descr) loop
    begin
      if exists (select 1 from public.dev_roadmap_items where title = r.title) then
        update public.dev_roadmap_items set stage = 'completed', module = 'vouchers', description = r.descr, pr_url = pr where title = r.title;
      else
        insert into public.dev_roadmap_items (title, description, module, stage, pr_url) values (r.title, r.descr, 'vouchers', 'completed', pr);
      end if;
    exception when undefined_column or undefined_table then
      raise notice 'dev_roadmap schema variant; skip: %', sqlerrm;
    end;
  end loop;
end $$;

notify pgrst, 'reload schema';
