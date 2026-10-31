-- Payroll Reconciliation v3 — employee reconciliation report + WhatsApp sign link (idempotent;
-- run after 20261101020000_payroll_recon_core.sql). Same token pattern as sd_signatures_01.sql:
-- only sha256(token) is stored, link valid 30 days, signature PNG uploaded to doc-files/{tenant}/prc-sign/{hash}/.

create table if not exists public.payroll_recon_reports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  employee_id uuid not null,
  ref_no text not null check (length(ref_no) <= 60),
  period_from date,
  period_to date,
  lang text not null default 'en' check (lang in ('en', 'bm')),
  snapshot jsonb not null default '{}'::jsonb,
  status text not null default 'saved' check (status in ('saved', 'shared', 'signed', 'void')),
  created_by uuid default auth.uid(),
  signer_name text check (signer_name is null or length(signer_name) <= 120),
  sig_path text,
  signed_at timestamptz,
  voided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists payroll_recon_reports_emp_idx on public.payroll_recon_reports (tenant_id, employee_id, created_at desc) where deleted_at is null;

create table if not exists public.payroll_recon_sign_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  report_id uuid not null,
  token_hash text not null unique check (length(token_hash) = 64),
  expires_at timestamptz not null default now() + interval '30 days',
  revoked_at timestamptz,
  used_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists payroll_recon_sign_links_rep_idx on public.payroll_recon_sign_links (tenant_id, report_id);

alter table public.payroll_recon_reports enable row level security;
alter table public.payroll_recon_sign_links enable row level security;
revoke all on public.payroll_recon_reports from anon;
revoke all on public.payroll_recon_sign_links from anon;

drop policy if exists payroll_recon_reports_read on public.payroll_recon_reports;
create policy payroll_recon_reports_read on public.payroll_recon_reports for select to authenticated using (
  tenant_id = public.get_my_tenant_id() and public.payroll__is_hr(tenant_id));
drop policy if exists payroll_recon_reports_ins on public.payroll_recon_reports;
create policy payroll_recon_reports_ins on public.payroll_recon_reports for insert to authenticated with check (
  tenant_id = public.get_my_tenant_id() and public.payroll__is_hr(tenant_id) and status = 'saved'
  and exists (select 1 from public.employees e where e.id = employee_id and e.tenant_id = payroll_recon_reports.tenant_id));
-- app may only edit / soft-delete a report that is not shared or signed; status changes go through the RPCs below
drop policy if exists payroll_recon_reports_upd on public.payroll_recon_reports;
create policy payroll_recon_reports_upd on public.payroll_recon_reports for update to authenticated
  using (tenant_id = public.get_my_tenant_id() and public.payroll__is_hr(tenant_id) and status in ('saved', 'void'))
  with check (tenant_id = public.get_my_tenant_id() and public.payroll__is_hr(tenant_id) and status in ('saved', 'void'));
drop policy if exists payroll_recon_sign_links_read on public.payroll_recon_sign_links;
create policy payroll_recon_sign_links_read on public.payroll_recon_sign_links for select to authenticated using (
  tenant_id = public.get_my_tenant_id() and public.payroll__is_hr(tenant_id));
grant select, insert, update on public.payroll_recon_reports to authenticated;
grant select on public.payroll_recon_sign_links to authenticated;

-- storage: anon upload only into the folder of a live, unsigned link
create or replace function public.prc_sign_path_ok(p_tenant text, p_hash text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.payroll_recon_sign_links l join public.payroll_recon_reports r on r.id = l.report_id
    where l.tenant_id::text = p_tenant and l.token_hash = p_hash and l.revoked_at is null and l.expires_at > now()
      and r.deleted_at is null and r.status = 'shared')
$$;
drop policy if exists doc_files_prcsig_pub_ins on storage.objects;
create policy doc_files_prcsig_pub_ins on storage.objects for insert to anon, authenticated with check (
  bucket_id = 'doc-files'
  and (storage.foldername(name))[2] = 'prc-sign'
  and public.prc_sign_path_ok((storage.foldername(name))[1], (storage.foldername(name))[3]));

