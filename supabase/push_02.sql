-- M-Core Phone alerts — scheduler (Supabase Cron + pg_net) for SLA reminders, urgent escalation, morning summary,
-- backstop delivery and subscription cleanup. WRITE-ONLY. Run AFTER push_01.sql and AFTER deploying the push-send function.
-- No CREATE FUNCTION, no $$. Needs extensions pg_cron + pg_net (Dashboard -> Database -> Extensions) and Vault (on by default).

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 1) Store the shared secret in Vault (replace the text in quotes with the SAME value you saved as the
--    Edge Function secret PUSH_CRON_SECRET). Rerun-safe: deletes the old copy first.
delete from vault.secrets where name = 'push_cron_secret';
select vault.create_secret('PASTE_PUSH_CRON_SECRET_HERE', 'push_cron_secret', 'M-Core push-send cron/webhook secret');

-- 2) Every minute: call push-send {"action":"tick"} with the secret header (read from Vault at run time).
select cron.unschedule(jobid) from cron.job where jobname = 'mcore-push-tick';
select cron.schedule(
  'mcore-push-tick',
  '* * * * *',
  'select net.http_post(url := ''https://wjqhhnjlgoigoagsnsen.supabase.co/functions/v1/push-send'', headers := jsonb_build_object(''Content-Type'', ''application/json'', ''x-push-secret'', (select decrypted_secret from vault.decrypted_secrets where name = ''push_cron_secret'')), body := ''{"action":"tick"}''::jsonb, timeout_milliseconds := 20000)'
);

-- 3) Check (read-only): job exists and recent runs succeed.
select jobid, jobname, schedule, active from cron.job where jobname = 'mcore-push-tick';
