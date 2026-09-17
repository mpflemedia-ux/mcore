-- Booking state machine: expire holds, advisory lock, cash confirm, quote_ref
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS quote_ref text,
  ADD COLUMN IF NOT EXISTS payment_channel text,
  ADD COLUMN IF NOT EXISTS expired_at timestamptz;

CREATE OR REPLACE FUNCTION public.expire_stale_bookings()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE n int;
BEGIN
  UPDATE public.bookings
  SET status = 'expired', expired_at = now(), updated_at = now()
  WHERE status IN ('hold', 'pending_payment')
    AND hold_until IS NOT NULL AND hold_until < now();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$fn$;
GRANT EXECUTE ON FUNCTION public.expire_stale_bookings() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_booking_board(p_token text, p_date date DEFAULT CURRENT_DATE)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE tn public.tenants%ROWTYPE; services jsonb; booked jsonb;
BEGIN
  PERFORM public.expire_stale_bookings();
  IF p_token IS NULL OR length(trim(p_token)) < 8 THEN RAISE EXCEPTION 'Invalid token'; END IF;
  SELECT * INTO tn FROM public.tenants WHERE booking_public_token = trim(p_token) AND deleted_at IS NULL LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking page not found'; END IF;
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
  RETURN jsonb_build_object('tenant_name', tn.name, 'date', p_date, 'services', services, 'booked', booked);
