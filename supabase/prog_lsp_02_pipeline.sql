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
  if public.is_platform_admin() then return; end if;
  if p_tenant is null or p_tenant is distinct from public.get_my_tenant_id() then raise exception 'not allowed'; end if;
  if not public.has_module(p_module) then raise exception 'not allowed'; end if;
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
  with check (tenant_id = public.get_my_tenant_id() and public.has_module('crm'));
drop policy if exists prog_lead_activities_update on public.prog_lead_activities;
create policy prog_lead_activities_update on public.prog_lead_activities for update to authenticated
  using (tenant_id = public.get_my_tenant_id() and public.has_module('crm'))
  with check (tenant_id = public.get_my_tenant_id() and public.has_module('crm'));
drop policy if exists platform_admin_all on public.prog_lead_activities;
create policy platform_admin_all on public.prog_lead_activities for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

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
