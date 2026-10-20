reset role;

-- M-Core: Project Task -> Service Request convert (tenant-side "Request from M-Core", AI-assisted draft).
-- Write-only. Run once in Supabase SQL Editor. Rerun-safe (IF NOT EXISTS / WHERE NOT EXISTS throughout).
-- No new RLS policies needed: project_tasks UPDATE already allows tenant_id = get_my_tenant_id()
-- OR is_platform_admin() on every operation (20261005170000_projects_board.sql); the tenant setting
-- linked_sr_id/column_key on their OWN task already satisfies that. service_requests insert already
-- has a tenant-scoped policy requiring an active paid contract (servicedesk_all_v2.sql) -- unchanged,
-- reused as-is. project_task_comments insert is the same existing path the task's own Activity/comment
-- composer already uses (pj-wa-activity.js) -- unchanged.

-- 1) Link column: one service_requests row per project_tasks row (idempotency + "View Request" button).
alter table public.project_tasks
  add column if not exists linked_sr_id uuid references public.service_requests(id);

create unique index if not exists project_tasks_linked_sr_uq
  on public.project_tasks (linked_sr_id)
  where linked_sr_id is not null;

notify pgrst, 'reload schema';

-- 2) System Development
update public.dev_roadmap_items set stage = 'completed', module = 'core',
  description = 'Projects Task Detail (tenant''s own board): "Request from M-Core" button (subscribed tenants only -- Service Desk module + active paid contract) drafts a New Request (service pick + title + details) via ai-proxy action suggest_service_request (best-effort, never blocks on failure; AI may only pick from the tenant''s own contracted service list, never invent one). Priority is mapped deterministically from the task''s Important/Urgent matrix, never from AI. Tenant reviews/edits the full 3-step wizard before submitting (unchanged). On submit, links back via project_tasks.linked_sr_id (button becomes "View Request"), moves the task to the review column, and posts a system comment in the task''s own Activity log.'
  where title = 'Projects: Request from M-Core (task to SR convert)';
insert into public.dev_roadmap_items (title, description, module, stage)
  select 'Projects: Request from M-Core (task to SR convert)', 'Projects Task Detail (tenant''s own board): "Request from M-Core" button (subscribed tenants only -- Service Desk module + active paid contract) drafts a New Request (service pick + title + details) via ai-proxy action suggest_service_request (best-effort, never blocks on failure; AI may only pick from the tenant''s own contracted service list, never invent one). Priority is mapped deterministically from the task''s Important/Urgent matrix, never from AI. Tenant reviews/edits the full 3-step wizard before submitting (unchanged). On submit, links back via project_tasks.linked_sr_id (button becomes "View Request"), moves the task to the review column, and posts a system comment in the task''s own Activity log.', 'core', 'completed'
  where not exists (select 1 from public.dev_roadmap_items where title = 'Projects: Request from M-Core (task to SR convert)');
