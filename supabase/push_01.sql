-- M-Core Phone alerts (Web Push) — tables + RLS. WRITE-ONLY: run in Supabase SQL Editor. Idempotent / rerun-safe.
-- No CREATE FUNCTION, no $$, no pgcrypto. The app keeps the old in-app behaviour until this file has run (feature-detect).

-- 1) Device subscriptions (one row per user per browser endpoint). Soft delete only.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  user_id uuid not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  device_label text,
  ua text,
  platform text,
  lang text not null default 'en',
  last_seen_at timestamptz not null default now(),
  last_ok_at timestamptz,
  fail_count integer not null default 0,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, endpoint)
);
alter table public.push_subscriptions drop constraint if exists push_subscriptions_len_chk;
alter table public.push_subscriptions add constraint push_subscriptions_len_chk check (length(endpoint) < 1200 and length(coalesce(ua, '')) < 400 and length(coalesce(device_label, '')) < 80);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (tenant_id, user_id) where deleted_at is null;
alter table public.push_subscriptions enable row level security;
drop policy if exists push_sub_read on public.push_subscriptions;
create policy push_sub_read on public.push_subscriptions for select to authenticated using (
  user_id = auth.uid() and tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid()));
drop policy if exists push_sub_ins on public.push_subscriptions;
create policy push_sub_ins on public.push_subscriptions for insert to authenticated with check (
  user_id = auth.uid() and tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid()));
drop policy if exists push_sub_upd on public.push_subscriptions;
create policy push_sub_upd on public.push_subscriptions for update to authenticated
  using (user_id = auth.uid() and tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid()))
  with check (user_id = auth.uid() and tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid()));
grant select, insert, update on public.push_subscriptions to authenticated;
revoke all on public.push_subscriptions from anon;

-- 2) Delivery log (server writes with service role; users can read their own rows). dedupe_key makes sends idempotent.
create table if not exists public.push_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id),
  user_id uuid,
  notification_id uuid,
  subscription_id uuid,
  channel text not null default 'push',
  status text not null default 'pending',
  reason text,
  dedupe_key text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table public.push_log drop constraint if exists push_log_channel_chk;
alter table public.push_log add constraint push_log_channel_chk check (channel in ('push', 'telegram', 'none'));
alter table public.push_log drop constraint if exists push_log_status_chk;
alter table public.push_log add constraint push_log_status_chk check (status in ('pending', 'sent', 'grouped', 'failed', 'skipped', 'gone', 'test'));
create unique index if not exists push_log_dedupe_uidx on public.push_log (dedupe_key);
create index if not exists push_log_user_idx on public.push_log (user_id, created_at desc);
create index if not exists push_log_notif_idx on public.push_log (notification_id);
alter table public.push_log enable row level security;
drop policy if exists push_log_read on public.push_log;
create policy push_log_read on public.push_log for select to authenticated using (
  user_id = auth.uid() and tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid()));
grant select on public.push_log to authenticated;
revoke all on public.push_log from anon;

-- 3) Tenant push settings: role routing + urgent escalation minutes. Empty = current behaviour.
--    settings = { "roles": { "<role>": ["approval","sd","assigned","overdue","contract"] }, "escalate_min": 30 }
create table if not exists public.push_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  settings jsonb not null default '{}'::jsonb,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id)
);
alter table public.push_settings drop constraint if exists push_settings_size_chk;
alter table public.push_settings add constraint push_settings_size_chk check (pg_column_size(settings) < 16000);
alter table public.push_settings enable row level security;
drop policy if exists push_set_read on public.push_settings;
create policy push_set_read on public.push_settings for select to authenticated using (
  tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid()));
drop policy if exists push_set_ins on public.push_settings;
create policy push_set_ins on public.push_settings for insert to authenticated with check (
  tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid() and lower(p.role) in ('owner', 'admin', 'platform_admin')));
drop policy if exists push_set_upd on public.push_settings;
create policy push_set_upd on public.push_settings for update to authenticated
  using (tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid() and lower(p.role) in ('owner', 'admin', 'platform_admin')))
  with check (tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid() and lower(p.role) in ('owner', 'admin', 'platform_admin')));
grant select, insert, update on public.push_settings to authenticated;
revoke all on public.push_settings from anon;

notify pgrst, 'reload schema';
