-- M-Core Project <-> Planner (Nov 2026): Project = controller, Planner = mirror per ASSIGNEE (DB triggers, not page open),
-- two-way Complete (each assignee marks own part), My Work, 8 AM digest + overdue escalation, repeating manual todos, snooze.
-- WRITE-ONLY: run manually in Supabase SQL Editor. Idempotent (safe to re-run). Soft delete only. No new tables
-- (new columns on platform_activities only; existing tenant RLS platform_activities_tenant_all still applies).
-- Needs (already live): pj_multi_01.sql / pj_multi_02.sql (project_task_assignees.progress), notif_01 (notifications),
-- push_01/02 (push-send tick delivers new notification rows to phone), pg_cron.

-- ============ 1) platform_activities: mirror + repeat columns ============
alter table public.platform_activities add column if not exists project_task_id uuid;
alter table public.platform_activities add column if not exists project_employee_id uuid;
alter table public.platform_activities add column if not exists recur_rule text;
alter table public.platform_activities add column if not exists recur_until date;
alter table public.platform_activities add column if not exists recur_parent_id uuid;
alter table public.platform_activities add column if not exists recur_spawned_at timestamptz;
alter table public.platform_activities drop constraint if exists platform_activities_recur_rule_chk;
alter table public.platform_activities add constraint platform_activities_recur_rule_chk
  check (recur_rule is null or recur_rule in ('daily', 'weekdays', 'weekly', 'monthly'));

-- old client sync could race and make 2 live rows for the same task + person: keep the newest, soft-delete the rest
update public.platform_activities pa
set deleted_at = now(), status = case when pa.status = 'open' then 'cancelled' else pa.status end, updated_at = now()
from (select id, row_number() over (partition by project_task_id, owner_user_id order by updated_at desc nulls last, created_at desc) as rn
      from public.platform_activities where project_task_id is not null and deleted_at is null) d
where pa.id = d.id and d.rn > 1;

-- one live row per task was the old rule (viewer's uid); now one live row per task per assignee
drop index if exists public.platform_activities_project_task_idx;
create unique index if not exists platform_activities_task_owner_uq
  on public.platform_activities (project_task_id, owner_user_id) where project_task_id is not null and deleted_at is null;
create index if not exists platform_activities_owner_open_idx
  on public.platform_activities (tenant_id, owner_user_id, status) where deleted_at is null;
create index if not exists platform_activities_recur_idx
  on public.platform_activities (due_at) where recur_rule is not null and recur_spawned_at is null and deleted_at is null;

-- ============ 2) helpers ============
create or replace function public._mw_day()
returns date language sql stable set search_path = public as $$
  select (now() at time zone 'Asia/Kuala_Lumpur')::date
$$;

-- employee -> user_profiles.id (same rule as dk__emp_user / NT.userForEmp: user_id, email, auth email, unique full name)
create or replace function public._mw_emp_user(p_tid uuid, p_emp uuid)
returns uuid language plpgsql stable security definer set search_path = public as $$
declare e jsonb; u uuid; n int;
begin
  if p_tid is null or p_emp is null then return null; end if;
  select to_jsonb(x) into e from public.employees x where x.id = p_emp and x.tenant_id = p_tid;
  if e is null then return null; end if;
  if coalesce(e->>'user_id', '') <> '' then
    begin u := (e->>'user_id')::uuid; exception when others then u := null; end;
    if u is not null and exists (select 1 from public.user_profiles p where p.id = u and p.tenant_id = p_tid) then return u; end if;
    u := null;
  end if;
  if coalesce(trim(e->>'email'), '') <> '' then
    select p.id into u from public.user_profiles p where p.tenant_id = p_tid and lower(trim(to_jsonb(p)->>'email')) = lower(trim(e->>'email')) limit 1;
    if u is not null then return u; end if;
    begin
      execute 'select a.id from auth.users a join public.user_profiles p on p.id = a.id and p.tenant_id = $1 where lower(a.email) = lower($2) limit 1' into u using p_tid, trim(e->>'email');
    exception when others then u := null; end;
    if u is not null then return u; end if;
  end if;
  if coalesce(trim(e->>'name'), '') <> '' then
    select count(*), min(p.id::text)::uuid into n, u from public.user_profiles p where p.tenant_id = p_tid and lower(trim(p.full_name)) = lower(trim(e->>'name'));
    if n = 1 then return u; end if;
  end if;
  return null;
end;
$$;

