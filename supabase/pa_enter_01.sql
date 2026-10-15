-- M-Core: Platform admin direct Enter (silent support session). WRITE ONLY, idempotent, rerun-safe.
-- No CREATE FUNCTION, no pgcrypto. RLS via direct subquery on user_profiles.
-- 1) session windows (PA writes on Enter/Exit; drives hiding + server-side view-only)
create table if not exists public.platform_support_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  actor_id uuid not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  view_only boolean not null default false,
  end_reason text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists pss_actor_open_idx on public.platform_support_sessions (actor_id) where ended_at is null;
create index if not exists pss_tenant_time_idx on public.platform_support_sessions (tenant_id, actor_id, started_at);
alter table public.platform_support_sessions enable row level security;
-- read: PA, or members of that tenant (needed so the hiding policies below can evaluate for tenant readers;
-- rows hold only ids + times, never shown in the tenant UI)
drop policy if exists pss_read on public.platform_support_sessions;
create policy pss_read on public.platform_support_sessions for select to authenticated using (
  exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.role = 'platform_admin')
  or tenant_id = (select up.tenant_id from public.user_profiles up where up.id = auth.uid()));
drop policy if exists pss_ins on public.platform_support_sessions;
create policy pss_ins on public.platform_support_sessions for insert to authenticated with check (actor_id = auth.uid() and exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.role = 'platform_admin'));
drop policy if exists pss_upd on public.platform_support_sessions;
create policy pss_upd on public.platform_support_sessions for update to authenticated using (actor_id = auth.uid() and exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.role = 'platform_admin')) with check (actor_id = auth.uid());
grant select, insert, update on public.platform_support_sessions to authenticated;

-- 2) hide rows produced by a PA during a support session from tenant readers (Activity / Audit Log / bell)
drop policy if exists pa_hide_session on public.audit_logs;
create policy pa_hide_session on public.audit_logs as restrictive for select to authenticated using (
  exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.role = 'platform_admin')
  or audit_logs.user_id is null
  or not exists (select 1 from public.platform_support_sessions s
    where s.actor_id = audit_logs.user_id and s.tenant_id = audit_logs.tenant_id and s.deleted_at is null
      and audit_logs.created_at >= s.started_at and (s.ended_at is null or audit_logs.created_at <= s.ended_at)));
drop policy if exists pa_hide_session on public.notifications;
create policy pa_hide_session on public.notifications as restrictive for select to authenticated using (
  exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.role = 'platform_admin')
  or notifications.actor_id is null
  or not exists (select 1 from public.platform_support_sessions s
    where s.actor_id = notifications.actor_id and s.tenant_id = notifications.tenant_id and s.deleted_at is null
      and notifications.created_at >= s.started_at and (s.ended_at is null or notifications.created_at <= s.ended_at)));

