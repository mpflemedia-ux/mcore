-- M-Core Phone alerts — fix cron secret mismatch (diagnosed 23 Oct 2026 00:49 MYT). WRITE-ONLY. No functions, no $$.
-- Symptom: every 'mcore-push-tick' call to push-send returns 401. push-send logs show the Vault value sent in
-- x-push-secret is 44 characters but the Edge Function secret PUSH_CRON_SECRET is 15 characters, so they cannot match.
-- Fix: make the Vault copy EXACTLY the same text as Dashboard -> Edge Functions -> Secrets -> PUSH_CRON_SECRET.
-- (Alternative without SQL: edit PUSH_CRON_SECRET in the Dashboard to the value you stored in Vault.)
-- Replace the text in quotes with the PUSH_CRON_SECRET value. Rerun-safe.
delete from vault.secrets where name = 'push_cron_secret';
select vault.create_secret('PASTE_PUSH_CRON_SECRET_HERE', 'push_cron_secret', 'M-Core push-send cron/webhook secret');

-- Check (read-only, shows only the length, never the value). Must equal the length of PUSH_CRON_SECRET (15 today).
select name, length(decrypted_secret) as secret_length from vault.decrypted_secrets where name = 'push_cron_secret';
