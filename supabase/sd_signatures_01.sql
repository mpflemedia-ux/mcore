-- M-Core Salary Disbursement — 4 signatures (Prepared By / Checked By / First Approval / Second Approval).
-- WRITE-ONLY: Mike runs this in Supabase SQL Editor. Run AFTER sd_approval_01.sql, sd_approval_02.sql, sd_public_fit_send_01.sql. Rerun-safe.
--   1) salary_disbursement_batches: 4 signer-name columns (replace localStorage; app keeps localStorage only as fallback/seed).
--   2) sd_signatures: one ACTIVE signature per batch + role (draw-signature PNG in doc-files), voided on reject / unlock / reset.
--   3) sd_sign_links: one WhatsApp link per role; only the SHA-256 of the token is stored.
--   4) RPCs (SECURITY DEFINER): sd_sign_app (in-app), sd_sign_link_create, get_public_sd_sign, sd_sign_public (link), sd_sign_reset.
--      4/4 signed -> batch auto-approved (locked). Each signature -> bell + phone push (notifications -> push-send webhook), no amounts.
--   5) Trigger: batch back to 'draft' (reject / unlock / reset) -> void all signatures + revoke role links.
--   6) Storage: doc-files/{tenant}/sd-signatures/{batch}/... (staff) and doc-files/{tenant}/sd-sign/{token_hash}/... (link signer).
--   7) get_public_salary_batch: bank_name / bank_account_no removed from the public response.
reset role;
select 1 / (case when to_regclass('public.salary_disbursement_batches') is null then 0 else 1 end) as sd_approval_01_present;

-- ---------- 1) signer names on the batch ----------
alter table public.salary_disbursement_batches
  add column if not exists prepared_by_name text,
  add column if not exists checked_by_name text,
  add column if not exists first_approval_name text,
  add column if not exists second_approval_name text;
alter table public.salary_disbursement_batches drop constraint if exists sd_batches_signer_names_len;
alter table public.salary_disbursement_batches add constraint sd_batches_signer_names_len check (
  coalesce(length(prepared_by_name), 0) <= 120 and coalesce(length(checked_by_name), 0) <= 120
  and coalesce(length(first_approval_name), 0) <= 120 and coalesce(length(second_approval_name), 0) <= 120);

-- ---------- 2) role links (hash only) ----------
create table if not exists public.sd_sign_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  batch_id uuid not null references public.salary_disbursement_batches(id) on delete cascade,
  role text not null check (role in ('prepared', 'checked', 'first', 'second')),
  token_hash text not null unique check (length(token_hash) = 64),
  expires_at timestamptz not null default now() + interval '30 days',
  revoked_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists sd_sign_links_batch_idx on public.sd_sign_links (tenant_id, batch_id, role);
alter table public.sd_sign_links enable row level security;
revoke all on public.sd_sign_links from anon;
drop policy if exists sd_sign_links_read on public.sd_sign_links;
create policy sd_sign_links_read on public.sd_sign_links for select to authenticated using (
  tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid()));
grant select on public.sd_sign_links to authenticated;

-- ---------- 3) signatures ----------
create table if not exists public.sd_signatures (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  batch_id uuid not null references public.salary_disbursement_batches(id) on delete cascade,
  role text not null check (role in ('prepared', 'checked', 'first', 'second')),
  signer_name text not null check (length(btrim(signer_name)) between 1 and 120),
  signer_user_id uuid,
  storage_path text not null check (length(storage_path) between 10 and 400),
  attachment_path text check (attachment_path is null or length(attachment_path) <= 400),
  signed_via text not null check (signed_via in ('app', 'link')),
  link_id uuid references public.sd_sign_links(id) on delete set null,
  signed_at timestamptz not null default now(),
  voided_at timestamptz,
  void_reason text check (void_reason is null or length(void_reason) <= 500),
  created_at timestamptz not null default now()
);
create unique index if not exists sd_signatures_active_uq on public.sd_signatures (batch_id, role) where voided_at is null;
create index if not exists sd_signatures_tenant_idx on public.sd_signatures (tenant_id, batch_id);
alter table public.sd_signatures enable row level security;
revoke all on public.sd_signatures from anon;
drop policy if exists sd_signatures_read on public.sd_signatures;
create policy sd_signatures_read on public.sd_signatures for select to authenticated using (
  tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid())
  or exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin'));
