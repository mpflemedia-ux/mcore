-- M-Core bell: route DB-function notifications (fn_emit_activity_notification etc.) + self-filter. WRITE-ONLY, idempotent.
-- No CREATE FUNCTION. Run after notif_01. Safe to rerun any time.

-- 1) actor_id defaults to the caller. auth.uid() reads the request JWT, so it is the logged-in user even inside
--    SECURITY DEFINER functions (fn_emit_activity_notification, cob_notify_tenant). Cron/service-role inserts get null.
--    The app's notify() always sets actor_id explicitly; own reminders set it to null.
alter table public.notifications alter column actor_id set default auth.uid();

-- 2) kind gets NO default on purpose: one default would also send onboarding (cob_notify_tenant),
--    probation reminders and Service Desk revisions to Aktiviti. The app classifies kind-null rows on read:
--    sales/finance/inventory/purchasing, or hr with ref_table (fn_emit_activity_notification) -> Aktiviti; others -> Untuk Kau.
alter table public.notifications alter column kind drop default;

-- 3) Re-route rows notif_01 put in Untuk Kau that came from fn_emit_activity_notification (hr + ref_table, no type)
update public.notifications set kind = 'activity'
where kind is distinct from 'activity' and type is null and ref_table is not null
  and category in ('hr','sales','finance','inventory','purchasing');
update public.notifications set kind = 'activity'
where kind is null and category in ('hr','sales','finance','inventory','purchasing') and ref_table is not null;

-- 4) Rows inserted without tenant_id (probation reminders) -> fill from the recipient's profile (rerun as needed)
update public.notifications n set tenant_id = p.tenant_id
from public.user_profiles p where n.tenant_id is null and p.id = n.user_id and p.tenant_id is not null;

notify pgrst, 'reload schema';

-- 5) READ-ONLY check: every policy on the two tables. Any row with permissive = 'RESTRICTIVE' must be sent to the dev.
select tablename, policyname, permissive, cmd, roles, qual, with_check
from pg_policies where schemaname = 'public' and tablename in ('notifications','notification_settings')
order by tablename, cmd, policyname;