-- 3) server-side view-only: while the PA's open session has view_only = true, writes into that tenant are refused
drop policy if exists pa_vo_ins on public.customers;
create policy pa_vo_ins on public.customers as restrictive for insert to authenticated with check (not exists (select 1 from public.platform_support_sessions s where s.actor_id = auth.uid() and s.ended_at is null and s.view_only and s.deleted_at is null and s.tenant_id = customers.tenant_id));
drop policy if exists pa_vo_upd on public.customers;
create policy pa_vo_upd on public.customers as restrictive for update to authenticated using (not exists (select 1 from public.platform_support_sessions s where s.actor_id = auth.uid() and s.ended_at is null and s.view_only and s.deleted_at is null and s.tenant_id = customers.tenant_id));
drop policy if exists pa_vo_del on public.customers;
create policy pa_vo_del on public.customers as restrictive for delete to authenticated using (not exists (select 1 from public.platform_support_sessions s where s.actor_id = auth.uid() and s.ended_at is null and s.view_only and s.deleted_at is null and s.tenant_id = customers.tenant_id));
drop policy if exists pa_vo_ins on public.invoices;
create policy pa_vo_ins on public.invoices as restrictive for insert to authenticated with check (not exists (select 1 from public.platform_support_sessions s where s.actor_id = auth.uid() and s.ended_at is null and s.view_only and s.deleted_at is null and s.tenant_id = invoices.tenant_id));
drop policy if exists pa_vo_upd on public.invoices;
create policy pa_vo_upd on public.invoices as restrictive for update to authenticated using (not exists (select 1 from public.platform_support_sessions s where s.actor_id = auth.uid() and s.ended_at is null and s.view_only and s.deleted_at is null and s.tenant_id = invoices.tenant_id));
drop policy if exists pa_vo_del on public.invoices;
create policy pa_vo_del on public.invoices as restrictive for delete to authenticated using (not exists (select 1 from public.platform_support_sessions s where s.actor_id = auth.uid() and s.ended_at is null and s.view_only and s.deleted_at is null and s.tenant_id = invoices.tenant_id));
drop policy if exists pa_vo_ins on public.products;
create policy pa_vo_ins on public.products as restrictive for insert to authenticated with check (not exists (select 1 from public.platform_support_sessions s where s.actor_id = auth.uid() and s.ended_at is null and s.view_only and s.deleted_at is null and s.tenant_id = products.tenant_id));
drop policy if exists pa_vo_upd on public.products;
create policy pa_vo_upd on public.products as restrictive for update to authenticated using (not exists (select 1 from public.platform_support_sessions s where s.actor_id = auth.uid() and s.ended_at is null and s.view_only and s.deleted_at is null and s.tenant_id = products.tenant_id));
drop policy if exists pa_vo_del on public.products;
create policy pa_vo_del on public.products as restrictive for delete to authenticated using (not exists (select 1 from public.platform_support_sessions s where s.actor_id = auth.uid() and s.ended_at is null and s.view_only and s.deleted_at is null and s.tenant_id = products.tenant_id));
drop policy if exists pa_vo_ins on public.quotations;
create policy pa_vo_ins on public.quotations as restrictive for insert to authenticated with check (not exists (select 1 from public.platform_support_sessions s where s.actor_id = auth.uid() and s.ended_at is null and s.view_only and s.deleted_at is null and s.tenant_id = quotations.tenant_id));
drop policy if exists pa_vo_upd on public.quotations;
create policy pa_vo_upd on public.quotations as restrictive for update to authenticated using (not exists (select 1 from public.platform_support_sessions s where s.actor_id = auth.uid() and s.ended_at is null and s.view_only and s.deleted_at is null and s.tenant_id = quotations.tenant_id));
drop policy if exists pa_vo_del on public.quotations;
create policy pa_vo_del on public.quotations as restrictive for delete to authenticated using (not exists (select 1 from public.platform_support_sessions s where s.actor_id = auth.uid() and s.ended_at is null and s.view_only and s.deleted_at is null and s.tenant_id = quotations.tenant_id));
drop policy if exists pa_vo_ins on public.employees;
create policy pa_vo_ins on public.employees as restrictive for insert to authenticated with check (not exists (select 1 from public.platform_support_sessions s where s.actor_id = auth.uid() and s.ended_at is null and s.view_only and s.deleted_at is null and s.tenant_id = employees.tenant_id));
drop policy if exists pa_vo_upd on public.employees;
create policy pa_vo_upd on public.employees as restrictive for update to authenticated using (not exists (select 1 from public.platform_support_sessions s where s.actor_id = auth.uid() and s.ended_at is null and s.view_only and s.deleted_at is null and s.tenant_id = employees.tenant_id));
drop policy if exists pa_vo_del on public.employees;
create policy pa_vo_del on public.employees as restrictive for delete to authenticated using (not exists (select 1 from public.platform_support_sessions s where s.actor_id = auth.uid() and s.ended_at is null and s.view_only and s.deleted_at is null and s.tenant_id = employees.tenant_id));
drop policy if exists pa_vo_ins on public.bookings;
create policy pa_vo_ins on public.bookings as restrictive for insert to authenticated with check (not exists (select 1 from public.platform_support_sessions s where s.actor_id = auth.uid() and s.ended_at is null and s.view_only and s.deleted_at is null and s.tenant_id = bookings.tenant_id));
drop policy if exists pa_vo_upd on public.bookings;
create policy pa_vo_upd on public.bookings as restrictive for update to authenticated using (not exists (select 1 from public.platform_support_sessions s where s.actor_id = auth.uid() and s.ended_at is null and s.view_only and s.deleted_at is null and s.tenant_id = bookings.tenant_id));
drop policy if exists pa_vo_del on public.bookings;
create policy pa_vo_del on public.bookings as restrictive for delete to authenticated using (not exists (select 1 from public.platform_support_sessions s where s.actor_id = auth.uid() and s.ended_at is null and s.view_only and s.deleted_at is null and s.tenant_id = bookings.tenant_id));
drop policy if exists pa_vo_ins on public.expense_claims;
create policy pa_vo_ins on public.expense_claims as restrictive for insert to authenticated with check (not exists (select 1 from public.platform_support_sessions s where s.actor_id = auth.uid() and s.ended_at is null and s.view_only and s.deleted_at is null and s.tenant_id = expense_claims.tenant_id));
drop policy if exists pa_vo_upd on public.expense_claims;
create policy pa_vo_upd on public.expense_claims as restrictive for update to authenticated using (not exists (select 1 from public.platform_support_sessions s where s.actor_id = auth.uid() and s.ended_at is null and s.view_only and s.deleted_at is null and s.tenant_id = expense_claims.tenant_id));
drop policy if exists pa_vo_del on public.expense_claims;
create policy pa_vo_del on public.expense_claims as restrictive for delete to authenticated using (not exists (select 1 from public.platform_support_sessions s where s.actor_id = auth.uid() and s.ended_at is null and s.view_only and s.deleted_at is null and s.tenant_id = expense_claims.tenant_id));
drop policy if exists pa_vo_ins on public.journal_entries;
create policy pa_vo_ins on public.journal_entries as restrictive for insert to authenticated with check (not exists (select 1 from public.platform_support_sessions s where s.actor_id = auth.uid() and s.ended_at is null and s.view_only and s.deleted_at is null and s.tenant_id = journal_entries.tenant_id));
drop policy if exists pa_vo_upd on public.journal_entries;
create policy pa_vo_upd on public.journal_entries as restrictive for update to authenticated using (not exists (select 1 from public.platform_support_sessions s where s.actor_id = auth.uid() and s.ended_at is null and s.view_only and s.deleted_at is null and s.tenant_id = journal_entries.tenant_id));
drop policy if exists pa_vo_del on public.journal_entries;
create policy pa_vo_del on public.journal_entries as restrictive for delete to authenticated using (not exists (select 1 from public.platform_support_sessions s where s.actor_id = auth.uid() and s.ended_at is null and s.view_only and s.deleted_at is null and s.tenant_id = journal_entries.tenant_id));
drop policy if exists pa_vo_ins on public.purchase_orders;
create policy pa_vo_ins on public.purchase_orders as restrictive for insert to authenticated with check (not exists (select 1 from public.platform_support_sessions s where s.actor_id = auth.uid() and s.ended_at is null and s.view_only and s.deleted_at is null and s.tenant_id = purchase_orders.tenant_id));
drop policy if exists pa_vo_upd on public.purchase_orders;
create policy pa_vo_upd on public.purchase_orders as restrictive for update to authenticated using (not exists (select 1 from public.platform_support_sessions s where s.actor_id = auth.uid() and s.ended_at is null and s.view_only and s.deleted_at is null and s.tenant_id = purchase_orders.tenant_id));
drop policy if exists pa_vo_del on public.purchase_orders;
create policy pa_vo_del on public.purchase_orders as restrictive for delete to authenticated using (not exists (select 1 from public.platform_support_sessions s where s.actor_id = auth.uid() and s.ended_at is null and s.view_only and s.deleted_at is null and s.tenant_id = purchase_orders.tenant_id));
drop policy if exists pa_vo_ins on public.suppliers;
create policy pa_vo_ins on public.suppliers as restrictive for insert to authenticated with check (not exists (select 1 from public.platform_support_sessions s where s.actor_id = auth.uid() and s.ended_at is null and s.view_only and s.deleted_at is null and s.tenant_id = suppliers.tenant_id));
drop policy if exists pa_vo_upd on public.suppliers;
create policy pa_vo_upd on public.suppliers as restrictive for update to authenticated using (not exists (select 1 from public.platform_support_sessions s where s.actor_id = auth.uid() and s.ended_at is null and s.view_only and s.deleted_at is null and s.tenant_id = suppliers.tenant_id));
drop policy if exists pa_vo_del on public.suppliers;
create policy pa_vo_del on public.suppliers as restrictive for delete to authenticated using (not exists (select 1 from public.platform_support_sessions s where s.actor_id = auth.uid() and s.ended_at is null and s.view_only and s.deleted_at is null and s.tenant_id = suppliers.tenant_id));
drop policy if exists pa_vo_ins on public.leave_requests;
create policy pa_vo_ins on public.leave_requests as restrictive for insert to authenticated with check (not exists (select 1 from public.platform_support_sessions s where s.actor_id = auth.uid() and s.ended_at is null and s.view_only and s.deleted_at is null and s.tenant_id = leave_requests.tenant_id));
drop policy if exists pa_vo_upd on public.leave_requests;
create policy pa_vo_upd on public.leave_requests as restrictive for update to authenticated using (not exists (select 1 from public.platform_support_sessions s where s.actor_id = auth.uid() and s.ended_at is null and s.view_only and s.deleted_at is null and s.tenant_id = leave_requests.tenant_id));
drop policy if exists pa_vo_del on public.leave_requests;
create policy pa_vo_del on public.leave_requests as restrictive for delete to authenticated using (not exists (select 1 from public.platform_support_sessions s where s.actor_id = auth.uid() and s.ended_at is null and s.view_only and s.deleted_at is null and s.tenant_id = leave_requests.tenant_id));
drop policy if exists pa_vo_ins on public.platform_activities;
create policy pa_vo_ins on public.platform_activities as restrictive for insert to authenticated with check (not exists (select 1 from public.platform_support_sessions s where s.actor_id = auth.uid() and s.ended_at is null and s.view_only and s.deleted_at is null and s.tenant_id = platform_activities.tenant_id));
drop policy if exists pa_vo_upd on public.platform_activities;
create policy pa_vo_upd on public.platform_activities as restrictive for update to authenticated using (not exists (select 1 from public.platform_support_sessions s where s.actor_id = auth.uid() and s.ended_at is null and s.view_only and s.deleted_at is null and s.tenant_id = platform_activities.tenant_id));
drop policy if exists pa_vo_del on public.platform_activities;
create policy pa_vo_del on public.platform_activities as restrictive for delete to authenticated using (not exists (select 1 from public.platform_support_sessions s where s.actor_id = auth.uid() and s.ended_at is null and s.view_only and s.deleted_at is null and s.tenant_id = platform_activities.tenant_id));
drop policy if exists pa_vo_ins on public.tenants;
create policy pa_vo_ins on public.tenants as restrictive for insert to authenticated with check (not exists (select 1 from public.platform_support_sessions s where s.actor_id = auth.uid() and s.ended_at is null and s.view_only and s.deleted_at is null and s.tenant_id = tenants.id));
drop policy if exists pa_vo_upd on public.tenants;
create policy pa_vo_upd on public.tenants as restrictive for update to authenticated using (not exists (select 1 from public.platform_support_sessions s where s.actor_id = auth.uid() and s.ended_at is null and s.view_only and s.deleted_at is null and s.tenant_id = tenants.id));
drop policy if exists pa_vo_del on public.tenants;
create policy pa_vo_del on public.tenants as restrictive for delete to authenticated using (not exists (select 1 from public.platform_support_sessions s where s.actor_id = auth.uid() and s.ended_at is null and s.view_only and s.deleted_at is null and s.tenant_id = tenants.id));

