-- Programme Lead -> Sales -> Payment · Phase 1: public lead capture
-- WRITE-ONLY: run in Supabase SQL Editor. Rerun-safe (IF NOT EXISTS / CREATE OR REPLACE / DROP POLICY IF EXISTS).
-- Tables: prog_programmes, prog_leads. RPC: create_public_lead (anon).

-- 1) Programmes (one row per programme, owned by the selling tenant)
create table if not exists public.prog_programmes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  code text not null,
  name text not null,
  starts_on date,
  ends_on date,
  fee_per_pax numeric(14,2) not null default 0 check (fee_per_pax >= 0),
  public_token text check (public_token is null or length(public_token) >= 24),
  wa_phone text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index if not exists prog_programmes_code_uidx on public.prog_programmes (tenant_id, code) where deleted_at is null;
create unique index if not exists prog_programmes_token_uidx on public.prog_programmes (public_token) where public_token is not null;

-- 2) Leads (enquiries from the landing page)
create table if not exists public.prog_leads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  programme_id uuid not null references public.prog_programmes(id),
  ref_no text not null,
  name text not null check (length(name) between 2 and 120),
  email text check (email is null or length(email) <= 160),
  phone text check (phone is null or length(phone) <= 30),
  organisation text check (organisation is null or length(organisation) <= 160),
  job_role text check (job_role is null or length(job_role) <= 40),
  funding text check (funding is null or length(funding) <= 40),
  pax int not null default 1 check (pax between 1 and 50),
  message text check (message is null or length(message) <= 2000),
  lang text,
  utm_source text, utm_medium text, utm_campaign text, utm_content text, utm_term text,
  ref_code text,
  page_url text,
  consent_at timestamptz,
  consent_version text,
  ip_hash text,
  stage text not null default 'new' check (stage in ('new','contacted','qualified','proposal','won','lost')),
  lost_reason text check (lost_reason is null or length(lost_reason) <= 500),
  assigned_to uuid,
  next_follow_up_at date,
  contacted_at timestamptz,
  sla_notified_at timestamptz,
  customer_id uuid,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index if not exists prog_leads_ref_uidx on public.prog_leads (tenant_id, ref_no);
create index if not exists prog_leads_prog_idx on public.prog_leads (tenant_id, programme_id, stage) where deleted_at is null;
create index if not exists prog_leads_email_idx on public.prog_leads (tenant_id, programme_id, lower(email)) where deleted_at is null;
create index if not exists prog_leads_ip_idx on public.prog_leads (ip_hash, created_at);

-- 3) RLS: read = same tenant; write = same tenant + crm module; platform admin full; no DELETE policy (soft delete only)
alter table public.prog_programmes enable row level security;
alter table public.prog_leads enable row level security;

drop policy if exists prog_programmes_select on public.prog_programmes;
create policy prog_programmes_select on public.prog_programmes for select to authenticated
  using (tenant_id = public.get_my_tenant_id());
drop policy if exists prog_programmes_insert on public.prog_programmes;
create policy prog_programmes_insert on public.prog_programmes for insert to authenticated
  with check (tenant_id = public.get_my_tenant_id() and public.has_module('crm'));
drop policy if exists prog_programmes_update on public.prog_programmes;
create policy prog_programmes_update on public.prog_programmes for update to authenticated
  using (tenant_id = public.get_my_tenant_id() and public.has_module('crm'))
  with check (tenant_id = public.get_my_tenant_id() and public.has_module('crm'));
drop policy if exists platform_admin_all on public.prog_programmes;
create policy platform_admin_all on public.prog_programmes for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists prog_leads_select on public.prog_leads;
create policy prog_leads_select on public.prog_leads for select to authenticated
  using (tenant_id = public.get_my_tenant_id());
drop policy if exists prog_leads_insert on public.prog_leads;
create policy prog_leads_insert on public.prog_leads for insert to authenticated
  with check (tenant_id = public.get_my_tenant_id() and public.has_module('crm'));
drop policy if exists prog_leads_update on public.prog_leads;
create policy prog_leads_update on public.prog_leads for update to authenticated
  using (tenant_id = public.get_my_tenant_id() and public.has_module('crm'))
  with check (tenant_id = public.get_my_tenant_id() and public.has_module('crm'));