-- task PIC = Owner (star) assignee, else project_tasks.assignee_employee_id -> user
create or replace function public._mw_task_pic(p_task uuid)
returns uuid language plpgsql stable security definer set search_path = public as $$
declare v_tid uuid; v_emp uuid;
begin
  select t.tenant_id, coalesce((select a.employee_id from public.project_task_assignees a
           where a.task_id = t.id and a.tenant_id = t.tenant_id and a.is_owner and a.deleted_at is null limit 1), t.assignee_employee_id)
    into v_tid, v_emp from public.project_tasks t where t.id = p_task;
  return public._mw_emp_user(v_tid, v_emp);
end;
$$;

-- bell (+ phone via push-send tick) through the existing DB helper dk__notify (language per user, actor never notified)
create or replace function public._mw_notify(p_tid uuid, p_users uuid[], p_actor uuid, p_title_en text, p_title_bm text,
  p_body_en text, p_body_bm text, p_type text, p_link jsonb, p_ref_table text, p_ref_id uuid, p_group text)
returns int language plpgsql security definer set search_path = public as $$
declare k int := 0;
begin
  if p_tid is null or p_users is null or cardinality(p_users) = 0 then return 0; end if;
  if to_regprocedure('public.dk__notify(uuid,text[],uuid[],uuid,text,text,text,text,text,jsonb,text,uuid,text)') is not null then
    return public.dk__notify(p_tid, null, p_users, p_actor, p_title_en, p_title_bm, p_body_en, p_body_bm, p_type, p_link, p_ref_table, p_ref_id, p_group);
  end if;
  insert into public.notifications (tenant_id, user_id, actor_id, title, body, category, kind, type, priority, link, ref_table, ref_id, group_key)
  select p_tid, u.id, p_actor,
    left(case when lower(coalesce(to_jsonb(u)->>'language', '')) = 'bm' then p_title_bm else p_title_en end, 200),
    left(case when lower(coalesce(to_jsonb(u)->>'language', '')) = 'bm' then p_body_bm else p_body_en end, 500),
    split_part(p_type, '.', 1), 'for_you', p_type, case when p_type ~ 'overdue$' then 1 else 0 end, p_link, p_ref_table, p_ref_id, p_group
  from public.user_profiles u
  where u.tenant_id = p_tid and u.id = any(p_users) and (p_actor is null or u.id <> p_actor);
  get diagnostics k = row_count;
  return k;
end;
$$;

-- next date of a repeat rule, never before p_today (missed periods skipped; same rule as Edge Function pj-auto)
create or replace function public._mw_next_date(p_d date, p_rule text, p_today date)
returns date language plpgsql immutable set search_path = public as $$
declare x date := p_d; n int := 0; anchor int;
begin
  if p_d is null or p_rule is null or p_rule not in ('daily', 'weekdays', 'weekly', 'monthly') then return null; end if;
  anchor := extract(day from p_d)::int;
  loop
    x := case p_rule
      when 'daily' then x + 1
      when 'weekly' then x + 7
      when 'weekdays' then x + case extract(isodow from x)::int when 5 then 3 when 6 then 2 else 1 end
      else (date_trunc('month', x) + interval '1 month')::date
           + (least(anchor, extract(day from (date_trunc('month', x) + interval '2 month' - interval '1 day'))::int) - 1)
    end;
    n := n + 1;
    exit when x >= p_today or n > 1000;
  end loop;
  return x;
end;
$$;

