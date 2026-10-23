-- M-Core booking payment flow, step 4 of 4: Dev Roadmap entries (marks the work as completed).
-- WRITE-ONLY: run in Supabase SQL Editor after booking_pay_01..03.sql. Rerun-safe (update + insert-if-missing).

update public.dev_roadmap_items set stage = 'completed', module = 'sales' where title = 'Booking: pay after Confirm hold (DuitNow QR + receipt)';
insert into public.dev_roadmap_items (title, description, module, stage)
select 'Booking: pay after Confirm hold (DuitNow QR + receipt)', 'Public booking: after Confirm hold the customer sees DuitNow QR, short pay ref (BKxxxxxx), copy buttons, amount due (deposit or full), camera / file upload with compression, WhatsApp backup with prefilled "Payment INV booking BK". Upload freezes the hold. Reopenable status page (?book=..&bkpay=token, also on the public invoice link): waiting / verified + receipt link / rejected with reason / part paid / expired.', 'sales', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Booking: pay after Confirm hold (DuitNow QR + receipt)');

update public.dev_roadmap_items set stage = 'completed', module = 'sales' where title = 'Booking: Payments to review queue';
insert into public.dev_roadmap_items (title, description, module, stage)
select 'Booking: Payments to review queue', 'Sales tab "Payments to review (n)": receipt left, invoice + booking right (stacked on mobile), checks: amount vs due, AI-read amount and date, duplicate file (sha256), reused bank ref, pay ref. One-tap Verify (records payment via Record Payment, keeps the original file, makes the official receipt PDF, confirms booking on deposit / full) or Reject with reason (2 h grace hold). Verifier = owner / admin, never the invoice maker; platform admin full access.', 'sales', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Booking: Payments to review queue');

update public.dev_roadmap_items set stage = 'completed', module = 'sales' where title = 'Booking: deposits, grace and staff alerts';
insert into public.dev_roadmap_items (title, description, module, stage)
select 'Booking: deposits, grace and staff alerts', 'Deposit % per booking service (blank = full); grace and reminder minutes in Settings > Public booking (pay_settings.bk_grace_min / bk_remind_min). Cron mcore-bkpay-tick (freeze, grace, deposit confirm, expiry), mcore-bkpay-notify (bell + push to owner / admin on upload, slow-review reminder), mcore-bkpay-morning (9 AM MYT summary). Tables: payment_claims columns, view bkpay_pub.', 'sales', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Booking: deposits, grace and staff alerts');

select title, stage, module from public.dev_roadmap_items where title like 'Booking:%' order by title;
