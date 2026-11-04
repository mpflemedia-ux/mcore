-- M-Core — Service commission: WhatsApp share + signature request (same concept as Salary Disbursement). svc_commission_02.sql
-- WRITE-ONLY: Mike runs this in Supabase SQL editor AFTER svc_commission_01.sql. Rerun-safe (idempotent), guarded.
--
-- Mirrors supabase/sd_signatures_01.sql 1:1, per employee-month (svc_comm_months row) instead of per SD batch:
--   svc_sign_links       one WhatsApp link per role; only the SHA-256 of the token is stored (30 days).
--   svc_signatures       one ACTIVE signature per month + role (draw-signature PNG in doc-files), voided on reopen /
--                        amount change / reset.
--   Roles: 'prepared' = staff (Prepared by, needs status submitted|approved),
--          'approved' = Owner/HR (Approved by, needs status approved).
--   RPCs (SECURITY DEFINER): svc_sign_app (in-app), svc_sign_link_create (HR), svc_sign_request (bell + push to the signer),
--          get_public_svc_sign + svc_sign_public (public-svc.html?svc_sign=<token>, no login), svc_sign_reset (HR).
--   Notifications via dk__notify (bell + push-send webhook): actor skipped, one row per recipient, deep link
--          {page:'hr', params:{view:'my-payslips', svc:'log', emp, m, y, sig}}, NO amounts in title/body.
--   Storage: doc-files/{tenant}/svc-signatures/{month_id}/... (staff) and doc-files/{tenant}/svc-sign/{token_hash}/... (link signer).
--   doc_shares checks widened (never shrunk) for doc_type 'svc' + templates 'svc_send' / 'svc_remind' / 'svc_sign'.
-- Seed / data: none. Tenant data is untouched.

begin;

select 1 / (case when to_regclass('public.svc_comm_months') is null then 0 else 1 end) as svc_commission_01_present;

-- ---------- 1) role links (hash only) ----------
create table if not exists public.svc_sign_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  month_id uuid not null references public.svc_comm_months(id) on delete cascade,
  role text not null check (role in ('prepared', 'approved')),
  token_hash text not null unique check (length(token_hash) = 64),
  expires_at timestamptz not null default now() + interval '30 days',
  revoked_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists svc_sign_links_month_idx on public.svc_sign_links (tenant_id, month_id, role);
alter table public.svc_sign_links enable row level security;
revoke all on public.svc_sign_links from anon;
drop policy if exists svc_sign_links_read on public.svc_sign_links;
create policy svc_sign_links_read on public.svc_sign_links for select to authenticated using (
  tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid()));
grant select on public.svc_sign_links to authenticated;

-- ---------- 2) signatures ----------
create table if not exists public.svc_signatures (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  month_id uuid not null references public.svc_comm_months(id) on delete cascade,
  role text not null check (role in ('prepared', 'approved')),
  signer_name text not null check (length(btrim(signer_name)) between 1 and 120),
  signer_user_id uuid,
  storage_path text not null check (length(storage_path) between 10 and 400),
  signed_via text not null check (signed_via in ('app', 'link')),
  link_id uuid references public.svc_sign_links(id) on delete set null,
  signed_at timestamptz not null default now(),
  voided_at timestamptz,
  void_reason text check (void_reason is null or length(void_reason) <= 500),
  created_at timestamptz not null default now()
);
create unique index if not exists svc_signatures_active_uq on public.svc_signatures (month_id, role) where voided_at is null;
create index if not exists svc_signatures_tenant_idx on public.svc_signatures (tenant_id, month_id);
alter table public.svc_signatures enable row level security;
revoke all on public.svc_signatures from anon;
drop policy if exists svc_signatures_read on public.svc_signatures;
create policy svc_signatures_read on public.svc_signatures for select to authenticated using (
  tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid())
  or exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin'));
-- no insert / update / delete grants: every write goes through the RPCs below
grant select on public.svc_signatures to authenticated;