-- ============ 3) Phase A: mirror one project task into each assignee's Planner ============
create or replace function public._pj_planner_sync(p_task uuid)
returns void language plpgsql security definer set search_path = public as $$
declare t record; pr record; v_live boolean; v_due timestamptz; v_users uuid[] := '{}'; r record; v_uid uuid; v_status text; v_title text;
begin
  perform set_config('mcore.mw_sync', '1', true);
  select * into t from public.project_tasks where id = p_task;
  if t.id is null then
    update public.platform_activities set deleted_at = now(), status = case when status = 'open' then 'cancelled' else status end, updated_at = now()
     where project_task_id = p_task and deleted_at is null;
    perform set_config('mcore.mw_sync', '0', true);
    return;
  end if;
  select p.id, p.name, p.archived_at, p.deleted_at into pr from public.projects p where p.id = t.project_id and p.tenant_id = t.tenant_id;
  v_live := t.deleted_at is null and pr.id is not null and pr.deleted_at is null and t.due_date is not null;
  if v_live then
    v_due := ((t.due_date::text || ' ' || coalesce(nullif(left(to_jsonb(t)->>'due_time', 5), ''), '09:00'))::timestamp at time zone 'Asia/Kuala_Lumpur');
    v_title := left(coalesce(nullif(trim(t.title), ''), 'Task'), 500);
    for r in
      select x.employee_id, max(x.prog) as prog from (
        select a.employee_id, coalesce(a.progress, 0) as prog from public.project_task_assignees a
         where a.task_id = t.id and a.tenant_id = t.tenant_id and a.deleted_at is null
        union all
        select t.assignee_employee_id, null::int where t.assignee_employee_id is not null
      ) x group by x.employee_id
    loop
      v_uid := public._mw_emp_user(t.tenant_id, r.employee_id);
      continue when v_uid is null or v_uid = any(v_users);
      v_users := v_users || v_uid;
      v_status := case when pr.archived_at is not null then 'cancelled'
                       when t.column_key = 'done' or coalesce(t.progress, 0) >= 100 then 'done'
                       when coalesce(r.prog, 0) >= 100 then 'done'
                       else 'open' end;
      if exists (select 1 from public.platform_activities where project_task_id = t.id and owner_user_id = v_uid and deleted_at is null) then
        update public.platform_activities
           set tenant_id = t.tenant_id, title = v_title, activity_type = 'todo', status = v_status, due_at = v_due, starts_at = v_due,
               project_employee_id = r.employee_id, updated_at = now()
         where project_task_id = t.id and owner_user_id = v_uid and deleted_at is null
           and (tenant_id, title, activity_type, status, due_at, starts_at, project_employee_id)
               is distinct from (t.tenant_id, v_title, 'todo'::text, v_status, v_due, v_due, r.employee_id);
      else
        insert into public.platform_activities (tenant_id, owner_user_id, project_task_id, project_employee_id, title, activity_type, status, due_at, starts_at)
        values (t.tenant_id, v_uid, t.id, r.employee_id, v_title, 'todo', v_status, v_due, v_due)
        on conflict (project_task_id, owner_user_id) where project_task_id is not null and deleted_at is null do nothing;
      end if;
    end loop;
  end if;
  -- rows of people no longer assigned / task deleted / no due date / project deleted (also the old viewer-uid rows)
  update public.platform_activities
     set deleted_at = now(), status = case when status = 'open' then 'cancelled' else status end, updated_at = now()
   where project_task_id = t.id and deleted_at is null and not (owner_user_id = any(v_users));
  perform set_config('mcore.mw_sync', '0', true);
end;
$$;

create or replace function public._pj_task_planner_trg()
returns trigger language plpgsql security definer set search_path = public as $$
declare o jsonb; n jsonb;
begin
  if TG_OP = 'UPDATE' then
    o := to_jsonb(OLD); n := to_jsonb(NEW);
    if jsonb_build_array(o->'title', o->'due_date', o->'due_time', o->'column_key', o->'progress', o->'assignee_employee_id', o->'project_id', o->'deleted_at', o->'tenant_id')
       = jsonb_build_array(n->'title', n->'due_date', n->'due_time', n->'column_key', n->'progress', n->'assignee_employee_id', n->'project_id', n->'deleted_at', n->'tenant_id')
    then return NEW; end if;
  end if;
  begin
    perform public._pj_planner_sync(NEW.id);
  exception when others then
    raise warning '_pj_task_planner_trg(%): %', NEW.id, sqlerrm;
  end;
  return NEW;
end;
$$;
drop trigger if exists trg_pj_task_planner on public.project_tasks;
create trigger trg_pj_task_planner after insert or update on public.project_tasks
  for each row execute function public._pj_task_planner_trg();

create or replace function public._pj_assignee_planner_trg()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'UPDATE' and OLD.employee_id is not distinct from NEW.employee_id and OLD.progress is not distinct from NEW.progress
     and OLD.deleted_at is not distinct from NEW.deleted_at and OLD.task_id is not distinct from NEW.task_id then
    return NEW;
  end if;
  begin
    perform public._pj_planner_sync(NEW.task_id);
    if TG_OP = 'UPDATE' and OLD.task_id is distinct from NEW.task_id then perform public._pj_planner_sync(OLD.task_id); end if;
  exception when others then
    raise warning '_pj_assignee_planner_trg(%): %', NEW.task_id, sqlerrm;
  end;
  return NEW;
end;
$$;
drop trigger if exists trg_pj_assignee_planner on public.project_task_assignees;
create trigger trg_pj_assignee_planner after insert or update on public.project_task_assignees
  for each row execute function public._pj_assignee_planner_trg();

-- Project closed (archived_at) / deleted: open todos -> cancelled; Restore -> back to open (history kept in the project)
create or replace function public._pj_project_planner_trg()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record; o jsonb := to_jsonb(OLD); n jsonb := to_jsonb(NEW);
begin
  if (o->'archived_at') is not distinct from (n->'archived_at') and (o->'deleted_at') is not distinct from (n->'deleted_at') then return NEW; end if;
  begin
    for r in select id from public.project_tasks where project_id = NEW.id and tenant_id = NEW.tenant_id loop
      perform public._pj_planner_sync(r.id);
    end loop;
  exception when others then
    raise warning '_pj_project_planner_trg(%): %', NEW.id, sqlerrm;
  end;
  return NEW;
