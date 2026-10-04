-- Roadmap: public booking "Customer pilih staff" (default OFF).
-- WRITE-ONLY — run in Supabase SQL Editor AFTER
--   supabase/migrations/20261004090000_booking_staff_picker.sql
-- Live cachebust SHA: 364a848c9ba2df5b3d3c91809075a05f9a9d38be
-- SQL commit: 8887d6b24612fc294a1ff7996e5eba34f8139bae
-- Does not apply the booking migration. Does not touch confirm_booking_cash.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.dev_roadmap_items
    WHERE title ILIKE '%customer pilih staff%'
       OR title ILIKE '%booking%staff picker%'
  ) THEN
    UPDATE public.dev_roadmap_items
    SET
      stage = 'completed',
      module = COALESCE(NULLIF(TRIM(module), ''), 'booking'),
      description = 'Existing public booking can optionally ask the customer to pick a staff member first (tenants.config.booking_customer_pick_staff, default off). Settings assign staff to services via booking_service_staff. Bookings store staff_id. Deleted employees are skipped. No duty column. OFF path stays service then date then slot and does not send p_staff_id. confirm_booking_cash, Pay invoice, booking-free-confirm.js, CSS, print, sidebar, and openPage are unchanged. SQL is write-only until Mike runs 20261004090000.',
      pr_url = 'https://github.com/mpflemedia-ux/mcore/commit/364a848c9ba2df5b3d3c91809075a05f9a9d38be'
    WHERE title ILIKE '%customer pilih staff%'
       OR title ILIKE '%booking%staff picker%';
  ELSE
    INSERT INTO public.dev_roadmap_items (title, description, module, stage, pr_url)
    VALUES (
      'Booking: customer pilih staff (default off)',
      'Existing public booking can optionally ask the customer to pick a staff member first (tenants.config.booking_customer_pick_staff, default off). Settings assign staff to services via booking_service_staff. Bookings store staff_id. Deleted employees are skipped. No duty column. OFF path stays service then date then slot and does not send p_staff_id. confirm_booking_cash, Pay invoice, booking-free-confirm.js, CSS, print, sidebar, and openPage are unchanged. SQL is write-only until Mike runs 20261004090000.',
      'booking',
      'completed',
      'https://github.com/mpflemedia-ux/mcore/commit/364a848c9ba2df5b3d3c91809075a05f9a9d38be'
    );
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN
  RAISE NOTICE 'dev_roadmap schema variant; skip: %', SQLERRM;
END $$;
