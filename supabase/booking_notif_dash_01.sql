-- M-Core: New booking notification deep link + dashboard booking card MYT day bounds.
-- WRITE-ONLY: run in Supabase SQL Editor after deploy. Rerun-safe. No functions / $$ / pgcrypto.
-- Client-only feature (booking-realtime.js v2, booking-card-ui.js v3, booking.js v3).

update public.dev_roadmap_items set stage = 'completed', module = 'sales'
where title = 'Booking: New booking notification opens that booking';
insert into public.dev_roadmap_items (title, description, module, stage)
select 'Booking: New booking notification opens that booking',
  'Bell / OS tap on New booking inserts self notification with ref_table=bookings, ref_id, link.page=dashboard + params.bkid; NT.fromRow and openPage open the dashboard booking card and expand that row (mirrors booking-pay-go payment-claim pattern). Legacy rows without ref stay dashboard-only.',
  'sales', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Booking: New booking notification opens that booking');

update public.dev_roadmap_items set stage = 'completed', module = 'sales'
where title = 'Booking: dashboard card day bounds use MYT';
insert into public.dev_roadmap_items (title, description, module, stage)
select 'Booking: dashboard card day bounds use MYT',
  'Dashboard booking card filters (today / 7d / upcoming / all) and the today-only dash card query use Asia/Kuala_Lumpur day strings with T00:00:00+08:00 / T23:59:59.999+08:00, not device local midnight. Display fmt already MYT; datetime-local toLocal unchanged.',
  'sales', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Booking: dashboard card day bounds use MYT');

select title, stage, module from public.dev_roadmap_items
where title in (
  'Booking: New booking notification opens that booking',
  'Booking: dashboard card day bounds use MYT'
) order by title;
