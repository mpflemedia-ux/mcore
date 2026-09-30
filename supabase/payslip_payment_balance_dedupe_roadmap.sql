-- Roadmap: Payslip PAYMENT/BALANCE dedupe (Hafiz Jul 2026)
-- Write-only for Mike — do NOT execute from agent.
-- Shipped: fix/payslip-payment-balance-dedupe (overlay V2, ?v=2 cache-bust)

-- Feature: payslip partial payment display
-- Root cause: payslip-scroll.js and payslip-statutory-partial both re-boot at 400ms;
--   scroll re-wraps _pdocPayslipHtml (drops _statPartial), statutory wraps again → payBlock x2.

-- Verify after deploy (ATAS ANGIN / Brzky Empire — Mohd Hafiz Jul 2026):
-- 1) Hard refresh app; confirm index loads payslip-statutory-partial-*.js?v=2
-- 2) Open payslip PDF/print: exactly ONE "PAYMENT / BALANCE" block
--    Net Entitlement 6000 / Amount Paid 3500 / Balance Outstanding 2500
-- 3) Employer contrib section still shows EPF/SOCSO/EIS 0 (or hidden if skip flag)
-- 4) Fully paid slip (amount_paid = net, balance 0): NO Payment/Balance section
-- 5) Normal employee unpaid slip (amount_paid 0): NO Payment/Balance section

-- Optional DB sanity (read in SQL editor; agent must not run writes):
-- SELECT id, month, year, net_pay, amount_paid, balance_outstanding, payment_note,
--        epf_exempt, skip_employer_contrib, epf_employee, epf_employer
-- FROM payroll_records
-- WHERE month = 7 AND year = 2026
--   AND employee_id IN (
--     SELECT id FROM employees WHERE name ILIKE '%Hafiz%' AND deleted_at IS NULL
--   );

-- No schema migration required for this UI dedupe fix.
-- pr_url: (fill after merge)