end;
$$;
drop trigger if exists trg_pj_project_planner on public.projects;
create trigger trg_pj_project_planner after update on public.projects
  for each row execute function public._pj_project_planner_trg();

-- ============ 4) Phase B: Complete in Planner = this assignee's part done ============
create or replace function public._mw_complete_part(p_task uuid, p_user uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = public as $$
declare t record; v_emps uuid[]; v_has boolean; v_tot int := 1; v_done int := 0; v_avg int := 0; v_all boolean := false;
        v_pic uuid; v_to uuid[]; v_pname text := ''; v_who text := ''; v_link jsonb;
begin
  select * into t from public.project_tasks where id = p_task and deleted_at is null;
  if t.id is null or t.column_key = 'done' then return; end if;
  select array_agg(x.eid) into v_emps from (
    select a.employee_id as eid from public.project_task_assignees a where a.task_id = t.id and a.tenant_id = t.tenant_id and a.deleted_at is null
    union select t.assignee_employee_id) x
  where x.eid is not null and public._mw_emp_user(t.tenant_id, x.eid) = p_user;
  if v_emps is null then return; end if;
  select exists (select 1 from public.project_task_assignees a where a.task_id = t.id and a.tenant_id = t.tenant_id and a.deleted_at is null) into v_has;
  if v_has then
    update public.project_task_assignees set progress = 100, done_at = coalesce(done_at, now())
     where task_id = t.id and tenant_id = t.tenant_id and deleted_at is null and employee_id = any(v_emps) and (progress < 100 or done_at is null);
    select count(*), count(*) filter (where progress >= 100), coalesce(round(avg(progress)), 0)
      into v_tot, v_done, v_avg
      from public.project_task_assignees where task_id = t.id and tenant_id = t.tenant_id and deleted_at is null;
    v_all := v_done >= v_tot;
  else
    v_all := true; v_done := 1;
  end if;
  if v_all then
    update public.project_tasks set column_key = 'done', progress = 100 where id = t.id and tenant_id = t.tenant_id and column_key <> 'done';
  else
    update public.project_tasks set progress = v_avg, column_key = case when column_key = 'backlog' and v_avg > 0 then 'progress' else column_key end
     where id = t.id and tenant_id = t.tenant_id;
  end if;
  -- notify the PIC (task Owner), or the tenant owner when the task has no PIC; the actor is never notified
  v_pic := public._mw_task_pic(t.id);
  if v_pic is not null then v_to := array[v_pic];
  else select array_agg(u.id) into v_to from public.user_profiles u where u.tenant_id = t.tenant_id and lower(coalesce(u.role, '')) = 'owner'; end if;
  select coalesce(p.name, '') into v_pname from public.projects p where p.id = t.project_id;
  select coalesce(u.full_name, '') into v_who from public.user_profiles u where u.id = p_user;
  v_link := jsonb_build_object('page', 'projects', 'params', jsonb_build_object('id', t.project_id, 'taskId', t.id), 'icon', 'ti-circle-check');
  if v_all then
    perform public._mw_notify(t.tenant_id, v_to, coalesce(p_actor, p_user), 'Task done: ' || left(t.title, 150), 'Task siap: ' || left(t.title, 150),
      concat_ws(' · ', nullif(v_pname, ''), nullif(v_who, '')), concat_ws(' · ', nullif(v_pname, ''), nullif(v_who, '')),
      'assigned.pj_done', v_link, 'project_tasks', t.id, 'pjdone:' || t.id);
  else
    perform public._mw_notify(t.tenant_id, v_to, coalesce(p_actor, p_user),
      coalesce(nullif(v_who, ''), 'Assignee') || ' finished their part: ' || left(t.title, 120),
      coalesce(nullif(v_who, ''), 'Assignee') || ' siapkan bahagian: ' || left(t.title, 120),
      concat_ws(' · ', nullif(v_pname, ''), v_done || '/' || v_tot || ' done'), concat_ws(' · ', nullif(v_pname, ''), v_done || '/' || v_tot || ' siap'),
      'assigned.pj_done', v_link, 'project_tasks', t.id, 'pjpart:' || t.id || ':' || p_user);
  end if;
end;
$$;

-- ============ 5) Phase F: next copy of a repeating manual todo (claimed once -> never duplicated) ============
create or replace function public._mw_spawn_next(p_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare a record; v_base timestamptz; v_d date; v_next date; v_delta interval; v_new uuid;
begin
  update public.platform_activities set recur_spawned_at = now()
   where id = p_id and recur_spawned_at is null and recur_rule is not null and deleted_at is null and project_task_id is null
  returning * into a;
  if a.id is null then return null; end if;
  v_base := coalesce(a.due_at, a.starts_at);
  if v_base is null then return null; end if;
  v_d := (v_base at time zone 'Asia/Kuala_Lumpur')::date;
  v_next := public._mw_next_date(v_d, a.recur_rule, public._mw_day());
  if v_next is null or (a.recur_until is not null and v_next > a.recur_until) then return null; end if;
  v_delta := (v_next - v_d) * interval '1 day';
  insert into public.platform_activities (tenant_id, owner_user_id, title, activity_type, status, starts_at, ends_at, due_at, remind_at,
    related_tenant_id, notes, recur_rule, recur_until, recur_parent_id)
  values (a.tenant_id, a.owner_user_id, a.title, a.activity_type, 'open', a.starts_at + v_delta, a.ends_at + v_delta, a.due_at + v_delta, a.remind_at + v_delta,
    a.related_tenant_id, a.notes, a.recur_rule, a.recur_until, coalesce(a.recur_parent_id, a.id))
  returning id into v_new;
  return v_new;
end;
$$;

-- guard: only the assignee, the task PIC, tenant owner/admin or platform admin may Complete a project-linked Planner row
create or replace function public._mw_activity_guard_trg()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if pg_trigger_depth() > 1 or current_setting('mcore.mw_sync', true) = '1' then return NEW; end if;
  if NEW.project_task_id is not null and NEW.status = 'done' and OLD.status is distinct from 'done'
     and auth.uid() is not null and auth.uid() <> NEW.owner_user_id then
    if not (public._mw_task_pic(NEW.project_task_id) is not distinct from auth.uid()
            or exists (select 1 from public.user_profiles u where u.id = auth.uid() and u.tenant_id = NEW.tenant_id and lower(coalesce(u.role, '')) in ('owner', 'admin'))
            or public.is_platform_admin()) then
      raise exception 'mw_not_assignee' using errcode = 'P0001';
    end if;
  end if;
  return NEW;
end;
$$;
drop trigger if exists trg_mw_activity_guard on public.platform_activities;
create trigger trg_mw_activity_guard before update of status on public.platform_activities
  for each row execute function public._mw_activity_guard_trg();

create or replace function public._mw_activity_done_trg()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if pg_trigger_depth() > 1 or current_setting('mcore.mw_sync', true) = '1' then return NEW; end if;
  if NEW.status = 'done' and OLD.status is distinct from 'done' and NEW.deleted_at is null then
    begin
      if NEW.project_task_id is not null then perform public._mw_complete_part(NEW.project_task_id, NEW.owner_user_id, auth.uid());
      elsif NEW.recur_rule is not null then perform public._mw_spawn_next(NEW.id);
      end if;
    exception when others then
      raise warning '_mw_activity_done_trg(%): %', NEW.id, sqlerrm;
    end;
  end if;
  return NEW;
end;
$$;
drop trigger if exists trg_mw_activity_done on public.platform_activities;
create trigger trg_mw_activity_done after update of status on public.platform_activities
  for each row execute function public._mw_activity_done_trg();

-- ============ 6) Phase H: Snooze (Tomorrow = 1, Next week = 7) from a Planner card ============
create or replace function public.mywork_snooze(p_id uuid, p_days int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a record; t record; v_tid uuid := public.get_my_tenant_id(); v_uid uuid := auth.uid(); v_new date; v_d date; v_delta interval;
        v_pic uuid; v_who text := ''; v_pname text := '';
begin
  if v_uid is null or v_tid is null then raise exception 'mw_auth' using errcode = 'P0001'; end if;
  if p_days is null or p_days not in (1, 7) then raise exception 'mw_bad_days' using errcode = 'P0001'; end if;
  select * into a from public.platform_activities where id = p_id and tenant_id = v_tid and deleted_at is null and status = 'open';
  if a.id is null then raise exception 'mw_not_found' using errcode = 'P0001'; end if;
  if a.owner_user_id <> v_uid then raise exception 'mw_not_assignee' using errcode = 'P0001'; end if;
  v_new := public._mw_day() + p_days;
  if a.project_task_id is not null then
    select * into t from public.project_tasks where id = a.project_task_id and tenant_id = v_tid and deleted_at is null;
    if t.id is null then raise exception 'mw_not_found' using errcode = 'P0001'; end if;
    update public.project_tasks set due_date = v_new,
      start_date = case when start_date is not null and start_date > v_new then v_new else start_date end
     where id = t.id and tenant_id = v_tid;
    v_pic := public._mw_task_pic(t.id);
    select coalesce(u.full_name, '') into v_who from public.user_profiles u where u.id = v_uid;
    select coalesce(p.name, '') into v_pname from public.projects p where p.id = t.project_id;
    perform public._mw_notify(v_tid, case when v_pic is null then null else array[v_pic] end, v_uid,
      'Snoozed to ' || to_char(v_new, 'DD/MM/YYYY') || ': ' || left(t.title, 120),
      'Ditunda ke ' || to_char(v_new, 'DD/MM/YYYY') || ': ' || left(t.title, 120),
      concat_ws(' · ', nullif(v_pname, ''), nullif(v_who, '')), concat_ws(' · ', nullif(v_pname, ''), nullif(v_who, '')),
      'assigned.pj_snooze', jsonb_build_object('page', 'projects', 'params', jsonb_build_object('id', t.project_id, 'taskId', t.id), 'icon', 'ti-clock-pause'),
      'project_tasks', t.id, 'pjsnz:' || t.id || ':' || v_new);
  else
    if coalesce(a.due_at, a.starts_at) is null then
      update public.platform_activities set due_at = ((v_new::text || ' 09:00')::timestamp at time zone 'Asia/Kuala_Lumpur'), reminded_at = null, updated_at = now()
       where id = a.id and tenant_id = v_tid;
    else
      v_d := (coalesce(a.due_at, a.starts_at) at time zone 'Asia/Kuala_Lumpur')::date;
      v_delta := (v_new - v_d) * interval '1 day';
      update public.platform_activities set starts_at = starts_at + v_delta, ends_at = ends_at + v_delta, due_at = due_at + v_delta,
        remind_at = remind_at + v_delta, reminded_at = null, updated_at = now()
       where id = a.id and tenant_id = v_tid;
    end if;
  end if;
  return jsonb_build_object('ok', true, 'due', v_new);
end;
$$;

-- ============ 7) Phase D + I + F: 8 AM digest, overdue escalation, repeating todos past due (one daily run) ============
create or replace function public.mywork_morning_run()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_day date := public._mw_day(); v_start timestamptz; v_end timestamptz; r record; k int;
        v_sent int := 0; v_esc int := 0; v_rec int := 0; v_lag uuid[]; v_pic uuid; v_to uuid[]; v_names text; v_days int;
