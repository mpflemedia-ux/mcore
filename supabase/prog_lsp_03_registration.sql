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
