CREATE OR REPLACE FUNCTION public.create_public_booking(
  p_token text, p_service_id uuid, p_starts_at timestamptz, p_name text, p_email text, p_phone text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
BEGIN
  PERFORM public.expire_stale_bookings();
  IF p_token IS NULL OR length(trim(p_token)) < 8 THEN RAISE EXCEPTION 'Invalid token'; END IF;
  IF p_name IS NULL OR length(trim(p_name)) < 2 THEN RAISE EXCEPTION 'Name required'; END IF;
  SELECT * INTO tn FROM public.tenants WHERE booking_public_token = trim(p_token) AND deleted_at IS NULL LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking page not found'; END IF;
  SELECT * INTO svc FROM public.booking_services WHERE id = p_service_id AND tenant_id = tn.id AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Service not found'; END IF;
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
    cust_code := 'BKCUS-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 8));
    INSERT INTO public.customers (tenant_id, code, name, email, phone)
    VALUES (tn.id, cust_code, trim(p_name), nullif(trim(p_email), ''), nullif(trim(p_phone), ''))
    RETURNING id INTO cust_id;
  END IF;
  qref := 'BK-' || to_char(now() AT TIME ZONE 'Asia/Kuala_Lumpur', 'YYYYMMDD') || '-' || substr(encode(gen_random_bytes(4), 'hex'), 1, 6);
  INSERT INTO public.bookings (
    tenant_id, service_id, customer_id, customer_name, customer_email, customer_phone,
    starts_at, ends_at, status, hold_until, quote_ref
  ) VALUES (
    tn.id, svc.id, cust_id, trim(p_name), nullif(trim(p_email), ''), nullif(trim(p_phone), ''),
    p_starts_at, v_ends, 'hold', now() + interval '15 minutes', qref
  ) RETURNING id INTO book_id;
  inv_tok := encode(gen_random_bytes(16), 'hex');
  BEGIN
    INSERT INTO public.invoices (tenant_id, customer_id, customer_name, issue_date, due_date, total, status, notes, public_token)
    VALUES (tn.id, cust_id, trim(p_name), CURRENT_DATE, CURRENT_DATE, coalesce(svc.price, 0), 'unpaid',
      'Booking '||qref||' '||svc.name, inv_tok) RETURNING id INTO inv_id;
    INSERT INTO public.invoice_items (invoice_id, description, qty, unit_price, line_total)
    VALUES (inv_id, svc.name||' ['||qref||']', 1, coalesce(svc.price, 0), coalesce(svc.price, 0));
    UPDATE public.bookings SET invoice_id = inv_id, status = 'pending_payment', updated_at = now() WHERE id = book_id;
  EXCEPTION WHEN OTHERS THEN inv_id := NULL; inv_tok := NULL; END;
  BEGIN
    SELECT user_id INTO owner_id FROM public.user_profiles WHERE tenant_id = tn.id AND lower(coalesce(role,'')) IN ('owner','admin') LIMIT 1;
    IF owner_id IS NOT NULL THEN
      INSERT INTO public.platform_activities (owner_user_id, tenant_id, title, activity_type, starts_at, ends_at, notes, status)
      VALUES (owner_id, tn.id, 'Booking '||qref||': '||svc.name||' — '||trim(p_name), 'appointment', p_starts_at, v_ends, 'booking:'||book_id::text, 'open')
      RETURNING id INTO act_id;
      UPDATE public.bookings SET activity_id = act_id WHERE id = book_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN act_id := NULL; END;
  RETURN jsonb_build_object('booking_id', book_id, 'status', 'pending_payment', 'quote_ref', qref,
    'starts_at', p_starts_at, 'ends_at', v_ends, 'service', svc.name, 'amount', coalesce(svc.price, 0),
    'invoice_id', inv_id, 'pay_token', inv_tok, 'hold_until', now() + interval '15 minutes');
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_public_booking(text, uuid, timestamptz, text, text, text) TO anon, authenticated;
