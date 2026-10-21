-- M-Core payment attachments, Phase 4: reporting - per-tenant "warn when a bank payment has no slip" setting (pay_settings).
-- Write-only; run in Supabase SQL Editor. Rerun-safe. Plain SQL only (no new functions, no dollar quoting, no pgcrypto).
-- RUN ORDER: pay_attach_01.sql -> pay_attach_02.sql -> pay_attach_03.sql -> pay_attach_04.sql (THIS).
-- The first statement stops here with "division by zero" if pay_attach_01 has not been run.
-- The "No slip" tag + filter on the invoice list, the Payment proof section in the Monthly Report Pack and the slips ZIP export only need
-- pay_attach_01 (they read doc_attachments). Only the warning setting needs this file; until it runs the toggle stays hidden and no warning shows.
select 1 / (case when to_regclass('public.doc_attachments') is null then 0 else 1 end) as pay_attach_01_present;

create table if not exists public.pay_settings (
  tenant_id uuid primary key references public.tenants(id),
  warn_no_slip boolean not null default false,
  updated_by uuid,
  updated_at timestamptz not null default now()
);
alter table public.pay_settings enable row level security;

drop policy if exists pay_settings_read on public.pay_settings;
create policy pay_settings_read on public.pay_settings for select to authenticated using (
  tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid())
  or exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin'));
-- owner / admin of the tenant (or PA inside the tenant) may set it
drop policy if exists pay_settings_ins on public.pay_settings;
create policy pay_settings_ins on public.pay_settings for insert to authenticated with check (
  tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid() and lower(coalesce(p.role, '')) in ('owner', 'admin', 'platform_admin')));
drop policy if exists pay_settings_upd on public.pay_settings;
create policy pay_settings_upd on public.pay_settings for update to authenticated
  using (tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid() and lower(coalesce(p.role, '')) in ('owner', 'admin', 'platform_admin')))
  with check (tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid() and lower(coalesce(p.role, '')) in ('owner', 'admin', 'platform_admin')));
drop policy if exists pa_vo_ins on public.pay_settings;
create policy pa_vo_ins on public.pay_settings as restrictive for insert to authenticated with check (not exists (select 1 from public.platform_support_sessions s where s.actor_id = auth.uid() and s.ended_at is null and s.view_only and s.deleted_at is null and s.tenant_id = pay_settings.tenant_id));
drop policy if exists pa_vo_upd on public.pay_settings;
create policy pa_vo_upd on public.pay_settings as restrictive for update to authenticated using (not exists (select 1 from public.platform_support_sessions s where s.actor_id = auth.uid() and s.ended_at is null and s.view_only and s.deleted_at is null and s.tenant_id = pay_settings.tenant_id));
grant select, insert, update on public.pay_settings to authenticated;

notify pgrst, 'reload schema';

update public.dev_roadmap_items set stage = 'completed', module = 'sales',
  description = 'Payment attachments Phase 4: "No slip" tag + filter on the invoice list, Payment proof section in the Monthly Report Pack, per-tenant warning when a bank payment is saved without a slip (pay_settings), ZIP of slips per month / customer (client-side, no CDN). One payment across several invoices and overpayment as customer credit are designed but not built (need changes to payment / ToyyibPay database functions).'
where title = 'Payment attachments (Phase 4)';
insert into public.dev_roadmap_items (title, description, module, stage)
select 'Payment attachments (Phase 4)', 'Payment attachments Phase 4: "No slip" tag + filter on the invoice list, Payment proof section in the Monthly Report Pack, per-tenant warning when a bank payment is saved without a slip (pay_settings), ZIP of slips per month / customer (client-side, no CDN). One payment across several invoices and overpayment as customer credit are designed but not built (need changes to payment / ToyyibPay database functions).', 'sales', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Payment attachments (Phase 4)');
