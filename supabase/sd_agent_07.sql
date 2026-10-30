reset role;

-- SR Agent Backend -- Fasa 1 hotfix. app/sd-core.js's generic "has this table been set up yet"
-- probe (SD.probe(), used by every Service Desk sub-module) does `select('id', {head:true})`
-- against every table in its TABLES map to detect existence/RLS without fetching real rows.
-- sd_agent_settings (sd_agent_01.sql) was given tenant_id as its primary key with no separate
-- id column -- every other probed Service Desk table (service_contracts, service_requests,
-- support_access_consents, service_report_packs) has one. The probe's select('id', ...) against
-- sd_agent_settings fails with 42703 (column does not exist), so SD.has.agent stays false and
-- the Admin -> Service Desk -> Agent tab never renders, however the DB side is actually fine.
-- Caught live: Mike ran all prior SQL + deployed both Edge Functions correctly, but the Agent
-- tab was still missing from the admin menu and from "Arrange menu"'s available items.
-- Additive only -- tenant_id stays the primary key; id is just along for this probe convention.

alter table public.sd_agent_settings add column if not exists id uuid not null default gen_random_uuid();

notify pgrst, 'reload schema';
