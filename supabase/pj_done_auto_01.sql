-- M-Core Projects: auto-Done for tasks at 100% or with a delivered/closed linked Service Request.
-- Write-only; run once in Supabase SQL Editor. Rerun-safe. Plain SQL only (no functions, no dollar quoting).
-- Optional: the app already heals these tasks on board load (app/pj-done-auto.js). This one-off fixes every
-- existing stuck row for all tenants at once, including boards nobody has opened yet.

-- 1) Per-person rows of tasks whose linked Service Request is delivered/closed -> 100% (multi-assignee mode).
update public.project_task_assignees a
set progress = 100, done_at = coalesce(a.done_at, now())
from public.project_tasks t
where a.task_id = t.id and a.tenant_id = t.tenant_id
  and a.deleted_at is null and coalesce(a.progress, 0) < 100
  and t.deleted_at is null and t.column_key <> 'done'
  and coalesce(t.progress, 0) < 100
  and t.linked_sr_id in (
    select s.id from public.service_requests s
    where s.tenant_id = t.tenant_id and s.deleted_at is null and s.status in ('delivered', 'closed'));

-- 2) Tasks at 100%, or with a delivered/closed linked Service Request -> Done (progress 100).
update public.project_tasks t
set column_key = 'done', progress = 100
where t.deleted_at is null and t.column_key <> 'done'
  and (coalesce(t.progress, 0) >= 100
    or t.linked_sr_id in (
      select s.id from public.service_requests s
      where s.tenant_id = t.tenant_id and s.deleted_at is null and s.status in ('delivered', 'closed')));

-- 3) System Development
update public.dev_roadmap_items set stage = 'completed', module = 'core',
  description = 'Projects: a task moves to Done automatically when its progress reaches 100% (incl. the per-person Done tick in multi-assignee mode) or when its linked Service Request is delivered/closed. Converting a task to a Service Request below 100% still moves it to Review; at 100% it goes to Done. Board load heals existing stuck tasks (tenant-scoped, skipped in PA view-only); pj_done_auto_01.sql fixes all existing rows once.'
where title = 'Projects auto-Done (100% / request closed)';
insert into public.dev_roadmap_items (title, description, module, stage)
select 'Projects auto-Done (100% / request closed)', 'Projects: a task moves to Done automatically when its progress reaches 100% (incl. the per-person Done tick in multi-assignee mode) or when its linked Service Request is delivered/closed. Converting a task to a Service Request below 100% still moves it to Review; at 100% it goes to Done. Board load heals existing stuck tasks (tenant-scoped, skipped in PA view-only); pj_done_auto_01.sql fixes all existing rows once.', 'core', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Projects auto-Done (100% / request closed)');