-- ---------- 3) helpers (not callable by clients) ----------
create or replace function public.svc__sign_label(p_role text, p_bm boolean)
returns text language sql immutable set search_path = public as $$
  select case p_role
    when 'prepared' then case when p_bm then 'Disediakan oleh' else 'Prepared by' end
    else case when p_bm then 'Diluluskan oleh' else 'Approved by' end end
$$;

create or replace function public.svc__sign_period(p_month int, p_year int, p_bm boolean)
returns text language sql immutable set search_path = public as $$
  select (case when p_bm then array['Jan','Feb','Mac','Apr','Mei','Jun','Jul','Ogo','Sep','Okt','Nov','Dis']
               else array['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'] end)[p_month] || ' ' || p_year
$$;

create or replace function public.svc__sign_slots(p_mid uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'role', r.role,
    'signed', s.id is not null,
    'signer_name', s.signer_name,
    'signed_at', s.signed_at,
    'signed_via', s.signed_via
  ) order by r.ord), '[]'::jsonb)
  from (values ('prepared', 1), ('approved', 2)) r(role, ord)
  left join public.svc_signatures s on s.month_id = p_mid and s.role = r.role and s.voided_at is null
$$;

-- month row for the caller's tenant (null when the month was never saved / submitted)
create or replace function public.svc__sign_month(p_tid uuid, p_emp uuid, p_month int, p_year int)
returns uuid language sql stable security definer set search_path = public as $$
  select m.id from public.svc_comm_months m
  where m.tenant_id = p_tid and m.employee_id = p_emp and m.month = p_month and m.year = p_year and m.deleted_at is null
$$;

-- status gate per role: prepared needs submitted|approved, approved needs approved
create or replace function public.svc__sign_gate(p_status text, p_role text)
returns void language plpgsql immutable set search_path = public as $$
begin
  if p_role is null or p_role not in ('prepared', 'approved') then raise exception 'Invalid role' using errcode = '22023'; end if;
  if p_role = 'prepared' and coalesce(p_status, 'draft') not in ('submitted', 'approved') then
    raise exception 'Submit the month first' using errcode = 'P0001'; end if;
  if p_role = 'approved' and coalesce(p_status, 'draft') <> 'approved' then
    raise exception 'Approve the month first' using errcode = 'P0001'; end if;
end;
$$;