begin
  v_start := (v_day::text || ' 00:00')::timestamp at time zone 'Asia/Kuala_Lumpur';
  v_end := v_start + interval '1 day';
  -- F) repeating manual todos whose due date passed: make the next copy once
  for r in select id from public.platform_activities
            where deleted_at is null and status = 'open' and project_task_id is null and recur_rule is not null and recur_spawned_at is null
              and coalesce(due_at, starts_at) < v_start limit 2000 loop
    if public._mw_spawn_next(r.id) is not null then v_rec := v_rec + 1; end if;
  end loop;
  -- D) one digest per person: open Planner items today + overdue (project tasks, todos, bookings; holidays/events excluded). No amounts.
  for r in
    select a.tenant_id, a.owner_user_id as uid, lower(coalesce(max(u.role), '')) as role,
      count(*) filter (where coalesce(a.due_at, a.starts_at) >= v_start) as n_today,
      count(*) filter (where coalesce(a.due_at, a.starts_at) < v_start) as n_late
    from public.platform_activities a join public.user_profiles u on u.id = a.owner_user_id and u.tenant_id = a.tenant_id
    where a.deleted_at is null and a.status = 'open' and a.activity_type <> 'event' and a.tenant_id is not null
      and coalesce(a.due_at, a.starts_at) < v_end
    group by a.tenant_id, a.owner_user_id
  loop
    continue when r.n_today + r.n_late = 0;
    continue when exists (select 1 from public.notifications x where x.user_id = r.uid and x.group_key = 'mwd:' || r.uid || ':' || v_day);
    -- same person, same day: this replaces the Projects 9 AM summary (pj-auto) and the unread-count morning push (push-send)
    if to_regclass('public.pj_auto_log') is not null then
      execute 'insert into public.pj_auto_log (dedupe_key, tenant_id, user_id, kind) values ($1, $2, $3, ''digest'') on conflict do nothing'
        using 'pjd:' || r.uid || ':' || v_day, r.tenant_id, r.uid;
      get diagnostics k = row_count;
      continue when k = 0; -- the Projects summary already went out today
    end if;
    if to_regclass('public.push_log') is not null and r.role <> 'platform_admin' then
      execute 'insert into public.push_log (dedupe_key, tenant_id, user_id, channel, status, reason) values ($1, $2, $3, ''push'', ''skipped'', ''mywork_digest'') on conflict do nothing'
        using 'dg:' || r.uid || ':' || v_day, r.tenant_id, r.uid;
    end if;
    v_sent := v_sent + public._mw_notify(r.tenant_id, array[r.uid], null,
      'Today: ' || r.n_today || ' task' || case when r.n_today = 1 then '' else 's' end || ', ' || r.n_late || ' overdue',
      'Hari ini: ' || r.n_today || ' task, ' || r.n_late || ' lewat',
      'Open My Work in Planner', 'Buka Kerja Saya dalam Perancang',
      'assigned.digest', jsonb_build_object('page', 'planner', 'params', jsonb_build_object('mw', case when r.n_late > 0 then 'overdue' else 'today' end), 'icon', 'ti-sun'),
      null, null, 'mwd:' || r.uid || ':' || v_day);
  end loop;
  -- I) task more than 2 days overdue -> PIC (or tenant owner when the PIC is the one behind), once per task per due date
  for r in
    select t.id, t.tenant_id, t.title, t.project_id, t.due_date, p.name as pname
    from public.project_tasks t join public.projects p on p.id = t.project_id and p.tenant_id = t.tenant_id
    where t.deleted_at is null and t.column_key <> 'done' and coalesce(t.progress, 0) < 100 and t.due_date < v_day - 2
      and p.deleted_at is null and p.archived_at is null
      and not exists (select 1 from public.notifications x where x.tenant_id = t.tenant_id and x.group_key = 'pjesc:' || t.id || ':' || t.due_date)
    order by t.due_date limit 1000
  loop
    select array_agg(distinct a.owner_user_id) into v_lag from public.platform_activities a
     where a.project_task_id = r.id and a.tenant_id = r.tenant_id and a.deleted_at is null and a.status = 'open';
    continue when v_lag is null;
    v_pic := public._mw_task_pic(r.id);
    if v_pic is not null and not (v_pic = any(v_lag)) then v_to := array[v_pic];
    else select array_agg(u.id) into v_to from public.user_profiles u
          where u.tenant_id = r.tenant_id and lower(coalesce(u.role, '')) = 'owner' and not (u.id = any(v_lag)); end if;
    continue when v_to is null;
    select string_agg(coalesce(nullif(u.full_name, ''), '?'), ', ') into v_names from public.user_profiles u where u.id = any(v_lag);
    v_days := v_day - r.due_date;
    v_esc := v_esc + public._mw_notify(r.tenant_id, v_to, null,
      'Overdue ' || v_days || ' days: ' || left(r.title, 120), 'Lewat ' || v_days || ' hari: ' || left(r.title, 120),
      concat_ws(' · ', nullif(r.pname, ''), v_names), concat_ws(' · ', nullif(r.pname, ''), v_names),
      'assigned.pj_overdue', jsonb_build_object('page', 'projects', 'params', jsonb_build_object('id', r.project_id, 'taskId', r.id), 'icon', 'ti-alarm'),
      'project_tasks', r.id, 'pjesc:' || r.id || ':' || r.due_date);
  end loop;
  return jsonb_build_object('day', v_day, 'digest', v_sent, 'escalated', v_esc, 'repeats', v_rec);
