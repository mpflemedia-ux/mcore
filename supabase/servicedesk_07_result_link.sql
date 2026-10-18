-- M-Core Service Desk - phase 6: Public Result Link (no-login, view a delivered/closed request's
-- status + deliverables + full timeline, reopen). Run after servicedesk_all_v2.sql +
-- servicedesk_06_public_link.sql. Rerun-safe. Plain SQL only (no new functions, no dollar quoting,
-- no pgcrypto).
--
-- Security model: unlike service_public_links, this link is served ONLY by the sd-result Edge
-- Function using the service-role key (service_requests/service_request_events have no anon RLS
-- policy at all, by design, since they hold real client work). So no new RLS/anon policy is added
-- here. The admin generates a random token client-side and hashes it (same sha256 pattern as
-- service_public_links.token_hash) from the "Share result link" button on the request detail page
-- (Service Desk / Servis Saya) - only the hash is ever stored; the plaintext token lives only in
-- the URL the admin copies and shares.
alter table public.service_requests add column if not exists result_token_hash text;
alter table public.service_requests add column if not exists result_token_expires_on date;
create unique index if not exists service_requests_result_token_uq on public.service_requests (result_token_hash) where result_token_hash is not null;

notify pgrst, 'reload schema';

update public.dev_roadmap_items set stage = 'completed', module = 'service_desk',
  description = 'Service Desk Public Result Link: admin "Share result link" button on a delivered/closed request (14-day expiry), no-login result page via sd-result Edge Function (status, deliverables, full timeline incl. comments + attachments, reopen request), correct M-Core boot-mark logo on all public link pages.'
where title = 'Service Desk F6: Public Result Link';
insert into public.dev_roadmap_items (title, description, module, stage)
select 'Service Desk F6: Public Result Link', 'Service Desk Public Result Link: admin "Share result link" button on a delivered/closed request (14-day expiry), no-login result page via sd-result Edge Function (status, deliverables, full timeline incl. comments + attachments, reopen request), correct M-Core boot-mark logo on all public link pages.', 'service_desk', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Service Desk F6: Public Result Link');
