-- Replace get_my_tenant_id() with locked user_profiles pattern
CREATE OR REPLACE FUNCTION public.confirm_booking_cash(p_booking_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE tid uuid; b public.bookings%ROWTYPE;
BEGIN
  SELECT tenant_id INTO tid FROM public.user_profiles WHERE id = auth.uid();
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
  SELECT tenant_id INTO tid FROM public.user_profiles WHERE id = auth.uid();
  UPDATE public.bookings SET status = 'expired', expired_at = now(), updated_at = now()
  WHERE id = p_booking_id AND tenant_id = tid AND status IN ('hold', 'pending_payment', 'payment_failed');
  IF NOT FOUND THEN RAISE EXCEPTION 'Cannot release'; END IF;
  RETURN jsonb_build_object('booking_id', p_booking_id, 'status', 'expired');
END;
$fn$;
GRANT EXECUTE ON FUNCTION public.release_booking(uuid) TO authenticated;
