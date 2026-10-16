-- M-Core back-office support, Phase A: PA cross-tenant work dashboard, "send as company" setting, monthly support summary, "Opened but unpaid" list.
-- Write-only; run in Supabase SQL Editor. Rerun-safe. Plain SQL only (no new functions, no dollar quoting, no pgcrypto).
-- RUN ORDER: wa_doc_01.sql -> wa_doc_02.sql -> THIS FILE (bo_support_01.sql) -> bo_support_02.sql -> bo_support_03.sql.
-- The first statement stops here with "division by zero" if wa_doc_01 / wa_doc_02 have not been run.
-- Until this runs, the app hides every Phase A feature (it probes wa_settings).
select 1 / (case when to_regclass('public.doc_shares') is null or to_regclass('public.doc_responses') is null or to_regclass('public.service_requests') is null or to_regclass('public.bookings') is null then 0 else 1 end) as prerequisites_present;

-- 1) Per-tenant WhatsApp settings (sign off as the company; default on). One live row per tenant.
create table if not exists public.wa_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  sign_as_company boolean not null default true,
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz);
create unique index if not exists wa_settings_live_uq on public.wa_settings (tenant_id) where deleted_at is null;
alter table public.wa_settings enable row level security;
drop policy if exists wa_settings_read on public.wa_settings;
create policy wa_settings_read on public.wa_settings for select to authenticated using (
  tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid())
  or exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin'));
drop policy if exists wa_settings_ins on public.wa_settings;
create policy wa_settings_ins on public.wa_settings for insert to authenticated with check (
  tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid() and p.role in ('owner', 'admin', 'platform_admin')));
drop policy if exists wa_settings_upd on public.wa_settings;
create policy wa_settings_upd on public.wa_settings for update to authenticated
  using (tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid() and p.role in ('owner', 'admin', 'platform_admin')))
  with check (tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid() and p.role in ('owner', 'admin', 'platform_admin')));
grant select, insert, update on public.wa_settings to authenticated;

-- 2) Platform admin READ across all tenants (select only; existing tenant policies are untouched).
--    Every app query on these tables already filters by tenant_id or by id, so a PA working inside one tenant still sees only that tenant.
drop policy if exists bo_pa_read on public.invoices;
create policy bo_pa_read on public.invoices for select to authenticated using (exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin'));
drop policy if exists bo_pa_read on public.quotations;
create policy bo_pa_read on public.quotations for select to authenticated using (exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin'));
drop policy if exists bo_pa_read on public.bookings;
create policy bo_pa_read on public.bookings for select to authenticated using (exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin'));
drop policy if exists bo_pa_read on public.service_requests;
create policy bo_pa_read on public.service_requests for select to authenticated using (exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin'));
drop policy if exists bo_pa_read on public.doc_shares;
create policy bo_pa_read on public.doc_shares for select to authenticated using (exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin'));
drop policy if exists bo_pa_read on public.doc_views;
create policy bo_pa_read on public.doc_views for select to authenticated using (exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin'));
drop policy if exists bo_pa_read on public.doc_responses;
create policy bo_pa_read on public.doc_responses for select to authenticated using (exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin'));
drop policy if exists bo_pa_read on public.tenants;
create policy bo_pa_read on public.tenants for select to authenticated using (exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin'));

-- 3) Speed for the cross-tenant lists
create index if not exists bo_inv_open_idx on public.invoices (due_date) where deleted_at is null;
create index if not exists bo_views_time_idx on public.doc_views (doc_type, viewed_at);

-- 4) System Development
update public.dev_roadmap_items set stage = 'completed', module = 'admin',
  description = 'Back-office support Phase A: PA cross-tenant work dashboard (overdue, quotations awaiting answer, bookings tomorrow, open Service Desk, opened-but-unpaid >3 days; tenant/type filters; tap = silent enter + open), "Sign off as company" WhatsApp setting (default on), monthly PA support summary with CSV, tenant "Opened but unpaid" invoice list. SQL: supabase/bo_support_01.sql (after wa_doc_02.sql).'
where title = 'Back-office support (Phase A)';
insert into public.dev_roadmap_items (title, description, module, stage)
select 'Back-office support (Phase A)', 'Back-office support Phase A: PA cross-tenant work dashboard (overdue, quotations awaiting answer, bookings tomorrow, open Service Desk, opened-but-unpaid >3 days; tenant/type filters; tap = silent enter + open), "Sign off as company" WhatsApp setting (default on), monthly PA support summary with CSV, tenant "Opened but unpaid" invoice list. SQL: supabase/bo_support_01.sql (after wa_doc_02.sql).', 'admin', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Back-office support (Phase A)');
