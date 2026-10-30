reset role;

-- SR Agent Backend -- Fasa 4 (Notifications). Data-only: backfills kind/type on existing Service
-- Desk notifications that predate app/sd-data.js + app/sd-pa.js now setting both explicitly on
-- every insert (see that Fasa 4 app/*.js diff). Before this, every SR-related bell row relied on
-- notif-core.js NT.classify()'s title-regex guessing at render time (kind stays null in the DB).
-- This backfill makes the DB match what classify() would have guessed, so the same rows read
-- identically before and after -- nothing changes for anyone, it just stops depending on a regex
-- guess at every page load. Idempotent (every UPDATE is guarded by `kind is null`); write-only,
-- Mike runs this manually. No PII, no tenant-identifying values -- safe to commit as-is.

-- 1) New service request (sd-new.js / SD.bellNew default): kind=action.
update public.notifications set kind = 'action', type = 'sd.new'
where kind is null and category = 'service_desk' and ref_table = 'service_requests'
  and (title like 'New service request %' or title like 'Permohonan servis baharu %');

-- 2) Escalation reminder (SD.escalate -> SD.bellNew with the "unopened/no reply" suffix): kind=for_you.
update public.notifications set kind = 'for_you', type = 'sd.status'
where kind is null and category = 'service_desk' and ref_table = 'service_requests'
  and (title like '%· 24h unopened' or title like '%· 4h no reply' or title like '%· 24j tiada buka' or title like '%· 4j tiada balasan');

-- 3) Status change -> delivered (SD.setStatus, stLabel('delivered') = 'Delivered'/'Dihantar'): kind=action.
update public.notifications set kind = 'action', type = 'sd.delivered'
where kind is null and category = 'service_desk' and ref_table = 'service_requests'
  and (title like '%: Delivered' or title like '%: Dihantar');

-- 4) Status change -> revision (stLabel('revision') = 'Revision'/'Revisi'): kind=action.
update public.notifications set kind = 'action', type = 'sd.revision'
where kind is null and category = 'service_desk' and ref_table = 'service_requests'
  and (title like '%: Revision' or title like '%: Revisi');

-- 5) New message on a request (sd-detail.js comment bell): kind=for_you.
update public.notifications set kind = 'for_you', type = 'sd.message'
where kind is null and category = 'service_desk' and ref_table = 'service_requests'
  and (title like '%: new message' or title like '%: mesej baharu');

-- 6) Everything else still untouched: every other status-change bell (submitted/triaged/
--    in_progress/waiting_client/closed/out_of_scope/cancelled) -- same fallback classify() itself
--    would have picked (kind=for_you) for category='service_desk' outside the revision/delivered
--    cases above.
update public.notifications set kind = 'for_you', type = coalesce(type, 'sd.status')
where kind is null and category = 'service_desk' and ref_table = 'service_requests';

update public.dev_roadmap_items set stage = 'completed', module = 'service_desk',
  description = 'SR Agent Backend Fasa 4 (Notifications): bellFor/bellNew set kind+type explicitly on every SR notification going forward; this backfill makes existing rows match. Also: push-send sla() stale-reminder cleanup, platform_admin morning() ops summary (overdue/near-SLA/AI-drafts/waiting-client, deep-linked to the Service Desk board), tighter activity-bell grouping (ACT_RE-matched prefix + 2-min rolling window, financial trigger untouched), notif-push-boot.js forwards ?view= on deep links, and the push "Hantar"/deliver action on sd.ai_draft notifications (promotes the latest AI draft + moves the SR to delivered straight from the notification, platform_admin + signed-token gated). Fixed in the same PR: sd-agent''s Fasa 2 upload_draft notified "platform_admin" scoped to the client''s own tenant_id (tenantStaff), which is always empty since platform_admin is a global role -- switched to a tenant-agnostic lookup (allPlatformAdmins), matching the pattern already used by the existing sd-result function''s bellAdmins().'
where title = 'Service Desk: SR Agent Backend (Fasa 4 — Notifications)';
insert into public.dev_roadmap_items (title, description, module, stage)
select 'Service Desk: SR Agent Backend (Fasa 4 — Notifications)',
  'SR Agent Backend Fasa 4 (Notifications): bellFor/bellNew set kind+type explicitly on every SR notification going forward; this backfill makes existing rows match. Also: push-send sla() stale-reminder cleanup, platform_admin morning() ops summary (overdue/near-SLA/AI-drafts/waiting-client, deep-linked to the Service Desk board), tighter activity-bell grouping (ACT_RE-matched prefix + 2-min rolling window, financial trigger untouched), notif-push-boot.js forwards ?view= on deep links, and the push "Hantar"/deliver action on sd.ai_draft notifications (promotes the latest AI draft + moves the SR to delivered straight from the notification, platform_admin + signed-token gated). Fixed in the same PR: sd-agent''s Fasa 2 upload_draft notified "platform_admin" scoped to the client''s own tenant_id (tenantStaff), which is always empty since platform_admin is a global role -- switched to a tenant-agnostic lookup (allPlatformAdmins), matching the pattern already used by the existing sd-result function''s bellAdmins().',
  'service_desk', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Service Desk: SR Agent Backend (Fasa 4 — Notifications)');
