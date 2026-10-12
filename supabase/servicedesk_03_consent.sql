-- M-Core Service Desk - phase 3: support access consent. Run after 02. Rerun-safe. Plain SQL only.
-- Enforcement is in the app (support-tenant flow) + logging; the existing enter_support_tenant RPC is unchanged.
create table if not exists public.support_access_consents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  enabled boolean not null default false,
  scope text not null default 'open_request_only' check (scope in ('contract', 'open_request_only')),
  allowed_modules text[] not null default '{sales,accounting,hr,crm}',
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz);
create unique index if not exists support_access_consents_tenant_uq on public.support_access_consents (tenant_id) where deleted_at is null;
alter table public.support_access_consents enable row level security;

drop policy if exists support_access_consents_read on public.support_access_consents;
create policy support_access_consents_read on public.support_access_consents for select to authenticated using (
  (deleted_at is null and tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid()))
  or exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin'));
-- Only the tenant's owner/admin may change consent (platform admin cannot grant itself access).
drop policy if exists support_access_consents_ins on public.support_access_consents;
create policy support_access_consents_ins on public.support_access_consents for insert to authenticated with check (
  tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid() and lower(coalesce(p.role, '')) in ('owner', 'admin')));
drop policy if exists support_access_consents_upd on public.support_access_consents;
create policy support_access_consents_upd on public.support_access_consents for update to authenticated
  using (tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid() and lower(coalesce(p.role, '')) in ('owner', 'admin')))
  with check (tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid() and lower(coalesce(p.role, '')) in ('owner', 'admin')));
grant select, insert, update on public.support_access_consents to authenticated;

update public.dev_roadmap_items set stage = 'completed', module = 'service_desk',
  description = 'Client Settings Akses Sokongan (toggle, scope, modules, access log). Support session requires consent, ties to request (mandatory for open_request_only), restricts modules in app, logs start/end as request events.'
where title = 'Service Desk F3: Support access consent';
insert into public.dev_roadmap_items (title, description, module, stage)
select 'Service Desk F3: Support access consent', 'Client Settings Akses Sokongan (toggle, scope, modules, access log). Support session requires consent, ties to request (mandatory for open_request_only), restricts modules in app, logs start/end as request events.', 'service_desk', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Service Desk F3: Support access consent');
