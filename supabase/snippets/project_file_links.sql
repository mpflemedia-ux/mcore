create table if not exists public.project_file_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  project_id uuid not null,
  task_id uuid,
  file_name text not null,
  created_at timestamptz not null default now(),
  unique (project_id, file_name)
);

alter table public.project_file_links enable row level security;

drop policy if exists project_file_links_tenant on public.project_file_links;
create policy project_file_links_tenant on public.project_file_links
  for all to authenticated
  using (
    tenant_id = (select tenant_id from public.user_profiles where id = auth.uid())
    or public.is_platform_admin()
  )
  with check (
    tenant_id = (select tenant_id from public.user_profiles where id = auth.uid())
    or public.is_platform_admin()
  );

grant select, insert, update, delete on public.project_file_links to authenticated;
