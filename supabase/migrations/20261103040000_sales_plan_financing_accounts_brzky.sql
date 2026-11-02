-- Sales Plan financing accounts — Brzky Empire (c60f2b79-7132-48ed-b35d-72b0dfd9a973).
-- "Brzky Empire Sales Plan" (10c84447-adfd-4631-b291-7e205d6eacdd) had no loan/fee/draw
-- accounts set, so Draw funding / repayment journals could not post (warning banner on
-- the Stock & Financing tab). Financier is FundedHere (fundedhere.com) per owner.
--
-- Adds: 2300 "Financier Loan - FundedHere" (liability), 7010 "Financing Fee" (expense).
-- Draw-side debit uses the EXISTING 1300 "Inventory" account — no new account for that.
--
-- NOTE: this only wires up the accounts. The actual principal %, fee % and repayment
-- date for Batch A (or any batch) are NOT set here — those come from Brzky's real
-- FundedHere loan agreement, not from anything this migration can look up or guess.
-- Enter them in Sales Plan -> Stock & Financing -> Batch A -> Edit once known.
--
-- Idempotent — write-only, run in Supabase SQL Editor.

do $$
declare
  v_tenant_id uuid := 'c60f2b79-7132-48ed-b35d-72b0dfd9a973';
  v_plan_id uuid := '10c84447-adfd-4631-b291-7e205d6eacdd';
  v_loan_id uuid;
  v_fee_id uuid;
  v_inv_id uuid;
begin
  select id into v_loan_id from chart_of_accounts where tenant_id = v_tenant_id and code = '2300' and deleted_at is null;
  if v_loan_id is null then
    insert into chart_of_accounts (tenant_id, code, name_en, name_bm, account_type, account_class, normal_balance)
    values (v_tenant_id, '2300', 'Financier Loan - FundedHere', 'Pinjaman Pembiaya - FundedHere', 'liability', 'balance_sheet', 'debit')
    returning id into v_loan_id;
  end if;

  select id into v_fee_id from chart_of_accounts where tenant_id = v_tenant_id and code = '7010' and deleted_at is null;
  if v_fee_id is null then
    insert into chart_of_accounts (tenant_id, code, name_en, name_bm, account_type, account_class, normal_balance)
    values (v_tenant_id, '7010', 'Financing Fee', 'Fi Pembiayaan', 'expense', 'income_statement', 'debit')
    returning id into v_fee_id;
  end if;

  select id into v_inv_id from chart_of_accounts where tenant_id = v_tenant_id and code = '1300' and deleted_at is null;

  update sales_plans
  set loan_account_id = coalesce(loan_account_id, v_loan_id),
      fee_account_id = coalesce(fee_account_id, v_fee_id),
      draw_debit_account_id = coalesce(draw_debit_account_id, v_inv_id)
  where id = v_plan_id and tenant_id = v_tenant_id;

  raise notice 'Financier Loan=%, Financing Fee=%, draw debit (Inventory)=%', v_loan_id, v_fee_id, v_inv_id;
end $$;