-- after each signature: close open sign requests for that slot + bell/push (no amounts), actor excluded
create or replace function public.svc__after_sign(p_mid uuid, p_role text, p_signer text, p_via text, p_actor uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  m public.svc_comm_months%rowtype;
  n int; ename text := ''; who uuid; lnk jsonb; typ text := 'hr.svc_comm_signed';
  per_en text; per_bm text; via_en text; via_bm text;
begin
  select * into m from public.svc_comm_months where id = p_mid;
  select count(*) into n from public.svc_signatures where month_id = p_mid and voided_at is null;
  begin
    update public.notifications set acted_at = now(), read_at = coalesce(read_at, now())
    where tenant_id = m.tenant_id and ref_id::text = p_mid::text and type = 'hr.svc_comm_sign_req' and acted_at is null
      and coalesce(link->'params'->>'sig', '') = p_role;
  exception when others then raise warning 'svc__after_sign close: %', sqlerrm; end;
  if to_regprocedure('public.dk__notify(uuid,text[],uuid[],uuid,text,text,text,text,text,jsonb,text,uuid,text)') is not null then
    begin
      select coalesce(e.name, '') into ename from public.employees e where e.id = m.employee_id and e.tenant_id = m.tenant_id;
      per_en := public.svc__sign_period(m.month, m.year, false); per_bm := public.svc__sign_period(m.month, m.year, true);
      via_en := case when p_via = 'link' then 'via WhatsApp link' else 'in the app' end;
      via_bm := case when p_via = 'link' then 'melalui pautan WhatsApp' else 'dalam aplikasi' end;
      who := public.svc__emp_user(m.tenant_id, m.employee_id);
      lnk := jsonb_build_object('page', 'hr', 'params', jsonb_build_object('view', 'my-payslips', 'svc', 'log',
               'emp', m.employee_id::text, 'm', m.month, 'y', m.year, 'sig', p_role), 'icon', case when n >= 2 then 'ti-circle-check' else 'ti-signature' end);
      -- Owner/Admin/Manager/HR always; the employee too once Approved by is signed (one row per user, actor skipped)
      perform public.dk__notify(m.tenant_id, array['owner', 'admin', 'manager', 'hr'],
        case when p_role = 'approved' and who is not null then array[who] else null end, p_actor,
        case when n >= 2 then 'Service commission statement fully signed (2/2) · ' || coalesce(nullif(ename, ''), 'staff') || ' · ' || per_en
             else public.svc__sign_label(p_role, false) || ' signed (' || n || '/2) · ' || coalesce(nullif(ename, ''), 'staff') || ' · ' || per_en end,
        case when n >= 2 then 'Penyata komisen servis lengkap ditandatangani (2/2) · ' || coalesce(nullif(ename, ''), 'staf') || ' · ' || per_bm
             else public.svc__sign_label(p_role, true) || ' ditandatangani (' || n || '/2) · ' || coalesce(nullif(ename, ''), 'staf') || ' · ' || per_bm end,
        'Service commission · ' || left(coalesce(p_signer, ''), 80) || ' signed ' || via_en || '. Tap to view the statement.',
        'Komisen servis · ' || left(coalesce(p_signer, ''), 80) || ' tandatangan ' || via_bm || '. Ketik untuk lihat penyata.',
        typ, lnk, 'svc_comm_months', m.id, typ || ':' || m.id::text || ':' || p_role || ':' || now()::text);
    exception when others then
      raise warning 'svc__after_sign notify skipped: %', sqlerrm;  -- a notification problem never blocks the signature
    end;
  end if;
  return jsonb_build_object('signed', n, 'complete', n >= 2, 'slots', public.svc__sign_slots(p_mid));
end;
$$;

-- storage policy helper: is {tenant}/svc-sign/{hash}/ a live role link of that tenant?
create or replace function public.svc_sign_path_ok(p_tenant text, p_hash text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.svc_sign_links l join public.svc_comm_months m on m.id = l.month_id
    where l.tenant_id::text = p_tenant and l.token_hash = p_hash and l.revoked_at is null and l.expires_at > now()
      and m.deleted_at is null and m.status in ('submitted', 'approved'))
$$;

-- ---------- 4) RPCs ----------
-- staff (own month, Prepared by) or Owner/HR (either slot), in the app: PNG already uploaded to {tenant}/svc-signatures/{month_id}/
create or replace function public.svc_sign_app(p_emp uuid, p_month int, p_year int, p_role text, p_name text, p_path text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  tid uuid := public.svc__my_tenant();
  m public.svc_comm_months%rowtype;
  nm text := left(btrim(coalesce(p_name, '')), 120);
  hr boolean; pre text;
begin
  if auth.uid() is null or tid is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  hr := public.svc__is_hr(tid);
  if not (hr or (p_role = 'prepared' and public.svc__is_me(tid, p_emp))) then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into m from public.svc_comm_months where id = public.svc__sign_month(tid, p_emp, p_month, p_year);
  if not found then raise exception 'Submit the month first' using errcode = 'P0001'; end if;
  perform public.svc__sign_gate(m.status, p_role);
  if nm = '' then raise exception 'Name required' using errcode = '22023'; end if;
  pre := m.tenant_id::text || '/svc-signatures/' || m.id::text || '/';
  if p_path is null or left(p_path, length(pre)) <> pre or p_path !~* '\.png$' then raise exception 'Invalid signature file' using errcode = '22023'; end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'doc-files' and o.name = p_path) then raise exception 'Signature file not uploaded' using errcode = 'P0001'; end if;
  begin
    insert into public.svc_signatures (tenant_id, month_id, role, signer_name, signer_user_id, storage_path, signed_via)
    values (m.tenant_id, m.id, p_role, nm, auth.uid(), p_path, 'app');
  exception when unique_violation then raise exception 'This slot is already signed' using errcode = 'P0001';
  end;
  return public.svc__after_sign(m.id, p_role, nm, 'app', auth.uid());
