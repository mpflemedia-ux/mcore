reset role;

-- Attendance (HR & Payroll > Kehadiran): Print + Share WhatsApp. Pure client-side feature
-- (app/index.html — renderAttendance / _attendanceRenderHistoryTable). No new table/column,
-- no RLS change — reuses employees.phone (already selectable under existing employees RLS,
-- same as Projects WhatsApp share) and the existing attendance tenant-scoped RLS. Write-only,
-- idempotent, run once in Supabase SQL Editor.

-- System Development
update public.dev_roadmap_items set stage = 'completed', module = 'hr',
  description = 'Attendance log table (HR & Payroll > Kehadiran) gained Print (landscape A4, header shows tenant + month + active filters, GPS column becomes a clickable Google Maps link, Notes column no longer truncated, Actions column hidden) and Share WhatsApp (per-employee summary — Present/Late/Absent/Half-day/Leave counts + attendance rate %, broadcast or one staff via employees.phone, text states the active filter). Gated to canManageHR() — regular staff cannot export/broadcast other staff attendance data. Both read-only — nothing is written to the database.'
  where title = 'Attendance: Print & Share WhatsApp';
insert into public.dev_roadmap_items (title, description, module, stage)
  select 'Attendance: Print & Share WhatsApp', 'Attendance log table (HR & Payroll > Kehadiran) gained Print (landscape A4, header shows tenant + month + active filters, GPS column becomes a clickable Google Maps link, Notes column no longer truncated, Actions column hidden) and Share WhatsApp (per-employee summary — Present/Late/Absent/Half-day/Leave counts + attendance rate %, broadcast or one staff via employees.phone, text states the active filter). Gated to canManageHR() — regular staff cannot export/broadcast other staff attendance data. Both read-only — nothing is written to the database.', 'hr', 'completed'
  where not exists (select 1 from public.dev_roadmap_items where title = 'Attendance: Print & Share WhatsApp');
