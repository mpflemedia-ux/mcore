-- OT Approvals → in-app Notifications (bell) live wire
-- WRITE ONLY — Mike runs in Supabase SQL Editor. Do not execute from agents.
-- Idempotent roadmap upsert only. No schema change: authenticated SELECT on
-- ot_claims already tenant-scoped (ot_claims_select). Live query mirrors Leave/SD.

-- ---------- System Development roadmap ----------
update public.dev_roadmap_items
set stage = 'completed',
    module = 'hr_payroll',
    description = coalesce(description, '') ||
      case when description ilike '%notif-live ot_claims%' then ''
           else E'\n[2026-10-28] Wire pending ot_claims into notif-live Action (Leave/SD pattern); deep-link HR OT Approvals; no inline Approve (hours prompt on page); no new tables.'
      end
where title = 'OT Approvals Notifications bell live wire';

insert into public.dev_roadmap_items (title, description, module, stage)
select
  'OT Approvals Notifications bell live wire',
  'Wire pending ot_claims into app/notif-live.js (Leave/SD pattern Action item EN/BM); gate _otIsApproverUser; hide own claim for non-owner; tap deep-links openPage(hr,{view:ot-approvals}); item disappears when status≠pending. No FCM, no new tables, no inline Approve/Reject (Approve needs hours prompt on OT Approvals page).',
  'hr_payroll',
  'completed'
where not exists (
  select 1 from public.dev_roadmap_items
  where title = 'OT Approvals Notifications bell live wire'
);
