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