end;
$$;

-- ============ 8) permissions ============
revoke all on function public._mw_emp_user(uuid, uuid) from public, anon, authenticated;
revoke all on function public._mw_task_pic(uuid) from public, anon, authenticated;
revoke all on function public._mw_notify(uuid, uuid[], uuid, text, text, text, text, text, jsonb, text, uuid, text) from public, anon, authenticated;
revoke all on function public._pj_planner_sync(uuid) from public, anon, authenticated;
revoke all on function public._mw_complete_part(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public._mw_spawn_next(uuid) from public, anon, authenticated;
revoke all on function public.mywork_morning_run() from public, anon, authenticated;
revoke all on function public.mywork_snooze(uuid, int) from public, anon;
grant execute on function public.mywork_snooze(uuid, int) to authenticated;

-- ============ 9) backfill: every live task -> assignee rows; wrong viewer-uid rows soft-deleted (re-run safe) ============
do $$
declare r record; n int := 0;
begin
  for r in
    select id from public.project_tasks where deleted_at is null and due_date is not null
    union
    select distinct project_task_id from public.platform_activities where project_task_id is not null and deleted_at is null
  loop
    perform public._pj_planner_sync(r.id); n := n + 1;
  end loop;
  raise notice 'mywork backfill: % tasks synced', n;