-- HR: create a one-time sign link (old links for the report are revoked). Returns the raw token once.
create or replace function public.prc_sign_link_create(p_report uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r public.payroll_recon_reports%rowtype;
  tok text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  exp timestamptz := now() + interval '30 days';
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select * into r from public.payroll_recon_reports where id = p_report and deleted_at is null;
  if not found or r.tenant_id is distinct from public.get_my_tenant_id() then raise exception 'Report not found'; end if;
  if not public.payroll__is_hr(r.tenant_id) then raise exception 'HR managers only'; end if;
  if r.status not in ('saved', 'shared') then raise exception 'Report is already signed or void'; end if;
  update public.payroll_recon_sign_links set revoked_at = now() where report_id = r.id and revoked_at is null;
  insert into public.payroll_recon_sign_links (tenant_id, report_id, token_hash, expires_at)
  values (r.tenant_id, r.id, encode(sha256(convert_to(tok, 'UTF8')), 'hex'), exp);
  update public.payroll_recon_reports set status = 'shared', updated_at = now() where id = r.id;
  return jsonb_build_object('token', tok, 'expires_at', exp);
end;
$$;

-- public page: read the report snapshot behind a token
create or replace function public.get_public_prc_sign(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  l public.payroll_recon_sign_links%rowtype;
  r public.payroll_recon_reports%rowtype;
begin
  if p_token is null or length(btrim(p_token)) < 32 then raise exception 'Invalid token'; end if;
  select * into l from public.payroll_recon_sign_links where token_hash = encode(sha256(convert_to(btrim(p_token), 'UTF8')), 'hex');
  if not found or l.revoked_at is not null or (l.expires_at <= now() and l.used_at is null) then raise exception 'Link expired or revoked'; end if;
  select * into r from public.payroll_recon_reports where id = l.report_id and deleted_at is null;
  if not found or r.status = 'void' then raise exception 'Link expired or revoked'; end if;
  return jsonb_build_object('report_id', r.id, 'tenant_id', r.tenant_id, 'status', r.status, 'ref_no', r.ref_no, 'lang', r.lang,
    'snapshot', r.snapshot, 'signer_name', r.signer_name, 'signed_at', r.signed_at, 'expires_at', l.expires_at);
end;
$$;

-- public page: employee signs with a PNG already uploaded to {tenant}/prc-sign/{token_hash}/*.png
create or replace function public.prc_sign_public(p_token text, p_name text, p_path text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  l public.payroll_recon_sign_links%rowtype;
  r public.payroll_recon_reports%rowtype;
  nm text := left(btrim(coalesce(p_name, '')), 120);
  h text;
begin
  if p_token is null or length(btrim(p_token)) < 32 then raise exception 'Invalid token'; end if;
  h := encode(sha256(convert_to(btrim(p_token), 'UTF8')), 'hex');
  select * into l from public.payroll_recon_sign_links where token_hash = h for update;
  if not found or l.revoked_at is not null or l.expires_at <= now() or l.used_at is not null then raise exception 'Link expired or revoked'; end if;
  select * into r from public.payroll_recon_reports where id = l.report_id and deleted_at is null for update;
  if not found or r.status <> 'shared' then raise exception 'Report is not open for signing'; end if;
  if length(nm) < 2 then raise exception 'Name required'; end if;
  if p_path is null or p_path not like (l.tenant_id::text || '/prc-sign/' || h || '/%') or right(lower(p_path), 4) <> '.png' then
    raise exception 'Invalid signature path';
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'doc-files' and o.name = p_path) then raise exception 'Signature file not uploaded'; end if;
  update public.payroll_recon_reports set status = 'signed', signer_name = nm, sig_path = p_path, signed_at = now(), updated_at = now() where id = r.id;
  update public.payroll_recon_sign_links set used_at = now() where id = l.id;
  begin
    insert into public.notifications (tenant_id, user_id, actor_id, title, body, category, kind, type, priority, link, ref_table, ref_id)
    select r.tenant_id, u.id, null,
      case when u.language = 'bm' then 'Laporan rekonsiliasi ditandatangani · ' || r.ref_no else 'Reconciliation report signed · ' || r.ref_no end,
      case when u.language = 'bm' then left(nm, 80) || ' telah menandatangani laporan rekonsiliasi gaji melalui pautan WhatsApp.'
        else left(nm, 80) || ' signed the payroll reconciliation report via the WhatsApp link.' end,
      'approval', 'for_you', 'approval.payroll', 0,
      jsonb_build_object('page', 'hr', 'params', jsonb_build_object('view', 'payroll-recon-report', 'id', r.id), 'icon', 'ti-signature'),
      'payroll_recon_reports', r.id::text
    from public.user_profiles u
    where u.tenant_id = r.tenant_id and coalesce(u.is_active, true)
      and (u.id = r.created_by or lower(coalesce(u.role, '')) in ('owner', 'admin', 'platform_admin', 'manager', 'hr'));
  exception when others then
    raise warning 'prc_sign_public notify skipped: %', sqlerrm;  -- never block the signature
  end;
  return jsonb_build_object('signed', true, 'signed_at', now());
end;
$$;

-- HR: Reset = void the report (signed or shared) and revoke its links. Bell to the preparer (not the actor).
create or replace function public.prc_sign_reset(p_report uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r public.payroll_recon_reports%rowtype;
  me uuid := auth.uid();
begin
  if me is null then raise exception 'Not signed in'; end if;
  select * into r from public.payroll_recon_reports where id = p_report and deleted_at is null for update;
  if not found or r.tenant_id is distinct from public.get_my_tenant_id() then raise exception 'Report not found'; end if;
  if not public.payroll__is_hr(r.tenant_id) then raise exception 'HR managers only'; end if;
  update public.payroll_recon_sign_links set revoked_at = now() where report_id = r.id and revoked_at is null;
  update public.payroll_recon_reports set status = 'void', voided_at = now(), updated_at = now() where id = r.id;
  begin
    insert into public.notifications (tenant_id, user_id, actor_id, title, body, category, kind, type, priority, link, ref_table, ref_id)
    select r.tenant_id, u.id, me,
      case when u.language = 'bm' then 'Laporan rekonsiliasi di-reset · ' || r.ref_no else 'Reconciliation report reset · ' || r.ref_no end,
      case when u.language = 'bm' then 'Laporan ini telah dibatalkan. Jana dan kongsi semula jika perlu.'
        else 'This report was voided. Generate and share it again if needed.' end,
      'approval', 'for_you', 'approval.payroll', 0,
      jsonb_build_object('page', 'hr', 'params', jsonb_build_object('view', 'payroll-recon-report', 'id', r.id), 'icon', 'ti-rotate'),
      'payroll_recon_reports', r.id::text
    from public.user_profiles u
    where u.id = r.created_by and u.tenant_id = r.tenant_id and u.id <> me;
  exception when others then
    raise warning 'prc_sign_reset notify skipped: %', sqlerrm;
  end;
  return jsonb_build_object('status', 'void');
end;
$$;

revoke all on function public.prc_sign_path_ok(text, text) from public;
revoke all on function public.prc_sign_link_create(uuid) from public, anon;
revoke all on function public.prc_sign_reset(uuid) from public, anon;
revoke all on function public.get_public_prc_sign(text) from public;
revoke all on function public.prc_sign_public(text, text, text) from public;
grant execute on function public.prc_sign_path_ok(text, text) to anon, authenticated;
grant execute on function public.prc_sign_link_create(uuid) to authenticated;
grant execute on function public.prc_sign_reset(uuid) to authenticated;
grant execute on function public.get_public_prc_sign(text) to anon, authenticated;
grant execute on function public.prc_sign_public(text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
