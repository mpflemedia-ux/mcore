-- Service Desk notification flow. WRITE ONLY. Idempotent.
-- 1) platform admin recipient view (bypass user_profiles RLS)
create or replace view public.sd_platform_admins with (security_invoker = false) as
  select p.id, p.tenant_id from public.user_profiles p
  where p.role = 'platform_admin' and p.tenant_id is not null;
revoke all on public.sd_platform_admins from anon;
grant select on public.sd_platform_admins to authenticated;

-- 2) insert policy: client may bell a platform admin in the admin's tenant
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
select 'Service Desk notification flow', 'Click opens ticket, badge on Admin tab, morning digest, escalation, working hours.', 'service_desk', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Service Desk notification flow');
