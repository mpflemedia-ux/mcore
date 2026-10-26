-- Programme Lead -> Sales -> Payment · ALL PHASES (01 → 05) in run order. Paste whole file into Supabase SQL Editor.
-- Rerun-safe. Generated from supabase/prog_lsp_01_leads.sql … prog_lsp_05_confirm_balance_settle.sql.

-- ================================================================
-- supabase/prog_lsp_01_leads.sql
-- ================================================================
-- Programme Lead -> Sales -> Payment · Phase 1: public lead capture
-- WRITE-ONLY: run in Supabase SQL Editor. Rerun-safe (IF NOT EXISTS / CREATE OR REPLACE / DROP POLICY IF EXISTS).
-- Tables: prog_programmes, prog_leads. RPC: create_public_lead (anon).

-- 0) permission helpers (self-contained: work whether or not the RBAC helpers has_module / is_platform_admin are installed)
create or replace function public.prog__is_pa()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare ok boolean;
begin
  begin
    execute 'select public.is_platform_admin()' into ok;
    return coalesce(ok, false);
  exception when undefined_function then
    return exists (select 1 from public.user_profiles where id = auth.uid() and lower(coalesce(role, '')) = 'platform_admin');
  end;
end;
$fn$;
revoke all on function public.prog__is_pa() from public;
grant execute on function public.prog__is_pa() to authenticated;

