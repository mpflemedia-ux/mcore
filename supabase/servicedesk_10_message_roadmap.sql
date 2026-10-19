-- M-Core Service Desk F10: System Development roadmap entry for the "leave a message + attach files,
-- any status" feature on the public result link (sd-result's new 'message' action).
-- Write-only: run once in Supabase SQL Editor. Rerun-safe (update-then-insert-if-missing, same pattern
-- as sd_reopen_01.sql / servicedesk_02_desk.sql).
update public.dev_roadmap_items set stage = 'completed', module = 'service_desk',
  description = 'Public result link (sr_result=TOKEN): client can leave a free-text message + attach up to 3 files (PDF/image/Excel/Word/CSV/TXT, 10MB each) at ANY request status (not gated on Delivered like Confirm/Request changes). Does not change request status - logged as comment/attachment Timeline events, separate 10-message rate limit, bells platform admins.'
where title = 'Service Desk: client message + attachments on result link (any status)';
insert into public.dev_roadmap_items (title, description, module, stage)
select 'Service Desk: client message + attachments on result link (any status)', 'Public result link (sr_result=TOKEN): client can leave a free-text message + attach up to 3 files (PDF/image/Excel/Word/CSV/TXT, 10MB each) at ANY request status (not gated on Delivered like Confirm/Request changes). Does not change request status - logged as comment/attachment Timeline events, separate 10-message rate limit, bells platform admins.', 'service_desk', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Service Desk: client message + attachments on result link (any status)');
