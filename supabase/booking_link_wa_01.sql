-- M-Core: Share public booking link via WhatsApp (beside Copy link). WRITE-ONLY. Rerun-safe. No functions/$$/pgcrypto.
update public.dev_roadmap_items set stage = 'completed', module = 'sales'
where title = 'Booking: share public link via WhatsApp';
insert into public.dev_roadmap_items (title, description, module, stage)
select 'Booking: share public link via WhatsApp',
  'Dashboard Tempahan and Settings > Public booking: WhatsApp button beside Copy/Salin link. Opens wa.me/?text= with EN/BM prefilled message + ?book=TOKEN (pick contact). Copy unchanged. Extends booking-token-fix.js v2.',
  'sales', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Booking: share public link via WhatsApp');
select title, stage, module from public.dev_roadmap_items where title = 'Booking: share public link via WhatsApp';
