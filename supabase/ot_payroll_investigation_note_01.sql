reset role;

-- Investigation note: "OT not appearing on payslip" was reported 3 times. Root cause found
-- by comparing ot_claims.created_at vs payroll_records.generated_at (identical to the
-- microsecond = same transaction = a "Reset Demo" click, which wipes+reseeds both tables).
-- The claim had gone back to pending; Payroll Run correctly found zero approved claims at
-- that moment; the claim was re-approved ~1 minute later, after that run had already
-- finished. Not a code defect — confirmed by replaying the exact live query/upsert via the
-- Supabase REST API as demo.owner, which found and applied the claim with no changes needed.
--
-- Real gaps found and fixed along the way (kept, all legitimate):
--   - Payslip document template never had an OT line at all (PR #1108)
--   - Re-running Payroll Run for an already-processed period silently dropped OT because the
--     claim lookup excluded anything already attached to that row (PR #1109)
--   - Added visible diagnostics (OT amount found, per-employee) to Payroll Run's result/toast
--     so this class of issue is self-diagnosing going forward (PR #1110)

update public.dev_roadmap_items set stage = 'completed', module = 'hr',
  description = 'OT -> Payslip pipeline audited end-to-end and verified live (RLS, schema, calc, upsert, mark-paid all confirmed correct via direct API replay as demo.owner). Fixed two real gaps found during investigation: payslip document template was missing the OT line entirely (_pdocPayslipHtml), and re-running Payroll Run for an already-processed period silently dropped previously-applied OT (claim lookup now also matches claims already attached to the row being regenerated). Payroll Run result/toast now shows the OT amount found per run for self-diagnosis.'
where title = 'HR: Payroll Run OT Integration (OT roadmap Phase 7 — final)';
insert into public.dev_roadmap_items (title, description, module, stage)
select 'HR: Payroll Run OT Integration (OT roadmap Phase 7 — final)',
  'OT -> Payslip pipeline audited end-to-end and verified live (RLS, schema, calc, upsert, mark-paid all confirmed correct via direct API replay as demo.owner). Fixed two real gaps found during investigation: payslip document template was missing the OT line entirely (_pdocPayslipHtml), and re-running Payroll Run for an already-processed period silently dropped previously-applied OT (claim lookup now also matches claims already attached to the row being regenerated). Payroll Run result/toast now shows the OT amount found per run for self-diagnosis.',
  'hr', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'HR: Payroll Run OT Integration (OT roadmap Phase 7 — final)');
