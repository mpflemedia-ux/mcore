reset role;

-- Attendance Analytics dashboard (HR & Payroll > Attendance > Analytics). Pure client-side
-- feature (app/index.html — renderAttendanceAnalytics). No new table/column/RLS — reuses the
-- exact Attendance Rate calculation engine already built for Share WhatsApp (_attAllEmployees,
-- _attHolidaySet, _attLeaveRanges, _attEmployeeSummary) so the numbers never drift from what
-- admins already see in the WhatsApp summary. Write-only, idempotent, run once in Supabase SQL Editor.

-- System Development
update public.dev_roadmap_items set stage = 'completed', module = 'hr',
  description = 'Attendance Analytics dashboard (HR & Payroll > Attendance > Analytics, canManageHR()-only): ranked "who needs attention" list — staff sorted by lowest Attendance Rate first, colour-flagged (red <70%, amber <85%, green otherwise), company-wide avg rate / total absent days / total late count at a glance, click any staff row to jump straight into their filtered attendance log for the same month. Reuses the Share WhatsApp calculation engine as-is — no duplicated formula, no schema change.'
  where title = 'Attendance Analytics Dashboard';
insert into public.dev_roadmap_items (title, description, module, stage)
  select 'Attendance Analytics Dashboard', 'Attendance Analytics dashboard (HR & Payroll > Attendance > Analytics, canManageHR()-only): ranked "who needs attention" list — staff sorted by lowest Attendance Rate first, colour-flagged (red <70%, amber <85%, green otherwise), company-wide avg rate / total absent days / total late count at a glance, click any staff row to jump straight into their filtered attendance log for the same month. Reuses the Share WhatsApp calculation engine as-is — no duplicated formula, no schema change.', 'hr', 'completed'
  where not exists (select 1 from public.dev_roadmap_items where title = 'Attendance Analytics Dashboard');
