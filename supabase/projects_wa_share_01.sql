-- M-Core Projects - Share WhatsApp (Tier 1, wa.me, no API): share log + task comments (+ private screenshots bucket).
-- Write-only; run in Supabase SQL Editor. Rerun-safe. Plain SQL only (no new functions, no dollar quoting).
-- Who can share: tenant owner/admin, or the task assignee (employees.email = login email). Everyone in the tenant can read.
create table if not exists public.project_task_shares (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  task_id uuid references public.project_tasks(id),
  project_id uuid references public.projects(id),
  template text not null check (template in ('reminder', 'request_info', 'done', 'client', 'summary', 'daily')),
  lang text not null default 'bm' check (lang in ('en', 'bm')),
  recipient_kind text not null check (recipient_kind in ('staff', 'client', 'other')),
  recipient_id uuid,
  recipient_label text check (recipient_label is null or length(recipient_label) <= 200),
  phone text check (phone is null or phone ~ '^[0-9]{8,15}$'),
  message text check (message is null or length(message) <= 6000),
  created_by uuid default auth.uid(),
  created_by_name text check (created_by_name is null or length(created_by_name) <= 200),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint project_task_shares_task_chk check (task_id is not null or template = 'daily'));
create index if not exists project_task_shares_task_idx on public.project_task_shares (task_id) where deleted_at is null;
create index if not exists project_task_shares_tenant_idx on public.project_task_shares (tenant_id, created_at);

create table if not exists public.project_task_comments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  task_id uuid not null references public.project_tasks(id),
  body text check (body is null or length(body) <= 4000),
  file_path text check (file_path is null or length(file_path) <= 300),
  file_name text check (file_name is null or length(file_name) <= 200),
  file_size int check (file_size is null or file_size between 0 and 5242880),
  created_by uuid default auth.uid(),
  created_by_name text check (created_by_name is null or length(created_by_name) <= 200),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint project_task_comments_body_chk check (coalesce(length(btrim(body)), 0) > 0 or file_path is not null));
create index if not exists project_task_comments_task_idx on public.project_task_comments (task_id) where deleted_at is null;

alter table public.project_task_shares enable row level security;
alter table public.project_task_comments enable row level security;

drop policy if exists project_task_shares_read on public.project_task_shares;
create policy project_task_shares_read on public.project_task_shares for select to authenticated using (
  (deleted_at is null and tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid()))
  or exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin'));
drop policy if exists project_task_shares_ins on public.project_task_shares;
create policy project_task_shares_ins on public.project_task_shares for insert to authenticated with check (
  created_by = auth.uid() and deleted_at is null and (
    exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin')
    or tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid() and lower(coalesce(p.role, '')) in ('owner', 'admin'))
    or (task_id is not null and tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid())
        and exists (select 1 from public.project_tasks k join public.employees e on e.id = k.assignee_employee_id
          where k.id = task_id and k.tenant_id = project_task_shares.tenant_id and k.deleted_at is null
            and lower(coalesce(e.email, '')) = lower(coalesce(auth.jwt() ->> 'email', '-'))))));

drop policy if exists project_task_comments_read on public.project_task_comments;
create policy project_task_comments_read on public.project_task_comments for select to authenticated using (
  (deleted_at is null and tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid()))
  or exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin'));
drop policy if exists project_task_comments_ins on public.project_task_comments;
create policy project_task_comments_ins on public.project_task_comments for insert to authenticated with check (
  created_by = auth.uid() and deleted_at is null and (
    tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid())
    or exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin'))
  and exists (select 1 from public.project_tasks k where k.id = task_id and k.tenant_id = project_task_comments.tenant_id));
-- soft delete: own comment, or tenant owner/admin
drop policy if exists project_task_comments_upd on public.project_task_comments;
create policy project_task_comments_upd on public.project_task_comments for update to authenticated
  using (created_by = auth.uid() or tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid() and lower(coalesce(p.role, '')) in ('owner', 'admin')))
  with check (tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid()));
grant select, insert on public.project_task_shares to authenticated;
grant select, insert, update on public.project_task_comments to authenticated;

-- Private bucket for pasted WhatsApp screenshots: project-comments/{tenant_id}/{task_id}/{file}. 5 MB, images only. Signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('project-comments', 'project-comments', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists project_comments_files_ins on storage.objects;
create policy project_comments_files_ins on storage.objects for insert to authenticated with check (
  bucket_id = 'project-comments' and (storage.foldername(name))[1] = (select p.tenant_id::text from public.user_profiles p where p.id = auth.uid()));
drop policy if exists project_comments_files_read on storage.objects;
create policy project_comments_files_read on storage.objects for select to authenticated using (
  bucket_id = 'project-comments' and ((storage.foldername(name))[1] = (select p.tenant_id::text from public.user_profiles p where p.id = auth.uid())
    or exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin')));

notify pgrst, 'reload schema';

update public.dev_roadmap_items set stage = 'completed', module = 'core',
  description = 'Projects Share WhatsApp (Tier 1, wa.me): share button on card + detail, Ingatkan on overdue, 3-step sheet (4 templates EN/BM, staff/client/group), share log + Dikongsi Nx, activity + comments with pasted screenshot (private bucket), multi-select summary, daily Task hari ini & lewat.'
where title = 'Projects: Share WhatsApp (Tier 1)';
insert into public.dev_roadmap_items (title, description, module, stage)
select 'Projects: Share WhatsApp (Tier 1)', 'Projects Share WhatsApp (Tier 1, wa.me): share button on card + detail, Ingatkan on overdue, 3-step sheet (4 templates EN/BM, staff/client/group), share log + Dikongsi Nx, activity + comments with pasted screenshot (private bucket), multi-select summary, daily Task hari ini & lewat.', 'core', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Projects: Share WhatsApp (Tier 1)');
