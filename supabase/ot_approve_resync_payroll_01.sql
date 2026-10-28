-- OT Approve → re-sum into payroll_records (Salary Disbursement / payslip)
-- WRITE ONLY — Mike runs in Supabase SQL Editor. Do not execute from agents.
-- Idempotent roadmap upsert only. No schema change.

update public.dev_roadmap_items
set stage = 'completed',
    module = 'hr_payroll',
    description = coalesce(description, '') ||
      case when description ilike '%ot-payroll-resync%' then ''
           else E'\n[2026-10-28] On OT Approve/Reject re-sum approved ot_claims into existing payroll_records.ot_amount+net_pay (same filters as Run Payroll); post-pass restores OT after statutory payroll wrap; SD grandTotal includes OT; monthEnd via _dbFmtYMD; EN/BM toasts.'
      end
where title = 'OT approve re-sum to payroll_records';

insert into public.dev_roadmap_items (title, description, module, stage)
select
  'OT approve re-sum to payroll_records',
  'On OT Approve/Reject: if payroll_records exists for employee+period(claim_date), immediately re-sum approved ot_claims into ot_amount + net_pay (idempotent; preserves SD edits). Run Payroll post-pass same helper (fixes payslip-statutory-partial dropping OT). SD grandTotal includes ot_amount; monthEnd via _dbFmtYMD. EN/BM toasts when slip missing vs updated. No FCM, no new tables.',
  'hr_payroll',
  'completed'
where not exists (
  select 1 from public.dev_roadmap_items
  where title = 'OT approve re-sum to payroll_records'
);
