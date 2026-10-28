-- Salary Disbursement signature → in-app Notifications (bell) live wire
-- WRITE ONLY — Mike runs in Supabase SQL Editor. Do not execute from agents.
-- Idempotent roadmap upsert only. No schema change: authenticated SELECT on
-- sd_approvals already tenant-scoped (sd_approvals_read). Live query mirrors Leave.

-- ---------- System Development roadmap ----------
update public.dev_roadmap_items
set stage = 'completed',
    module = 'hr_payroll',
    description = coalesce(description, '') ||
      case when description ilike '%notif-live sd_approvals%' then ''
           else E'\n[2026-10-28] Wire pending sd_approvals into notif-live Action (Leave pattern); deep-link HR Salary Disbursement + auto-open Review modal; no inline Approve; no new tables.'
      end
where title = 'SD signature Notifications bell live wire';

insert into public.dev_roadmap_items (title, description, module, stage)
select
  'SD signature Notifications bell live wire',
  'Wire pending sd_approvals into app/notif-live.js (Leave pattern Action item EN/BM); tap deep-links openPage(hr,{view:salary-disbursement,month,year,review}); renderSalaryDisbursement auto-opens _sdReviewSubmission; item disappears when status≠pending. No FCM, no new tables, no inline Approve/Reject without viewing signed file.',
  'hr_payroll',
  'completed'
where not exists (
  select 1 from public.dev_roadmap_items
  where title = 'SD signature Notifications bell live wire'
);
