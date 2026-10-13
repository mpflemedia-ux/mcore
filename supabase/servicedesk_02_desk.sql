-- M-Core Service Desk - phase 2: service requests + timeline events + private storage. Run after 01. Rerun-safe. Plain SQL only.
create table if not exists public.service_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  contract_id uuid references public.service_contracts(id),
  ref_no text not null,
  service_code text not null,
  title text not null check (length(title) between 1 and 200),
  description text,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'submitted' check (status in ('submitted', 'triaged', 'in_progress', 'waiting_client', 'delivered', 'revision', 'closed', 'out_of_scope', 'cancelled')),
  assigned_to uuid,
  due_at timestamptz,
  sla_paused_seconds int not null default 0 check (sla_paused_seconds >= 0),
  paused_at timestamptz, delivered_at timestamptz, closed_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz);
create unique index if not exists service_requests_ref_uq on public.service_requests (tenant_id, ref_no);
create index if not exists service_requests_status_idx on public.service_requests (status) where deleted_at is null;

create table if not exists public.service_request_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  request_id uuid not null references public.service_requests(id),
  type text not null check (type in ('status', 'comment', 'attachment', 'support_access', 'internal_note')),
  from_status text, to_status text, body text, file_path text,
  actor_id uuid default auth.uid(),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now());
create index if not exists service_request_events_req_idx on public.service_request_events (request_id, created_at);

alter table public.service_requests enable row level security;
alter table public.service_request_events enable row level security;

-- Requests: tenant reads own; platform admin all. Client may only create 'submitted' under a paid active contract,
-- and may only set client statuses (cancel pre-triage, revision, close). Transitions themselves are checked in JS.
drop policy if exists service_requests_read on public.service_requests;
create policy service_requests_read on public.service_requests for select to authenticated using (
  (deleted_at is null and tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid()))
  or exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin'));
drop policy if exists service_requests_ins on public.service_requests;
create policy service_requests_ins on public.service_requests for insert to authenticated with check (
  exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin')
  or (tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid())
      and status = 'submitted' and created_by = auth.uid()
      and exists (select 1 from public.service_contracts c where c.tenant_id = service_requests.tenant_id and c.deleted_at is null
                  and c.payment_status = 'paid' and c.status = 'active' and current_date between c.start_date and c.end_date)));
drop policy if exists service_requests_upd on public.service_requests;
create policy service_requests_upd on public.service_requests for update to authenticated
  using (exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin')
    or (deleted_at is null and tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid())))
  with check (exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin')
    or (tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid())
        and status in ('submitted', 'cancelled', 'revision', 'closed')));

-- Events: tenant reads own except internal staff notes; platform admin reads all.
drop policy if exists service_request_events_read on public.service_request_events;
create policy service_request_events_read on public.service_request_events for select to authenticated using (
  exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin')
  or (type <> 'internal_note' and tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid())));
drop policy if exists service_request_events_ins on public.service_request_events;
create policy service_request_events_ins on public.service_request_events for insert to authenticated with check (
  exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin')
  or (type in ('status', 'comment', 'attachment') and actor_id = auth.uid()
      and tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid())
      and exists (select 1 from public.service_requests r where r.id = request_id and r.tenant_id = service_request_events.tenant_id)));

grant select, insert, update on public.service_requests to authenticated;
grant select, insert on public.service_request_events to authenticated;

-- Private storage: service-files/{tenant_id}/service-requests/{request_id}/{file}. Read needs a PAID contract (deliverables
-- released after full payment). Insert + read only; files are never overwritten.
insert into storage.buckets (id, name, public, file_size_limit)
values ('service-files', 'service-files', false, 26214400)
on conflict (id) do update set public = false, file_size_limit = 26214400;
drop policy if exists service_files_read on storage.objects;
create policy service_files_read on storage.objects for select to authenticated using (
  bucket_id = 'service-files' and (
    exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin')
    or ((storage.foldername(name))[1] = (select p.tenant_id::text from public.user_profiles p where p.id = auth.uid())
        and exists (select 1 from public.service_contracts c where c.tenant_id::text = (storage.foldername(name))[1]
                    and c.payment_status = 'paid' and c.deleted_at is null))));
drop policy if exists service_files_insert on storage.objects;
create policy service_files_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'service-files' and (storage.foldername(name))[2] = 'service-requests' and (
    exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin')
    or (storage.foldername(name))[1] = (select p.tenant_id::text from public.user_profiles p where p.id = auth.uid())));

update public.dev_roadmap_items set stage = 'completed', module = 'service_desk',
  description = 'Service requests SR-YYYYMM-NNNN (unique per tenant + retry), status machine, SLA business hours with waiting_client pause, auto-close after 7 days, client Servis Saya + admin Service Desk board, internal staff notes, private service-files storage gated on paid contract, realtime toasts.'
where title = 'Service Desk F2: Service requests';
insert into public.dev_roadmap_items (title, description, module, stage)
select 'Service Desk F2: Service requests', 'Service requests SR-YYYYMM-NNNN (unique per tenant + retry), status machine, SLA business hours with waiting_client pause, auto-close after 7 days, client Servis Saya + admin Service Desk board, internal staff notes, private service-files storage gated on paid contract, realtime toasts.', 'service_desk', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Service Desk F2: Service requests');
