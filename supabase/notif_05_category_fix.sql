-- M-Core Notifications - fix notifications_category_check: it only allowed ('sales','inventory',
-- 'purchasing','finance','hr') but most of the app's "for_you" notifications use a category it
-- never allowed, so those inserts have been silently rejected (caught and swallowed by the calling
-- code everywhere, by design) for as long as this constraint has existed - not something introduced
-- by the Projects public-report or Service Desk work; found while debugging why report-link
-- "leave a message" notifications never reached the bell.
--
-- Values this adds, confirmed actually used in the codebase:
--   projects      - app's project report-share message notifications (this session's work)
--   service_desk  - app/sd-data.js, app/sd-pa.js, sd-result edge function (confirm/revise/reopen)
--   sd            - app/notif-hooks.js's support-access notification (type 'sd.support', no
--                   explicit category -> falls back to the type prefix)
--   assigned      - app/pj-multi-remind.js, and every NT.notify() call for task assignment/
--                   comment/@mention (app/notif-hooks.js's NT.taskSaved/NT.taskComment) that never
--                   sets an explicit category
--   approval      - app/notif-hooks.js's attendance-exception and approval-result notifications
--   self          - app/notif-hooks.js's local reminder bell rows (_notifPushBell wrap)
--
-- Purely additive (keeps the 5 existing values) - does not change or re-validate any existing row.
alter table public.notifications drop constraint if exists notifications_category_check;
alter table public.notifications add constraint notifications_category_check
  check (category = ANY (ARRAY['sales', 'inventory', 'purchasing', 'finance', 'hr', 'projects', 'service_desk', 'sd', 'assigned', 'approval', 'self']::text[]));

notify pgrst, 'reload schema';