END;
$fn$;
GRANT EXECUTE ON FUNCTION public.get_public_booking_board(text, date) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_public_booking(
  p_token text, p_service_id uuid, p_starts_at timestamptz, p_name text, p_email text, p_phone text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  tn public.tenants%ROWTYPE; svc public.booking_services%ROWTYPE;
  ends_at timestamptz; taken int; cust_id uuid; book_id uuid; inv_id uuid; inv_tok text; qref text; owner_id uuid; act_id uuid;
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
    ends_at := coalesce(svc.event_ends_at, svc.event_starts_at + make_interval(mins => svc.duration_min));
  ELSE
    ends_at := p_starts_at + make_interval(mins => svc.duration_min);
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext(tn.id::text || svc.id::text || p_starts_at::text));
  SELECT count(*) INTO taken FROM public.bookings b
  WHERE b.tenant_id = tn.id AND b.service_id = svc.id
    AND b.status IN ('hold', 'pending_payment', 'confirmed')
    AND (b.status = 'confirmed' OR b.hold_until IS NULL OR b.hold_until > now())
    AND b.starts_at < ends_at AND b.ends_at > p_starts_at;
  IF taken >= svc.capacity THEN RAISE EXCEPTION 'Slot full'; END IF;
  IF p_email IS NOT NULL AND length(trim(p_email)) > 3 THEN
    SELECT id INTO cust_id FROM public.customers WHERE tenant_id = tn.id AND lower(email) = lower(trim(p_email)) LIMIT 1;
  END IF;
  IF cust_id IS NULL THEN
    INSERT INTO public.customers (tenant_id, name, email, phone)
    VALUES (tn.id, trim(p_name), nullif(trim(p_email), ''), nullif(trim(p_phone), ''))
    RETURNING id INTO cust_id;
  END IF;
  qref := 'BK-' || to_char(now() AT TIME ZONE 'Asia/Kuala_Lumpur', 'YYYYMMDD') || '-' || substr(encode(gen_random_bytes(4), 'hex'), 1, 6);
  INSERT INTO public.bookings (
    tenant_id, service_id, customer_id, customer_name, customer_email, customer_phone,
    starts_at, ends_at, status, hold_until, quote_ref
  ) VALUES (
    tn.id, svc.id, cust_id, trim(p_name), nullif(trim(p_email), ''), nullif(trim(p_phone), ''),
    p_starts_at, ends_at, 'hold', now() + interval '15 minutes', qref
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
    SELECT user_id INTO owner_id FROM public.profiles WHERE tenant_id = tn.id AND lower(coalesce(role,'')) IN ('owner','admin') LIMIT 1;
    IF owner_id IS NOT NULL THEN
      INSERT INTO public.platform_activities (owner_user_id, tenant_id, title, activity_type, starts_at, ends_at, notes, status)
      VALUES (owner_id, tn.id, 'Booking '||qref||': '||svc.name||' — '||trim(p_name), 'appointment', p_starts_at, ends_at, 'booking:'||book_id::text, 'open')
      RETURNING id INTO act_id;
      UPDATE public.bookings SET activity_id = act_id WHERE id = book_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN act_id := NULL; END;
  RETURN jsonb_build_object('booking_id', book_id, 'status', 'pending_payment', 'quote_ref', qref,
    'starts_at', p_starts_at, 'ends_at', ends_at, 'service', svc.name, 'amount', coalesce(svc.price, 0),
    'invoice_id', inv_id, 'pay_token', inv_tok, 'hold_until', now() + interval '15 minutes');
END;
$fn$;
GRANT EXECUTE ON FUNCTION public.create_public_booking(text, uuid, timestamptz, text, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.confirm_booking_cash(p_booking_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE tid uuid; b public.bookings%ROWTYPE;
BEGIN
  tid := public.get_my_tenant_id();
  IF tid IS NULL THEN RAISE EXCEPTION 'No tenant'; END IF;
  SELECT * INTO b FROM public.bookings WHERE id = p_booking_id AND tenant_id = tid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;
  IF b.status NOT IN ('hold', 'pending_payment', 'payment_failed') THEN
    RAISE EXCEPTION 'Cannot confirm cash from status %', b.status;
  END IF;
  UPDATE public.bookings SET status = 'confirmed', payment_channel = 'cash', updated_at = now() WHERE id = b.id;
  IF b.invoice_id IS NOT NULL THEN
    UPDATE public.invoices SET status = 'paid', paid_amt = total, updated_at = now()
    WHERE id = b.invoice_id AND tenant_id = tid AND status <> 'paid';
  END IF;
  RETURN jsonb_build_object('booking_id', b.id, 'status', 'confirmed', 'quote_ref', b.quote_ref);
END;
$fn$;
GRANT EXECUTE ON FUNCTION public.confirm_booking_cash(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.release_booking(p_booking_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE tid uuid;
BEGIN
  tid := public.get_my_tenant_id();
  UPDATE public.bookings SET status = 'expired', expired_at = now(), updated_at = now()
  WHERE id = p_booking_id AND tenant_id = tid AND status IN ('hold', 'pending_payment', 'payment_failed');
  IF NOT FOUND THEN RAISE EXCEPTION 'Cannot release'; END IF;
  RETURN jsonb_build_object('booking_id', p_booking_id, 'status', 'expired');
END;
$fn$;
GRANT EXECUTE ON FUNCTION public.release_booking(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public._booking_on_invoice_paid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF NEW.status = 'paid' AND (OLD.status IS DISTINCT FROM 'paid') THEN
    UPDATE public.bookings
    SET status = 'confirmed', payment_channel = coalesce(payment_channel, 'online'), updated_at = now()
    WHERE invoice_id = NEW.id AND status IN ('hold', 'pending_payment', 'payment_failed', 'confirmed');
  END IF;
  RETURN NEW;
END;
$fn$;
DROP TRIGGER IF EXISTS trg_booking_invoice_paid ON public.invoices;
CREATE TRIGGER trg_booking_invoice_paid
  AFTER UPDATE OF status ON public.invoices
  FOR EACH ROW EXECUTE PROCEDURE public._booking_on_invoice_paid();

DO $rd$
BEGIN
  IF EXISTS (SELECT 1 FROM public.dev_roadmap_items WHERE title ILIKE '%booking state%') THEN
    UPDATE public.dev_roadmap_items SET stage = 'completed',
      description = 'Booking state machine: hold TTL, pending_payment, cash confirm, expire, invoice-paid confirm.'
    WHERE title ILIKE '%booking state%';
  ELSE
    INSERT INTO public.dev_roadmap_items (title, description, module, stage)
    VALUES ('Booking state machine',
      'Booking state machine: hold TTL, pending_payment, cash confirm, expire, invoice-paid confirm.',
      'planner', 'completed');
  END IF;
END;
$rd$;
