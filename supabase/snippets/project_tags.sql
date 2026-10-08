create table if not exists public.project_tags (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists project_tags_name_idx
  on public.project_tags (tenant_id, name)
  where deleted_at is null;
alter table public.project_tags enable row level security;
drop policy if exists project_tags_tenant on public.project_tags;
create policy project_tags_tenant on public.project_tags
  for all to authenticated
  using (tenant_id = (select tenant_id from public.user_profiles where id = auth.uid()))
  with check (tenant_id = (select tenant_id from public.user_profiles where id = auth.uid()));
insert into public.project_tags (tenant_id, name, sort_order)
select t.id, v.name, v.sort_order
from public.tenants t
cross join (values
  ('Administration', 1),
  ('Finance', 2),
  ('Human Resource', 3),
  ('Brand & Marketing', 4),
  ('Clients', 5),
  ('Partners & Vendors', 6),
  ('Projects', 7),
  ('Legal', 8),
  ('Operations', 9),
  ('Archive', 10)
) as v(name, sort_order)
where t.deleted_at is null
  and not exists (
    select 1 from public.project_tags p
    where p.tenant_id = t.id and p.name = v.name and p.deleted_at is null
  );