-- module check: owner/admin always; otherwise has_module() when installed, else denied (least privilege)
create or replace function public.prog__can(p_module text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare ok boolean;
begin
  if exists (select 1 from public.user_profiles where id = auth.uid() and lower(coalesce(role, '')) in ('owner', 'admin')) then
    return true;
  end if;
  begin
    execute 'select public.has_module($1)' into ok using p_module;
    return coalesce(ok, false);
  exception when undefined_function then
    return false;
  end;
end;
$fn$;
revoke all on function public.prog__can(text) from public;
grant execute on function public.prog__can(text) to authenticated;

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
  with check (tenant_id = public.get_my_tenant_id() and public.prog__can('crm'));
drop policy if exists prog_programmes_update on public.prog_programmes;
create policy prog_programmes_update on public.prog_programmes for update to authenticated
  using (tenant_id = public.get_my_tenant_id() and public.prog__can('crm'))
  with check (tenant_id = public.get_my_tenant_id() and public.prog__can('crm'));
drop policy if exists platform_admin_all on public.prog_programmes;
create policy platform_admin_all on public.prog_programmes for all to authenticated
  using (public.prog__is_pa()) with check (public.prog__is_pa());

drop policy if exists prog_leads_select on public.prog_leads;
create policy prog_leads_select on public.prog_leads for select to authenticated
  using (tenant_id = public.get_my_tenant_id());
drop policy if exists prog_leads_insert on public.prog_leads;
create policy prog_leads_insert on public.prog_leads for insert to authenticated
  with check (tenant_id = public.get_my_tenant_id() and public.prog__can('crm'));
drop policy if exists prog_leads_update on public.prog_leads;
create policy prog_leads_update on public.prog_leads for update to authenticated
  using (tenant_id = public.get_my_tenant_id() and public.prog__can('crm'))
  with check (tenant_id = public.get_my_tenant_id() and public.prog__can('crm'));
drop policy if exists platform_admin_all on public.prog_leads;
create policy platform_admin_all on public.prog_leads for all to authenticated
  using (public.prog__is_pa()) with check (public.prog__is_pa());

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

-- ================================================================
-- supabase/prog_lsp_02_pipeline.sql
-- ================================================================
-- Programme Lead -> Sales -> Payment · Phase 2: sales pipeline
-- WRITE-ONLY: run in Supabase SQL Editor after prog_lsp_01_leads.sql. Rerun-safe.
-- Table: prog_lead_activities. RPC: prog_lead_set_stage, prog_lead_log. Cron: hourly 24h-SLA alert.

-- shared guard: caller must belong to the row's tenant (or be platform admin) and hold the module
create or replace function public.prog__guard(p_tenant uuid, p_module text)
returns void
language plpgsql
stable
security definer
set search_path = public
as $fn$
begin
  if public.prog__is_pa() then return; end if;
  if p_tenant is null or p_tenant is distinct from public.get_my_tenant_id() then raise exception 'not allowed'; end if;
  if not public.prog__can(p_module) then raise exception 'not allowed'; end if;
end;
$fn$;
revoke all on function public.prog__guard(uuid, text) from public;
grant execute on function public.prog__guard(uuid, text) to authenticated;

create table if not exists public.prog_lead_activities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  lead_id uuid not null references public.prog_leads(id),
  type text not null check (type in ('note','call','whatsapp','email','meeting','stage','system')),
  notes text check (notes is null or length(notes) <= 2000),
  from_stage text,
  to_stage text,
  user_id uuid,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists prog_lead_activities_lead_idx on public.prog_lead_activities (tenant_id, lead_id, occurred_at desc) where deleted_at is null;

alter table public.prog_lead_activities enable row level security;
drop policy if exists prog_lead_activities_select on public.prog_lead_activities;
create policy prog_lead_activities_select on public.prog_lead_activities for select to authenticated
  using (tenant_id = public.get_my_tenant_id());
drop policy if exists prog_lead_activities_insert on public.prog_lead_activities;
create policy prog_lead_activities_insert on public.prog_lead_activities for insert to authenticated
  with check (tenant_id = public.get_my_tenant_id() and public.prog__can('crm'));
drop policy if exists prog_lead_activities_update on public.prog_lead_activities;
create policy prog_lead_activities_update on public.prog_lead_activities for update to authenticated
  using (tenant_id = public.get_my_tenant_id() and public.prog__can('crm'))
  with check (tenant_id = public.get_my_tenant_id() and public.prog__can('crm'));
drop policy if exists platform_admin_all on public.prog_lead_activities;
create policy platform_admin_all on public.prog_lead_activities for all to authenticated
  using (public.prog__is_pa()) with check (public.prog__is_pa());

-- stage change + history in one step. 'won' is set only by enrolment creation (phase 3); 'lost' needs a reason.
create or replace function public.prog_lead_set_stage(p_lead uuid, p_stage text, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare l public.prog_leads%rowtype;
begin
  select * into l from public.prog_leads where id = p_lead and deleted_at is null for update;
  if not found then raise exception 'lead not found'; end if;
  perform public.prog__guard(l.tenant_id, 'crm');
  if p_stage not in ('new','contacted','qualified','proposal','lost') then raise exception 'invalid stage'; end if;
  if l.stage = 'won' then raise exception 'lead already enrolled'; end if;
  if p_stage = 'lost' and length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'reason required'; end if;
  if p_stage = l.stage then return jsonb_build_object('ok', true, 'stage', l.stage); end if;
  update public.prog_leads set
    stage = p_stage,
    lost_reason = case when p_stage = 'lost' then left(trim(p_reason), 500) else null end,
    contacted_at = case when p_stage <> 'new' then coalesce(contacted_at, now()) else contacted_at end,
    updated_at = now()
  where id = l.id;
  insert into public.prog_lead_activities (tenant_id, lead_id, type, notes, from_stage, to_stage, user_id)
  values (l.tenant_id, l.id, 'stage', case when p_stage = 'lost' then left(trim(p_reason), 2000) end, l.stage, p_stage, auth.uid());
  return jsonb_build_object('ok', true, 'stage', p_stage);
end;
$fn$;
revoke all on function public.prog_lead_set_stage(uuid, text, text) from public;
grant execute on function public.prog_lead_set_stage(uuid, text, text) to authenticated;

-- log a call / WhatsApp / note; first contact moves 'new' -> 'contacted' automatically
create or replace function public.prog_lead_log(p_lead uuid, p_type text, p_notes text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare l public.prog_leads%rowtype;
begin
  select * into l from public.prog_leads where id = p_lead and deleted_at is null for update;
  if not found then raise exception 'lead not found'; end if;
  perform public.prog__guard(l.tenant_id, 'crm');
  if p_type not in ('note','call','whatsapp','email','meeting') then raise exception 'invalid type'; end if;
  if length(trim(coalesce(p_notes, ''))) < 1 then raise exception 'notes required'; end if;
  insert into public.prog_lead_activities (tenant_id, lead_id, type, notes, user_id)
  values (l.tenant_id, l.id, p_type, left(trim(p_notes), 2000), auth.uid());
  if l.stage = 'new' and p_type <> 'note' then
    update public.prog_leads set stage = 'contacted', contacted_at = coalesce(contacted_at, now()), updated_at = now() where id = l.id;
    insert into public.prog_lead_activities (tenant_id, lead_id, type, from_stage, to_stage, user_id)
    values (l.tenant_id, l.id, 'stage', 'new', 'contacted', auth.uid());
  else
    update public.prog_leads set updated_at = now() where id = l.id;
  end if;
  return jsonb_build_object('ok', true);
end;
$fn$;
revoke all on function public.prog_lead_log(uuid, text, text) from public;
grant execute on function public.prog_lead_log(uuid, text, text) to authenticated;

-- SLA: a lead still 'new' after 24 hours -> one alert to owner/admin
create or replace function public.prog_cron_sla()
returns int
language plpgsql
security definer
set search_path = public
as $fn$
declare n int := 0;
begin
  with due as (
    update public.prog_leads l set sla_notified_at = now()
     where l.stage = 'new' and l.deleted_at is null and l.sla_notified_at is null
       and l.created_at < now() - interval '24 hours'
    returning l.id, l.tenant_id, l.ref_no, l.name, l.organisation
  ), ins as (
    insert into public.notifications (tenant_id, user_id, title, body, category, kind, type, priority, link, ref_table, ref_id)
    select d.tenant_id, u.id,
      case when u.language = 'bm' then 'Lead belum dihubungi > 24 jam: ' || d.ref_no else 'Lead not contacted > 24h: ' || d.ref_no end,
      concat_ws(' · ', d.name, d.organisation),
      'sales', 'action', 'crm.programme_lead_sla', 2,
      jsonb_build_object('page', 'crm', 'params', jsonb_build_object('view', 'programmes', 'lead', d.id::text)),
      'prog_leads', d.id::text
    from due d
    join public.user_profiles u on u.tenant_id = d.tenant_id and coalesce(u.is_active, true)
     and lower(coalesce(u.role, '')) in ('owner', 'admin')
    returning 1
  )
  select count(*) into n from ins;
  return n;
end;
$fn$;
revoke all on function public.prog_cron_sla() from public;

select cron.unschedule(jobid) from cron.job where jobname = 'mcore-prog-sla';
select cron.schedule('mcore-prog-sla', '7 * * * *', 'select public.prog_cron_sla()');

do $rd$
begin
  if exists (select 1 from public.dev_roadmap_items where title = 'Programme LSP · Phase 2: sales pipeline') then
    update public.dev_roadmap_items set stage = 'completed', module = 'crm' where title = 'Programme LSP · Phase 2: sales pipeline';
  else
    insert into public.dev_roadmap_items (title, description, module, stage)
    values ('Programme LSP · Phase 2: sales pipeline',
      'CRM → Programmes → Leads: NEW → CONTACTED → QUALIFIED → PROPOSAL / LOST (reason required), activity log (call/WhatsApp/note), first contact auto-moves NEW → CONTACTED, hourly 24h SLA alert to owner/admin.',
      'crm', 'completed');
  end if;
exception when undefined_column or undefined_table then raise notice 'dev_roadmap skip: %', sqlerrm;
end $rd$;

notify pgrst, 'reload schema';

-- ================================================================
-- supabase/prog_lsp_03_registration.sql
-- ================================================================
-- Programme Lead -> Sales -> Payment · Phase 3: enrolment + participant registration
-- WRITE-ONLY: run after prog_lsp_02_pipeline.sql. Rerun-safe.
-- Tables: prog_enrolments (one per payer/deal), prog_participants (one per person, own public link).
-- RPC: prog_create_enrolment (staff), get_prog_registration / submit_prog_registration (anon, token).

alter table public.prog_programmes add column if not exists terms_url text;
alter table public.prog_programmes add column if not exists terms_version text;

create table if not exists public.prog_enrolments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  programme_id uuid not null references public.prog_programmes(id),
  lead_id uuid references public.prog_leads(id),
  customer_id uuid,
  payer_name text not null check (length(payer_name) between 2 and 160),
  payer_type text not null default 'individual' check (payer_type in ('individual','company')),
  email text,
  phone text,
  pax int not null check (pax between 1 and 50),
  funding text not null default 'self' check (funding in ('self','company','hrdcorp')),
  fee_total numeric(14,2),
  deposit_total numeric(14,2),
  deposit_invoice_id uuid,
  balance_invoice_id uuid,
  hold_until timestamptz,
  hrd_approval_no text,
  cancelled_at timestamptz,
  cancel_reason text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists prog_enrolments_prog_idx on public.prog_enrolments (tenant_id, programme_id) where deleted_at is null;
create unique index if not exists prog_enrolments_lead_uidx on public.prog_enrolments (lead_id) where lead_id is not null and deleted_at is null;

create table if not exists public.prog_participants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  programme_id uuid not null references public.prog_programmes(id),
  enrolment_id uuid not null references public.prog_enrolments(id),
  seq int not null default 1,
  public_token text not null,
  full_name_passport text check (full_name_passport is null or length(full_name_passport) <= 160),
  nationality text check (nationality is null or length(nationality) <= 80),
  email text check (email is null or length(email) <= 160),
  phone text check (phone is null or length(phone) <= 30),
  dietary text check (dietary is null or length(dietary) <= 300),
  room_pref text check (room_pref is null or length(room_pref) <= 300),
  emergency_name text check (emergency_name is null or length(emergency_name) <= 120),
  emergency_phone text check (emergency_phone is null or length(emergency_phone) <= 30),
  terms_accepted_at timestamptz,
  terms_version text,
  submitted_at timestamptz,
  eta_status text not null default 'pending' check (eta_status in ('pending','submitted','approved')),
  insurance_status text not null default 'pending' check (insurance_status in ('pending','confirmed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index if not exists prog_participants_token_uidx on public.prog_participants (public_token);
create index if not exists prog_participants_enr_idx on public.prog_participants (tenant_id, enrolment_id) where deleted_at is null;

alter table public.prog_enrolments enable row level security;
alter table public.prog_participants enable row level security;
do $pol$
declare t text;
begin
  foreach t in array array['prog_enrolments','prog_participants'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('create policy %I on public.%I for select to authenticated using (tenant_id = public.get_my_tenant_id())', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (tenant_id = public.get_my_tenant_id() and public.prog__can(''crm''))', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('create policy %I on public.%I for update to authenticated using (tenant_id = public.get_my_tenant_id() and public.prog__can(''crm'')) with check (tenant_id = public.get_my_tenant_id() and public.prog__can(''crm''))', t || '_update', t);
    execute format('drop policy if exists platform_admin_all on public.%I', t);
    execute format('create policy platform_admin_all on public.%I for all to authenticated using (public.prog__is_pa()) with check (public.prog__is_pa())', t);
  end loop;
end $pol$;

-- staff: convert a lead into an enrolment (payer + pax + funding) and create one registration link per participant
create or replace function public.prog_create_enrolment(
  p_lead uuid, p_payer_name text, p_payer_type text, p_pax int, p_funding text, p_email text default null, p_phone text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare l public.prog_leads%rowtype; v_id uuid; i int;
begin
  select * into l from public.prog_leads where id = p_lead and deleted_at is null for update;
  if not found then raise exception 'lead not found'; end if;
  perform public.prog__guard(l.tenant_id, 'crm');
  if l.stage in ('won', 'lost') then raise exception 'lead is closed'; end if;
  if p_pax is null or p_pax < 1 or p_pax > 50 then raise exception 'invalid pax'; end if;
  if p_funding not in ('self','company','hrdcorp') then raise exception 'invalid funding'; end if;
  if p_payer_type not in ('individual','company') then raise exception 'invalid payer type'; end if;
  if length(trim(coalesce(p_payer_name, ''))) < 2 then raise exception 'payer name required'; end if;

  insert into public.prog_enrolments (tenant_id, programme_id, lead_id, payer_name, payer_type, email, phone, pax, funding, created_by)
  values (l.tenant_id, l.programme_id, l.id, left(trim(p_payer_name), 160), p_payer_type,
          lower(nullif(trim(coalesce(p_email, l.email, '')), '')), nullif(trim(coalesce(p_phone, l.phone, '')), ''),
          p_pax, p_funding, auth.uid())
  returning id into v_id;

  for i in 1..p_pax loop
    insert into public.prog_participants (tenant_id, programme_id, enrolment_id, seq, public_token)
    values (l.tenant_id, l.programme_id, v_id, i,
            replace(gen_random_uuid()::text, '-', '') || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  end loop;

  update public.prog_leads set stage = 'won', updated_at = now() where id = l.id;
  insert into public.prog_lead_activities (tenant_id, lead_id, type, notes, from_stage, to_stage, user_id)
  values (l.tenant_id, l.id, 'stage', 'Enrolment created · ' || p_pax || ' pax · ' || p_funding, l.stage, 'won', auth.uid());
  return jsonb_build_object('ok', true, 'enrolment_id', v_id);
end;
$fn$;
revoke all on function public.prog_create_enrolment(uuid, text, text, int, text, text, text) from public;
grant execute on function public.prog_create_enrolment(uuid, text, text, int, text, text, text) to authenticated;

-- public registration page (?prog_reg=TOKEN)
create or replace function public.get_prog_registration(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare p public.prog_participants%rowtype; pg public.prog_programmes%rowtype; e public.prog_enrolments%rowtype; tn public.tenants%rowtype;
begin
  if p_token is null or length(trim(p_token)) < 24 then return null; end if;
  select * into p from public.prog_participants where public_token = trim(p_token) and deleted_at is null;
  if not found then return null; end if;
  select * into e from public.prog_enrolments where id = p.enrolment_id;
  if e.deleted_at is not null or e.cancelled_at is not null then return null; end if;
  select * into pg from public.prog_programmes where id = p.programme_id;
  select * into tn from public.tenants where id = p.tenant_id;
  return jsonb_build_object(
    'tenant_name', tn.name, 'logo_url', tn.logo_url,
    'programme', pg.name, 'starts_on', pg.starts_on, 'ends_on', pg.ends_on,
    'terms_url', pg.terms_url, 'terms_version', pg.terms_version,
    'seq', p.seq, 'pax', e.pax, 'payer_name', e.payer_name,
    'full_name_passport', p.full_name_passport, 'nationality', p.nationality, 'email', p.email, 'phone', p.phone,
    'dietary', p.dietary, 'room_pref', p.room_pref, 'emergency_name', p.emergency_name, 'emergency_phone', p.emergency_phone,
    'submitted_at', p.submitted_at, 'locked', (pg.starts_on is not null and current_date >= pg.starts_on)
  );
end;
$fn$;

create or replace function public.submit_prog_registration(p_token text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare p public.prog_participants%rowtype; pg public.prog_programmes%rowtype; e public.prog_enrolments%rowtype;
  v_name text; v_nat text; v_email text; v_phone text; v_en text; v_ep text;
begin
  if p_token is null or length(trim(p_token)) < 24 then raise exception 'invalid link'; end if;
  select * into p from public.prog_participants where public_token = trim(p_token) and deleted_at is null for update;
  if not found then raise exception 'invalid link'; end if;
  select * into e from public.prog_enrolments where id = p.enrolment_id;
  if e.deleted_at is not null or e.cancelled_at is not null then raise exception 'invalid link'; end if;
  select * into pg from public.prog_programmes where id = p.programme_id;
  if pg.starts_on is not null and current_date >= pg.starts_on then raise exception 'registration closed'; end if;
  if pg.terms_url is null or length(trim(pg.terms_url)) < 8 then raise exception 'terms not published'; end if;
  if coalesce(p_payload->>'terms', '') not in ('true', '1', 'yes') then raise exception 'terms required'; end if;

  v_name := nullif(trim(coalesce(p_payload->>'full_name_passport', '')), '');
  v_nat  := nullif(trim(coalesce(p_payload->>'nationality', '')), '');
  v_email := lower(nullif(trim(coalesce(p_payload->>'email', '')), ''));
  v_phone := nullif(trim(coalesce(p_payload->>'phone', '')), '');
  v_en := nullif(trim(coalesce(p_payload->>'emergency_name', '')), '');
  v_ep := nullif(trim(coalesce(p_payload->>'emergency_phone', '')), '');
  if v_name is null or length(v_name) < 2 or length(v_name) > 160 then raise exception 'name required'; end if;
  if v_nat is null or length(v_nat) > 80 then raise exception 'nationality required'; end if;
  if v_email is null or v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' then raise exception 'email invalid'; end if;
  if v_phone is null or length(regexp_replace(v_phone, '\D', '', 'g')) < 8 or length(v_phone) > 30 then raise exception 'phone invalid'; end if;
  if v_en is null or length(v_en) > 120 then raise exception 'emergency contact required'; end if;
  if v_ep is null or length(regexp_replace(v_ep, '\D', '', 'g')) < 8 or length(v_ep) > 30 then raise exception 'emergency phone invalid'; end if;

  update public.prog_participants set
    full_name_passport = v_name, nationality = v_nat, email = v_email, phone = v_phone,
    dietary = left(nullif(trim(coalesce(p_payload->>'dietary', '')), ''), 300),
    room_pref = left(nullif(trim(coalesce(p_payload->>'room_pref', '')), ''), 300),
    emergency_name = v_en, emergency_phone = v_ep,
    terms_accepted_at = now(), terms_version = coalesce(pg.terms_version, pg.terms_url),
    submitted_at = now(), updated_at = now()
  where id = p.id;
  return jsonb_build_object('ok', true);
end;
$fn$;
revoke all on function public.get_prog_registration(text) from public;
revoke all on function public.submit_prog_registration(text, jsonb) from public;
grant execute on function public.get_prog_registration(text) to anon, authenticated;
grant execute on function public.submit_prog_registration(text, jsonb) to anon, authenticated;

do $rd$
begin
  if exists (select 1 from public.dev_roadmap_items where title = 'Programme LSP · Phase 3: participant registration') then
    update public.dev_roadmap_items set stage = 'completed', module = 'crm' where title = 'Programme LSP · Phase 3: participant registration';
  else
    insert into public.dev_roadmap_items (title, description, module, stage)
    values ('Programme LSP · Phase 3: participant registration',
      'Lead → enrolment (payer, pax, funding) with one public registration link per participant (?prog_reg=TOKEN): passport name, nationality, contact, diet, room, emergency contact, T&C acceptance stored with version + time. Needs programme T&C URL.',
      'crm', 'completed');
  end if;
exception when undefined_column or undefined_table then raise notice 'dev_roadmap skip: %', sqlerrm;
end $rd$;

notify pgrst, 'reload schema';

-- ================================================================
-- supabase/prog_lsp_04_invoice_payment.sql
-- ================================================================
-- Programme Lead -> Sales -> Payment · Phase 4-5: deposit invoice, seat hold, payment (manual transfer / QR via existing proof flow), HRD Corp
-- WRITE-ONLY: run after prog_lsp_03_registration.sql. Rerun-safe.
-- Invoices are issued by the programme tenant (seller). Self/company payers see the collection agent's account
-- (invoice-level override); HRD Corp invoices keep the tenant's own account. Payment proof reuses payment_claims
-- (public invoice link → upload receipt → Payments to review → Verify) with no change.

-- 1) programme money settings (all optional; nothing is assumed)
alter table public.prog_programmes add column if not exists deposit_per_pax numeric(14,2) check (deposit_per_pax is null or deposit_per_pax >= 0);
alter table public.prog_programmes add column if not exists balance_due_on date;
alter table public.prog_programmes add column if not exists capacity int check (capacity is null or capacity > 0);
alter table public.prog_programmes add column if not exists hold_days int not null default 7 check (hold_days between 1 and 60);
alter table public.prog_programmes add column if not exists hrd_hold_days int not null default 30 check (hrd_hold_days between 1 and 120);
alter table public.prog_programmes add column if not exists pay_bank_name text;
alter table public.prog_programmes add column if not exists pay_account_name text;
alter table public.prog_programmes add column if not exists pay_account_number text;
alter table public.prog_programmes add column if not exists pay_qr_url text;
alter table public.prog_programmes add column if not exists pay_note text;

-- 2) invoice-level payment account (null = tenant default, unchanged for every other invoice)
alter table public.invoices add column if not exists pay_bank_name text;
alter table public.invoices add column if not exists pay_account_name text;
alter table public.invoices add column if not exists pay_account_number text;
alter table public.invoices add column if not exists pay_qr_url text;
alter table public.invoices add column if not exists pay_note text;

-- 3) public invoice: same output as before + invoice override + pay_note
CREATE OR REPLACE FUNCTION public.get_public_invoice(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv invoices%ROWTYPE;
  items jsonb;
  tn tenants%ROWTYPE;
  cp jsonb;
  ovr boolean;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) < 8 THEN
    RAISE EXCEPTION 'Invalid token';
  END IF;
  SELECT * INTO inv FROM invoices WHERE public_token = trim(p_token) AND deleted_at IS NULL LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;
  SELECT * INTO tn FROM tenants WHERE id = inv.tenant_id;
  cp := coalesce(tn.config->'company_profile', '{}'::jsonb);
  ovr := nullif(trim(coalesce(inv.pay_account_number, '')), '') IS NOT NULL;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'description', description,
    'qty', qty,
    'unit_price', unit_price,
    'line_total', line_total
  ) ORDER BY created_at), '[]'::jsonb)
  INTO items
  FROM invoice_items WHERE invoice_id = inv.id;

  RETURN jsonb_build_object(
    'tenant_name', coalesce(nullif(tn.name,''), cp->>'name'),
    'logo_url', coalesce(nullif(tn.logo_url,''), cp->>'logo_url'),
    'payment_qr_url', CASE WHEN ovr THEN nullif(inv.pay_qr_url,'') ELSE coalesce(nullif(tn.payment_qr_url,''), cp->>'payment_qr_url') END,
    'ssm_no', coalesce(nullif(tn.ssm_no,''), cp->>'ssm_no'),
    'address', coalesce(nullif(tn.address,''), cp->>'address'),
    'address_line2', coalesce(nullif(tn.address_line2,''), cp->>'address_line2'),
    'city', coalesce(nullif(tn.city,''), cp->>'city'),
    'postcode', coalesce(nullif(tn.postcode,''), cp->>'postcode'),
    'state', coalesce(nullif(tn.state,''), cp->>'state'),
    'phone', coalesce(nullif(tn.phone,''), cp->>'phone'),
    'email', coalesce(nullif(tn.email,''), cp->>'email'),
    'bank_name', CASE WHEN ovr THEN inv.pay_bank_name ELSE coalesce(nullif(tn.bank_name,''), cp->>'bank_name') END,
    'account_name', CASE WHEN ovr THEN inv.pay_account_name ELSE coalesce(nullif(tn.account_name,''), cp->>'account_name') END,
    'account_number', CASE WHEN ovr THEN inv.pay_account_number ELSE coalesce(nullif(tn.account_number,''), cp->>'account_number') END,
    'pay_note', nullif(trim(coalesce(inv.pay_note, '')), ''),
    'ref_no', inv.ref_no,
    'issue_date', inv.issue_date,
    'due_date', inv.due_date,
    'customer_name', inv.customer_name,
    'subtotal', inv.subtotal,
    'tax_rate', inv.tax_rate,
    'tax_amt', inv.tax_amt,
    'total', inv.total,
    'paid_amt', inv.paid_amt,
    'status', inv.status,
    'items', items
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_public_invoice(text) TO anon, authenticated;

-- 4) one status for every enrolment, computed from its invoices (no stored status → no drift / double count)
--    draft: no invoice yet · held: deposit unpaid, hold running · verifying: receipt waiting for review
--    hrd_pending: HRD Corp invoice, approval not in yet · confirmed: deposit paid (or HRD approval no.)
--    paid_full: total paid >= programme fee · expired: hold ran out unpaid · cancelled
drop view if exists public.prog_enrolments_v;
create view public.prog_enrolments_v with (security_invoker = true) as
select e.*,
  di.ref_no as dep_ref, di.total as dep_total, coalesce(di.paid_amt, 0) as dep_paid, di.status as dep_status, di.public_token as dep_token, di.due_date as dep_due,
  bi.ref_no as bal_ref, bi.total as bal_total, coalesce(bi.paid_amt, 0) as bal_paid, bi.status as bal_status, bi.public_token as bal_token, bi.due_date as bal_due,
  (select count(*) from public.payment_claims c where c.tenant_id = e.tenant_id and c.deleted_at is null and c.status = 'pending'
     and c.invoice_id in (e.deposit_invoice_id, e.balance_invoice_id)) as claims_pending,
  (select count(*) from public.prog_participants p where p.enrolment_id = e.id and p.deleted_at is null and p.submitted_at is not null) as registered,
  case
    when e.cancelled_at is not null then 'cancelled'
    when e.deposit_invoice_id is null then 'draft'
    when coalesce(di.paid_amt, 0) + coalesce(bi.paid_amt, 0) >= coalesce(e.fee_total, 0) - 0.005 and coalesce(e.fee_total, 0) > 0 then 'paid_full'
    when e.funding = 'hrdcorp' and nullif(trim(coalesce(e.hrd_approval_no, '')), '') is not null then 'confirmed'
    when e.funding <> 'hrdcorp' and coalesce(di.paid_amt, 0) >= coalesce(di.total, 0) - 0.005 then 'confirmed'
    when exists (select 1 from public.payment_claims c where c.tenant_id = e.tenant_id and c.deleted_at is null and c.status = 'pending' and c.invoice_id = e.deposit_invoice_id) then 'verifying'
    when e.hold_until > now() then case when e.funding = 'hrdcorp' then 'hrd_pending' else 'held' end
    else 'expired'
  end as status
from public.prog_enrolments e
left join public.invoices di on di.id = e.deposit_invoice_id and di.tenant_id = e.tenant_id
left join public.invoices bi on bi.id = e.balance_invoice_id and bi.tenant_id = e.tenant_id
where e.deleted_at is null;
grant select on public.prog_enrolments_v to authenticated;

-- seats: everything except draft / expired / cancelled holds a seat
create or replace function public.prog_seats(p_programme uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare pg public.prog_programmes%rowtype; v_used int; v_conf int; v_hold int;
begin
  select * into pg from public.prog_programmes where id = p_programme and deleted_at is null;
  if not found then raise exception 'programme not found'; end if;
  perform public.prog__guard(pg.tenant_id, 'crm');
  select coalesce(sum(pax) filter (where status in ('confirmed','paid_full')), 0),
         coalesce(sum(pax) filter (where status in ('held','verifying','hrd_pending')), 0)
    into v_conf, v_hold
    from public.prog_enrolments_v where programme_id = pg.id;
  v_used := v_conf + v_hold;
  return jsonb_build_object('capacity', pg.capacity, 'confirmed', v_conf, 'held', v_hold, 'used', v_used,
    'available', case when pg.capacity is null then null else greatest(pg.capacity - v_used, 0) end);
end;
$fn$;
revoke all on function public.prog_seats(uuid) from public;
grant execute on function public.prog_seats(uuid) to authenticated;

-- internal: create one programme invoice (tenant series ref, public link token, agent account unless HRD Corp)
create or replace function public.prog__make_invoice(e public.prog_enrolments, pg public.prog_programmes, p_total numeric, p_due date, p_desc text)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare v_ref text; v_tok text; v_inv uuid; v_agent boolean;
begin
  if pg.tenant_id = public.get_my_tenant_id() then
    begin v_ref := public.next_ref_no('INV'); exception when others then v_ref := null; end;
  end if;
  if v_ref is null or length(trim(v_ref)) < 3 then
    v_ref := 'INV-PRG-' || to_char(now() at time zone 'Asia/Kuala_Lumpur', 'YYYYMMDD') || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  end if;
  v_tok := replace(gen_random_uuid()::text, '-', '') || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
  v_agent := e.funding <> 'hrdcorp' and nullif(trim(coalesce(pg.pay_account_number, '')), '') is not null;
  insert into public.invoices (
    tenant_id, customer_id, customer_name, ref_no, issue_date, due_date,
    subtotal, tax_rate, tax_amt, total, paid_amt, status, notes, public_token,
    pay_bank_name, pay_account_name, pay_account_number, pay_qr_url, pay_note
  ) values (
    pg.tenant_id, e.customer_id, e.payer_name, v_ref, (now() at time zone 'Asia/Kuala_Lumpur')::date, p_due,
    p_total, 0, 0, p_total, 0, 'unpaid', pg.code || ' · ' || p_desc, v_tok,
    case when v_agent then pg.pay_bank_name end, case when v_agent then pg.pay_account_name end,
    case when v_agent then pg.pay_account_number end, case when v_agent then pg.pay_qr_url end,
    case when v_agent then pg.pay_note end
  ) returning id into v_inv;
  begin
    insert into public.invoice_items (tenant_id, invoice_id, description, qty, unit_price, line_total)
    values (pg.tenant_id, v_inv, pg.name || ' — ' || p_desc, e.pax, round(p_total / e.pax, 2), p_total);
  exception when undefined_column then
    insert into public.invoice_items (invoice_id, description, qty, unit_price, line_total)
    values (v_inv, pg.name || ' — ' || p_desc, e.pax, round(p_total / e.pax, 2), p_total);
  end;
  return v_inv;
end;
$fn$;
revoke all on function public.prog__make_invoice(public.prog_enrolments, public.prog_programmes, numeric, date, text) from public;

-- staff: issue the first invoice and hold the seats (atomic capacity check)
--   self/company: deposit_per_pax x pax (or full fee when no deposit is set), hold = hold_days
--   hrdcorp:      full fee x pax on the tenant's own account, hold = hrd_hold_days, confirmed by approval no.
create or replace function public.prog_issue_deposit(p_enrolment uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare e public.prog_enrolments%rowtype; pg public.prog_programmes%rowtype; v_used int; v_fee numeric; v_amt numeric;
  v_hold timestamptz; v_inv uuid; v_cust uuid; v_code text; v_desc text;
begin
  select * into e from public.prog_enrolments where id = p_enrolment and deleted_at is null for update;
  if not found then raise exception 'enrolment not found'; end if;
  perform public.prog__guard(e.tenant_id, 'sales');
  if e.cancelled_at is not null then raise exception 'enrolment cancelled'; end if;
  if e.deposit_invoice_id is not null then raise exception 'invoice already issued'; end if;
  select * into pg from public.prog_programmes where id = e.programme_id and deleted_at is null for update;
  if coalesce(pg.fee_per_pax, 0) <= 0 then raise exception 'programme fee not set'; end if;

  if pg.capacity is not null then
    select coalesce(sum(pax), 0) into v_used from public.prog_enrolments_v
     where programme_id = pg.id and status in ('held','verifying','hrd_pending','confirmed','paid_full');
    if v_used + e.pax > pg.capacity then raise exception 'not enough seats'; end if;
  end if;

  -- customer: reuse by email in this tenant, else create (same pattern as public booking)
  if e.email is not null then
    select id into v_cust from public.customers where tenant_id = e.tenant_id and deleted_at is null and lower(email) = lower(e.email) limit 1;
  end if;
  if v_cust is null then
    if e.tenant_id = public.get_my_tenant_id() then
      begin v_code := public.next_ref_no('CUST'); exception when others then v_code := null; end;
    end if;
    if v_code is null or length(trim(v_code)) < 3 then v_code := 'CUST-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)); end if;
    insert into public.customers (tenant_id, code, name, email, phone)
    values (e.tenant_id, v_code, e.payer_name, e.email, e.phone) returning id into v_cust;
    begin update public.customers set source = 'Programme ' || pg.code where id = v_cust; exception when undefined_column then null; end;
  end if;
  e.customer_id := v_cust;

  v_fee := round(pg.fee_per_pax * e.pax, 2);
  if e.funding = 'hrdcorp' then
    v_amt := v_fee; v_hold := now() + make_interval(days => pg.hrd_hold_days); v_desc := 'Programme fee (HRD Corp)';
  elsif coalesce(pg.deposit_per_pax, 0) > 0 and pg.deposit_per_pax < pg.fee_per_pax then
    v_amt := round(pg.deposit_per_pax * e.pax, 2); v_hold := now() + make_interval(days => pg.hold_days); v_desc := 'Deposit';
  else
    v_amt := v_fee; v_hold := now() + make_interval(days => pg.hold_days); v_desc := 'Programme fee';
  end if;
  v_inv := public.prog__make_invoice(e, pg, v_amt, (v_hold at time zone 'Asia/Kuala_Lumpur')::date, v_desc || ' (' || e.pax || ' pax)');

  update public.prog_enrolments set customer_id = v_cust, fee_total = v_fee, deposit_total = v_amt,
    deposit_invoice_id = v_inv, hold_until = v_hold, updated_at = now() where id = e.id;
  update public.prog_leads set customer_id = v_cust, updated_at = now() where id = e.lead_id;
  return jsonb_build_object('ok', true, 'invoice_id', v_inv, 'amount', v_amt, 'hold_until', v_hold);
end;
$fn$;
revoke all on function public.prog_issue_deposit(uuid) from public;
grant execute on function public.prog_issue_deposit(uuid) to authenticated;

-- staff: extend a running/expired hold (capacity re-checked when the hold had expired)
create or replace function public.prog_extend_hold(p_enrolment uuid, p_days int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare v public.prog_enrolments_v%rowtype; pg public.prog_programmes%rowtype; v_used int; v_new timestamptz;
begin
  select * into v from public.prog_enrolments_v where id = p_enrolment;
  if not found then raise exception 'enrolment not found'; end if;
  perform public.prog__guard(v.tenant_id, 'sales');
  if p_days is null or p_days < 1 or p_days > 60 then raise exception 'invalid days'; end if;
  if v.status not in ('held','hrd_pending','expired','verifying') then raise exception 'nothing to extend'; end if;
  select * into pg from public.prog_programmes where id = v.programme_id for update;
  if v.status = 'expired' and pg.capacity is not null then
    select coalesce(sum(pax), 0) into v_used from public.prog_enrolments_v
     where programme_id = pg.id and status in ('held','verifying','hrd_pending','confirmed','paid_full');
    if v_used + v.pax > pg.capacity then raise exception 'not enough seats'; end if;
  end if;
  v_new := greatest(coalesce(v.hold_until, now()), now()) + make_interval(days => p_days);
  update public.prog_enrolments set hold_until = v_new, updated_at = now() where id = v.id;
  update public.invoices set due_date = (v_new at time zone 'Asia/Kuala_Lumpur')::date, updated_at = now()
   where id = v.deposit_invoice_id and tenant_id = v.tenant_id and status = 'unpaid';
  return jsonb_build_object('ok', true, 'hold_until', v_new);
end;
$fn$;
revoke all on function public.prog_extend_hold(uuid, int) from public;
grant execute on function public.prog_extend_hold(uuid, int) to authenticated;

-- staff: HRD Corp grant approval number -> confirmed
create or replace function public.prog_set_hrd_approval(p_enrolment uuid, p_no text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare e public.prog_enrolments%rowtype;
begin
  select * into e from public.prog_enrolments where id = p_enrolment and deleted_at is null for update;
  if not found then raise exception 'enrolment not found'; end if;
  perform public.prog__guard(e.tenant_id, 'sales');
  if e.funding <> 'hrdcorp' then raise exception 'not an HRD Corp enrolment'; end if;
  update public.prog_enrolments set hrd_approval_no = left(nullif(trim(coalesce(p_no, '')), ''), 80), updated_at = now() where id = e.id;
  return jsonb_build_object('ok', true);
end;
$fn$;
revoke all on function public.prog_set_hrd_approval(uuid, text) from public;
grant execute on function public.prog_set_hrd_approval(uuid, text) to authenticated;

-- staff: cancel an enrolment (frees seats; unpaid programme invoices are cancelled, paid ones are left for refund handling)
create or replace function public.prog_cancel_enrolment(p_enrolment uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare e public.prog_enrolments%rowtype;
begin
  select * into e from public.prog_enrolments where id = p_enrolment and deleted_at is null for update;
  if not found then raise exception 'enrolment not found'; end if;
  perform public.prog__guard(e.tenant_id, 'sales');
  if e.cancelled_at is not null then return jsonb_build_object('ok', true); end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'reason required'; end if;
  update public.prog_enrolments set cancelled_at = now(), cancel_reason = left(trim(p_reason), 500), updated_at = now() where id = e.id;
  update public.invoices set status = 'cancelled', updated_at = now()
   where tenant_id = e.tenant_id and id in (e.deposit_invoice_id, e.balance_invoice_id)
     and coalesce(paid_amt, 0) = 0 and status = 'unpaid';
  return jsonb_build_object('ok', true);
end;
$fn$;
revoke all on function public.prog_cancel_enrolment(uuid, text) from public;
grant execute on function public.prog_cancel_enrolment(uuid, text) to authenticated;

do $rd$
begin
  if exists (select 1 from public.dev_roadmap_items where title = 'Programme LSP · Phase 4-5: deposit invoice, seat hold, payment') then
    update public.dev_roadmap_items set stage = 'completed', module = 'sales' where title = 'Programme LSP · Phase 4-5: deposit invoice, seat hold, payment';
  else
    insert into public.dev_roadmap_items (title, description, module, stage)
    values ('Programme LSP · Phase 4-5: deposit invoice, seat hold, payment',
      'Deposit (or full-fee) invoice per enrolment with atomic seat HOLD; invoice-level collection-agent bank/QR + note (public link, print); manual transfer/QR proof via existing Payments to review; HRD Corp path (full fee, tenant own account, confirmed by approval no.); extend hold; cancel; status computed from invoices (prog_enrolments_v).',
      'sales', 'completed');
  end if;
exception when undefined_column or undefined_table then raise notice 'dev_roadmap skip: %', sqlerrm;
end $rd$;

notify pgrst, 'reload schema';

-- ================================================================
-- supabase/prog_lsp_05_confirm_balance_settle.sql
-- ================================================================
-- Programme Lead -> Sales -> Payment · Phase 6-7: confirmation, balance invoice + reminders, weekly settlement
-- WRITE-ONLY: run after prog_lsp_04_invoice_payment.sql. Rerun-safe.

-- 1) confirmation letter templates (written by the organiser; placeholders {payer} {pax} {programme} {dates} {ref})
alter table public.prog_programmes add column if not exists confirm_letter_en text;
alter table public.prog_programmes add column if not exists confirm_letter_bm text;

-- 2) balance invoice: only after the deposit is fully paid, due on the programme balance date
create or replace function public.prog_issue_balance(p_enrolment uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare e public.prog_enrolments%rowtype; pg public.prog_programmes%rowtype; di public.invoices%rowtype; v_amt numeric; v_inv uuid;
begin
  select * into e from public.prog_enrolments where id = p_enrolment and deleted_at is null for update;
  if not found then raise exception 'enrolment not found'; end if;
  perform public.prog__guard(e.tenant_id, 'sales');
  if e.cancelled_at is not null then raise exception 'enrolment cancelled'; end if;
  if e.funding = 'hrdcorp' then raise exception 'HRD Corp enrolments have one invoice'; end if;
  if e.balance_invoice_id is not null then raise exception 'balance invoice already issued'; end if;
  select * into di from public.invoices where id = e.deposit_invoice_id and tenant_id = e.tenant_id;
  if not found then raise exception 'deposit invoice not issued'; end if;
  if coalesce(di.paid_amt, 0) < coalesce(di.total, 0) - 0.005 then raise exception 'deposit not paid'; end if;
  v_amt := round(coalesce(e.fee_total, 0) - coalesce(e.deposit_total, 0), 2);
  if v_amt <= 0 then raise exception 'no balance'; end if;
  select * into pg from public.prog_programmes where id = e.programme_id;
  if pg.balance_due_on is null then raise exception 'balance due date not set'; end if;
  v_inv := public.prog__make_invoice(e, pg, v_amt, pg.balance_due_on, 'Balance (' || e.pax || ' pax)');
  update public.prog_enrolments set balance_invoice_id = v_inv, updated_at = now() where id = e.id;
  return jsonb_build_object('ok', true, 'invoice_id', v_inv, 'amount', v_amt);
end;
$fn$;
revoke all on function public.prog_issue_balance(uuid) from public;
grant execute on function public.prog_issue_balance(uuid) to authenticated;

-- 3) daily 09:05 MYT: balance invoice unpaid and due in 14 / 7 / 3 days -> owner/admin alert with invoice deep link
create or replace function public.prog_cron_balance_remind()
returns int
language plpgsql
security definer
set search_path = public
as $fn$
declare n int := 0; v_today date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
begin
  with due as (
    select e.tenant_id, e.payer_name, i.id as invoice_id, i.ref_no, i.total - coalesce(i.paid_amt, 0) as bal, i.due_date - v_today as days
    from public.prog_enrolments e
    join public.invoices i on i.id = e.balance_invoice_id and i.tenant_id = e.tenant_id
    where e.deleted_at is null and e.cancelled_at is null and i.deleted_at is null
      and i.status in ('unpaid', 'partial') and i.due_date - v_today in (14, 7, 3)
  ), ins as (
    insert into public.notifications (tenant_id, user_id, title, body, category, kind, type, priority, link, ref_table, ref_id)
    select d.tenant_id, u.id,
      case when u.language = 'bm' then 'Baki program perlu dibayar dalam ' || d.days || ' hari: ' || d.ref_no
           else 'Programme balance due in ' || d.days || ' days: ' || d.ref_no end,
      concat_ws(' · ', d.payer_name, 'RM ' || to_char(d.bal, 'FM999,999,990.00')),
      'sales', 'action', 'sales.programme_balance_due', case when d.days <= 3 then 2 else 1 end,
      jsonb_build_object('page', 'sales', 'params', jsonb_build_object('view', 'inv-detail', 'id', d.invoice_id::text)),
      'invoices', d.invoice_id::text
    from due d
    join public.user_profiles u on u.tenant_id = d.tenant_id and coalesce(u.is_active, true)
     and lower(coalesce(u.role, '')) in ('owner', 'admin')
    returning 1
  )
  select count(*) into n from ins;
  return n;
end;
$fn$;
revoke all on function public.prog_cron_balance_remind() from public;

-- 4) settlement: collection agent -> programme tenant, weekly. One allocation can be settled once only.
create table if not exists public.prog_settlements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  programme_id uuid not null references public.prog_programmes(id),
  period_to date not null,
  amount numeric(14,2) not null check (amount > 0),
  settled_on date not null,
  bank_ref text check (bank_ref is null or length(bank_ref) <= 80),
  note text check (note is null or length(note) <= 500),
  created_by uuid,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create table if not exists public.prog_settlement_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  settlement_id uuid not null references public.prog_settlements(id),
  allocation_id uuid not null,
  invoice_id uuid not null,
  payment_id uuid,
  amount numeric(14,2) not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index if not exists prog_settlement_items_alloc_uidx on public.prog_settlement_items (allocation_id) where deleted_at is null;
create index if not exists prog_settlements_prog_idx on public.prog_settlements (tenant_id, programme_id) where deleted_at is null;

alter table public.prog_settlements enable row level security;
alter table public.prog_settlement_items enable row level security;
do $pol$
declare t text;
begin
  foreach t in array array['prog_settlements','prog_settlement_items'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('create policy %I on public.%I for select to authenticated using (tenant_id = public.get_my_tenant_id())', t || '_select', t);
    execute format('drop policy if exists platform_admin_all on public.%I', t);
    execute format('create policy platform_admin_all on public.%I for all to authenticated using (public.prog__is_pa()) with check (public.prog__is_pa())', t);
  end loop;
end $pol$;
-- writes only through prog_settle (no insert/update policy for normal users)

-- payments received through the agent account and not yet settled (per invoice allocation, not per payment → no double count)
create or replace function public.prog_unsettled(p_programme uuid, p_to date default null)
returns table (allocation_id uuid, invoice_id uuid, invoice_ref text, payer_name text, payment_id uuid, payment_date date, payment_method text, payment_ref text, amount numeric)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare pg public.prog_programmes%rowtype;
begin
  select * into pg from public.prog_programmes where id = p_programme and deleted_at is null;
  if not found then raise exception 'programme not found'; end if;
  perform public.prog__guard(pg.tenant_id, 'sales');
  return query
  select a.id, i.id, i.ref_no, e.payer_name, p.id, p.payment_date, p.payment_method, p.ref_no, a.amount::numeric
  from public.prog_enrolments e
  join public.invoices i on i.tenant_id = e.tenant_id and i.id in (e.deposit_invoice_id, e.balance_invoice_id)
  join public.payment_allocations a on a.invoice_id = i.id and a.tenant_id = e.tenant_id
  left join public.payments p on p.id = a.payment_id and p.tenant_id = e.tenant_id
  where e.programme_id = pg.id and e.deleted_at is null and e.funding <> 'hrdcorp'
    and nullif(trim(coalesce(i.pay_account_number, '')), '') is not null
    and coalesce(a.amount, 0) > 0
    and (p_to is null or p.payment_date is null or p.payment_date <= p_to)
    and not exists (select 1 from public.prog_settlement_items s where s.allocation_id = a.id and s.deleted_at is null)
  order by p.payment_date nulls last, i.ref_no;
end;
$fn$;
revoke all on function public.prog_unsettled(uuid, date) from public;
grant execute on function public.prog_unsettled(uuid, date) to authenticated;

create or replace function public.prog_settle(p_programme uuid, p_to date, p_settled_on date, p_bank_ref text, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare pg public.prog_programmes%rowtype; v_id uuid; v_amt numeric; v_n int;
begin
  select * into pg from public.prog_programmes where id = p_programme and deleted_at is null for update;
  if not found then raise exception 'programme not found'; end if;
  perform public.prog__guard(pg.tenant_id, 'sales');
  if p_to is null or p_settled_on is null then raise exception 'dates required'; end if;
  select coalesce(sum(u.amount), 0), count(*) into v_amt, v_n from public.prog_unsettled(pg.id, p_to) u;
  if v_n = 0 or v_amt <= 0 then raise exception 'nothing to settle'; end if;
  insert into public.prog_settlements (tenant_id, programme_id, period_to, amount, settled_on, bank_ref, note, created_by)
  values (pg.tenant_id, pg.id, p_to, v_amt, p_settled_on, left(nullif(trim(coalesce(p_bank_ref, '')), ''), 80), left(nullif(trim(coalesce(p_note, '')), ''), 500), auth.uid())
  returning id into v_id;
  insert into public.prog_settlement_items (tenant_id, settlement_id, allocation_id, invoice_id, payment_id, amount)
  select pg.tenant_id, v_id, u.allocation_id, u.invoice_id, u.payment_id, u.amount from public.prog_unsettled(pg.id, p_to) u;
  return jsonb_build_object('ok', true, 'settlement_id', v_id, 'amount', v_amt, 'items', v_n);
end;
$fn$;
revoke all on function public.prog_settle(uuid, date, date, text, text) from public;
grant execute on function public.prog_settle(uuid, date, date, text, text) to authenticated;

-- 5) Friday 09:15 MYT: unsettled agent collections -> owner/admin alert
create or replace function public.prog_cron_settle_remind()
returns int
language plpgsql
security definer
set search_path = public
as $fn$
declare n int := 0;
begin
  with t as (
    select pg.tenant_id, pg.id as programme_id, pg.code, sum(a.amount) as amt, count(*) as cnt
    from public.prog_programmes pg
    join public.prog_enrolments e on e.programme_id = pg.id and e.deleted_at is null and e.funding <> 'hrdcorp'
    join public.invoices i on i.tenant_id = e.tenant_id and i.id in (e.deposit_invoice_id, e.balance_invoice_id)
      and nullif(trim(coalesce(i.pay_account_number, '')), '') is not null
    join public.payment_allocations a on a.invoice_id = i.id and a.tenant_id = e.tenant_id and coalesce(a.amount, 0) > 0
    where pg.deleted_at is null
      and not exists (select 1 from public.prog_settlement_items s where s.allocation_id = a.id and s.deleted_at is null)
    group by pg.tenant_id, pg.id, pg.code
  ), ins as (
    insert into public.notifications (tenant_id, user_id, title, body, category, kind, type, priority, link, ref_table, ref_id)
    select t.tenant_id, u.id,
      case when u.language = 'bm' then 'Settlement mingguan: ' || t.code else 'Weekly settlement: ' || t.code end,
      case when u.language = 'bm' then t.cnt || ' bayaran belum diserah · RM ' || to_char(t.amt, 'FM999,999,990.00')
           else t.cnt || ' payments not settled · RM ' || to_char(t.amt, 'FM999,999,990.00') end,
      'sales', 'action', 'sales.programme_settlement', 1,
      jsonb_build_object('page', 'crm', 'params', jsonb_build_object('view', 'programmes', 'tab', 'settle')),
      'prog_programmes', t.programme_id::text
    from t
    join public.user_profiles u on u.tenant_id = t.tenant_id and coalesce(u.is_active, true)
     and lower(coalesce(u.role, '')) in ('owner', 'admin')
    where t.amt > 0
    returning 1
  )
  select count(*) into n from ins;
  return n;
end;
$fn$;
revoke all on function public.prog_cron_settle_remind() from public;

select cron.unschedule(jobid) from cron.job where jobname in ('mcore-prog-balance', 'mcore-prog-settle');
select cron.schedule('mcore-prog-balance', '5 1 * * *', 'select public.prog_cron_balance_remind()');
select cron.schedule('mcore-prog-settle', '15 1 * * 5', 'select public.prog_cron_settle_remind()');

do $rd$
begin
  if exists (select 1 from public.dev_roadmap_items where title = 'Programme LSP · Phase 6-7: confirmation, balance, settlement') then
    update public.dev_roadmap_items set stage = 'completed', module = 'sales' where title = 'Programme LSP · Phase 6-7: confirmation, balance, settlement';
  else
    insert into public.dev_roadmap_items (title, description, module, stage)
    values ('Programme LSP · Phase 6-7: confirmation, balance, settlement',
      'Confirmation letter from organiser template (EN/BM placeholders) + ETA/insurance checklist per participant; balance invoice after deposit paid (due = programme balance date); daily D-14/D-7/D-3 balance alerts; weekly settlement of agent collections (per allocation, settled once) + Friday reminder.',
      'sales', 'completed');
  end if;
exception when undefined_column or undefined_table then raise notice 'dev_roadmap skip: %', sqlerrm;
end $rd$;

notify pgrst, 'reload schema';
