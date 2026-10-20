reset role;

-- M-Core: Service Desk -> Project Task Auto-Sync (admin-triggered, AI-assisted draft).
-- Write-only. Run once in Supabase SQL Editor. Rerun-safe (IF NOT EXISTS / WHERE NOT EXISTS throughout).
-- No new RLS policies needed:
--   - service_requests UPDATE already bypasses for platform_admin and is column-agnostic
--     (servicedesk_all_v2.sql) -> setting linked_task_id needs nothing new.
--   - projects / project_tasks / project_task_assignees already bypass tenant_id = get_my_tenant_id()
--     OR is_platform_admin() on every operation (20261005170000_projects_board.sql, pj_multi_01.sql).
--   - customers writes go through the EXISTING SECURITY DEFINER RPC
--     sync_tenant_as_platform_customer() (20260822110000_sync_tenant_platform_customer.sql), which
--     already bypasses customers RLS and already finds-or-creates the mirrored CRM customer per
--     client tenant (matched by the MCORE_TENANT:<uuid> marker in notes, not by name) -- reused as-is,
--     not duplicated.

-- 1) Link column: one project_tasks row per service_requests row (idempotency + "View Task" button).
alter table public.service_requests
  add column if not exists linked_task_id uuid references public.project_tasks(id);

create unique index if not exists service_requests_linked_task_uq
  on public.service_requests (linked_task_id)
  where linked_task_id is not null;

-- 2) Resolve the platform home tenant ("MP Workspace") id for client-side use.
-- Same lookup rule already used inside sync_tenant_as_platform_customer() above, kept identical for
-- consistency (code MPWORK24/MPWORK, or name "MP Workspace") instead of hardcoding a tenant id.
create or replace function public.get_platform_home_tenant_id()
returns uuid
language sql
security definer
set search_path = public, extensions
stable
as $$
  select id from public.tenants
  where deleted_at is null
    and (
      upper(coalesce(code,'')) in ('MPWORK24','MPWORK')
      or lower(trim(coalesce(name,''))) in ('mp workspace','mpworkspace')
    )
  order by created_at asc
  limit 1;
$$;

grant execute on function public.get_platform_home_tenant_id() to authenticated;

notify pgrst, 'reload schema';

-- 3) System Development
update public.dev_roadmap_items set stage = 'completed', module = 'service_desk',
  description = 'Admin Service Desk request detail: "Create Project Task" button (platform_admin only) finds/creates the client''s mirrored CRM customer + MP Workspace project, drafts title/notes/tag/est_hours via ai-proxy action draft_project_task (best-effort, never blocks on failure), fills due date/time + important/urgent + assignee deterministically (never from AI), shows a review modal before saving, links back via service_requests.linked_task_id (button becomes "View Task"). Self/internal requests go to an Internal project instead of creating a customer. On Delivered/Closed with a linked task not yet Done, offers a one-click "mark Done too?" suggestion (never automatic).'
  where title = 'Service Desk: Create Project Task sync';
insert into public.dev_roadmap_items (title, description, module, stage)
  select 'Service Desk: Create Project Task sync', 'Admin Service Desk request detail: "Create Project Task" button (platform_admin only) finds/creates the client''s mirrored CRM customer + MP Workspace project, drafts title/notes/tag/est_hours via ai-proxy action draft_project_task (best-effort, never blocks on failure), fills due date/time + important/urgent + assignee deterministically (never from AI), shows a review modal before saving, links back via service_requests.linked_task_id (button becomes "View Task"). Self/internal requests go to an Internal project instead of creating a customer. On Delivered/Closed with a linked task not yet Done, offers a one-click "mark Done too?" suggestion (never automatic).', 'service_desk', 'completed'
  where not exists (select 1 from public.dev_roadmap_items where title = 'Service Desk: Create Project Task sync');
