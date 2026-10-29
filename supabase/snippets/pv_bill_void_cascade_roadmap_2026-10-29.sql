-- M-Core · Bill-page void cascades to linked Payment Voucher — System Development roadmap item (WRITE ONLY; run manually in Supabase SQL editor)
-- No schema migration needed: the fix is frontend-only (app/index.html, app/pay-void.js).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.dev_roadmap_items
              WHERE title ILIKE '%bill-page void cascades%payment voucher%') THEN
    UPDATE public.dev_roadmap_items
       SET stage = 'completed',
           module = COALESCE(NULLIF(TRIM(module), ''), 'purchasing'),
           description = 'Voiding a supplier-bill payment from the Bill page now detects PV-created payments (memo ''PV <ref>'' on the same bill; legacy rows: same bill + amount within ±10 min of PV paid_at) and runs the PV void path: PV → void, cashbook payments row removed, PV journals cleared, bill paid_amt/status restored once, approval.pv_void notification (bell + push). Shared _pvVoidCore with a status-flip gate (no double reversal from either side), stale-row guard, books-lock + reason sheet kept, EN/BM toasts. Non-PV bill payments unchanged.'
     WHERE title ILIKE '%bill-page void cascades%payment voucher%';
  ELSE
    INSERT INTO public.dev_roadmap_items (title, description, module, stage)
    VALUES ('Bill-page void cascades to linked Payment Voucher',
            'Voiding a supplier-bill payment from the Bill page now detects PV-created payments (memo ''PV <ref>'' on the same bill; legacy rows: same bill + amount within ±10 min of PV paid_at) and runs the PV void path: PV → void, cashbook payments row removed, PV journals cleared, bill paid_amt/status restored once, approval.pv_void notification (bell + push). Shared _pvVoidCore with a status-flip gate (no double reversal from either side), stale-row guard, books-lock + reason sheet kept, EN/BM toasts. Non-PV bill payments unchanged.',
            'purchasing', 'completed');
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN
  RAISE NOTICE 'dev_roadmap schema variant; skip: %', SQLERRM;
END $$;

-- Verify
SELECT title, module, stage FROM public.dev_roadmap_items
 WHERE title ILIKE '%bill-page void cascades%payment voucher%';
