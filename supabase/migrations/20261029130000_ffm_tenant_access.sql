-- FFM tenant gate: Flash Fulfillment visible/usable ONLY for Platform Admin + tenants enabled here (pilot: Brzky Empire).
-- WRITE-ONLY: run in Supabase SQL Editor AFTER 20261029120000_ffm_connector.sql. Idempotent / rerun-safe.
-- Platform-managed: tenant users can only READ their own row (cannot self-enable; tenants.config is tenant-writable so not used).
-- Enforced server-side in ffm-api (403), ffm-cron (skips), ffm-webhook (ack, no updates); client hides hub/DO card/PO card.

create table if not exists public.ffm_tenant_access (
  tenant_id uuid primary key references public.tenants(id),
  enabled boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table public.ffm_tenant_access enable row level security;
revoke all on table public.ffm_tenant_access from anon;
revoke insert, update, delete, truncate on table public.ffm_tenant_access from authenticated;
grant select on table public.ffm_tenant_access to authenticated;
grant all on table public.ffm_tenant_access to service_role;
drop policy if exists ffm_tenant_access_read on public.ffm_tenant_access;
create policy ffm_tenant_access_read on public.ffm_tenant_access for select to authenticated
  using (tenant_id = public.get_my_tenant_id() or public.is_platform_admin());

-- Enable Brzky Empire (looked up by name; no hardcoded uuid). Exactly one match required.
do $$
declare v_ids uuid[];
begin
  select array_agg(id) into v_ids from public.tenants
  where deleted_at is null and (name ilike 'brzky empire%' or name ilike 'brozky empire%');
  if coalesce(array_length(v_ids, 1), 0) = 1 then
    insert into public.ffm_tenant_access (tenant_id, enabled, note)
    values (v_ids[1], true, 'FFM pilot')
    on conflict (tenant_id) do update set enabled = true, deleted_at = null, updated_at = now();
    raise notice 'FFM enabled for tenant %', v_ids[1];
  else
    raise notice 'Brzky Empire tenant match count = % — not enabled; check: select id, name from public.tenants where name ilike ''%%brzky%%'';', coalesce(array_length(v_ids, 1), 0);
  end if;
end $$;
