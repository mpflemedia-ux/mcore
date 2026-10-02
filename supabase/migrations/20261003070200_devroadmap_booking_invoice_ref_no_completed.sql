-- Roadmap: paid public booking always creates invoice (ref_no restore)
-- WRITE-ONLY — run in Supabase SQL Editor AFTER app/SQL ship of
--   20261003070000_fix_booking_invoice_ref_no.sql
-- Optional backfill: 20261003070100_backfill_booking_missing_invoices.sql
-- Live bake SHA: b3671ee5f59c3ddc09626ee2ae0e3cc67c505dec (SQL-only; no JS bake)

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.dev_roadmap_items
    WHERE title ILIKE '%booking%invoice%'
       OR title ILIKE '%paid booking%invoice%'
       OR title ILIKE '%create_public_booking%ref_no%'
       OR title ILIKE '%missing invoice%booking%'
  ) THEN
    UPDATE public.dev_roadmap_items
    SET
      stage = 'completed',
      module = COALESCE(NULLIF(TRIM(module), ''), 'booking'),
      description = 'Paid create_public_booking restores invoices.ref_no (INV-BK-…) + paid_amt=0; removes silent EXCEPTION WHEN OTHERS so invoice insert cannot fail while booking stays hold. Free bookings unchanged. confirm_booking_cash NOT changed (marks existing invoice paid only). Optional backfill for confirmed+cash with invoice_id null uses booking customer_id/name only. Does not touch CSS, print, sidebar, openPage, or JS overlays.',
      pr_url = 'https://github.com/mpflemedia-ux/mcore/commit/b3671ee5f59c3ddc09626ee2ae0e3cc67c505dec'
    WHERE title ILIKE '%booking%invoice%'
       OR title ILIKE '%paid booking%invoice%'
       OR title ILIKE '%create_public_booking%ref_no%'
       OR title ILIKE '%missing invoice%booking%';
  ELSE
    INSERT INTO public.dev_roadmap_items (
      title, description, module, stage, pr_url
    ) VALUES (
      'Booking: paid create always creates invoice (ref_no)',
      'Paid create_public_booking restores invoices.ref_no (INV-BK-…) + paid_amt=0; removes silent EXCEPTION WHEN OTHERS so invoice insert cannot fail while booking stays hold. Free bookings unchanged. confirm_booking_cash NOT changed (marks existing invoice paid only). Optional backfill for confirmed+cash with invoice_id null uses booking customer_id/name only. Does not touch CSS, print, sidebar, openPage, or JS overlays.',
      'booking',
      'completed',
      'https://github.com/mpflemedia-ux/mcore/commit/b3671ee5f59c3ddc09626ee2ae0e3cc67c505dec'
    );
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN
  RAISE NOTICE 'dev_roadmap schema variant; skip: %', SQLERRM;
END $$;
