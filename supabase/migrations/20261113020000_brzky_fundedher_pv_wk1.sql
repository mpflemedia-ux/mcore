-- Brzky Empire — draft Payment Voucher for FundedHer Week 1 invoice-financing repayment
-- (due 11/11/2026, SGD 1,002.20 = MYR 3,212.00).
-- WRITE-ONLY, idempotent. Run in Supabase SQL Editor. Safe to re-run.
--
-- Status is 'draft' on purpose: no journal is posted here. Mike reviews the PV in the app,
-- completes signatures, then Mark as Paid (that journal Dr gl_account_id / Cr default Cash).
-- Bank account number is not known — left empty on purpose; never invented.
-- No dev_roadmap_items row: this is a tenant data insert (same convention as
-- 20261106120000_brzky_bainom_petty_cash_float.sql), not a product change.

do $$
declare
  tid uuid;
  n int;
  marker text := 'FundedHer Wk1 11/11/2026';
  v_gl uuid;
  v_gl_code text;
  v_gl_name text;
  v_ref text;
  v_id uuid;
  desc_json text;
begin
  -- Look up by exact name (case-insensitive). Do not use ILIKE '%brzky%' /
  -- '%brozky%' — that would also match "The Brozkey Club".
  select count(*) into n
    from public.tenants
   where deleted_at is null
     and lower(btrim(name)) = lower('Brzky Empire');
  if n = 0 then
    raise exception 'Tenant ''Brzky Empire'' not found';
  elsif n > 1 then
    raise exception 'Tenant ''Brzky Empire'' is not unique (found %)', n;
  end if;
  select id into tid
    from public.tenants
   where deleted_at is null
     and lower(btrim(name)) = lower('Brzky Empire');

  -- Financing repayment debit: Brzky's existing Financier Loan - FundedHere (2300),
  -- created by 20261103040000_sales_plan_financing_accounts_brzky.sql and used as
  -- sales_plans.loan_account_id. If missing, leave gl_account_id null — Mark as Paid
  -- then follows the PV module default (Dr general_expense, Cr cash).
  select a.id, a.code, a.name_en
    into v_gl, v_gl_code, v_gl_name
    from public.chart_of_accounts a
   where a.tenant_id = tid
     and a.deleted_at is null
     and (
       (a.code = '2300' and a.account_type = 'liability')
       or (a.account_type = 'liability' and (
            a.name_en ilike '%FundedHer%' or a.name_bm ilike '%FundedHer%'
         or a.name_en ilike '%Financier Loan%' or a.name_bm ilike '%Pinjaman Pembiaya%'
       ))
     )
   order by
     case
       when a.name_en ilike '%FundedHer%' or a.name_bm ilike '%FundedHer%' then 0
       when a.code = '2300' then 1
       else 2
     end,
     a.code
   limit 1;

  desc_json := jsonb_build_object(
    'en',
      'Week 1 repayment (due 11/11/2026) of 1st invoice financing — FundedHer repayment plan. ' || marker || E'.\n' ||
      'SGD 1,002.20 = MYR 3,212.00.' || E'\n' ||
      'Projected payout: SGD 4,008.78; issued 3-Nov; tenure 30 days; maturity 3-Dec. Instalment 1 of 4.' || E'\n' ||
      'Remaining schedule (for reference): Wk 2 (18/11) SGD 1,002.20; Wk 3 (25/11) SGD 1,002.20; Wk 4 (02/12) SGD 1,002.18.' || E'\n' ||
      'Payee is the Wallex collection account of BRZKY EMPIRE - MDAQ MALAYSIA SDN BHD. Bank account number to be confirmed.',
    'bm',
      'Bayaran balik Minggu 1 (tarikh akhir 11/11/2026) pembiayaan invois pertama — pelan bayaran FundedHer. ' || marker || E'.\n' ||
      'SGD 1,002.20 = MYR 3,212.00.' || E'\n' ||
      'Unjuran bayaran: SGD 4,008.78; dikeluarkan 3-Nov; tempoh 30 hari; matang 3-Dis. Ansuran 1 daripada 4.' || E'\n' ||
      'Jadual baki (rujukan): Mg 2 (18/11) SGD 1,002.20; Mg 3 (25/11) SGD 1,002.20; Mg 4 (02/12) SGD 1,002.18.' || E'\n' ||
      'Penerima ialah akaun kutipan Wallex BRZKY EMPIRE - MDAQ MALAYSIA SDN BHD. Nombor akaun bank belum disahkan.'
  )::text;

  select id, ref_no into v_id, v_ref
    from public.payment_vouchers
   where tenant_id = tid
     and deleted_at is null
     and description like '%' || marker || '%'
   order by created_at
   limit 1;

  if v_id is not null then
    raise notice 'Already exists: % (id=%). Nothing inserted. GL on file is unchanged.', v_ref, v_id;
  else
    if to_regprocedure('public.pv__next_ref(uuid,text)') is not null then
      v_ref := public.pv__next_ref(tid, 'PV');
    else
      -- Same format as pv__next_ref / app _genFallbackRefNo: PV-0001
      perform pg_advisory_xact_lock(hashtext(tid::text || ':PV'));
      select coalesce(max((substring(ref_no from '^PV-(\d+)$'))::int), 0) into n
        from public.payment_vouchers
       where tenant_id = tid and ref_no ~ '^PV-\d+$';
      v_ref := 'PV-' || lpad((n + 1)::text, 4, '0');
    end if;

    insert into public.payment_vouchers (
      tenant_id, ref_no, voucher_date,
      payee_name, payee_type,
      amount, payment_method, bank_name, bank_account_no,
      description, status, category, gl_account_id,
      created_at, updated_at
    ) values (
      tid, v_ref, date '2026-11-11',
      'BRZKY EMPIRE - MDAQ MALAYSIA SDN BHD', 'other',
      3212.00, 'Bank Transfer', null, null,
      desc_json, 'draft', 'other', v_gl,
      now(), now()
    )
    returning id into v_id;

    raise notice 'Inserted draft PV % (id=%). Debit GL: % % (%). Credit GL is not stored on the PV — Mark as Paid credits the tenant default Cash account.',
      v_ref, v_id, coalesce(v_gl_code, '(none)'), coalesce(v_gl_name, 'PV default general_expense on Mark as Paid'), v_gl;
  end if;
end $$;

-- Read-only check: the created (or already-existing) PV
select
  v.id,
  v.ref_no,
  v.voucher_date,
  v.payee_name,
  v.payee_type,
  v.amount,
  v.payment_method,
  v.bank_name,
  v.bank_account_no,
  v.category,
  v.status,
  v.gl_account_id,
  a.code as gl_debit_code,
  a.name_en as gl_debit_name,
  v.description,
  v.created_at,
  t.name as tenant_name,
  v.tenant_id
from public.payment_vouchers v
join public.tenants t on t.id = v.tenant_id
left join public.chart_of_accounts a
  on a.id = v.gl_account_id and a.tenant_id = v.tenant_id
where t.deleted_at is null
  and lower(btrim(t.name)) = lower('Brzky Empire')
  and v.deleted_at is null
  and v.description like '%FundedHer Wk1 11/11/2026%';
