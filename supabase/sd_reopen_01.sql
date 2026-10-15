-- M-Core Service Desk: reopen 'Confirmed & closed' requests (public result link + platform admin in app).
-- Write-only: run once in Supabase SQL Editor. Rerun-safe. No functions, no dollar quoting, no pgcrypto.
-- Status after reopen = existing 'in_progress' (no status constraint change). Reason = existing timeline event
-- (service_request_events type 'status', meta.reopen = true). SLA restarts: due_at = reopen time + same business-hour window.
-- Public reopen is written by Edge Function sd-result (service role) -> redeploy: supabase functions deploy sd-result --no-verify-jwt

alter table public.service_requests add column if not exists reopen_count int not null default 0;
alter table public.service_requests add column if not exists reopened_at timestamptz;
alter table public.service_requests drop constraint if exists service_requests_reopen_count_chk;
alter table public.service_requests add constraint service_requests_reopen_count_chk check (reopen_count >= 0);

-- Client response log from the result page: allow action 'reopen' (reason required, same rule as 'revise').
alter table public.service_result_responses drop constraint if exists service_result_responses_action_check;
alter table public.service_result_responses add constraint service_result_responses_action_check check (action in ('confirm', 'revise', 'reopen'));

notify pgrst, 'reload schema';

update public.dev_roadmap_items set stage = 'completed', module = 'service_desk',
  description = 'Service Desk: reopen Confirmed & closed requests. Client via result link (Buka semula request + required reason, while link valid) and platform admin in request detail. Back to In progress, SLA restarts from reopen time, reopen_count + reopened_at, timeline "Reopened by X: reason", bells to platform admins + tenant owner.'
where title = 'Service Desk: Reopen closed request';
insert into public.dev_roadmap_items (title, description, module, stage)
select 'Service Desk: Reopen closed request', 'Service Desk: reopen Confirmed & closed requests. Client via result link (Buka semula request + required reason, while link valid) and platform admin in request detail. Back to In progress, SLA restarts from reopen time, reopen_count + reopened_at, timeline "Reopened by X: reason", bells to platform admins + tenant owner.', 'service_desk', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Service Desk: Reopen closed request');
