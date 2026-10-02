-- Roadmap: editable public booking hold minutes (default 30) — Mike unlocked
-- WRITE-ONLY — run in Supabase SQL Editor AFTER app ship + after
--   20261003060000_booking_hold_minutes.sql (RPC + board hold_minutes).
-- No new table/column: uses tenants.config->>'booking_hold_minutes' via merge_tenant_config.
-- Badge window in booking-card-ui.js (15*60*1000) left alone — UI "fresh" badge, not hold TTL.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.dev_roadmap_items
    WHERE title ILIKE '%booking%hold%min%'
       OR title ILIKE '%hold minutes%'
       OR title ILIKE '%booking hold TTL%'
  ) THEN
    UPDATE public.dev_roadmap_items
    SET
      stage = 'completed',
      module = COALESCE(NULLIF(TRIM(module), ''), 'booking'),
      description = 'Tenant-configurable paid public booking hold TTL. Default 30 min (was hardcoded 15). Stored in tenants.config.booking_hold_minutes (clamp 5–1440). create_public_booking + get_public_booking_board use same value; Settings → Public booking has Hold minutes field saved via merge_tenant_config; app/booking.js HOLD note dynamic from board/RPC. Free bookings still skip hold. booking-card-ui fresh badge (15 min) left — UI-only, not hold TTL. Does not touch CSS global, print, sidebar, openPage, or unrelated modules.',
      pr_url = 'https://github.com/mpflemedia-ux/mcore/commit/dc94fb44fbbe55e37368b444f9c605c363d17b6c'
    WHERE title ILIKE '%booking%hold%min%'
       OR title ILIKE '%hold minutes%'
       OR title ILIKE '%booking hold TTL%';
  ELSE
    INSERT INTO public.dev_roadmap_items (
      title, description, module, stage, pr_url
    ) VALUES (
      'Booking: editable hold minutes (default 30)',
      'Tenant-configurable paid public booking hold TTL. Default 30 min (was hardcoded 15). Stored in tenants.config.booking_hold_minutes (clamp 5–1440). create_public_booking + get_public_booking_board use same value; Settings → Public booking has Hold minutes field saved via merge_tenant_config; app/booking.js HOLD note dynamic from board/RPC. Free bookings still skip hold. booking-card-ui fresh badge (15 min) left — UI-only, not hold TTL. Does not touch CSS global, print, sidebar, openPage, or unrelated modules.',
      'booking',
      'completed',
      'https://github.com/mpflemedia-ux/mcore/commit/dc94fb44fbbe55e37368b444f9c605c363d17b6c'
    );
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN
  RAISE NOTICE 'dev_roadmap schema variant; skip: %', SQLERRM;
END $$;
