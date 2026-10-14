-- M-Core Bell Notification Redesign (F1-F5). WRITE-ONLY: run in Supabase SQL Editor. Idempotent / rerun-safe.
-- No CREATE FUNCTION, no pgcrypto. The new bell stays hidden until this file has run (old bell keeps working).

-- 1) notifications: new columns (all nullable / defaulted, so existing inserts + triggers keep working)
alter table public.notifications add column if not exists kind text;
alter table public.notifications add column if not exists type text;
alter table public.notifications add column if not exists priority smallint not null default 0;
alter table public.notifications add column if not exists link jsonb;
alter table public.notifications add column if not exists group_key text;
alter table public.notifications add column if not exists actor_id uuid;
alter table public.notifications add column if not exists ref_table text;
alter table public.notifications add column if not exists ref_id text;
alter table public.notifications add column if not exists acted_at timestamptz;
alter table public.notifications add column if not exists deleted_at timestamptz;
alter table public.notifications drop constraint if exists notifications_kind_chk;
alter table public.notifications add constraint notifications_kind_chk check (kind is null or kind in ('action','for_you','activity'));
alter table public.notifications drop constraint if exists notifications_priority_chk;
alter table public.notifications add constraint notifications_priority_chk check (priority between 0 and 2);
create index if not exists notifications_user_live_idx on public.notifications (user_id, tenant_id, created_at desc) where deleted_at is null;
create index if not exists notifications_group_idx on public.notifications (user_id, group_key) where deleted_at is null;

-- 2) Fix missing tenant_id on old rows (probation / older onboarding inserts had none)
update public.notifications n set tenant_id = p.tenant_id
from public.user_profiles p where n.tenant_id is null and p.id = n.user_id and p.tenant_id is not null;

-- 3) Route trigger-made "saved / recorded" rows to Aktiviti (rows have no kind; the app also classifies new ones)
update public.notifications set kind = 'activity'
where kind is null and (category in ('sales','finance','inventory','purchasing')
  or title ~ '^(Kehadiran direkod|Entri jurnal baru|Produk baru ditambah|Invois baru|Pekerja baru ditambah|Bayaran diterima|Baucar bayaran baru|Jualan POS baru|PO baru|Tuntutan perbelanjaan baru|GRN direkod)');
update public.notifications set kind = 'action', priority = 1
where kind is null and category = 'service_desk' and (title ilike '%pindaan%' or title ilike '%revision%');
update public.notifications set kind = 'for_you' where kind is null;

-- 4) Retention: soft delete after 90 days (rerun any time; the app also hides >90d rows and tidies on open)
update public.notifications set deleted_at = now() where deleted_at is null and created_at < now() - interval '90 days';

-- 5) RLS policies for notifications (added alongside any existing ones; permissive = OR)
drop policy if exists notif_v2_read on public.notifications;
create policy notif_v2_read on public.notifications for select to authenticated using (
  user_id = auth.uid() and deleted_at is null
  and (tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid())
       or exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin')));
drop policy if exists notif_v2_ins on public.notifications;
create policy notif_v2_ins on public.notifications for insert to authenticated with check (
  tenant_id is not null and deleted_at is null and (actor_id is null or actor_id = auth.uid())
  and exists (select 1 from public.user_profiles r where r.id = user_id and r.tenant_id = notifications.tenant_id)
  and (tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid())
       or exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin')));
drop policy if exists notif_v2_upd on public.notifications;
create policy notif_v2_upd on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 6) Per-user settings (type x channel, quiet hours, digest, snooze, pin)
create table if not exists public.notification_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  user_id uuid not null,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, user_id)
);
alter table public.notification_settings drop constraint if exists notification_settings_size_chk;
alter table public.notification_settings add constraint notification_settings_size_chk check (pg_column_size(settings) < 32000);
alter table public.notification_settings enable row level security;
drop policy if exists notif_set_read on public.notification_settings;
create policy notif_set_read on public.notification_settings for select to authenticated using (
  tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid())
  or exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin'));
drop policy if exists notif_set_ins on public.notification_settings;
create policy notif_set_ins on public.notification_settings for insert to authenticated with check (
  user_id = auth.uid() and (tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid())
    or exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin')));
drop policy if exists notif_set_upd on public.notification_settings;
create policy notif_set_upd on public.notification_settings for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update on public.notification_settings to authenticated;
revoke all on public.notification_settings from anon;

notify pgrst, 'reload schema';

insert into public.dev_roadmap_items (title, description, module, stage)
select 'Bell Notification Redesign (F1-F5)', 'Central notify() template, filters (own actions, role, per-user prefs, grouping), 3 tabs Tindakan / Untuk Kau / Aktiviti, deep links, inline Lulus/Tolak, snooze/pin, per-user settings type x channel + quiet hours, morning digest, 24h escalation, audit (sent/read/acted), 90-day retention, realtime, full notifications page.', 'core', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Bell Notification Redesign (F1-F5)');
