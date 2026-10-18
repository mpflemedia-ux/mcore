-- M-Core Projects - Public Report Link (no-login, view-only + "leave a message"). Run after the
-- Projects board schema (projects + project_tasks) already exists. Rerun-safe. Plain SQL only
-- (no CREATE FUNCTION, no $$, no pgcrypto; sha256() is built into Postgres 11+).
--
-- One active link per project: plaintext token lives only in the URL the owner/admin/platform-admin
-- copies+shares from the "Share public report" button on the Projects page; only its sha256 hash is
-- stored here (same model as service_public_links). projects/project_tasks have no anon RLS at all,
-- so an anonymous viewer can only ever reach them through the pj-report Edge Function (service-role
-- key) - these two tables don't grant anon access either, by the same design.
create table if not exists public.project_share_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  project_id uuid not null references public.projects(id),
  token_hash text not null,
  expires_on date not null,
  revoked_at timestamptz,
  view_count int not null default 0,
  viewed_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  deleted_at timestamptz);
create unique index if not exists project_share_links_hash_uq on public.project_share_links (token_hash);
create unique index if not exists project_share_links_active_uq on public.project_share_links (project_id) where revoked_at is null and deleted_at is null;
create index if not exists project_share_links_project_idx on public.project_share_links (project_id);

create table if not exists public.project_share_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  project_id uuid not null references public.projects(id),
  link_id uuid not null references public.project_share_links(id),
  body text not null check (length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  deleted_at timestamptz);
create index if not exists project_share_messages_project_idx on public.project_share_messages (project_id, created_at) where deleted_at is null;

alter table public.project_share_links enable row level security;
alter table public.project_share_messages enable row level security;

-- Owner/admin of the tenant manage their own project's links; platform admin manages all (explicit
-- requirement here, unlike service_public_links which platform admin only reads - this feature must
-- be usable by platform admin directly, per spec).
drop policy if exists project_share_links_read on public.project_share_links;
create policy project_share_links_read on public.project_share_links for select to authenticated using (
  (deleted_at is null and tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid() and lower(coalesce(p.role, '')) in ('owner', 'admin')))
  or exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin'));
drop policy if exists project_share_links_ins on public.project_share_links;
create policy project_share_links_ins on public.project_share_links for insert to authenticated with check (
  tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid() and lower(coalesce(p.role, '')) in ('owner', 'admin'))
  or exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin'));
drop policy if exists project_share_links_upd on public.project_share_links;
create policy project_share_links_upd on public.project_share_links for update to authenticated
  using (tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid() and lower(coalesce(p.role, '')) in ('owner', 'admin'))
    or exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin'))
  with check (tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid() and lower(coalesce(p.role, '')) in ('owner', 'admin'))
    or exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin'));

-- Messages: owner/admin/platform-admin read only (left by anon viewers via the Edge Function, which
-- uses the service-role key - no anon insert policy needed or granted here).
drop policy if exists project_share_messages_read on public.project_share_messages;
create policy project_share_messages_read on public.project_share_messages for select to authenticated using (
  (deleted_at is null and tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid() and lower(coalesce(p.role, '')) in ('owner', 'admin')))
  or exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin'));

grant select, insert, update on public.project_share_links to authenticated;
grant select on public.project_share_messages to authenticated;

notify pgrst, 'reload schema';

update public.dev_roadmap_items set stage = 'completed', module = 'projects',
  description = 'Projects: public report link (view-only, no login) for platform admin and tenant owner/admin - per-project token link, 14-day default expiry (editable), QR, revoke, view-count/last-viewed, viewer can leave a message (notifies tenant owner/admin). Served by the pj-report Edge Function (service-role key) since projects/project_tasks have no anon RLS.'
where title = 'Projects: Public report link (view + leave a message)';
insert into public.dev_roadmap_items (title, description, module, stage)
select 'Projects: Public report link (view + leave a message)', 'Projects: public report link (view-only, no login) for platform admin and tenant owner/admin - per-project token link, 14-day default expiry (editable), QR, revoke, view-count/last-viewed, viewer can leave a message (notifies tenant owner/admin). Served by the pj-report Edge Function (service-role key) since projects/project_tasks have no anon RLS.', 'projects', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Projects: Public report link (view + leave a message)');
