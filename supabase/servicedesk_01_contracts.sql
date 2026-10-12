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