-- no insert / update / delete grants: every write goes through the RPCs below
grant select on public.sd_signatures to authenticated;

-- ---------- 4) helpers (not callable by clients) ----------
create or replace function public.sd__role_label(p_role text, p_bm boolean)
returns text language sql immutable set search_path = public as $$
  select case p_role
    when 'prepared' then case when p_bm then 'Disediakan Oleh' else 'Prepared By' end
    when 'checked' then case when p_bm then 'Disemak Oleh' else 'Checked By' end
    when 'first' then case when p_bm then 'Kelulusan Pertama' else 'First Approval' end
    else case when p_bm then 'Kelulusan Kedua' else 'Second Approval' end end
$$;

create or replace function public.sd__public_rows(p_tenant uuid, p_month int, p_year int)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'name', e.name,
    'position', e.position,
    'basic_salary', pr.basic_salary,
    'allowance_total', coalesce(pr.allowance_1,0) + coalesce(pr.allowance_2,0) + coalesce(pr.allowance_3,0),
    'epf_employee', pr.epf_employee,
    'socso_employee', pr.socso_employee,
    'eis_employee', pr.eis_employee,
    'pcb', pr.pcb,
    'deduction_total', coalesce(pr.deduction_1,0) + coalesce(pr.deduction_2,0) + coalesce(pr.advance,0),
    'ot_amount', coalesce(pr.ot_amount,0),
    'net_pay', pr.net_pay
  ) order by e.name), '[]'::jsonb)
  from public.payroll_records pr
  join public.employees e on e.id = pr.employee_id
  where pr.tenant_id = p_tenant and pr.month = p_month and pr.year = p_year
$$;

create or replace function public.sd__slots(p_batch uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'role', r.role,
    'name', case r.role when 'prepared' then b.prepared_by_name when 'checked' then b.checked_by_name
      when 'first' then b.first_approval_name else b.second_approval_name end,
    'signed', s.id is not null,
    'signer_name', s.signer_name,
    'signed_at', s.signed_at,
    'signed_via', s.signed_via
  ) order by r.ord), '[]'::jsonb)
  from (values ('prepared', 1), ('checked', 2), ('first', 3), ('second', 4)) r(role, ord)
  join public.salary_disbursement_batches b on b.id = p_batch
  left join public.sd_signatures s on s.batch_id = p_batch and s.role = r.role and s.voided_at is null
$$;

