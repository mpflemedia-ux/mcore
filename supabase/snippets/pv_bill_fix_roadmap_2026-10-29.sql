-- M-Core · PV ↔ Supplier Bill fix — System Development roadmap item (WRITE ONLY; run manually in Supabase SQL editor)
-- No schema migration needed: the fix is frontend-only (app/index.html, app/pay-void.js).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.dev_roadmap_items
              WHERE title ILIKE '%payment voucher%supplier bill%link%') THEN
    UPDATE public.dev_roadmap_items
       SET stage = 'completed',
           module = COALESCE(NULLIF(TRIM(module), ''), 'purchasing'),
           description = 'PV ↔ Supplier Bill: fix supplier_bills selects (bill_no, supplier_id, suppliers(name)); PV form always preselects linked bill, keeps bill_id when bill list fails, saves supplier_id/payee_type; Mark Paid writes memo, caps at bill balance, blocks duplicates, touches bill only after payment insert; Void paid PV reverses bill + removes supplier_payments/payments + clears journals; NT.notify approval.pv_submitted/pv_approved/pv_paid/pv_void + bill_created (bell + push, EN/BM, deep links); mobile 1-col form, nowrap buttons.'
     WHERE title ILIKE '%payment voucher%supplier bill%link%';
  ELSE
    INSERT INTO public.dev_roadmap_items (title, description, module, stage)
    VALUES ('Payment Voucher ↔ Supplier Bill link fix + PV notifications',
            'PV ↔ Supplier Bill: fix supplier_bills selects (bill_no, supplier_id, suppliers(name)); PV form always preselects linked bill, keeps bill_id when bill list fails, saves supplier_id/payee_type; Mark Paid writes memo, caps at bill balance, blocks duplicates, touches bill only after payment insert; Void paid PV reverses bill + removes supplier_payments/payments + clears journals; NT.notify approval.pv_submitted/pv_approved/pv_paid/pv_void + bill_created (bell + push, EN/BM, deep links); mobile 1-col form, nowrap buttons.',
            'purchasing', 'completed');
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN
  RAISE NOTICE 'dev_roadmap schema variant; skip: %', SQLERRM;
END $$;

-- Verify
SELECT title, module, stage FROM public.dev_roadmap_items
 WHERE title ILIKE '%payment voucher%supplier bill%link%';
