-- ============================================================================
-- Brzky Empire — Supplier Bill from PV-0001 (Ethye Sdn Bhd)
-- File: supabase/snippets/brzky_supplier_bill_pv0001_2026-10-29.sql
-- Run MANUALLY in Supabase SQL Editor. Idempotent (safe to re-run).
--
-- Source PV-0001 (28/09/2026, DRAFT):
--   Pay to  : Ethye Sdn Bhd — Bank Transfer, UOB (Malaysia) Bhd 151-308-412-4, ref Pin-2609-0100
--   Desc    : Keravive Hair Moisturiser 150Ml Matt Finish, Soft Touch — 2400 Unit @ RM8.30
--   PV amt  : RM 10,956.00
--
-- Discrepancy: 2400 x 8.30 = RM 19,920.00 but PV = RM 10,956.00 (= 55% / 1320 unit).
--   -> Bill = full supply value RM 19,920.00 (2400 @ 8.30), status 'unpaid', paid_amt 0.
--   -> PV-0001 is a DRAFT: only LINKED (payment_vouchers.bill_id), no payment posted.
--      When PV-0001 is Approved -> Mark as Paid in the app, the app itself inserts
--      supplier_payments RM10,956, sets bill paid_amt=10,956 / status 'partial'
--      (balance RM 8,964.00) and posts the journal (Dr AP / Cr Cash).
--   -> No journal here: app posts NO journal on bill creation (only on payment).
--   -> No SST: supplier_bills has no tax columns; PV shows no tax.
--
-- Tenant: code BROZKY99 OR name ILIKE '%br%zky%' (Brzky/Brozky Empire). Must match exactly 1.
-- Optional columns (supplier_name, ref_no, notes, description, created_by, ...) and
-- supplier_bill_items are written ONLY if they exist in the live schema.
-- ============================================================================

DO $$
DECLARE
  v_tenant      uuid;
  v_cnt         int;
  v_supplier    uuid;
  v_bill        uuid;
  v_bill_no     text;
  v_pv          record;
  v_pv_found    boolean := false;
  v_qty         numeric := 2400;
  v_price       numeric := 8.30;
  v_total       numeric := 19920.00;     -- 2400 x 8.30
  v_pv_amt      numeric := 10956.00;
  v_bill_date   date := DATE '2026-09-28';
  v_due_date    date := DATE '2026-10-28'; -- Net 30 (same convention as demo seed bills); edit in app if terms differ
  v_item_desc   text := 'Keravive Hair Moisturiser 150Ml Matt Finish, Soft Touch';
  v_note        text;
  v_json        jsonb;
  v_cols        text;
  v_max         int;
  v_creator     uuid;