-- after each signature: status (draft -> shared lock; 4/4 -> approved) + bell/push to preparer + HR managers, actor excluded
create or replace function public.sd__after_sign(p_batch uuid, p_role text, p_signer text, p_via text, p_actor uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  b public.salary_disbursement_batches%rowtype;
  n int;
  ok boolean := false;
  en_m text; bm_m text;
begin
  select * into b from public.salary_disbursement_batches where id = p_batch for update;
  select count(*) into n from public.sd_signatures where batch_id = p_batch and voided_at is null;
  if n >= 4 then
    update public.salary_disbursement_batches set status = 'approved', reviewed_at = now(), reviewed_by = coalesce(p_actor, reviewed_by),
      shared_at = coalesce(shared_at, now()), reject_reason = null
    where id = p_batch and status <> 'approved';
    ok := true;
  elsif b.status in ('draft', 'rejected') then
    update public.salary_disbursement_batches set status = 'shared', shared_at = coalesce(shared_at, now()), reject_reason = null where id = p_batch;
  end if;
  en_m := (array['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'])[b.month] || ' ' || b.year;
  bm_m := (array['Jan','Feb','Mac','Apr','Mei','Jun','Jul','Ogos','Sep','Okt','Nov','Dis'])[b.month] || ' ' || b.year;
  begin
    insert into public.notifications (tenant_id, user_id, actor_id, title, body, category, kind, type, priority, link, ref_table, ref_id)
    select b.tenant_id, u.id, p_actor,
      case when ok then (case when u.language = 'bm' then 'Penyaluran gaji diluluskan (4/4) · ' || bm_m else 'SD approved (4/4) · ' || en_m end)
        else (case when u.language = 'bm' then public.sd__role_label(p_role, true) || ' ditandatangani (' || n || '/4) · ' || bm_m
          else public.sd__role_label(p_role, false) || ' signed (' || n || '/4) · ' || en_m end) end,
      case when u.language = 'bm' then 'Penyaluran gaji · ' || left(p_signer, 80) || ' tandatangan ' || (case when p_via = 'link' then 'melalui pautan WhatsApp' else 'dalam aplikasi' end)
          || (case when ok then '. Semua 4 tandatangan lengkap — bulan ini dikunci.' else '.' end)
        else 'Salary disbursement · ' || left(p_signer, 80) || ' signed ' || (case when p_via = 'link' then 'via WhatsApp link' else 'in the app' end)
          || (case when ok then '. All 4 signatures done — this month is locked.' else '.' end) end,
      'approval', 'for_you', 'approval.payroll', case when ok then 1 else 0 end,
      jsonb_build_object('page', 'hr', 'params', jsonb_build_object('view', 'salary-disbursement', 'month', b.month, 'year', b.year),
        'icon', case when ok then 'ti-circle-check' else 'ti-signature' end),
      'salary_disbursement_batches', b.id::text
    from public.user_profiles u
    where u.tenant_id = b.tenant_id and coalesce(u.is_active, true)
      and (lower(coalesce(u.role, '')) in ('owner', 'admin', 'hr', 'manager') or u.id = b.created_by)
      and (p_actor is null or u.id <> p_actor);
  exception when others then
    raise warning 'sd__after_sign notify skipped: %', sqlerrm;  -- a notification problem never blocks the signature
  end;
  return jsonb_build_object('signed', n, 'approved', ok, 'slots', public.sd__slots(p_batch));
end;
$$;

-- storage policy helper: is {tenant}/sd-sign/{hash}/ a live role link of that tenant?
create or replace function public.sd_sign_path_ok(p_tenant text, p_hash text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.sd_sign_links l join public.salary_disbursement_batches b on b.id = l.batch_id
    where l.tenant_id::text = p_tenant and l.token_hash = p_hash and l.revoked_at is null and l.expires_at > now()
      and b.deleted_at is null and b.status <> 'approved')
$$;

-- ---------- 5) RPCs ----------
-- staff, in the app (logged in): sign one slot with a PNG already uploaded to {tenant}/sd-signatures/{batch}/
create or replace function public.sd_sign_app(p_batch uuid, p_role text, p_name text, p_path text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me public.user_profiles%rowtype;
  b public.salary_disbursement_batches%rowtype;
  nm text := left(btrim(coalesce(p_name, '')), 120);
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select * into me from public.user_profiles where id = auth.uid();
  select * into b from public.salary_disbursement_batches where id = p_batch and deleted_at is null;
  if not found or me.tenant_id is distinct from b.tenant_id then raise exception 'Batch not found'; end if;
  if exists (select 1 from public.platform_support_sessions s where s.actor_id = auth.uid() and s.ended_at is null and s.view_only and s.deleted_at is null and s.tenant_id = b.tenant_id) then
    raise exception 'View-only support session'; end if;
  if p_role is null or p_role not in ('prepared', 'checked', 'first', 'second') then raise exception 'Invalid role'; end if;
  if b.status = 'approved' then raise exception 'Already approved — locked'; end if;
  if nm = '' then raise exception 'Name required'; end if;
  if p_path is null or left(p_path, length(b.tenant_id::text || '/sd-signatures/' || b.id::text || '/')) <> b.tenant_id::text || '/sd-signatures/' || b.id::text || '/' or p_path !~* '\.png$' then
    raise exception 'Invalid signature file'; end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'doc-files' and o.name = p_path) then raise exception 'Signature file not uploaded'; end if;
  begin
    insert into public.sd_signatures (tenant_id, batch_id, role, signer_name, signer_user_id, storage_path, signed_via)
    values (b.tenant_id, b.id, p_role, nm, auth.uid(), p_path, 'app');
  exception when unique_violation then raise exception 'This slot is already signed';
  end;
  update public.salary_disbursement_batches set
    prepared_by_name = case when p_role = 'prepared' then nm else prepared_by_name end,
    checked_by_name = case when p_role = 'checked' then nm else checked_by_name end,
    first_approval_name = case when p_role = 'first' then nm else first_approval_name end,
    second_approval_name = case when p_role = 'second' then nm else second_approval_name end
  where id = b.id;
  return public.sd__after_sign(b.id, p_role, nm, 'app', auth.uid());
