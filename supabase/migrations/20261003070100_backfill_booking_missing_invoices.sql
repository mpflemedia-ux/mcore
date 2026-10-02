-- OPTIONAL backfill: bookings that are paid/active but missing invoice_id.
-- WRITE-ONLY for Mike — run in Supabase SQL Editor AFTER
--   20261003070000_fix_booking_invoice_ref_no.sql
-- Does NOT invent customer rows: uses booking.customer_id / customer_name only.
-- Skips free services (price<=0) and rows missing quote_ref or customer_id.
-- confirmed + cash/online => invoice paid (status unchanged on booking).
-- hold / pending_payment / payment_failed => invoice unpaid + booking -> pending_payment.
-- Safe to re-run: only touches invoice_id IS NULL.
-- Preview (optional):
--   SELECT b.quote_ref, b.status, b.payment_channel, b.customer_name, b.invoice_id, s.price
--   FROM public.bookings b
--   JOIN public.booking_services s ON s.id = b.service_id
--   WHERE b.invoice_id IS NULL AND coalesce(s.price,0) > 0
--     AND b.status IN ('hold','pending_payment','payment_failed','confirmed')
--     AND b.quote_ref IS NOT NULL AND b.customer_id IS NOT NULL;

DO $backfill$
DECLARE
  r record;
  inv_id uuid;
  inv_tok text;
  inv_ref text;
  svc_name text;
  v_price numeric;
  v_paid boolean;
  n_ok int := 0;
  n_skip int := 0;
BEGIN
  FOR r IN
    SELECT b.id AS booking_id, b.tenant_id, b.customer_id, b.customer_name,
           b.quote_ref, b.status, b.payment_channel, b.service_id
    FROM public.bookings b
    WHERE b.invoice_id IS NULL
      AND b.quote_ref IS NOT NULL
      AND b.customer_id IS NOT NULL
      AND b.status IN ('hold', 'pending_payment', 'payment_failed', 'confirmed')
  LOOP
    SELECT coalesce(s.price, 0), s.name INTO v_price, svc_name
    FROM public.booking_services s WHERE s.id = r.service_id;
    IF v_price IS NULL OR v_price <= 0 THEN
      n_skip := n_skip + 1;
      CONTINUE;
    END IF;

    -- Mike case BK-20261003-c680c2: confirmed + cash => paid invoice, keep confirmed
    v_paid := (r.status = 'confirmed'
               AND lower(coalesce(r.payment_channel, '')) IN ('cash', 'online'));

    inv_tok := replace(gen_random_uuid()::text, '-', '') || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
    inv_ref := 'INV-BK-' || to_char(now() AT TIME ZONE 'Asia/Kuala_Lumpur', 'YYYYMMDD') || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);

    BEGIN
      INSERT INTO public.invoices (
        tenant_id, customer_id, customer_name, ref_no, issue_date, due_date,
        total, paid_amt, status, notes, public_token
      ) VALUES (
        r.tenant_id, r.customer_id, coalesce(nullif(trim(r.customer_name), ''), 'Booking'),
        inv_ref, CURRENT_DATE, CURRENT_DATE,
        v_price,
        CASE WHEN v_paid THEN v_price ELSE 0 END,
        CASE WHEN v_paid THEN 'paid' ELSE 'unpaid' END,
        'Booking '||r.quote_ref||' '||coalesce(svc_name, 'Service')||' (backfill)',
        inv_tok
      ) RETURNING id INTO inv_id;

      BEGIN
        INSERT INTO public.invoice_items (tenant_id, invoice_id, description, qty, unit_price, line_total)
        VALUES (r.tenant_id, inv_id, coalesce(svc_name,'Service')||' ['||r.quote_ref||']', 1, v_price, v_price);
      EXCEPTION WHEN OTHERS THEN
        INSERT INTO public.invoice_items (invoice_id, description, qty, unit_price, line_total)
        VALUES (inv_id, coalesce(svc_name,'Service')||' ['||r.quote_ref||']', 1, v_price, v_price);
      END;

      IF v_paid THEN
        UPDATE public.bookings
        SET invoice_id = inv_id, updated_at = now()
        WHERE id = r.booking_id AND invoice_id IS NULL;
      ELSE
        UPDATE public.bookings
        SET invoice_id = inv_id, status = 'pending_payment', updated_at = now()
        WHERE id = r.booking_id AND invoice_id IS NULL;
      END IF;
      n_ok := n_ok + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'backfill skip %: %', r.quote_ref, SQLERRM;
      n_skip := n_skip + 1;
    END;
  END LOOP;
  RAISE NOTICE 'booking invoice backfill done: ok=%, skip=%', n_ok, n_skip;
END;
$backfill$;
