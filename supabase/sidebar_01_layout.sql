-- M-Core Sidebar Redesign (Fasa 1-5) — tenant menu layout (order + hide-for-staff)
-- WRITE ONLY. Idempotent. No functions, no extensions. Safe to re-run.
-- Until this runs, the app hides Admin > "Susun menu" and uses the default order.

create table if not exists public.sidebar_layouts (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id),
  layout      jsonb not null default '{}'::jsonb,
  updated_by  uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
alter table public.sidebar_layouts add column if not exists layout jsonb not null default '{}'::jsonb;
alter table public.sidebar_layouts add column if not exists updated_by uuid;
alter table public.sidebar_layouts add column if not exists updated_at timestamptz not null default now();
alter table public.sidebar_layouts add column if not exists deleted_at timestamptz;
create unique index if not exists sidebar_layouts_tenant_uq on public.sidebar_layouts(tenant_id);

alter table public.sidebar_layouts enable row level security;

-- read: anyone in the same tenant (staff need the hide list) or platform admin
drop policy if exists sidebar_layouts_read on public.sidebar_layouts;
create policy sidebar_layouts_read on public.sidebar_layouts for select to authenticated using (
  tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid())
  or exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin'));

-- write: owner/admin of the same tenant, or platform admin
drop policy if exists sidebar_layouts_ins on public.sidebar_layouts;
create policy sidebar_layouts_ins on public.sidebar_layouts for insert to authenticated with check (
  exists (select 1 from public.user_profiles p where p.id = auth.uid()
          and ((p.tenant_id = sidebar_layouts.tenant_id and lower(p.role) in ('owner','admin')) or p.role = 'platform_admin')));

drop policy if exists sidebar_layouts_upd on public.sidebar_layouts;
create policy sidebar_layouts_upd on public.sidebar_layouts for update to authenticated
  using (exists (select 1 from public.user_profiles p where p.id = auth.uid()
          and ((p.tenant_id = sidebar_layouts.tenant_id and lower(p.role) in ('owner','admin')) or p.role = 'platform_admin')))
  with check (exists (select 1 from public.user_profiles p where p.id = auth.uid()
          and ((p.tenant_id = sidebar_layouts.tenant_id and lower(p.role) in ('owner','admin')) or p.role = 'platform_admin')));

-- no delete policy: reset = soft delete (deleted_at)
grant select, insert, update on public.sidebar_layouts to authenticated;

notify pgrst, 'reload schema';

insert into public.dev_roadmap_items (title, description, module, stage)
select 'Sidebar Redesign (Fasa 1-5)', 'Grouped sidebar (Utama/Jualan/Stok/Orang/Kewangan/Sokongan/Platform M-Core/Sistem), menu search + "/" shortcut, G+key jumps, pin & recent per user, collapsible sections, action badges from bell Tindakan, laptop compact icon mode (remembered), phone bottom bar + "+ Baru" sheet, PA tenant-switch chip, Admin > Susun menu (order + hide for staff), industry ordering, status line.', 'core', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Sidebar Redesign (Fasa 1-5)');
