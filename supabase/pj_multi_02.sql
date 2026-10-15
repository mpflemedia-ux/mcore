-- M-Core Projects phase 2: per-person progress, estimated hours (workload + clash warning), WhatsApp share for any assignee.
-- Needs pj_multi_01.sql first. Write-only; run manually in Supabase SQL Editor. Rerun-safe. Plain SQL only (no functions, no dollar quoting).

-- 1) Per-person progress on the assignee link rows (task progress = average, written back by the app)
alter table public.project_task_assignees add column if not exists progress int not null default 0;
alter table public.project_task_assignees add column if not exists done_at timestamptz;
alter table public.project_task_assignees drop constraint if exists project_task_assignees_progress_chk;
alter table public.project_task_assignees add constraint project_task_assignees_progress_chk check (progress between 0 and 100);
-- existing rows start from the task's current progress so the average does not drop on first save
update public.project_task_assignees a set progress = least(100, greatest(0, coalesce(t.progress, 0))),
  done_at = case when coalesce(t.progress, 0) >= 100 then coalesce(a.done_at, now()) else a.done_at end
from public.project_tasks t
where t.id = a.task_id and a.deleted_at is null and a.progress = 0 and coalesce(t.progress, 0) > 0;

-- 2) Estimated hours on tasks
alter table public.project_tasks add column if not exists est_hours numeric(6, 2);
alter table public.project_tasks drop constraint if exists project_tasks_est_hours_chk;
alter table public.project_tasks add constraint project_tasks_est_hours_chk check (est_hours is null or (est_hours > 0 and est_hours <= 999));

-- 3) WhatsApp share log: any assignee (link table) may log a share, not only the owner column
drop policy if exists project_task_shares_ins on public.project_task_shares;
create policy project_task_shares_ins on public.project_task_shares for insert to authenticated with check (
  created_by = auth.uid() and deleted_at is null and (
    exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin')
    or tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid() and lower(coalesce(p.role, '')) in ('owner', 'admin'))
    or (task_id is not null and tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid())
        and exists (select 1 from public.project_tasks k join public.employees e on e.id = k.assignee_employee_id
          where k.id = task_id and k.tenant_id = project_task_shares.tenant_id and k.deleted_at is null
            and lower(coalesce(e.email, '')) = lower(coalesce(auth.jwt() ->> 'email', '-'))))
    or (task_id is not null and tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid())
        and exists (select 1 from public.project_task_assignees a join public.employees e on e.id = a.employee_id
          where a.task_id = project_task_shares.task_id and a.tenant_id = project_task_shares.tenant_id and a.deleted_at is null
            and lower(coalesce(e.email, '')) = lower(coalesce(auth.jwt() ->> 'email', '-'))))));

-- 4) System Development entry
update public.dev_roadmap_items set stage = 'completed', module = 'core' where title = 'Projects: per-person progress, workload, clash warning, My tasks, WhatsApp all assignees';
insert into public.dev_roadmap_items (title, description, module, stage)
select 'Projects: per-person progress, workload, clash warning, My tasks, WhatsApp all assignees', 'Each assignee updates own progress (task progress = average). Estimated hours + weekly Workload panel (hours split evenly between assignees, >40h highlighted). Schedule clash warning on save. My tasks filter + Matrix assignee filter match any assignee. WhatsApp share to all assignees one by one; any assignee can share. Columns project_task_assignees.progress/done_at, project_tasks.est_hours.', 'core', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Projects: per-person progress, workload, clash warning, My tasks, WhatsApp all assignees');

notify pgrst, 'reload schema';