-- 4) platform-only audit: allow extra session actions + PA self-insert (enter/exit already written by the RPCs)
alter table public.platform_admin_audit drop constraint if exists platform_admin_audit_action_check;
alter table public.platform_admin_audit add constraint platform_admin_audit_action_check check (action in (
  'suspend_tenant', 'reactivate_tenant', 'set_tenant_plan', 'create_announcement', 'soft_delete_tenant', 'record_payment',
  'delete_tenant_plan_payment', 'enter_support_tenant', 'exit_support_tenant',
  'support_view_only_on', 'support_view_only_off', 'support_idle_exit', 'support_switch_tenant', 'support_big_action')) not valid;
drop policy if exists pa_audit_self_ins on public.platform_admin_audit;
create policy pa_audit_self_ins on public.platform_admin_audit for insert to authenticated with check (actor_user_id = auth.uid() and exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.role = 'platform_admin'));

-- 5) System Development progress
update public.dev_roadmap_items set stage = 'completed', module = 'admin' where title = 'Platform admin direct Enter (silent support session)';
insert into public.dev_roadmap_items (title, description, module, stage)
select 'Platform admin direct Enter (silent support session)', 'PA Enter without popup/consent, all modules; orange PA banner (view-only, switch tenant, 60 min idle exit); recent tenants; big-action confirm; PA session rows hidden from tenant Activity/Audit/bell (platform_support_sessions + restrictive RLS); server-side view-only on core tables; platform_admin_audit session actions; Support Access text + PDPA clause on Service Contract.', 'admin', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Platform admin direct Enter (silent support session)');
notify pgrst, 'reload schema';