end;
$$;

-- Owner/HR: new WhatsApp link for one role (raw token returned once; only its SHA-256 is stored)
create or replace function public.svc_sign_link_create(p_emp uuid, p_month int, p_year int, p_role text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  tid uuid := public.svc__my_tenant();
  m public.svc_comm_months%rowtype;
  tok text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  l public.svc_sign_links%rowtype;
begin
  if tid is null or not public.svc__is_hr(tid) then raise exception 'Only HR managers can share signing links' using errcode = '42501'; end if;
  select * into m from public.svc_comm_months where id = public.svc__sign_month(tid, p_emp, p_month, p_year);
  if not found then raise exception 'Submit the month first' using errcode = 'P0001'; end if;
  perform public.svc__sign_gate(m.status, p_role);
  insert into public.svc_sign_links (tenant_id, month_id, role, token_hash, created_by)
  values (m.tenant_id, m.id, p_role, encode(sha256(convert_to(tok, 'UTF8')), 'hex'), auth.uid())
  returning * into l;
  return jsonb_build_object('token', tok, 'link_id', l.id, 'expires_at', l.expires_at, 'role', p_role, 'month_id', m.id,
    'signed', exists (select 1 from public.svc_signatures s where s.month_id = m.id and s.role = p_role and s.voided_at is null));
end;
$$;

-- in-app signature request: bell + push to whoever signs that slot (prepared -> the employee; approved -> Owner/Admin/Manager/HR)
create or replace function public.svc_sign_request(p_emp uuid, p_month int, p_year int, p_role text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  tid uuid := public.svc__my_tenant();
  m public.svc_comm_months%rowtype;
  who uuid; ename text := ''; lnk jsonb; k int := 0; typ text := 'hr.svc_comm_sign_req';
  per_en text; per_bm text;
begin
  if tid is null then raise exception 'not allowed' using errcode = '42501'; end if;
  if not (public.svc__is_hr(tid) or (p_role = 'approved' and public.svc__is_me(tid, p_emp))) then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into m from public.svc_comm_months where id = public.svc__sign_month(tid, p_emp, p_month, p_year);
  if not found then raise exception 'Submit the month first' using errcode = 'P0001'; end if;
  perform public.svc__sign_gate(m.status, p_role);
  if exists (select 1 from public.svc_signatures s where s.month_id = m.id and s.role = p_role and s.voided_at is null) then
    raise exception 'This slot is already signed' using errcode = 'P0001'; end if;
  if to_regprocedure('public.dk__notify(uuid,text[],uuid[],uuid,text,text,text,text,text,jsonb,text,uuid,text)') is null then
    return jsonb_build_object('notified', 0, 'reason', 'dk__notify missing');
  end if;
  select coalesce(e.name, '') into ename from public.employees e where e.id = m.employee_id and e.tenant_id = m.tenant_id;
  per_en := public.svc__sign_period(m.month, m.year, false); per_bm := public.svc__sign_period(m.month, m.year, true);
  lnk := jsonb_build_object('page', 'hr', 'params', jsonb_build_object('view', 'my-payslips', 'svc', 'log',
           'emp', m.employee_id::text, 'm', m.month, 'y', m.year, 'sig', p_role), 'icon', 'ti-signature');
  -- one open request per slot: older unread requests for the same slot are closed first
  begin
    update public.notifications set acted_at = now(), read_at = coalesce(read_at, now())
    where tenant_id = m.tenant_id and ref_id::text = m.id::text and type = typ and acted_at is null and coalesce(link->'params'->>'sig', '') = p_role;
  exception when others then raise warning 'svc_sign_request close: %', sqlerrm; end;
  if p_role = 'prepared' then
    who := public.svc__emp_user(m.tenant_id, m.employee_id);
    if who is null then return jsonb_build_object('notified', 0, 'reason', 'no app login linked to this employee'); end if;
    k := public.dk__notify(m.tenant_id, null, array[who], auth.uid(),
      'Please sign your service commission statement · ' || per_en, 'Sila tandatangan penyata komisen servis anda · ' || per_bm,
      'Tap to review and sign as Prepared by.', 'Ketik untuk semak dan tandatangan sebagai Disediakan oleh.',
      typ, lnk, 'svc_comm_months', m.id, typ || ':' || m.id::text || ':prepared:' || now()::text);
  else
    k := public.dk__notify(m.tenant_id, array['owner', 'admin', 'manager', 'hr'], null, auth.uid(),
      'Signature needed: service commission · ' || coalesce(nullif(ename, ''), 'staff') || ' · ' || per_en,
      'Tandatangan diperlukan: komisen servis · ' || coalesce(nullif(ename, ''), 'staf') || ' · ' || per_bm,
      'Tap to review and sign as Approved by.', 'Ketik untuk semak dan tandatangan sebagai Diluluskan oleh.',
      typ, lnk, 'svc_comm_months', m.id, typ || ':' || m.id::text || ':approved:' || now()::text);
  end if;
  return jsonb_build_object('notified', coalesce(k, 0));
end;
$$;

-- public page (no login): statement for one role link + status of both slots. No bank / IC / basic pay.
create or replace function public.get_public_svc_sign(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  l public.svc_sign_links%rowtype;
  m public.svc_comm_months%rowtype;
  tn public.tenants%rowtype;
  ename text; epos text; cp jsonb; rt jsonb; rows jsonb;
  r_rate numeric; r_cap numeric; r_st text; r_leads jsonb;
begin
  if p_token is null or length(btrim(p_token)) < 32 then raise exception 'Invalid token'; end if;
  select * into l from public.svc_sign_links where token_hash = encode(sha256(convert_to(btrim(p_token), 'UTF8')), 'hex');
  if not found or l.revoked_at is not null or l.expires_at <= now() then raise exception 'Link expired or revoked'; end if;
  select * into m from public.svc_comm_months where id = l.month_id and deleted_at is null;
  if not found then raise exception 'Statement not found'; end if;
  select x.name, x.position into ename, epos from public.employees x where x.id = m.employee_id and x.tenant_id = m.tenant_id;
  select * into tn from public.tenants where id = m.tenant_id;
  cp := coalesce(tn.config->'company_profile', '{}'::jsonb);
  -- per-row commission from the rates snapshot taken at submit/approve (same defaults as svc__calc)
  rt := coalesce(m.rates, '{}'::jsonb);
  r_rate := coalesce(nullif(rt->>'svc_rate_pct', '')::numeric, 5);
  r_cap := case when rt ? 'svc_cap' then nullif(rt->>'svc_cap', '')::numeric else 10 end;
  r_st := upper(coalesce(nullif(rt->>'eligible_status', ''), 'NM'));
  r_leads := case when jsonb_typeof(rt->'eligible_leads') = 'array' then rt->'eligible_leads' else '["TT","ADS"]'::jsonb end;
  select coalesce(jsonb_agg(jsonb_build_object(
      'date', g.log_date, 'service', g.service, 'price', g.price, 'status', g.client_status, 'lead', g.lead_source,
      'commission', case when g.client_status = r_st and r_leads ? coalesce(g.lead_source, '') and coalesce(g.price, 0) > 0
                     then round(case when r_cap is null then g.price * r_rate / 100 else least(g.price * r_rate / 100, r_cap) end, 2)
                     else 0 end
    ) order by g.log_date, g.created_at), '[]'::jsonb) into rows
  from public.svc_logs g
  where g.tenant_id = m.tenant_id and g.employee_id = m.employee_id and g.deleted_at is null
    and g.log_date >= make_date(m.year, m.month, 1) and g.log_date < (make_date(m.year, m.month, 1) + interval '1 month')::date;
  return jsonb_build_object(
    'mode', 'sign', 'month_id', m.id, 'tenant_id', m.tenant_id, 'link_id', l.id, 'role', l.role, 'expires_at', l.expires_at,
    'status', m.status, 'month', m.month, 'year', m.year,
    'tenant_name', coalesce(nullif(tn.name, ''), cp->>'name'),
    'logo_url', coalesce(nullif(tn.logo_url, ''), cp->>'logo_url'),
    'address', coalesce(nullif(tn.address, ''), cp->>'address'),
    'employee_name', ename, 'position', epos,
    'heads', m.svc_heads, 'svc_commission', m.svc_commission, 'product_sales', m.product_sales, 'prod_commission', m.prod_commission,
    'bonus', m.bonus, 'commission_total', m.commission_total, 'product_note', m.product_note, 'rates', rt,
    'rows', rows,
    'slots', public.svc__sign_slots(m.id));
end;
$$;

-- public page: sign this link's slot with a PNG already uploaded to {tenant}/svc-sign/{token_hash}/
create or replace function public.svc_sign_public(p_token text, p_name text, p_path text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  h text;
  l public.svc_sign_links%rowtype;
  m public.svc_comm_months%rowtype;
  nm text := left(btrim(coalesce(p_name, '')), 120);
  pre text;
begin
  if p_token is null or length(btrim(p_token)) < 32 then raise exception 'Invalid token'; end if;
  h := encode(sha256(convert_to(btrim(p_token), 'UTF8')), 'hex');
  select * into l from public.svc_sign_links where token_hash = h for update;
  if not found or l.revoked_at is not null or l.expires_at <= now() then raise exception 'Link expired or revoked'; end if;
  select * into m from public.svc_comm_months where id = l.month_id and deleted_at is null;
  if not found then raise exception 'Statement not found'; end if;
  perform public.svc__sign_gate(m.status, l.role);
  if nm = '' then raise exception 'Name required'; end if;
  pre := m.tenant_id::text || '/svc-sign/' || h || '/';
  if p_path is null or left(p_path, length(pre)) <> pre or p_path !~* '\.png$' then raise exception 'Invalid signature file'; end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'doc-files' and o.name = p_path) then raise exception 'Signature file not uploaded'; end if;
  begin
    insert into public.svc_signatures (tenant_id, month_id, role, signer_name, storage_path, signed_via, link_id)
    values (m.tenant_id, m.id, l.role, nm, p_path, 'link', l.id);
  exception when unique_violation then raise exception 'This slot is already signed';
  end;
  return public.svc__after_sign(m.id, l.role, nm, 'link', null);
end;
$$;

-- Owner/HR: void both signatures + revoke links (month status unchanged; use Reopen to edit logs)
create or replace function public.svc_sign_reset(p_emp uuid, p_month int, p_year int, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  tid uuid := public.svc__my_tenant();
  mid uuid; n int;
begin
  if tid is null or not public.svc__is_hr(tid) then raise exception 'Only HR managers can reset signatures' using errcode = '42501'; end if;
  mid := public.svc__sign_month(tid, p_emp, p_month, p_year);
  if mid is null then return jsonb_build_object('voided', 0); end if;
  update public.svc_signatures set voided_at = now(), void_reason = coalesce(nullif(left(btrim(coalesce(p_reason, '')), 500), ''), 'reset')
    where month_id = mid and voided_at is null;
  get diagnostics n = row_count;
  update public.svc_sign_links set revoked_at = now() where month_id = mid and revoked_at is null;
  return jsonb_build_object('voided', n, 'month_id', mid);
end;
$$;

-- ---------- 5) reopen (-> draft) or a changed snapshot -> void signatures + revoke links ----------
create or replace function public.svc__month_void_sigs()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (NEW.status = 'draft' and OLD.status is distinct from 'draft')
     or NEW.commission_total is distinct from OLD.commission_total or NEW.svc_heads is distinct from OLD.svc_heads
     or NEW.deleted_at is not null then
    update public.svc_signatures set voided_at = now(),
      void_reason = case when NEW.status = 'draft' then 'reopened' when NEW.deleted_at is not null then 'deleted' else 'amounts changed' end
      where month_id = NEW.id and voided_at is null;
    update public.svc_sign_links set revoked_at = now() where month_id = NEW.id and revoked_at is null;
  end if;
  return NEW;
end;
$$;
drop trigger if exists svc_comm_months_void_sigs on public.svc_comm_months;
create trigger svc_comm_months_void_sigs after update of status, commission_total, svc_heads, deleted_at on public.svc_comm_months
  for each row execute function public.svc__month_void_sigs();

-- ---------- 6) storage (bucket doc-files, private; staff read via existing doc_files_read) ----------
drop policy if exists doc_files_svcsig_app_ins on storage.objects;
create policy doc_files_svcsig_app_ins on storage.objects for insert to authenticated with check (
  bucket_id = 'doc-files'
  and (storage.foldername(name))[1] = (select p.tenant_id::text from public.user_profiles p where p.id = auth.uid())
  and (storage.foldername(name))[2] = 'svc-signatures');
drop policy if exists doc_files_svcsig_pub_ins on storage.objects;
create policy doc_files_svcsig_pub_ins on storage.objects for insert to anon, authenticated with check (
  bucket_id = 'doc-files'
  and (storage.foldername(name))[2] = 'svc-sign'
  and public.svc_sign_path_ok((storage.foldername(name))[1], (storage.foldername(name))[3]));

-- ---------- 7) doc_shares: widen (never shrink) for WAD.log() of svc shares ----------
do $$
declare
  c record; d text; v text[]; want text[];
begin
  if to_regclass('public.doc_shares') is null then return; end if;
  for c in select * from (values ('doc_shares_doc_type_check', 'doc_type', array['svc']),
                                 ('doc_shares_template_check', 'template', array['svc_send', 'svc_remind', 'svc_sign'])) t(cname, col, vals)
  loop
    select pg_get_constraintdef(k.oid) into d from pg_constraint k where k.conrelid = 'public.doc_shares'::regclass and k.conname = c.cname;
    if d is null then continue; end if;           -- no check = nothing blocks the insert
    select coalesce(array_agg(distinct x[1]), '{}') into v from regexp_matches(d, '''([^'']+)''', 'g') x;
    if v @> c.vals then continue; end if;          -- already widened (rerun)
    select array_agg(distinct u order by u) into want from unnest(v || c.vals) u;
    execute format('alter table public.doc_shares drop constraint %I', c.cname);
    execute format('alter table public.doc_shares add constraint %I check (%I is null or %I = any (%L::text[])) not valid', c.cname, c.col, c.col, want);
  end loop;
end $$;

-- ---------- 8) grants ----------
revoke all on function public.svc__sign_label(text, boolean) from public, anon, authenticated;
revoke all on function public.svc__sign_period(int, int, boolean) from public, anon, authenticated;
revoke all on function public.svc__sign_slots(uuid) from public, anon, authenticated;
revoke all on function public.svc__sign_month(uuid, uuid, int, int) from public, anon, authenticated;
revoke all on function public.svc__sign_gate(text, text) from public, anon, authenticated;
revoke all on function public.svc__after_sign(uuid, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.svc__month_void_sigs() from public, anon, authenticated;
revoke all on function public.svc_sign_path_ok(text, text) from public;
revoke all on function public.svc_sign_app(uuid, int, int, text, text, text) from public, anon;
revoke all on function public.svc_sign_link_create(uuid, int, int, text) from public, anon;
revoke all on function public.svc_sign_request(uuid, int, int, text) from public, anon;
revoke all on function public.svc_sign_reset(uuid, int, int, text) from public, anon;
revoke all on function public.get_public_svc_sign(text) from public;
revoke all on function public.svc_sign_public(text, text, text) from public;
grant execute on function public.svc_sign_path_ok(text, text) to anon, authenticated;
grant execute on function public.svc_sign_app(uuid, int, int, text, text, text) to authenticated;
grant execute on function public.svc_sign_link_create(uuid, int, int, text) to authenticated;
grant execute on function public.svc_sign_request(uuid, int, int, text) to authenticated;
grant execute on function public.svc_sign_reset(uuid, int, int, text) to authenticated;
grant execute on function public.get_public_svc_sign(text) to anon, authenticated;
grant execute on function public.svc_sign_public(text, text, text) to anon, authenticated;

-- ---------- 9) dev roadmap ----------
update public.dev_roadmap_items set stage = 'completed', module = 'hr',
  description = 'Service Commission (Log Servis) gained WhatsApp share + signature request, same concept as Salary Disbursement: WhatsApp message to the employee (name, period, NM heads, total commission, view & sign link), per-role links (Prepared by = staff, Approved by = Owner/HR, SHA-256 hashed, 30 days), draw-signature in app or on public-svc.html (no login), signatures shown on the A4 statement + PDF, bell + push to the signer (no amounts), Pending / Signed chip on the card. Signatures void on reopen or when the approved amount changes.'
