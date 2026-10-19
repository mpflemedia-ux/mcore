-- M-Core Service Desk F9: HOTFIX - service_request_events is missing file_name/file_size columns that
-- sd-result's handler.ts/index.ts (client reply attachments PR) already reads/writes, breaking the
-- 'view' action for EVERY result link (not just new tickets) with a 500 -> public page shows "not active".
-- Write-only: run once in Supabase SQL Editor. Rerun-safe.
alter table public.service_request_events
  add column if not exists file_name text check (file_name is null or length(file_name) <= 200),
  add column if not exists file_size int check (file_size is null or file_size between 0 and 10485760);
