-- M-Core Projects phase 1: multiple assignees + owner, optional start/due time, reminder before due.
-- Write-only; run manually in Supabase SQL Editor. Rerun-safe. Plain SQL only (no functions, no dollar quoting).
-- project_tasks.assignee_employee_id stays the source for existing readers and is kept = Owner by the app.

-- 1) Optional times + reminder on tasks (existing start_date/due_date stay date-only, untouched)
alter table public.project_tasks add column if not exists start_time time;
alter table public.project_tasks add column if not exists due_time time;
alter table public.project_tasks add column if not exists remind_before_min int;
alter table public.project_tasks add column if not exists remind_sent_for timestamptz;
alter table public.project_tasks drop constraint if exists project_tasks_remind_before_chk;
alter table public.project_tasks add constraint project_tasks_remind_before_chk
  check (remind_before_min is null or remind_before_min in (15, 60, 1440));

-- 2) Assignee link table (employee ids, same as project_tasks.assignee_employee_id)
create table if not exists public.project_task_assignees (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  task_id uuid not null references public.project_tasks(id),
  employee_id uuid not null references public.employees(id),
  is_owner boolean not null default false,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  deleted_at timestamptz);
create unique index if not exists project_task_assignees_live_uq on public.project_task_assignees (task_id, employee_id) where deleted_at is null;
create unique index if not exists project_task_assignees_owner_uq on public.project_task_assignees (task_id) where is_owner and deleted_at is null;
create index if not exists project_task_assignees_emp_idx on public.project_task_assignees (tenant_id, employee_id) where deleted_at is null;

alter table public.project_task_assignees enable row level security;
drop policy if exists project_task_assignees_read on public.project_task_assignees;
create policy project_task_assignees_read on public.project_task_assignees for select to authenticated using (
  tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid())
  or exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin'));
drop policy if exists project_task_assignees_ins on public.project_task_assignees;
create policy project_task_assignees_ins on public.project_task_assignees for insert to authenticated with check (
  deleted_at is null and (
    tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid())
    or exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin'))
  and exists (select 1 from public.project_tasks k where k.id = task_id and k.tenant_id = project_task_assignees.tenant_id));
drop policy if exists project_task_assignees_upd on public.project_task_assignees;
create policy project_task_assignees_upd on public.project_task_assignees for update to authenticated using (
  tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid())
  or exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin'))
  with check (
  tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid())
  or exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin'));
grant select, insert, update on public.project_task_assignees to authenticated;
revoke all on public.project_task_assignees from anon;

-- 3) Migrate: current assignee becomes the Owner row (skips tasks already migrated)
insert into public.project_task_assignees (tenant_id, task_id, employee_id, is_owner, created_by)
select k.tenant_id, k.task_id_x, k.assignee_employee_id, true, null
from (select t.tenant_id, t.id as task_id_x, t.assignee_employee_id from public.project_tasks t
      where t.assignee_employee_id is not null and t.deleted_at is null
        and exists (select 1 from public.employees e where e.id = t.assignee_employee_id)) k
where not exists (select 1 from public.project_task_assignees a where a.task_id = k.task_id_x and a.deleted_at is null);

-- 4) System Development entry
update public.dev_roadmap_items set stage = 'completed', module = 'core' where title = 'Projects: multiple assignees, owner, time & reminders';
insert into public.dev_roadmap_items (title, description, module, stage)
select 'Projects: multiple assignees, owner, time & reminders', 'Task Detail: tick list + name chips for many assignees, star = Owner (kept in project_tasks.assignee_employee_id). Optional start/due time, reminder 15m/1h/1d before due to all assignees (bell, fired client-side when an assignee has the app open). Today & overdue card respects due time and lists all assignees; Planner calendar shows timed tasks for each assignee; board cards show assignee initials + due time. Table project_task_assignees.', 'core', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Projects: multiple assignees, owner, time & reminders');

notify pgrst, 'reload schema';