where title = 'Service commission: WhatsApp share + signature request';
insert into public.dev_roadmap_items (title, description, module, stage)
select 'Service commission: WhatsApp share + signature request',
  'Service Commission (Log Servis) gained WhatsApp share + signature request, same concept as Salary Disbursement: WhatsApp message to the employee (name, period, NM heads, total commission, view & sign link), per-role links (Prepared by = staff, Approved by = Owner/HR, SHA-256 hashed, 30 days), draw-signature in app or on public-svc.html (no login), signatures shown on the A4 statement + PDF, bell + push to the signer (no amounts), Pending / Signed chip on the card. Signatures void on reopen or when the approved amount changes.',
  'hr', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Service commission: WhatsApp share + signature request');

commit;

notify pgrst, 'reload schema';

-- ---------- checks (read-only) ----------
select to_regclass('public.svc_signatures') as svc_signatures,
       to_regclass('public.svc_sign_links') as svc_sign_links,
       (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
         and p.proname in ('svc_sign_app', 'svc_sign_link_create', 'svc_sign_request', 'get_public_svc_sign', 'svc_sign_public', 'svc_sign_reset', 'svc_sign_path_ok')) as rpcs_7,
       (select count(*) from pg_trigger where tgname = 'svc_comm_months_void_sigs' and not tgisinternal) as void_trigger_1,
       (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname in ('doc_files_svcsig_app_ins', 'doc_files_svcsig_pub_ins')) as storage_policies_2,
       (select coalesce(bool_and(pg_get_constraintdef(k.oid) like '%svc%'), true) from pg_constraint k
         where k.conrelid = 'public.doc_shares'::regclass and k.conname in ('doc_shares_doc_type_check', 'doc_shares_template_check')) as doc_shares_widened,
       to_regprocedure('public.dk__notify(uuid,text[],uuid[],uuid,text,text,text,text,text,jsonb,text,uuid,text)') is not null as notify_fn,
       (select stage from public.dev_roadmap_items where title = 'Service commission: WhatsApp share + signature request' limit 1) as roadmap_stage;
