-- Service Desk: let clients bell platform admins (who live in another tenant) on new request / status / message.
-- WRITE ONLY. Idempotent. No functions, no $$, no extensions.
-- Why: (1) user_profiles RLS (user_profiles_select_tenant) hides platform admins from client users, so the app
--      finds 0 recipients; (2) notif_v2_ins only allows inserts into the inserter's own tenant (or by a PA).
-- App side (sd-data.js SD.bellFor) reads public.sd_platform_admins; it falls back gracefully until this runs.

-- 1) minimal recipient list: id + tenant only (no name/email). Plain view = owner rights, bypasses user_profiles RLS.
create or replace view public.sd_platform_admins with (security_invoker = false) as
  select p.id, p.tenant_id from public.user_profiles p
  where p.role = 'platform_admin' and p.tenant_id is not null;
revoke all on public.sd_platform_admins from anon;
grant select on public.sd_platform_admins to authenticated;

-- 2) extra permissive insert policy (ORs with notif_v2_ins): service_desk bell to a platform admin,
--    in the admin's own tenant, only from a user whose tenant has a service contract.
drop policy if exists notif_sd_to_pa_ins on public.notifications;
create policy notif_sd_to_pa_ins on public.notifications for insert to authenticated with check (
  category = 'service_desk' and tenant_id is not null and deleted_at is null
  and (actor_id is null or actor_id = auth.uid())
  and exists (select 1 from public.sd_platform_admins a where a.id = notifications.user_id and a.tenant_id = notifications.tenant_id)
  and exists (select 1 from public.service_contracts c
              where c.deleted_at is null
                and c.tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid())));

notify pgrst, 'reload schema';

insert into public.dev_roadmap_items (title, description, module, stage)
select 'Service Desk: notify platform admin', 'Client new request / status / message now rings the platform admin bell (cross-tenant recipient view + scoped insert policy).', 'service_desk', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Service Desk: notify platform admin');