end;
$$;

-- HR: new WhatsApp link for one role (raw token returned once; only its SHA-256 is stored)
create or replace function public.sd_sign_link_create(p_batch uuid, p_role text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me public.user_profiles%rowtype;
  b public.salary_disbursement_batches%rowtype;
  tok text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  l public.sd_sign_links%rowtype;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select * into me from public.user_profiles where id = auth.uid();
  select * into b from public.salary_disbursement_batches where id = p_batch and deleted_at is null;
  if not found or me.tenant_id is distinct from b.tenant_id then raise exception 'Batch not found'; end if;
  if lower(coalesce(me.role, '')) not in ('owner', 'admin', 'platform_admin', 'manager', 'hr') then raise exception 'Only HR managers can share signing links'; end if;
  if exists (select 1 from public.platform_support_sessions s where s.actor_id = auth.uid() and s.ended_at is null and s.view_only and s.deleted_at is null and s.tenant_id = b.tenant_id) then
    raise exception 'View-only support session'; end if;
  if p_role is null or p_role not in ('prepared', 'checked', 'first', 'second') then raise exception 'Invalid role'; end if;
  if b.status = 'approved' then raise exception 'Already approved — locked'; end if;
  if exists (select 1 from public.sd_signatures s where s.batch_id = b.id and s.role = p_role and s.voided_at is null) then raise exception 'This slot is already signed'; end if;
  insert into public.sd_sign_links (tenant_id, batch_id, role, token_hash, created_by)
  values (b.tenant_id, b.id, p_role, encode(sha256(convert_to(tok, 'UTF8')), 'hex'), auth.uid())
  returning * into l;
  return jsonb_build_object('token', tok, 'link_id', l.id, 'expires_at', l.expires_at, 'role', p_role);
end;
$$;

-- public page (no login): batch view for one role link + status of all 4 slots. No bank details.
create or replace function public.get_public_sd_sign(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  l public.sd_sign_links%rowtype;
  b public.salary_disbursement_batches%rowtype;
  tn public.tenants%rowtype;
  cp jsonb;
begin
  if p_token is null or length(btrim(p_token)) < 32 then raise exception 'Invalid token'; end if;
  select * into l from public.sd_sign_links where token_hash = encode(sha256(convert_to(btrim(p_token), 'UTF8')), 'hex');
  if not found or l.revoked_at is not null or l.expires_at <= now() then raise exception 'Link expired or revoked'; end if;
  select * into b from public.salary_disbursement_batches where id = l.batch_id and deleted_at is null;
  if not found then raise exception 'Batch not found'; end if;
  select * into tn from public.tenants where id = b.tenant_id;
  cp := coalesce(tn.config->'company_profile', '{}'::jsonb);
  return jsonb_build_object(
    'mode', 'sign',
    'batch_id', b.id, 'tenant_id', b.tenant_id, 'link_id', l.id, 'role', l.role, 'expires_at', l.expires_at,
    'status', b.status, 'month', b.month, 'year', b.year,
    'tenant_name', coalesce(nullif(tn.name, ''), cp->>'name'),
    'logo_url', coalesce(nullif(tn.logo_url, ''), cp->>'logo_url'),
    'address', coalesce(nullif(tn.address, ''), cp->>'address'),
    'rows', public.sd__public_rows(b.tenant_id, b.month, b.year),
    'grand_total_net_pay', b.total_net_pay,
    'slots', public.sd__slots(b.id));
end;
$$;

-- public page: sign this link's slot with a PNG already uploaded to {tenant}/sd-sign/{token_hash}/ (+ optional photo/PDF there)
create or replace function public.sd_sign_public(p_token text, p_name text, p_path text, p_attach_path text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  h text;
  l public.sd_sign_links%rowtype;
  b public.salary_disbursement_batches%rowtype;
  nm text := left(btrim(coalesce(p_name, '')), 120);
  pre text;
begin
  if p_token is null or length(btrim(p_token)) < 32 then raise exception 'Invalid token'; end if;
  h := encode(sha256(convert_to(btrim(p_token), 'UTF8')), 'hex');
  select * into l from public.sd_sign_links where token_hash = h for update;
  if not found or l.revoked_at is not null or l.expires_at <= now() then raise exception 'Link expired or revoked'; end if;
  select * into b from public.salary_disbursement_batches where id = l.batch_id and deleted_at is null;
  if not found then raise exception 'Batch not found'; end if;
  if b.status = 'approved' then raise exception 'Already approved — locked'; end if;
  if nm = '' then raise exception 'Name required'; end if;
  pre := b.tenant_id::text || '/sd-sign/' || h || '/';
  if p_path is null or left(p_path, length(pre)) <> pre or p_path !~* '\.png$' then raise exception 'Invalid signature file'; end if;
  if p_attach_path is not null and left(p_attach_path, length(pre)) <> pre then raise exception 'Invalid attachment'; end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'doc-files' and o.name = p_path) then raise exception 'Signature file not uploaded'; end if;
  if p_attach_path is not null and not exists (select 1 from storage.objects o where o.bucket_id = 'doc-files' and o.name = p_attach_path) then raise exception 'Attachment not uploaded'; end if;
  begin
    insert into public.sd_signatures (tenant_id, batch_id, role, signer_name, storage_path, attachment_path, signed_via, link_id)
    values (b.tenant_id, b.id, l.role, nm, p_path, p_attach_path, 'link', l.id);
  exception when unique_violation then raise exception 'This slot is already signed';
  end;
  update public.salary_disbursement_batches set
    prepared_by_name = case when l.role = 'prepared' then nm else prepared_by_name end,
    checked_by_name = case when l.role = 'checked' then nm else checked_by_name end,
    first_approval_name = case when l.role = 'first' then nm else first_approval_name end,
    second_approval_name = case when l.role = 'second' then nm else second_approval_name end
  where id = b.id;
  return public.sd__after_sign(b.id, l.role, nm, 'link', null);
end;
$$;

-- HR: reject / reset while signing is in progress -> back to Draft (the trigger below voids all signatures + revokes links)
create or replace function public.sd_sign_reset(p_batch uuid, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me public.user_profiles%rowtype;
  b public.salary_disbursement_batches%rowtype;
  n int;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select * into me from public.user_profiles where id = auth.uid();
  select * into b from public.salary_disbursement_batches where id = p_batch and deleted_at is null;
  if not found or me.tenant_id is distinct from b.tenant_id then raise exception 'Batch not found'; end if;
  if lower(coalesce(me.role, '')) not in ('owner', 'admin', 'platform_admin', 'manager', 'hr') then raise exception 'Only HR managers can reset signatures'; end if;
  if exists (select 1 from public.platform_support_sessions s where s.actor_id = auth.uid() and s.ended_at is null and s.view_only and s.deleted_at is null and s.tenant_id = b.tenant_id) then
    raise exception 'View-only support session'; end if;
  select count(*) into n from public.sd_signatures where batch_id = b.id and voided_at is null;
  update public.salary_disbursement_batches set status = 'draft', reject_reason = nullif(left(btrim(coalesce(p_reason, '')), 500), ''),
    reviewed_by = auth.uid(), reviewed_at = now()
  where id = b.id;
  -- already 'draft' (no status change -> trigger does not fire): void here too
  update public.sd_signatures set voided_at = now(), void_reason = coalesce(nullif(left(btrim(coalesce(p_reason, '')), 500), ''), 'reset')
    where batch_id = b.id and voided_at is null;
  update public.sd_sign_links set revoked_at = now() where batch_id = b.id and revoked_at is null;
  return jsonb_build_object('voided', n, 'id', b.id, 'month', b.month, 'year', b.year, 'status', 'draft', 'created_by', b.created_by);
end;
$$;

-- ---------- 6) back to Draft (reject / Unlock / reset) -> void signatures + revoke role links ----------
create or replace function public.sd__batch_void_on_draft()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.sd_signatures set voided_at = now(), void_reason = coalesce(new.reject_reason, case when old.status = 'approved' then 'unlocked' else 'returned to draft' end)
    where batch_id = new.id and voided_at is null;
  update public.sd_sign_links set revoked_at = now() where batch_id = new.id and revoked_at is null;
  return new;
end;
$$;
drop trigger if exists sd_batches_void_sigs_trg on public.salary_disbursement_batches;
create trigger sd_batches_void_sigs_trg after update of status on public.salary_disbursement_batches
  for each row when (new.status = 'draft' and old.status is distinct from 'draft')
  execute function public.sd__batch_void_on_draft();

-- ---------- 7) storage (bucket doc-files, private; staff read via doc_files_read) ----------
drop policy if exists doc_files_sdsig_app_ins on storage.objects;
create policy doc_files_sdsig_app_ins on storage.objects for insert to authenticated with check (
  bucket_id = 'doc-files'
  and (storage.foldername(name))[1] = (select p.tenant_id::text from public.user_profiles p where p.id = auth.uid())
  and (storage.foldername(name))[2] = 'sd-signatures');
drop policy if exists doc_files_sdsig_pub_ins on storage.objects;
create policy doc_files_sdsig_pub_ins on storage.objects for insert to anon, authenticated with check (
  bucket_id = 'doc-files'
  and (storage.foldername(name))[2] = 'sd-sign'
  and public.sd_sign_path_ok((storage.foldername(name))[1], (storage.foldername(name))[3]));

-- ---------- 8) legacy public batch view: same as sd_public_fit_send_01.sql minus bank_name / bank_account_no ----------
create or replace function public.get_public_salary_batch(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  b salary_disbursement_batches%rowtype;
  tn tenants%rowtype;
  cp jsonb;
  link doc_public_links%rowtype;
begin
  if p_token is null or length(trim(p_token)) < 8 then raise exception 'Invalid token'; end if;
  select * into b from salary_disbursement_batches where public_token = trim(p_token) and deleted_at is null limit 1;
  if not found then raise exception 'Batch not found'; end if;
  select * into link from doc_public_links
    where doc_type = 'sd' and doc_id = b.id and token_hash = encode(sha256(convert_to(trim(p_token), 'UTF8')), 'hex') limit 1;
  if not found or link.revoked_at is not null or link.deleted_at is not null or link.expires_at <= now() then
    raise exception 'Link expired or revoked'; end if;
  select * into tn from tenants where id = b.tenant_id;
  cp := coalesce(tn.config->'company_profile', '{}'::jsonb);
  return jsonb_build_object(
    'batch_id', b.id, 'tenant_id', b.tenant_id, 'link_id', link.id, 'status', b.status, 'month', b.month, 'year', b.year,
    'tenant_name', coalesce(nullif(tn.name,''), cp->>'name'),
    'logo_url', coalesce(nullif(tn.logo_url,''), cp->>'logo_url'),
    'address', coalesce(nullif(tn.address,''), cp->>'address'),
    'rows', public.sd__public_rows(b.tenant_id, b.month, b.year),
    'grand_total_net_pay', b.total_net_pay);
end;
$$;

-- ---------- 9) grants ----------
revoke all on function public.sd__role_label(text, boolean) from public, anon, authenticated;
revoke all on function public.sd__public_rows(uuid, int, int) from public, anon, authenticated;
revoke all on function public.sd__slots(uuid) from public, anon, authenticated;
revoke all on function public.sd__after_sign(uuid, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.sd__batch_void_on_draft() from public, anon, authenticated;
revoke all on function public.sd_sign_path_ok(text, text) from public;
revoke all on function public.sd_sign_app(uuid, text, text, text) from public, anon;
revoke all on function public.sd_sign_link_create(uuid, text) from public, anon;
revoke all on function public.sd_sign_reset(uuid, text) from public, anon;
revoke all on function public.get_public_sd_sign(text) from public;
revoke all on function public.sd_sign_public(text, text, text, text) from public;
grant execute on function public.sd_sign_path_ok(text, text) to anon, authenticated;
grant execute on function public.sd_sign_app(uuid, text, text, text) to authenticated;
grant execute on function public.sd_sign_link_create(uuid, text) to authenticated;
grant execute on function public.sd_sign_reset(uuid, text) to authenticated;
grant execute on function public.get_public_sd_sign(text) to anon, authenticated;
grant execute on function public.sd_sign_public(text, text, text, text) to anon, authenticated;
grant execute on function public.get_public_salary_batch(text) to anon, authenticated;

notify pgrst, 'reload schema';

-- check (read-only)
select to_regclass('public.sd_signatures') as sd_signatures, to_regclass('public.sd_sign_links') as sd_sign_links,
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'salary_disbursement_batches'
    and column_name in ('prepared_by_name', 'checked_by_name', 'first_approval_name', 'second_approval_name')) as name_cols_4;