drop policy if exists platform_admin_all on public.prog_leads;
create policy platform_admin_all on public.prog_leads for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- 4) Public RPC: save the lead first, return LD-xxxx (landing page then opens WhatsApp)
create or replace function public.create_public_lead(p_token text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  pg public.prog_programmes%rowtype;
  v_name text; v_email text; v_phone text; v_org text; v_pax int; v_msg text;
  v_ip text; v_ip_hash text; v_n int; v_ref text; v_id uuid; v_old public.prog_leads%rowtype;
begin
  if p_token is null or length(trim(p_token)) < 24 then raise exception 'invalid token'; end if;
  select * into pg from public.prog_programmes
   where public_token = trim(p_token) and deleted_at is null limit 1;
  if not found then raise exception 'invalid token'; end if;

  -- honeypot: bots fill the hidden field -> pretend success, store nothing
  if length(trim(coalesce(p_payload->>'website', ''))) > 0 then
    return jsonb_build_object('ok', true, 'ref', null);
  end if;

  v_name  := nullif(trim(coalesce(p_payload->>'name', '')), '');
  v_email := lower(nullif(trim(coalesce(p_payload->>'email', '')), ''));
  -- phone -> digits with Malaysian country code (012... / +6012... / 12... all become 6012...)
  v_phone := nullif(regexp_replace(coalesce(p_payload->>'phone', ''), '\D', '', 'g'), '');
  if v_phone like '0%' then v_phone := '6' || v_phone; elsif v_phone like '1%' then v_phone := '60' || v_phone; end if;
  v_org   := nullif(trim(coalesce(p_payload->>'organisation', '')), '');
  v_msg   := nullif(left(trim(coalesce(p_payload->>'message', '')), 2000), '');
  v_pax   := case when coalesce(p_payload->>'pax', '') ~ '^[0-9]{1,2}$' then (p_payload->>'pax')::int else 1 end;
  if v_pax < 1 then v_pax := 1; end if;
  if v_pax > 50 then v_pax := 50; end if;

  if v_name is null or length(v_name) < 2 or length(v_name) > 120 then raise exception 'name required'; end if;
  if v_email is null or v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' then raise exception 'email invalid'; end if;
  if v_phone is null or length(v_phone) < 9 or length(v_phone) > 15 then raise exception 'phone invalid'; end if;
  if v_org is null then raise exception 'organisation required'; end if;
  if coalesce(p_payload->>'consent', '') not in ('true', '1', 'yes') then raise exception 'consent required'; end if;

  -- rate limit: 10 per IP per hour, 3 per email/phone per hour
  v_ip := split_part(coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json->>'x-forwarded-for', ',', 1);
  v_ip_hash := case when coalesce(v_ip, '') = '' then null else encode(sha256(convert_to(trim(v_ip) || ':' || pg.tenant_id::text, 'UTF8')), 'hex') end;
  if v_ip_hash is not null and (select count(*) from public.prog_leads
      where ip_hash = v_ip_hash and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'rate limited';
  end if;
  if (select count(*) from public.prog_leads
      where tenant_id = pg.tenant_id and created_at > now() - interval '1 hour'
        and (lower(email) = v_email or phone = v_phone)) >= 3 then
    raise exception 'rate limited';
  end if;

  -- same person re-submits within 30 days on an open lead -> keep one lead, log the new message
  select * into v_old from public.prog_leads
   where tenant_id = pg.tenant_id and programme_id = pg.id and deleted_at is null
     and stage not in ('won', 'lost') and created_at > now() - interval '30 days'
     and (lower(email) = v_email or phone = v_phone)
   order by created_at desc limit 1;
  if found then
    update public.prog_leads set updated_at = now(),
      message = coalesce(v_msg, message), pax = greatest(pax, v_pax)
     where id = v_old.id;
    begin
      insert into public.prog_lead_activities (tenant_id, lead_id, type, notes)
      values (pg.tenant_id, v_old.id, 'system', left('Re-submitted from landing page' || coalesce(': ' || v_msg, ''), 2000));
    exception when undefined_table then null; end;
    return jsonb_build_object('ok', true, 'ref', v_old.ref_no, 'mode', 'existing');
  end if;

  perform pg_advisory_xact_lock(hashtext('prog_lead_ref:' || pg.tenant_id::text));
  select coalesce(max(nullif(regexp_replace(ref_no, '\D', '', 'g'), '')::int), 0) + 1 into v_n
    from public.prog_leads where tenant_id = pg.tenant_id;
  v_ref := 'LD-' || lpad(v_n::text, 4, '0');

  insert into public.prog_leads (
    tenant_id, programme_id, ref_no, name, email, phone, organisation, job_role, funding, pax, message, lang,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term, ref_code, page_url,
    consent_at, consent_version, ip_hash
  ) values (
    pg.tenant_id, pg.id, v_ref, v_name, v_email, v_phone, v_org,
    left(nullif(trim(coalesce(p_payload->>'role', '')), ''), 40),
    left(nullif(trim(coalesce(p_payload->>'funding', '')), ''), 40),
    v_pax, v_msg,
    case when p_payload->>'lang' in ('en', 'bm') then p_payload->>'lang' else 'en' end,
    left(nullif(trim(coalesce(p_payload->>'utm_source', '')), ''), 120),
    left(nullif(trim(coalesce(p_payload->>'utm_medium', '')), ''), 120),
    left(nullif(trim(coalesce(p_payload->>'utm_campaign', '')), ''), 120),
    left(nullif(trim(coalesce(p_payload->>'utm_content', '')), ''), 120),
    left(nullif(trim(coalesce(p_payload->>'utm_term', '')), ''), 120),
    left(nullif(trim(coalesce(p_payload->>'ref', '')), ''), 60),
    left(nullif(trim(coalesce(p_payload->>'page_url', '')), ''), 500),
    now(), left(nullif(trim(coalesce(p_payload->>'consent_version', '')), ''), 40), v_ip_hash
  ) returning id into v_id;

  -- notify owner/admin (never blocks the lead)
  begin
    insert into public.notifications (tenant_id, user_id, title, body, category, kind, type, priority, link, ref_table, ref_id)
    select pg.tenant_id, u.id,
      case when u.language = 'bm' then 'Lead program baharu ' || v_ref else 'New programme lead ' || v_ref end,
      concat_ws(' · ', v_name, v_org, v_pax || ' pax', pg.code),
      'sales', 'action', 'crm.programme_lead', 1,
      jsonb_build_object('page', 'crm', 'params', jsonb_build_object('view', 'programmes', 'lead', v_id::text)),
      'prog_leads', v_id::text
    from public.user_profiles u
    where u.tenant_id = pg.tenant_id and coalesce(u.is_active, true)
      and lower(coalesce(u.role, '')) in ('owner', 'admin');
  exception when others then null; end;

  return jsonb_build_object('ok', true, 'ref', v_ref, 'mode', 'created');
end;
$fn$;
revoke all on function public.create_public_lead(text, jsonb) from public;
grant execute on function public.create_public_lead(text, jsonb) to anon, authenticated;

-- 5) Seed: Oxbridge SME 2026 programme in the Phion tenant (SSM 202601023064). Facts from the live LP only.
insert into public.prog_programmes (tenant_id, code, name, starts_on, ends_on, fee_per_pax, public_token, wa_phone)
select t.id, 'OXB-SME-2026', 'Oxford & Cambridge SME Business Leadership Programme', date '2026-12-13', date '2026-12-19',
       48000, 'f14095b73c4f211623da478089d3493a5e3ca716', '60183212669'
from public.tenants t
where t.deleted_at is null
  and coalesce(nullif(t.ssm_no, ''), t.config->'company_profile'->>'ssm_no') = '202601023064'
  and (select count(*) from public.tenants x where x.deleted_at is null
        and coalesce(nullif(x.ssm_no, ''), x.config->'company_profile'->>'ssm_no') = '202601023064') = 1
  and not exists (select 1 from public.prog_programmes p where p.public_token = 'f14095b73c4f211623da478089d3493a5e3ca716');

-- 6) Roadmap
do $rd$
begin
  if exists (select 1 from public.dev_roadmap_items where title = 'Programme LSP · Phase 1: public lead capture') then
    update public.dev_roadmap_items set stage = 'completed', module = 'crm'
     where title = 'Programme LSP · Phase 1: public lead capture';
  else
    insert into public.dev_roadmap_items (title, description, module, stage)
    values ('Programme LSP · Phase 1: public lead capture',
      'prog_programmes + prog_leads + create_public_lead (anon RPC: honeypot, rate limit, dedupe 30 days, LD-xxxx ref, owner/admin notification). Landing page saves the lead before opening WhatsApp.',
      'crm', 'completed');
  end if;
exception when undefined_column or undefined_table then raise notice 'dev_roadmap skip: %', sqlerrm;
end $rd$;

-- 7) Check (read-only)
select code, name, fee_per_pax, (public_token is not null) as has_token from public.prog_programmes where deleted_at is null;

notify pgrst, 'reload schema';