BEGIN
  -- 0) Tenant ---------------------------------------------------------------
  SELECT count(*) INTO v_cnt FROM public.tenants t
   WHERE t.deleted_at IS NULL AND (upper(t.code) = 'BROZKY99' OR t.name ILIKE '%br%zky%');
  IF v_cnt <> 1 THEN
    RAISE EXCEPTION 'Tenant Brzky match = % (expect 1). Semak tenants.name/code.', v_cnt;
  END IF;
  SELECT t.id INTO v_tenant FROM public.tenants t
   WHERE t.deleted_at IS NULL AND (upper(t.code) = 'BROZKY99' OR t.name ILIKE '%br%zky%');

  -- 1) Supplier: find or insert Ethye Sdn Bhd -------------------------------
  SELECT s.id INTO v_supplier FROM public.suppliers s
   WHERE s.tenant_id = v_tenant AND s.deleted_at IS NULL AND s.name ILIKE '%ethye%'
   ORDER BY s.created_at LIMIT 1;

  IF v_supplier IS NULL THEN
    v_supplier := gen_random_uuid();
    v_json := jsonb_build_object(
      'id', v_supplier, 'tenant_id', v_tenant, 'name', 'Ethye Sdn Bhd',
      -- optional bank columns (only used if they exist)
      'bank_name', 'United Overseas Bank (Malaysia) Bhd',
      'bank_account', '151-308-412-4', 'bank_account_no', '151-308-412-4',
      'account_no', '151-308-412-4', 'account_number', '151-308-412-4',
      'notes', 'Bank: United Overseas Bank (Malaysia) Bhd, Acc 151-308-412-4 (from PV-0001)',
      'created_at', now());
    SELECT string_agg(quote_ident(c.column_name), ',') INTO v_cols
      FROM information_schema.columns c
     WHERE c.table_schema = 'public' AND c.table_name = 'suppliers'
       AND v_json ? c.column_name;
    EXECUTE format('INSERT INTO public.suppliers (%s) SELECT %s FROM jsonb_populate_record(NULL::public.suppliers, $1)', v_cols, v_cols)
      USING v_json;
    RAISE NOTICE 'Supplier Ethye Sdn Bhd inserted: %', v_supplier;
  ELSE
    RAISE NOTICE 'Supplier Ethye Sdn Bhd exists: %', v_supplier;
  END IF;

  -- 2) PV-0001 lookup (no duplicate created) --------------------------------
  SELECT p.id, p.bill_id, p.amount, p.status, p.supplier_id INTO v_pv
    FROM public.payment_vouchers p
   WHERE p.tenant_id = v_tenant AND p.deleted_at IS NULL AND upper(trim(p.ref_no)) = 'PV-0001'
   ORDER BY p.created_at LIMIT 1;
  v_pv_found := FOUND;

  v_note := 'Ikut PV-0001 (28/09/2026, ' || CASE WHEN v_pv_found THEN upper(coalesce(v_pv.status,'draft')) ELSE 'DRAFT' END
         || ') RM 10,956.00 — Bank Transfer UOB 151-308-412-4, ref Pin-2609-0100. '
         || 'Item: ' || v_item_desc || ' — 2400 unit @ RM8.30 = RM19,920.00. '
         || 'Nota: amaun PV (RM10,956.00) = 55% / 1320 unit; baki RM8,964.00 belum dibayar. '
         || 'Prepared: Phubieyas Ahmad; Approved: Haziq Haime.';

  -- 3) Existing bill? (idempotent: same tenant + supplier + date + total) ----
  SELECT b.id, b.bill_no INTO v_bill, v_bill_no FROM public.supplier_bills b
   WHERE b.tenant_id = v_tenant AND b.deleted_at IS NULL
     AND b.supplier_id = v_supplier AND b.bill_date = v_bill_date AND b.total = v_total
   ORDER BY b.created_at LIMIT 1;

  IF v_bill IS NULL AND v_pv_found AND v_pv.bill_id IS NOT NULL THEN
    SELECT b.id, b.bill_no INTO v_bill, v_bill_no FROM public.supplier_bills b
     WHERE b.id = v_pv.bill_id AND b.tenant_id = v_tenant AND b.deleted_at IS NULL;
    IF v_bill IS NOT NULL THEN
      RAISE NOTICE 'PV-0001 already linked to bill % — no new bill created. Semak total bil itu.', v_bill_no;
    END IF;
  END IF;

  IF v_bill IS NULL THEN
    -- Bill number: follow tenant's existing pattern
    --   BILL-YYMM-NNNN (next_ref_no style) if tenant already uses it, else app fallback BILL-NNNN
    IF EXISTS (SELECT 1 FROM public.supplier_bills WHERE tenant_id = v_tenant AND bill_no ~ '^BILL-\d{4}-\d+$') THEN
      SELECT coalesce(max((regexp_match(bill_no, '^BILL-\d{4}-(\d+)$'))[1]::int), 0) INTO v_max
        FROM public.supplier_bills WHERE tenant_id = v_tenant AND bill_no ~ '^BILL-\d{4}-\d+$';
      v_bill_no := 'BILL-' || to_char(v_bill_date, 'YYMM') || '-' || lpad((v_max + 1)::text, 4, '0');
    ELSE
      SELECT coalesce(max((regexp_match(bill_no, '^BILL-(\d+)$'))[1]::int), 0) INTO v_max
        FROM public.supplier_bills WHERE tenant_id = v_tenant AND bill_no ~ '^BILL-\d+$';
      v_bill_no := 'BILL-' || lpad((v_max + 1)::text, 4, '0');
    END IF;

    -- created_by (only if column exists): tenant user named Phubieyas, else NULL
    BEGIN
      EXECUTE 'SELECT id FROM public.user_profiles WHERE tenant_id = $1 AND (coalesce(full_name, '''') ILIKE ''%phubieyas%'') LIMIT 1'
        INTO v_creator USING v_tenant;
    EXCEPTION WHEN undefined_column THEN
      BEGIN
        EXECUTE 'SELECT id FROM public.user_profiles WHERE tenant_id = $1 AND (coalesce(name, '''') ILIKE ''%phubieyas%'') LIMIT 1'
          INTO v_creator USING v_tenant;
      EXCEPTION WHEN undefined_column THEN v_creator := NULL;
      END;
    END;

    v_bill := gen_random_uuid();
    v_json := jsonb_build_object(
      'id', v_bill, 'tenant_id', v_tenant, 'bill_no', v_bill_no,
      'supplier_id', v_supplier, 'bill_date', v_bill_date, 'due_date', v_due_date,
      'total', v_total, 'paid_amt', 0, 'status', 'unpaid',
      -- optional columns (only if they exist in live schema)
      'ref_no', v_bill_no, 'supplier_name', 'Ethye Sdn Bhd',
      'subtotal', v_total, 'tax_amount', 0, 'sst_amount', 0, 'tax_rate', 0,
      'notes', v_note, 'description', v_note, 'memo', v_note,
      'created_by', v_creator, 'created_at', now(), 'updated_at', now());
    SELECT string_agg(quote_ident(c.column_name), ',') INTO v_cols
      FROM information_schema.columns c
     WHERE c.table_schema = 'public' AND c.table_name = 'supplier_bills'
       AND v_json ? c.column_name
       AND NOT (c.column_name = 'created_by' AND v_creator IS NULL);
    EXECUTE format('INSERT INTO public.supplier_bills (%s) SELECT %s FROM jsonb_populate_record(NULL::public.supplier_bills, $1)', v_cols, v_cols)
      USING v_json;
    RAISE NOTICE 'Supplier bill % created: RM % (unpaid)', v_bill_no, v_total;

    -- 3b) Bill line (only if supplier_bill_items table exists)
    IF to_regclass('public.supplier_bill_items') IS NOT NULL THEN
      v_json := jsonb_build_object(
        'id', gen_random_uuid(), 'bill_id', v_bill, 'tenant_id', v_tenant,
        'description', v_item_desc, 'item_name', v_item_desc,
        'qty', v_qty, 'quantity', v_qty, 'unit', 'Unit',
        'unit_cost', v_price, 'unit_price', v_price, 'price', v_price,
        'line_total', v_total, 'amount', v_total, 'total', v_total,
        'tax_rate', 0, 'tax_amount', 0, 'sort_order', 1, 'created_at', now());
      SELECT string_agg(quote_ident(c.column_name), ',') INTO v_cols
        FROM information_schema.columns c
       WHERE c.table_schema = 'public' AND c.table_name = 'supplier_bill_items'
         AND v_json ? c.column_name;
      BEGIN
        EXECUTE format('INSERT INTO public.supplier_bill_items (%s) SELECT %s FROM jsonb_populate_record(NULL::public.supplier_bill_items, $1)', v_cols, v_cols)
          USING v_json;
        RAISE NOTICE 'Bill line inserted: 2400 @ 8.30 = 19,920.00';
      EXCEPTION WHEN others THEN
        RAISE NOTICE 'supplier_bill_items variant, line skipped (bill total still 19,920): %', SQLERRM;
      END;
    END IF;
  ELSE
    RAISE NOTICE 'Bill already exists: % (%), skip insert.', v_bill_no, v_bill;
  END IF;

  -- 4) Link PV-0001 -> bill (DRAFT: link only, no payment) -------------------
  IF v_pv_found THEN
    IF v_pv.bill_id IS NULL OR v_pv.bill_id = v_bill THEN
      UPDATE public.payment_vouchers
         SET bill_id = v_bill,
             supplier_id = coalesce(supplier_id, v_supplier),
             payee_type = CASE WHEN coalesce(payee_type,'other') = 'other' THEN 'supplier' ELSE payee_type END,
             updated_at = now()
       WHERE id = v_pv.id;
      RAISE NOTICE 'PV-0001 linked to bill % (PV amount RM %, status %). Balance after PV paid = RM %',
        v_bill_no, v_pv.amount, v_pv.status, v_total - coalesce(v_pv.amount, 0);
    ELSE
      RAISE NOTICE 'PV-0001 already linked to a different bill (%) — NOT changed.', v_pv.bill_id;
    END IF;
    IF lower(coalesce(v_pv.status,'')) = 'paid' THEN
      RAISE NOTICE 'PV-0001 status=paid in DB but bill paid_amt not reflected by this script — semak supplier_payments.';
    END IF;
  ELSE
    RAISE NOTICE 'PV-0001 not found in tenant — bill left unpaid; PV ref + amount recorded in bill notes (if column exists).';
  END IF;