end $$;

-- ============ 10) schedule: every day 07:59 MYT (23:59 UTC) -> lands on the phone with the 08:00 push-send tick ============
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'mcore-mywork-morning';
    perform cron.schedule('mcore-mywork-morning', '59 23 * * *', 'select public.mywork_morning_run()');
  else
    raise notice 'pg_cron is not enabled: Dashboard -> Database -> Extensions -> pg_cron, then re-run this block';
  end if;
end $$;

-- ============ 11) System Development ============
do $$
declare
  items text[][] := array[
    array['Planner: project tasks mirrored per assignee (DB trigger)',
      'Phase A: project_tasks / project_task_assignees / projects triggers keep one Planner todo per ASSIGNEE (employee -> user like dk__emp_user), due = due date + due time MYT. Done / soft-delete / move / due or assignee change update at once; project Archive (close) -> open todos cancelled, Restore -> back; project delete -> removed. Old client syncPlanner (viewer uid) removed and its rows cleaned by backfill. pj-multi-remind Planner chips folded into the same rows (reminders unchanged).'],
    array['Planner: two-way Complete (each assignee own part)',
      'Phase B: Complete on a project-linked Planner item marks that assignee''s part 100% (project_task_assignees); task progress = average; task Done when every assignee is done (or PIC marks Done on the board). PIC (task Owner, else tenant owner) gets bell + push; actor never notified. Only assignee / PIC / owner / admin may complete (DB guard).'],
    array['Planner: My Work (Today / Overdue / This week / Done)',
      'Phase C: My Work on top of Planner: own project tasks, todos, bookings and pending approvals (Leave, OT, Salary signature, claims, advance, outstation) with a source label (project name / Booking / Approval / Todo); tap opens the original item (task detail, booking, Review page). Done and cancelled leave the active tabs. EN/BM, dark/light, 380px stacked cards.'],
    array['Planner: 8 AM morning digest',
      'Phase D: pg_cron mcore-mywork-morning (07:59 MYT) -> mywork_morning_run(): one bell + phone push per person "Today: N tasks, M overdue" (no amounts), deep link to My Work. Replaces the same-day Projects 9 AM summary and the unread-count morning push for that person (one push only).'],
    array['Planner: Team view (open / overdue per person)',
      'Phase E: Team tab in My Work for tenant owner / admin / platform admin (all people) and task PICs (people on their tasks): open and overdue counts per person, gated by canAccess(planner).'],
    array['Planner: repeating manual todos',
      'Phase F: Repeat (every day / weekday / week / month on the same day) + Until on Planner todos. Next copy made once (recur_spawned_at claim) when the todo is completed or when its due date passes (daily run). Project task repeat stays in Task Detail (pj-auto).'],
    array['Planner: checklist progress on My Work cards',
      'Phase G: existing task checklist (project_task_checklist, task progress = done/total) reused; My Work project cards show done/total. No schema change.'],
    array['Planner: Snooze Tomorrow / Next week',
      'Phase H: Snooze on My Work cards (Today / Overdue): mywork_snooze RPC moves the project task due date (all assignees follow) or the todo time; PIC notified (bell + push).'],
    array['Projects: overdue escalation to PIC',
      'Phase I: task more than 2 days overdue -> PIC (or tenant owner when the PIC is the one behind) gets one bell + push per task per due date (group_key pjesc), in the same daily run as the digest.'],
    array['Projects: Close project review',
      'Phase J: Archive (close) asks first when the project has open tasks: "N open tasks" -> Cancel all (close; tasks kept in history, Planner todos cancelled) / Move to another project (then close) / Back.']
  ];
  i int;
begin
  for i in 1 .. array_length(items, 1) loop
    if exists (select 1 from public.dev_roadmap_items where title = items[i][1]) then
      update public.dev_roadmap_items set stage = 'completed', module = 'core', description = items[i][2] where title = items[i][1];
    else
      insert into public.dev_roadmap_items (title, description, module, stage) values (items[i][1], items[i][2], 'core', 'completed');
    end if;
  end loop;
  update public.dev_roadmap_items set stage = 'completed' where title = 'Project tasks on planner';
exception when undefined_column or undefined_table then
  raise notice 'dev_roadmap schema variant; skip: %', sqlerrm;
end $$;

notify pgrst, 'reload schema';

-- ============ 12) check (read-only). Schedule: select jobname, schedule, active from cron.job where jobname = 'mcore-mywork-morning';
select count(*) filter (where status = 'open') as open_mirror_rows, count(*) as live_mirror_rows
from public.platform_activities where project_task_id is not null and deleted_at is null;
