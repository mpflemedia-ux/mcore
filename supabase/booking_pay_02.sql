-- M-Core booking payment flow, step 2 of 4: hold keeper (Supabase Cron, every minute, plain SQL).
-- WRITE-ONLY: run in Supabase SQL Editor AFTER booking_pay_01.sql. Rerun-safe. No functions, no dollar quoting. Needs pg_cron (already on for push_02).
-- What it does:
--   a) a receipt is waiting for review -> the hold never expires (hold_until = null), even if nobody opened the page again;
--   b) review finished but the booking is still unpaid (receipt rejected, or only part paid) -> a fresh grace hold:
--      last review time + pay_settings.bk_grace_min (default 120 min). After that the existing expiry releases the slot;
--   b2) deposit services: once the verified payments reach the deposit, the booking is confirmed (backup for the app doing it);
--   c) runs the existing public.expire_stale_bookings() so released slots free up even when nobody opens the booking page.
create extension if not exists pg_cron;
select cron.unschedule(jobid) from cron.job where jobname = 'mcore-bkpay-tick';
select cron.schedule(
  'mcore-bkpay-tick',
  '* * * * *',
  'update public.bookings b set hold_until = null, updated_at = now() where b.status in (''hold'', ''pending_payment'') and b.hold_until is not null and b.invoice_id is not null and exists (select 1 from public.payment_claims c where c.tenant_id = b.tenant_id and c.invoice_id = b.invoice_id and c.status = ''pending'' and c.deleted_at is null); update public.bookings b set hold_until = coalesce((select max(c.reviewed_at) from public.payment_claims c where c.tenant_id = b.tenant_id and c.invoice_id = b.invoice_id and c.deleted_at is null), now()) + make_interval(mins => coalesce((select ps.bk_grace_min from public.pay_settings ps where ps.tenant_id = b.tenant_id), 120)), updated_at = now() where b.status in (''hold'', ''pending_payment'') and b.hold_until is null and b.invoice_id is not null and exists (select 1 from public.payment_claims c where c.tenant_id = b.tenant_id and c.invoice_id = b.invoice_id and c.deleted_at is null) and not exists (select 1 from public.payment_claims c where c.tenant_id = b.tenant_id and c.invoice_id = b.invoice_id and c.status = ''pending'' and c.deleted_at is null); update public.bookings b set status = ''confirmed'', payment_channel = coalesce(b.payment_channel, ''bank_transfer''), updated_at = now() from public.booking_services s, public.invoices i where s.id = b.service_id and s.tenant_id = b.tenant_id and i.id = b.invoice_id and i.tenant_id = b.tenant_id and b.status in (''hold'', ''pending_payment'') and coalesce(s.deposit_pct, 0) > 0 and coalesce(i.paid_amt, 0) > 0 and coalesce(i.paid_amt, 0) >= round(coalesce(i.total, 0) * s.deposit_pct / 100, 2) - 0.005 and exists (select 1 from public.payment_claims c where c.tenant_id = b.tenant_id and c.invoice_id = b.invoice_id and c.status = ''approved'' and c.deleted_at is null); select public.expire_stale_bookings();'
);
-- check (read-only)
select jobid, jobname, schedule, active from cron.job where jobname = 'mcore-bkpay-tick';
