-- M-Core Service Desk: "Copy instructions" button on the request detail (app/sd-copy.js). OPTIONAL, write-only.
-- Run in Supabase SQL Editor only to record the item in Admin -> System Development. Rerun-safe. No schema change.
update public.dev_roadmap_items set stage = 'completed', module = 'service_desk',
  description = 'Service Request detail: small "Copy instructions" / "Salin arahan" button under the description (client tenant + platform admin desk). Copies the instructions as plain text with line breaks kept (clipboard API, textarea fallback for older Android browsers); toast Copied / Disalin.'
where title = 'Service Request: Copy instructions';
insert into public.dev_roadmap_items (title, description, module, stage)
select 'Service Request: Copy instructions', 'Service Request detail: small "Copy instructions" / "Salin arahan" button under the description (client tenant + platform admin desk). Copies the instructions as plain text with line breaks kept (clipboard API, textarea fallback for older Android browsers); toast Copied / Disalin.', 'service_desk', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Service Request: Copy instructions');
