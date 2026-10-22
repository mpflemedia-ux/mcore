-- M-Core Phone alerts — System Development (dev_roadmap_items). WRITE-ONLY. Rerun-safe.
insert into public.dev_roadmap_items (title, description, module, stage)
select 'Phone alerts P1 — honest status + local fixes', 'Real permission/subscription status on Notification settings, honest Send test, high-priority bypass of quiet hours for phone, dedupe by notification id (no per-title daily cap), unique tags, notificationclick deep links, legacy mute no longer blocks phone alerts when bell v2 is on.', 'core', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Phone alerts P1 — honest status + local fixes');
update public.dev_roadmap_items set stage = 'completed' where title = 'Phone alerts P1 — honest status + local fixes';

insert into public.dev_roadmap_items (title, description, module, stage)
select 'Phone alerts P2 — Web Push', 'VAPID Web Push: push_subscriptions + push_log + push_settings, sw.js push handler, edge function push-send (settings + quiet hours Asia/Kuala_Lumpur + high priority bypass, 404/410 cleanup, Telegram fallback, 2-min grouping, action buttons, SLA 2h/overdue reminders, urgent stays until tapped), server-routed Send test, device list.', 'core', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Phone alerts P2 — Web Push');
update public.dev_roadmap_items set stage = 'completed' where title = 'Phone alerts P2 — Web Push';

insert into public.dev_roadmap_items (title, description, module, stage)
select 'Phone alerts P3 — polish', 'Monochrome badge, morning summary push, iPhone Add to Home Screen guide, urgent SR escalation to platform admin Telegram (tenant minutes setting), client push on Delivered / Need info, role-based phone routing (default = current behaviour).', 'core', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Phone alerts P3 — polish');
update public.dev_roadmap_items set stage = 'completed' where title = 'Phone alerts P3 — polish';
