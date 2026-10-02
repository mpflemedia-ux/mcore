-- Tenant-configurable paid booking hold TTL (default 30 min).
-- Source of truth: tenants.config->>'booking_hold_minutes' (same JSONB as roles / books_lock_date).
-- WRITE-ONLY for Mike: run in Supabase SQL Editor. Do not apply from CI.
-- Clamps to 5..1440. Free bookings (price<=0) still skip hold.

CREATE OR REPLACE FUNCTION public.get_public_booking_board(p_token text, p_date date DEFAULT CURRENT_DATE)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  tn public.tenants%ROWTYPE;
  services jsonb;
  booked jsonb;
  v_hold_mins int;
BEGIN
  PERFORM public.expire_stale_bookings();
  IF p_token IS NULL OR length(trim(p_token)) < 8 THEN RAISE EXCEPTION 'Invalid token'; END IF;
  SELECT * INTO tn FROM public.tenants WHERE booking_public_token = trim(p_token) AND deleted_at IS NULL LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking page not found'; END IF;

  BEGIN
    IF (tn.config->>'booking_hold_minutes') ~ '^[0-9]+$' THEN
      v_hold_mins := (tn.config->>'booking_hold_minutes')::int;
    ELSE
      v_hold_mins := 30;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_hold_mins := 30;
  END;
  IF v_hold_mins < 5 THEN v_hold_mins := 5; END IF;
  IF v_hold_mins > 1440 THEN v_hold_mins := 1440; END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id, 'name', s.name, 'kind', s.kind, 'duration_min', s.duration_min,
    'price', s.price, 'capacity', s.capacity, 'weekday_mask', s.weekday_mask,
    'day_start', s.day_start, 'day_end', s.day_end,
    'event_starts_at', s.event_starts_at, 'event_ends_at', s.event_ends_at
  ) ORDER BY s.name), '[]'::jsonb) INTO services
  FROM public.booking_services s WHERE s.tenant_id = tn.id AND s.is_active = true;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'service_id', b.service_id, 'starts_at', b.starts_at, 'ends_at', b.ends_at, 'status', b.status
  )), '[]'::jsonb) INTO booked
  FROM public.bookings b
  WHERE b.tenant_id = tn.id AND b.starts_at::date = p_date
    AND b.status IN ('hold', 'pending_payment', 'confirmed')
    AND (b.status = 'confirmed' OR b.hold_until IS NULL OR b.hold_until > now());
  RETURN jsonb_build_object(
    'tenant_name', tn.name,
    'date', p_date,
    'services', services,
    'booked', booked,
    'hold_minutes', v_hold_mins
  );