END $$;

-- 5) System Development roadmap — mark/create completed ----------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.dev_roadmap_items
              WHERE title ILIKE '%brzky%supplier%bill%' OR title ILIKE '%brzky%pv-0001%') THEN
    UPDATE public.dev_roadmap_items
       SET stage = 'completed',
           module = COALESCE(NULLIF(TRIM(module), ''), 'purchasing'),
           description = 'Brzky Empire: supplier bill Ethye Sdn Bhd ikut PV-0001 — 2400 x RM8.30 = RM19,920 (unpaid). PV-0001 (RM10,956 draft) linked via payment_vouchers.bill_id; baki RM8,964 selepas PV dibayar. SQL snippet only.'
     WHERE title ILIKE '%brzky%supplier%bill%' OR title ILIKE '%brzky%pv-0001%';
  ELSE
    INSERT INTO public.dev_roadmap_items (title, description, module, stage)
    VALUES ('Brzky Empire: supplier bill from PV-0001 (Ethye Sdn Bhd)',
            'Brzky Empire: supplier bill Ethye Sdn Bhd ikut PV-0001 — 2400 x RM8.30 = RM19,920 (unpaid). PV-0001 (RM10,956 draft) linked via payment_vouchers.bill_id; baki RM8,964 selepas PV dibayar. SQL snippet only.',
            'purchasing', 'completed');
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN
  RAISE NOTICE 'dev_roadmap schema variant; skip: %', SQLERRM;
END $$;

-- 6) Verify ------------------------------------------------------------------
SELECT t.name AS tenant, b.bill_no, s.name AS supplier, b.bill_date, b.due_date,
       b.total, b.paid_amt, (b.total - b.paid_amt) AS balance, b.status,
       pv.ref_no AS pv_ref, pv.amount AS pv_amount, pv.status AS pv_status
  FROM public.supplier_bills b
  JOIN public.tenants t   ON t.id = b.tenant_id
  JOIN public.suppliers s ON s.id = b.supplier_id
  LEFT JOIN public.payment_vouchers pv ON pv.bill_id = b.id AND pv.deleted_at IS NULL
 WHERE (upper(t.code) = 'BROZKY99' OR t.name ILIKE '%br%zky%')
   AND s.name ILIKE '%ethye%' AND b.bill_date = DATE '2026-09-28' AND b.deleted_at IS NULL;
-- Expect 1 row: total 19920.00, paid_amt 0, balance 19920.00, status unpaid,
--               pv_ref PV-0001, pv_amount 10956.00, pv_status draft (null if PV-0001 not in DB)
