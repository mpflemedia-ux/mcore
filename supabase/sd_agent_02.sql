reset role;

-- SR Agent Backend — small Fasa 3 addition: track when SD_AGENT_SECRET was last rotated, so
-- Admin -> Service Desk -> Agent can show "last changed X days ago" + a >30-day warning.
-- Supabase Edge Function secrets aren't queryable from the DB side, so this is a self-reported
-- timestamp (a button on the Agent tab sets it to now() right after Mike rotates the secret in
-- the Dashboard) -- not a live read of the Dashboard's own secret store.
-- Needs sd_agent_01.sql already run. Write-only, idempotent.

alter table public.sd_agent_settings add column if not exists secret_rotated_at timestamptz;

-- service_files_insert (servicedesk_all_v2.sql) hardcodes (storage.foldername(name))[2] =
-- 'service-requests', which would reject every upload to the new <tenant>/_letterhead/ path
-- used by the tenant Settings "Letterhead" card (sd-letterhead.js) and by sd-agent reading it
-- back. Widen to also allow '_letterhead' -- additive only, 'service-requests' untouched, so
-- every existing attachment/deliverable upload keeps working exactly as before.
drop policy if exists service_files_insert on storage.objects;
create policy service_files_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'service-files' and (storage.foldername(name))[2] in ('service-requests', '_letterhead') and (
    exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin')
    or (storage.foldername(name))[1] = (select p.tenant_id::text from public.user_profiles p where p.id = auth.uid())));

notify pgrst, 'reload schema';

update public.dev_roadmap_items set stage = 'completed', module = 'service_desk',
  description = 'SR Agent Backend Fasa 3 (UI): sd_agent_settings.secret_rotated_at (self-reported secret-rotation date for the Admin Agent tab''s >30-day warning). See Fasa 3 app/index.html + app/sd-*.js changes for the rest (Draf AI card, dynamic form_fields, Admin Agent tab, tenant Letterhead upload, ref_no format support).'
where title = 'Service Desk: SR Agent Backend (Fasa 3 — UI)';
insert into public.dev_roadmap_items (title, description, module, stage)
select 'Service Desk: SR Agent Backend (Fasa 3 — UI)',
  'SR Agent Backend Fasa 3 (UI): sd_agent_settings.secret_rotated_at (self-reported secret-rotation date for the Admin Agent tab''s >30-day warning). See Fasa 3 app/index.html + app/sd-*.js changes for the rest (Draf AI card, dynamic form_fields, Admin Agent tab, tenant Letterhead upload, ref_no format support).',
  'service_desk', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Service Desk: SR Agent Backend (Fasa 3 — UI)');
