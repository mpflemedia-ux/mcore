-- dk_cron.sql — daily document reminders (overdue invoices, unanswered quotations, pending signers).
-- Run AFTER dk_phase0_kit.sql. Idempotent (unschedules then re-schedules). 01:00 UTC = 09:00 MYT.
-- WRITE-ONLY: review, then run in the Supabase SQL editor (needs the pg_cron extension).
create extension if not exists pg_cron;
select cron.unschedule(jobid) from cron.job where jobname = 'mcore-dk-remind';
select cron.schedule('mcore-dk-remind', '0 1 * * *', 'select public.dk_remind_run()');
select jobid, jobname, schedule, active from cron.job where jobname = 'mcore-dk-remind';
