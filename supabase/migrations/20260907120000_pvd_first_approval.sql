-- PV Disbursement: 4 signature roles to match Salary Disbursement
-- Prepared By / Checked By / First Approval / Second Approval
-- second approval continues to use existing approved_by
ALTER TABLE payment_voucher_batches
  ADD COLUMN IF NOT EXISTS first_approved_by text;
