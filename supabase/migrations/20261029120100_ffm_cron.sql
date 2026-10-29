-- FFM connector cron (pg_cron + pg_net). WRITE-ONLY: run in Supabase SQL Editor. Idempotent / rerun-safe.
-- Reuses the EXISTING Vault secret 'push_cron_secret' (push_02.sql) sent as x-push-secret;
-- ffm-cron checks it against the existing function secret PUSH_CRON_SECRET (same as pj-auto). No new secret.
-- Deploy ffm-cron BEFORE running this.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- every 30 min: FFM stock pull per account (-> ffm_stock only), low-stock alerts, shipment/ASN status polling
select cron.unschedule(jobid) from cron.job where jobname = 'mcore-ffm-tick';
select cron.schedule(
  'mcore-ffm-tick',
  '*/30 * * * *',
  'select net.http_post(url := ''https://wjqhhnjlgoigoagsnsen.supabase.co/functions/v1/ffm-cron'', headers := jsonb_build_object(''Content-Type'', ''application/json'', ''x-push-secret'', (select decrypted_secret from vault.decrypted_secrets where name = ''push_cron_secret'')), body := ''{"action":"tick"}''::jsonb, timeout_milliseconds := 60000)'
);

-- daily 07:15 MYT (23:15 UTC): reconciliation report M-Core stock_qty vs FFM
select cron.unschedule(jobid) from cron.job where jobname = 'mcore-ffm-recon';
select cron.schedule(
  'mcore-ffm-recon',
  '15 23 * * *',
  'select net.http_post(url := ''https://wjqhhnjlgoigoagsnsen.supabase.co/functions/v1/ffm-cron'', headers := jsonb_build_object(''Content-Type'', ''application/json'', ''x-push-secret'', (select decrypted_secret from vault.decrypted_secrets where name = ''push_cron_secret'')), body := ''{"action":"recon"}''::jsonb, timeout_milliseconds := 60000)'
);
