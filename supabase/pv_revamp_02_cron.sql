-- M-Core PV revamp — OPTIONAL hourly signature reminder via pg_cron (same extension push_02.sql already enabled).
-- WRITE-ONLY: run AFTER pv_revamp_01.sql. Rerun-safe. Without this file the app still runs pv_remind_pending() on open (own tenant).
-- Reminders insert into notifications -> push-send webhook delivers bell + phone push. No amounts.
create extension if not exists pg_cron;
select cron.unschedule(jobid) from cron.job where jobname = 'mcore-pv-remind';
select cron.schedule('mcore-pv-remind', '15 * * * *', 'select public.pv_remind_pending()');
select jobid, jobname, schedule, active from cron.job where jobname = 'mcore-pv-remind';
