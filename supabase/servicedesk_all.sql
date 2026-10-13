-- M-Core Service Desk - ALL phases in run order (01 contracts, 02 desk, 03 consent, 04 reports, 05 realtime).
-- Rerun-safe except the final realtime line (an 'already member of publication' error there is harmless).

-- ===== servicedesk_01_contracts.sql =====
-- M-Core Service Desk - phase 1: service catalog + service contracts. Run first. Rerun-safe. Plain SQL only (no new functions, no dollar quoting).
create table if not exists public.service_catalog (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id),
  code text not null, name_en text not null, name_bm text not null,
  default_sla_hours int not null default 48 check (default_sla_hours > 0),
  sort int not null default 0, active boolean not null default true,
  created_at timestamptz not null default now(), deleted_at timestamptz);
create unique index if not exists service_catalog_code_uq on public.service_catalog (code);

insert into public.service_catalog (tenant_id, code, name_en, name_bm, default_sla_hours, sort)
select (select t.id from public.tenants t where upper(coalesce(t.code, '')) in ('MPWORK24', 'MPWORK') order by t.code desc limit 1), v.code, v.en, v.bm, 48, v.s
from (values
  ('admin_docs', 'Administrative documents', 'Dokumen pentadbiran', 1),
  ('letters', 'Letters, memos & correspondence', 'Surat, memo & surat-menyurat', 2),
  ('sales_docs', 'Quotations, invoices, PO & DO', 'Sebut harga, invois, PO & DO', 3),
  ('records', 'Sales, purchase & expense records', 'Rekod jualan, belian & perbelanjaan', 4),
  ('bookkeeping', 'Bookkeeping', 'Simpan kira', 5),
  ('hr_records', 'Employee records, attendance, leave & claims', 'Rekod pekerja, kehadiran, cuti & tuntutan', 6),
  ('payroll', 'Payroll', 'Penggajian', 7),
  ('kpi', 'Employee KPIs', 'KPI pekerja', 8),
  ('data_entry', 'System data entry', 'Kemasukan data sistem', 9),
  ('sop', 'SOPs & workflows', 'SOP & aliran kerja', 10),
  ('reports', 'Sales, HR, accounts & operations reports', 'Laporan jualan, HR, akaun & operasi', 11),
  ('crm_digitise', 'Digitise customer records', 'Pendigitalan rekod pelanggan', 12)
) as v(code, en, bm, s)
on conflict (code) do update set name_en = excluded.name_en, name_bm = excluded.name_bm, sort = excluded.sort,
  tenant_id = coalesce(public.service_catalog.tenant_id, excluded.tenant_id);

create table if not exists public.service_contracts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  start_date date not null, end_date date not null,
  invoice_ref text,
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'paid')),
  services text[] not null default '{}',
  monthly_quota int check (monthly_quota is null or monthly_quota >= 0),
  sla_hours int not null default 48 check (sla_hours > 0),
  mcore_access_free boolean not null default true,
  renew_monthly_fee numeric(12,2) not null default 750,
  status text not null default 'draft' check (status in ('draft', 'active', 'expired', 'cancelled')),
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  constraint service_contracts_dates_chk check (end_date >= start_date));
create index if not exists service_contracts_tenant_idx on public.service_contracts (tenant_id) where deleted_at is null;

alter table public.service_catalog enable row level security;
alter table public.service_contracts enable row level security;

drop policy if exists service_catalog_read on public.service_catalog;
create policy service_catalog_read on public.service_catalog for select to authenticated using (true);
drop policy if exists service_catalog_pa_ins on public.service_catalog;
create policy service_catalog_pa_ins on public.service_catalog for insert to authenticated
  with check (exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin'));
drop policy if exists service_catalog_pa_upd on public.service_catalog;
create policy service_catalog_pa_upd on public.service_catalog for update to authenticated
  using (exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin'))
  with check (exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin'));

drop policy if exists service_contracts_read on public.service_contracts;
create policy service_contracts_read on public.service_contracts for select to authenticated using (
  (deleted_at is null and tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid()))
  or exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin'));
drop policy if exists service_contracts_pa_ins on public.service_contracts;
create policy service_contracts_pa_ins on public.service_contracts for insert to authenticated
  with check (exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin'));
drop policy if exists service_contracts_pa_upd on public.service_contracts;
create policy service_contracts_pa_upd on public.service_contracts for update to authenticated
  using (exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin'))
  with check (exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin'));

grant select on public.service_catalog, public.service_contracts to authenticated;
grant insert, update on public.service_catalog, public.service_contracts to authenticated;

update public.dev_roadmap_items set stage = 'completed', module = 'service_desk',
  description = 'Service catalog (12 services) + service contracts: admin Kontrak Servis tab, unpaid lock, status derived on load, contract chip in All Clients.'
where title = 'Service Desk F1: Service contracts';
insert into public.dev_roadmap_items (title, description, module, stage)
select 'Service Desk F1: Service contracts', 'Service catalog (12 services) + service contracts: admin Kontrak Servis tab, unpaid lock, status derived on load, contract chip in All Clients.', 'service_desk', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Service Desk F1: Service contracts');

-- ===== servicedesk_02_desk.sql =====
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

-- ===== servicedesk_03_consent.sql =====
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

-- ===== servicedesk_04_reports.sql =====
-- M-Core Service Desk - phase 4: monthly report packs. Run after 03. Rerun-safe. Plain SQL only.
create table if not exists public.service_report_packs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  month date not null check (extract(day from month) = 1),
  status text not null default 'draft' check (status in ('draft', 'sent')),
  sent_at timestamptz, sent_by uuid,
  created_at timestamptz not null default now(), deleted_at timestamptz);
create unique index if not exists service_report_packs_uq on public.service_report_packs (tenant_id, month) where deleted_at is null;
alter table public.service_report_packs enable row level security;
drop policy if exists service_report_packs_read on public.service_report_packs;
create policy service_report_packs_read on public.service_report_packs for select to authenticated using (
  exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin')
  or (deleted_at is null and status = 'sent' and tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid())));
drop policy if exists service_report_packs_pa_ins on public.service_report_packs;
create policy service_report_packs_pa_ins on public.service_report_packs for insert to authenticated
  with check (exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin'));
drop policy if exists service_report_packs_pa_upd on public.service_report_packs;
create policy service_report_packs_pa_upd on public.service_report_packs for update to authenticated
  using (exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin'))
  with check (exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin'));
grant select, insert, update on public.service_report_packs to authenticated;

update public.dev_roadmap_items set stage = 'completed', module = 'service_desk',
  description = 'Client Laporan Bulanan: SLA summary + Sales/HR/Accounts/Ops reusing existing Reports renderers, visible only when admin marks the month sent, print-to-PDF.'
where title = 'Service Desk F4: Monthly report pack';
insert into public.dev_roadmap_items (title, description, module, stage)
select 'Service Desk F4: Monthly report pack', 'Client Laporan Bulanan: SLA summary + Sales/HR/Accounts/Ops reusing existing Reports renderers, visible only when admin marks the month sent, print-to-PDF.', 'service_desk', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Service Desk F4: Monthly report pack');

-- ===== servicedesk_05_realtime.sql =====
-- M-Core Service Desk - realtime (run LAST, once). If Postgres says a table "is already member of publication", it is already done.
alter publication supabase_realtime add table public.service_requests, public.service_request_events;
