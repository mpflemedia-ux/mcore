-- Booking workflow: planner only after confirm; amend + cancel/delete.
CREATE OR REPLACE FUNCTION public._booking_sync_planner(p_booking_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  b public.bookings%ROWTYPE;
  svc_name text;
  owner_id uuid;
  act_id uuid;
  ttl text;
BEGIN
  SELECT * INTO b FROM public.bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT name INTO svc_name FROM public.booking_services WHERE id = b.service_id;
  svc_name := coalesce(svc_name, 'Booking');
  ttl := 'Booking '||coalesce(b.quote_ref,'')||': '||svc_name||' -- '||coalesce(b.customer_name,'');

  IF b.status IS DISTINCT FROM 'confirmed' THEN
    IF b.activity_id IS NOT NULL THEN
      UPDATE public.platform_activities
      SET status = 'cancelled', updated_at = now()
      WHERE id = b.activity_id AND status IS DISTINCT FROM 'cancelled';
    END IF;
    RETURN b.activity_id;
  END IF;

  IF b.activity_id IS NOT NULL THEN
    UPDATE public.platform_activities
    SET title = ttl, starts_at = b.starts_at, ends_at = b.ends_at,
        notes = 'booking:'||b.id::text, status = 'open', updated_at = now()
    WHERE id = b.activity_id;
    RETURN b.activity_id;
  END IF;

  SELECT user_id INTO owner_id
  FROM public.user_profiles
  WHERE tenant_id = b.tenant_id AND lower(coalesce(role,'')) IN ('owner','admin')
  LIMIT 1;
  IF owner_id IS NULL THEN
    SELECT user_id INTO owner_id FROM public.user_profiles WHERE tenant_id = b.tenant_id LIMIT 1;
  END IF;
  IF owner_id IS NULL THEN RETURN NULL; END IF;

  INSERT INTO public.platform_activities (
    owner_user_id, tenant_id, title, activity_type, starts_at, ends_at, notes, status
  ) VALUES (
    owner_id, b.tenant_id, ttl, 'appointment', b.starts_at, b.ends_at, 'booking:'||b.id::text, 'open'
  ) RETURNING id INTO act_id;
  UPDATE public.bookings SET activity_id = act_id WHERE id = b.id;
  RETURN act_id;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.confirm_booking_cash(p_booking_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE tid uuid; b public.bookings%ROWTYPE; act uuid;
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
  act := public._booking_sync_planner(b.id);
  RETURN jsonb_build_object('booking_id', b.id, 'status', 'confirmed', 'quote_ref', b.quote_ref, 'activity_id', act);
END;
$fn$;
GRANT EXECUTE ON FUNCTION public.confirm_booking_cash(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public._booking_on_invoice_paid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE rec record;
BEGIN
  IF NEW.status = 'paid' AND (OLD.status IS DISTINCT FROM 'paid') THEN
    UPDATE public.bookings
    SET status = 'confirmed', payment_channel = coalesce(payment_channel, 'online'), updated_at = now()
    WHERE invoice_id = NEW.id AND status IN ('hold', 'pending_payment', 'payment_failed', 'confirmed');
    FOR rec IN SELECT id FROM public.bookings WHERE invoice_id = NEW.id LOOP
      PERFORM public._booking_sync_planner(rec.id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.amend_booking(
  p_booking_id uuid,
  p_name text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_starts_at timestamptz DEFAULT NULL,
  p_notes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  tid uuid; b public.bookings%ROWTYPE; svc public.booking_services%ROWTYPE;
  v_start timestamptz; v_end timestamptz; taken int;
BEGIN
  tid := public.get_my_tenant_id();
  IF tid IS NULL THEN RAISE EXCEPTION 'No tenant'; END IF;
  SELECT * INTO b FROM public.bookings WHERE id = p_booking_id AND tenant_id = tid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;
  IF b.status IN ('expired', 'cancelled') THEN RAISE EXCEPTION 'Cannot amend a % booking', b.status; END IF;
  SELECT * INTO svc FROM public.booking_services WHERE id = b.service_id;
  v_start := coalesce(p_starts_at, b.starts_at);
  IF svc.kind = 'event' AND svc.event_starts_at IS NOT NULL THEN
    v_start := svc.event_starts_at;
    v_end := coalesce(svc.event_ends_at, svc.event_starts_at + make_interval(mins => svc.duration_min));
  ELSE
    v_end := v_start + make_interval(mins => coalesce(svc.duration_min, 60));
  END IF;
  IF v_start IS DISTINCT FROM b.starts_at THEN
    PERFORM pg_advisory_xact_lock(hashtext(tid::text || coalesce(b.service_id::text,'') || v_start::text));
    SELECT count(*) INTO taken FROM public.bookings x
    WHERE x.tenant_id = tid AND x.service_id = b.service_id AND x.id <> b.id
      AND x.status IN ('hold', 'pending_payment', 'confirmed')
      AND (x.status = 'confirmed' OR x.hold_until IS NULL OR x.hold_until > now())
      AND x.starts_at < v_end AND x.ends_at > v_start;
    IF svc.capacity IS NOT NULL AND taken >= svc.capacity THEN RAISE EXCEPTION 'Slot full'; END IF;
  END IF;
  UPDATE public.bookings SET
    customer_name = coalesce(nullif(trim(p_name), ''), customer_name),
    customer_phone = CASE WHEN p_phone IS NULL THEN customer_phone ELSE nullif(trim(p_phone), '') END,
    customer_email = CASE WHEN p_email IS NULL THEN customer_email ELSE nullif(trim(p_email), '') END,
    starts_at = v_start,
    ends_at = v_end,
    notes = CASE WHEN p_notes IS NULL THEN notes ELSE nullif(trim(p_notes), '') END,
    updated_at = now()
  WHERE id = b.id;
  PERFORM public._booking_sync_planner(b.id);
  RETURN jsonb_build_object('booking_id', b.id, 'starts_at', v_start, 'ends_at', v_end);
END;
$fn$;
GRANT EXECUTE ON FUNCTION public.amend_booking(uuid, text, text, text, timestamptz, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_booking(p_booking_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE tid uuid; b public.bookings%ROWTYPE;
BEGIN
  tid := public.get_my_tenant_id();
  IF tid IS NULL THEN RAISE EXCEPTION 'No tenant'; END IF;
  SELECT * INTO b FROM public.bookings WHERE id = p_booking_id AND tenant_id = tid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;
  IF b.status IN ('cancelled') THEN
    RETURN jsonb_build_object('booking_id', b.id, 'status', 'cancelled');
  END IF;
  UPDATE public.bookings SET status = 'cancelled', expired_at = now(), updated_at = now() WHERE id = b.id;
  PERFORM public._booking_sync_planner(b.id);
  RETURN jsonb_build_object('booking_id', b.id, 'status', 'cancelled');
END;
$fn$;
GRANT EXECUTE ON FUNCTION public.cancel_booking(uuid) TO authenticated;
