-- M-Core — Demo reset fix 01 (23 Oct 2026). WRITE-ONLY. No functions, no dollar quoting. Rerun-safe.
-- Bug: Platform admin -> Support -> Reset demo data fails with
--   update or delete on table "project_tasks" violates foreign key constraint
--   "project_task_assignees_task_id_fkey" on table "project_task_assignees".
-- Cause: reset_demo_tenant() (demo_tenant_16) hard-deletes project_tasks and projects for the DEMO tenant, but
-- tables added later (multi-assignee, checklist, task comments/shares, share links, SR<->task link) reference them
-- with the default NO ACTION rule, so any child row blocks the delete.
-- Fix: make those child foreign keys follow their parent (ON DELETE CASCADE), or clear the pointer (SET NULL) where
-- the row must survive (service requests, recurring parent). Only hard deletes are affected; the app soft-deletes
-- (deleted_at), so normal use does not change. reset_demo_tenant() already scopes every delete to the DEMO tenant,
-- so the cascade only removes rows that belong to deleted demo tasks/projects.

begin;

-- children of project_tasks
alter table public.project_task_assignees drop constraint if exists project_task_assignees_task_id_fkey;
alter table public.project_task_assignees add constraint project_task_assignees_task_id_fkey
  foreign key (task_id) references public.project_tasks(id) on delete cascade;

alter table public.project_task_checklist drop constraint if exists project_task_checklist_task_id_fkey;
alter table public.project_task_checklist add constraint project_task_checklist_task_id_fkey
  foreign key (task_id) references public.project_tasks(id) on delete cascade;

alter table public.project_task_comments drop constraint if exists project_task_comments_task_id_fkey;
alter table public.project_task_comments add constraint project_task_comments_task_id_fkey
  foreign key (task_id) references public.project_tasks(id) on delete cascade;

alter table public.project_task_shares drop constraint if exists project_task_shares_task_id_fkey;
alter table public.project_task_shares add constraint project_task_shares_task_id_fkey
  foreign key (task_id) references public.project_tasks(id) on delete cascade;

alter table public.project_share_links drop constraint if exists project_share_links_task_id_fkey;
alter table public.project_share_links add constraint project_share_links_task_id_fkey
  foreign key (task_id) references public.project_tasks(id) on delete cascade;

-- pointers that must survive the task
alter table public.project_tasks drop constraint if exists project_tasks_recur_parent_id_fkey;
alter table public.project_tasks add constraint project_tasks_recur_parent_id_fkey
  foreign key (recur_parent_id) references public.project_tasks(id) on delete set null;

alter table public.service_requests drop constraint if exists service_requests_linked_task_id_fkey;
alter table public.service_requests add constraint service_requests_linked_task_id_fkey
  foreign key (linked_task_id) references public.project_tasks(id) on delete set null;

-- children of projects
alter table public.project_task_shares drop constraint if exists project_task_shares_project_id_fkey;
alter table public.project_task_shares add constraint project_task_shares_project_id_fkey
  foreign key (project_id) references public.projects(id) on delete cascade;

alter table public.project_share_links drop constraint if exists project_share_links_project_id_fkey;
alter table public.project_share_links add constraint project_share_links_project_id_fkey
  foreign key (project_id) references public.projects(id) on delete cascade;

alter table public.project_share_messages drop constraint if exists project_share_messages_project_id_fkey;
alter table public.project_share_messages add constraint project_share_messages_project_id_fkey
  foreign key (project_id) references public.projects(id) on delete cascade;

alter table public.project_share_messages drop constraint if exists project_share_messages_link_id_fkey;
alter table public.project_share_messages add constraint project_share_messages_link_id_fkey
  foreign key (link_id) references public.project_share_links(id) on delete cascade;

-- assignee -> employee (employees are deleted later in the same reset)
alter table public.project_task_assignees drop constraint if exists project_task_assignees_employee_id_fkey;
alter table public.project_task_assignees add constraint project_task_assignees_employee_id_fkey
  foreign key (employee_id) references public.employees(id) on delete cascade;

commit;

-- Check (read-only): any foreign key still blocking a delete of a table the reset wipes.
-- Expect only project_tasks -> projects (the reset deletes tasks before projects). Any other row: send it to the dev team.
select c.conrelid::regclass as child_table, c.conname as constraint_name, c.confrelid::regclass as parent_table
from pg_constraint c
where c.contype = 'f' and c.confdeltype in ('a', 'r')
  and c.confrelid::regclass::text in ('project_tasks', 'projects')
order by 3, 1;
