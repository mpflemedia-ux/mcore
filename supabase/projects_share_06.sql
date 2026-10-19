-- M-Core Projects - Public Report Link, phase 6: widen 'project-comments' bucket from images-only/5MB
-- to the same document types + 10MB cap as sd-result's 'service-files' bucket (PDF/Office/CSV/TXT/
-- images), so "Leave a message" attachments (and staff's own task-comment uploads, same bucket) are
-- no longer image-only. Run after projects_share_01..05.sql. Rerun-safe.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('project-comments', 'project-comments', false, 10485760, array[
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
