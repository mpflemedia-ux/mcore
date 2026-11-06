-- Brzky Empire (tenant c60f2b79-7132-48ed-b35d-72b0dfd9a973) — issue RM200 petty cash float to
-- Bainom Binti Haime (same purpose as PV-0010: J&T logistics), via the real "Issue Float" flow's
-- own tables/journal — mirrors index.html's _pcIssueSave() + _pcPostIssueJournal() exactly:
--   1) insert into petty_cash_floats (status 'open')
--   2) post the matching journal entry (Dr Petty Cash / Cr Cash) via the SAME default account
--      mappings the UI uses (default_account_mappings: cash, petty_cash — both already set for
--      this tenant) and the SAME ref_no generator (generate_ref_no, called directly with the
--      tenant_id so it does not depend on auth.uid() like the next_ref_no() RPC wrapper does).
-- This does not touch/duplicate PV-0010 — that PV already paid Bainom RM200 for the same purpose;
-- this "Issue Float" record is the separate petty-cash-imprest tracking Mike asked for on top of it.
-- Idempotent (guarded by a NOT EXISTS on tenant+holder+date+amount, and _journalAlreadyPosted's own
-- check reproduced via a NOT EXISTS on journal_entries.source_table/source_id), write-only — run in
-- Supabase SQL Editor. Safe to re-run.

do $$
declare
  tid uuid := 'c60f2b79-7132-48ed-b35d-72b0dfd9a973';
  emp_id uuid := '6f31789e-43d7-45fc-b74a-6a8a02792ff1';
  holder text := 'Bainom Binti Haime';
  amt numeric := 200.00;
  idate date := '2026-11-06';
  float_id uuid;
  cash_acc uuid;
  petty_acc uuid;
  jref text;
  jentry_id uuid;
begin
  select id into float_id from public.petty_cash_floats
    where tenant_id = tid and holder_employee_id = emp_id and issued_date = idate and amount = amt and deleted_at is null
    limit 1;

  if float_id is null then
    insert into public.petty_cash_floats (tenant_id, holder_name, holder_employee_id, issued_date, amount, status, notes)
    values (tid, holder, emp_id, idate, amt, 'open', 'J&T logistics (petty cash)')
    returning id into float_id;
  end if;

  if not exists (select 1 from public.journal_entries where tenant_id = tid and source_table = 'petty_cash_floats' and source_id = float_id) then
    select account_id into cash_acc from public.default_account_mappings where tenant_id = tid and mapping_key = 'cash';
    select account_id into petty_acc from public.default_account_mappings where tenant_id = tid and mapping_key = 'petty_cash';
    if cash_acc is not null and petty_acc is not null then
      jref := public.generate_ref_no(tid, 'JNL', to_char(idate, 'YYMM'));
      insert into public.journal_entries (tenant_id, ref_no, entry_date, description, entry_type, source_table, source_id, total_debit, total_credit)
      values (tid, jref, idate, 'Petty cash float — ' || holder, 'auto', 'petty_cash_floats', float_id, amt, amt)
      returning id into jentry_id;
      insert into public.journal_lines (id, tenant_id, entry_id, account_id, line_no, description, debit_amt, credit_amt) values
        (gen_random_uuid(), tid, jentry_id, petty_acc, 1, 'Petty cash float — ' || holder, amt, 0),
        (gen_random_uuid(), tid, jentry_id, cash_acc, 2, 'Petty cash float — ' || holder, 0, amt);
    end if;
  end if;
end $$;
