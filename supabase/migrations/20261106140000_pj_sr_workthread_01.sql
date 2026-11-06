-- M-Core: Projects Task <-> Service Request as one work thread.
-- WRITE-ONLY: run manually in Supabase SQL Editor (role 'authenticated'). Rerun-safe. Plain SQL only
-- (no CREATE FUNCTION, no dollar quoting; pgcrypto is OFF so new-row ids use md5(random())::uuid,
-- which Postgres accepts as a bare 32-hex-digit uuid literal).

-- 1) snapshot of the tenant task at the moment a Service Request was raised from it (title/checklist/
--    project+entity name/due date "Requested by" info) -- read-only reference, never edited by hand.
alter table public.service_requests add column if not exists task_snapshot jsonb;

-- 2) many-to-many: one Projects task can raise more than one Service Request (replaces the old
--    single project_tasks.linked_sr_id, which stays as a backward-compat pointer to the first SR).
create table if not exists public.project_task_sr_links (
  id uuid primary key default md5(random()::text || clock_timestamp()::text)::uuid,
  tenant_id uuid not null references public.tenants(id),
  task_id uuid not null references public.project_tasks(id),
  sr_id uuid not null references public.service_requests(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz);
create unique index if not exists project_task_sr_links_uq on public.project_task_sr_links (task_id, sr_id) where deleted_at is null;
create index if not exists project_task_sr_links_task_idx on public.project_task_sr_links (tenant_id, task_id) where deleted_at is null;
create index if not exists project_task_sr_links_sr_idx on public.project_task_sr_links (sr_id) where deleted_at is null;

alter table public.project_task_sr_links enable row level security;
drop policy if exists project_task_sr_links_read on public.project_task_sr_links;
create policy project_task_sr_links_read on public.project_task_sr_links for select to authenticated using (
  tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid())
  or exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin'));
drop policy if exists project_task_sr_links_ins on public.project_task_sr_links;
create policy project_task_sr_links_ins on public.project_task_sr_links for insert to authenticated with check (
  deleted_at is null and (
    tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid())
    or exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin'))
  and exists (select 1 from public.project_tasks k where k.id = task_id and k.tenant_id = project_task_sr_links.tenant_id));
drop policy if exists project_task_sr_links_upd on public.project_task_sr_links;
create policy project_task_sr_links_upd on public.project_task_sr_links for update to authenticated using (
  tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid())
  or exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin'))
  with check (
  tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid())
  or exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin'));
grant select, insert, update on public.project_task_sr_links to authenticated;
revoke all on public.project_task_sr_links from anon;

-- 3) backfill existing single links into the new table (keeps linked_sr_id itself untouched)
insert into public.project_task_sr_links (tenant_id, task_id, sr_id)
select k.tenant_id, k.id, k.linked_sr_id from public.project_tasks k
where k.linked_sr_id is not null and k.deleted_at is null
  and not exists (select 1 from public.project_task_sr_links l where l.task_id = k.id and l.sr_id = k.linked_sr_id and l.deleted_at is null);

notify pgrst, 'reload schema';

-- 4) System Development entries
update public.dev_roadmap_items set stage = 'completed', module = 'core' where title = 'Projects <-> Service Desk: one work thread';
insert into public.dev_roadmap_items (title, description, module, stage)
select 'Projects <-> Service Desk: one work thread',
  'Tenant Task Detail "Request from M-Core" builds the Service Request description deterministically (notes + deduped checklist + last 3 comments + project/entity + due date), copies task attachments, AI only picks the service code(s) (no title/details), never silently falls back, and can link several SRs per task (project_task_sr_links). Admin "Create Project Task" seeds the checklist from that snapshot and shows the entity name. Admin checklist ticks on the mirrored task post back as a client-visible Service Request comment; the tenant''s own Task Detail shows a read-only M-Core activity section with a deep link. Auto-Done now waits for every linked SR to be delivered/closed, not just the first.',
  'core', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Projects <-> Service Desk: one work thread');

-- 5) Checks (read-only)
select count(*) as links_table_ok from public.project_task_sr_links;
select count(*) as backfilled_links from public.project_task_sr_links;
select column_name from information_schema.columns where table_schema = 'public' and table_name = 'service_requests' and column_name = 'task_snapshot';
