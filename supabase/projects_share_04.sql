-- M-Core Projects - Public Report Link, phase 4: notification fixes for "a viewer left a message".
-- Run after projects_share_01/02/03.sql. Rerun-safe.
--
-- 1) Lets the admin "Share report" toolbar button show a small unread-message dot: a link now
--    remembers when the admin last opened its share modal (messages_seen_at). No new table - the
--    notifications/notification_settings/telegram_links tables used for the bell + Telegram fix
--    below already exist (notif_01_redesign.sql / notif_02_realtime.sql), this is code-only there.
alter table public.project_share_links add column if not exists messages_seen_at timestamptz;

notify pgrst, 'reload schema';

update public.dev_roadmap_items set stage = 'completed', module = 'projects',
  description = 'Projects + Service Desk public-link notifications: pj-report and sd-result edge functions now insert full bell rows (type/link/ref_table/ref_id/group_key, mirroring app/notif-core.js NT.notify()) instead of a bare title/body insert, so clicking the bell notification opens the right project/ticket and same-day messages group together; both also fan out to Telegram via the existing telegram-send function when the admin has that channel turned on for the category. Added a 5-message-per-hour rate limit on the public "leave a message" endpoint, and an unread-message dot on the Projects "Share report" toolbar button.'
where title = 'Projects/SD: public-link message notifications - bell routing + Telegram + rate limit + unread dot';
insert into public.dev_roadmap_items (title, description, module, stage)
select 'Projects/SD: public-link message notifications - bell routing + Telegram + rate limit + unread dot', 'Projects + Service Desk public-link notifications: pj-report and sd-result edge functions now insert full bell rows (type/link/ref_table/ref_id/group_key, mirroring app/notif-core.js NT.notify()) instead of a bare title/body insert, so clicking the bell notification opens the right project/ticket and same-day messages group together; both also fan out to Telegram via the existing telegram-send function when the admin has that channel turned on for the category. Added a 5-message-per-hour rate limit on the public "leave a message" endpoint, and an unread-message dot on the Projects "Share report" toolbar button.', 'projects', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Projects/SD: public-link message notifications - bell routing + Telegram + rate limit + unread dot');
