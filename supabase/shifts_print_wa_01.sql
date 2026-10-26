reset role;

-- Shifts (Weekly Schedule): Print + Share WhatsApp. Pure client-side feature (app/shifts.js) —
-- no new table/column, no RLS change (reuses employees.phone + existing shifts/leave_requests
-- RLS already in place). Write-only, idempotent, run once in Supabase SQL Editor.

-- System Development
update public.dev_roadmap_items set stage = 'completed', module = 'hr',
  description = 'Weekly Schedule (Shifts) toolbar gained Print (window.print, landscape A4, hides admin-only cards/hours form, keeps only the grid + legend, today column marked) and Share WhatsApp (broadcast or one staff via employees.phone, bilingual summary text with consecutive Off days compressed) via wa.me. Both are read-only — nothing is written to the database.'
  where title = 'Shifts: Print & Share WhatsApp';
insert into public.dev_roadmap_items (title, description, module, stage)
  select 'Shifts: Print & Share WhatsApp', 'Weekly Schedule (Shifts) toolbar gained Print (window.print, landscape A4, hides admin-only cards/hours form, keeps only the grid + legend, today column marked) and Share WhatsApp (broadcast or one staff via employees.phone, bilingual summary text with consecutive Off days compressed) via wa.me. Both are read-only — nothing is written to the database.', 'hr', 'completed'
  where not exists (select 1 from public.dev_roadmap_items where title = 'Shifts: Print & Share WhatsApp');
