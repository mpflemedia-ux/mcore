-- M-Core Service Desk F8: bump client result link default expiry from 7 days to the max allowed (30 days).
-- Write-only: run once in Supabase SQL Editor AFTER servicedesk_07_wa_share.sql. Rerun-safe.
-- Only changes the DEFAULT for new rows (service_result_links.expires_at) - existing links keep whatever
-- expires_at they already have (not touched, so already-shared links don't silently extend).
alter table public.service_result_links
  alter column expires_at set default (now() + interval '30 days');