END;
$fn$;
GRANT EXECUTE ON FUNCTION public.get_public_booking_board(text, date) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_public_booking(
  p_token text, p_service_id uuid, p_starts_at timestamptz, p_name text, p_email text, p_phone text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $booking$
DECLARE
  tn public.tenants%ROWTYPE;
  svc public.booking_services%ROWTYPE;
  v_ends timestamptz;
  taken int;
  cust_id uuid;
  book_id uuid;
  inv_id uuid;
  inv_tok text;
  qref text;
  owner_id uuid;
  act_id uuid;
  cust_code text;
  v_free boolean;
  v_status text;
  v_hold_mins int;
  v_hold_until timestamptz;
BEGIN
  PERFORM public.expire_stale_bookings();
  IF p_token IS NULL OR length(trim(p_token)) < 8 THEN RAISE EXCEPTION 'Invalid token'; END IF;
  IF p_name IS NULL OR length(trim(p_name)) < 2 THEN RAISE EXCEPTION 'Name required'; END IF;
  SELECT * INTO tn FROM public.tenants WHERE booking_public_token = trim(p_token) AND deleted_at IS NULL LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking page not found'; END IF;
  SELECT * INTO svc FROM public.booking_services WHERE id = p_service_id AND tenant_id = tn.id AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Service not found'; END IF;

  BEGIN
    IF (tn.config->>'booking_hold_minutes') ~ '^[0-9]+$' THEN
      v_hold_mins := (tn.config->>'booking_hold_minutes')::int;
    ELSE
      v_hold_mins := 30;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_hold_mins := 30;
  END;
  IF v_hold_mins < 5 THEN v_hold_mins := 5; END IF;
  IF v_hold_mins > 1440 THEN v_hold_mins := 1440; END IF;

  v_free := coalesce(svc.price, 0) <= 0;
  IF svc.kind = 'event' AND svc.event_starts_at IS NOT NULL THEN
    p_starts_at := svc.event_starts_at;
    v_ends := coalesce(svc.event_ends_at, svc.event_starts_at + make_interval(mins => svc.duration_min));
  ELSE
    v_ends := p_starts_at + make_interval(mins => svc.duration_min);
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext(tn.id::text || svc.id::text || p_starts_at::text));
  SELECT count(*) INTO taken FROM public.bookings b
  WHERE b.tenant_id = tn.id AND b.service_id = svc.id
    AND b.status IN ('hold', 'pending_payment', 'confirmed')
    AND (b.status = 'confirmed' OR b.hold_until IS NULL OR b.hold_until > now())
    AND b.starts_at < v_ends AND b.ends_at > p_starts_at;
  IF taken >= svc.capacity THEN RAISE EXCEPTION 'Slot full'; END IF;
  IF p_email IS NOT NULL AND length(trim(p_email)) > 3 THEN
    SELECT id INTO cust_id FROM public.customers WHERE tenant_id = tn.id AND lower(email) = lower(trim(p_email)) LIMIT 1;
  END IF;
  IF cust_id IS NULL THEN
    cust_code := 'BKCUS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    INSERT INTO public.customers (tenant_id, code, name, email, phone)
    VALUES (tn.id, cust_code, trim(p_name), nullif(trim(p_email), ''), nullif(trim(p_phone), ''))
    RETURNING id INTO cust_id;
  END IF;
  qref := 'BK-' || to_char(now() AT TIME ZONE 'Asia/Kuala_Lumpur', 'YYYYMMDD') || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  v_status := CASE WHEN v_free THEN 'confirmed' ELSE 'hold' END;
  v_hold_until := CASE WHEN v_free THEN NULL ELSE now() + make_interval(mins => v_hold_mins) END;
  INSERT INTO public.bookings (
    tenant_id, service_id, customer_id, customer_name, customer_email, customer_phone,
    starts_at, ends_at, status, hold_until, quote_ref
  ) VALUES (
    tn.id, svc.id, cust_id, trim(p_name), nullif(trim(p_email), ''), nullif(trim(p_phone), ''),
    p_starts_at, v_ends, v_status,
    v_hold_until,
    qref
  ) RETURNING id INTO book_id;
  IF NOT v_free THEN
    inv_tok := replace(gen_random_uuid()::text, '-', '') || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
    BEGIN
      INSERT INTO public.invoices (tenant_id, customer_id, customer_name, issue_date, due_date, total, status, notes, public_token)
      VALUES (tn.id, cust_id, trim(p_name), CURRENT_DATE, CURRENT_DATE, coalesce(svc.price, 0), 'unpaid',
        'Booking '||qref||' '||svc.name, inv_tok) RETURNING id INTO inv_id;
      INSERT INTO public.invoice_items (invoice_id, description, qty, unit_price, line_total)
      VALUES (inv_id, svc.name||' ['||qref||']', 1, coalesce(svc.price, 0), coalesce(svc.price, 0));
      UPDATE public.bookings SET invoice_id = inv_id, status = 'pending_payment', updated_at = now() WHERE id = book_id;
      v_status := 'pending_payment';
    EXCEPTION WHEN OTHERS THEN inv_id := NULL; inv_tok := NULL; END;
  END IF;
  BEGIN
    SELECT user_id INTO owner_id FROM public.user_profiles WHERE tenant_id = tn.id AND lower(coalesce(role,'')) IN ('owner','admin') LIMIT 1;
    IF owner_id IS NOT NULL THEN
      INSERT INTO public.platform_activities (owner_user_id, tenant_id, title, activity_type, starts_at, ends_at, notes, status)
      VALUES (owner_id, tn.id, 'Booking '||qref||': '||svc.name||' -- '||trim(p_name), 'appointment', p_starts_at, v_ends, 'booking:'||book_id::text, 'open')
      RETURNING id INTO act_id;
      UPDATE public.bookings SET activity_id = act_id WHERE id = book_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN act_id := NULL; END;
  RETURN jsonb_build_object(
    'booking_id', book_id, 'status', v_status, 'quote_ref', qref,
    'starts_at', p_starts_at, 'ends_at', v_ends, 'service', svc.name,
    'amount', coalesce(svc.price, 0),
    'invoice_id', inv_id,
    'pay_token', CASE WHEN v_free THEN NULL ELSE inv_tok END,
    'hold_until', v_hold_until,
    'hold_minutes', CASE WHEN v_free THEN NULL ELSE v_hold_mins END
  );
END;
$booking$;
GRANT EXECUTE ON FUNCTION public.create_public_booking(text, uuid, timestamptz, text, text, text) TO anon, authenticated;
