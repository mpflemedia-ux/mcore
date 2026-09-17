-- Seed demo bookings — ATAS ANGIN MY SDN. BHD. only
-- Run manually in SQL Editor. Confirm cash/release via UPDATE (no auth.uid in editor).
DO $$
DECLARE
  tn public.tenants%ROWTYPE;
  tok text;
  svc_sess uuid;
  svc_evt uuid;
  r jsonb;
  id_hold uuid;
  id_pend uuid;
  id_cash uuid;
  id_online uuid;
  id_exp uuid;
  start_hold timestamptz := date_trunc('day', now() AT TIME ZONE 'Asia/Kuala_Lumpur') AT TIME ZONE 'Asia/Kuala_Lumpur' + interval '10 hours';
  start_pend timestamptz := date_trunc('day', now() AT TIME ZONE 'Asia/Kuala_Lumpur') AT TIME ZONE 'Asia/Kuala_Lumpur' + interval '11 hours';
  start_cash timestamptz := date_trunc('day', now() AT TIME ZONE 'Asia/Kuala_Lumpur') AT TIME ZONE 'Asia/Kuala_Lumpur' + interval '12 hours';
  start_onl timestamptz := date_trunc('day', now() AT TIME ZONE 'Asia/Kuala_Lumpur') AT TIME ZONE 'Asia/Kuala_Lumpur' + interval '13 hours';
  start_exp timestamptz := date_trunc('day', now() AT TIME ZONE 'Asia/Kuala_Lumpur') AT TIME ZONE 'Asia/Kuala_Lumpur' + interval '14 hours';
BEGIN
  SELECT * INTO tn FROM public.tenants
  WHERE name ILIKE 'ATAS ANGIN MY SDN. BHD.' AND deleted_at IS NULL
  ORDER BY CASE WHEN is_active THEN 0 ELSE 1 END LIMIT 1;
  IF tn.id IS NULL THEN RAISE EXCEPTION 'Tenant ATAS ANGIN MY SDN. BHD. not found'; END IF;

  IF tn.booking_public_token IS NULL OR length(tn.booking_public_token) < 8 THEN
    UPDATE public.tenants SET booking_public_token = encode(gen_random_bytes(16), 'hex')
    WHERE id = tn.id RETURNING booking_public_token INTO tok;
  ELSE
    tok := tn.booking_public_token;
  END IF;

  SELECT id INTO svc_sess FROM public.booking_services
  WHERE tenant_id = tn.id AND is_active AND kind <> 'event' ORDER BY created_at LIMIT 1;
  IF svc_sess IS NULL THEN
    INSERT INTO public.booking_services (tenant_id, name, kind, duration_min, price, capacity, weekday_mask, day_start, day_end, is_active)
    VALUES (tn.id, 'Consultation', 'session', 60, 150.00, 1, 127, '09:00', '18:00', true)
    RETURNING id INTO svc_sess;
  END IF;

  SELECT id INTO svc_evt FROM public.booking_services
  WHERE tenant_id = tn.id AND is_active AND kind = 'event' ORDER BY created_at LIMIT 1;
  IF svc_evt IS NULL THEN
    INSERT INTO public.booking_services (tenant_id, name, kind, duration_min, price, capacity, weekday_mask, day_start, day_end, event_starts_at, event_ends_at, is_active)
    VALUES (tn.id, 'Open Day Briefing', 'event', 90, 0, 20, 127, '09:00', '18:00',
      date_trunc('day', now() AT TIME ZONE 'Asia/Kuala_Lumpur') AT TIME ZONE 'Asia/Kuala_Lumpur' + interval '3 days' + interval '10 hours',
      date_trunc('day', now() AT TIME ZONE 'Asia/Kuala_Lumpur') AT TIME ZONE 'Asia/Kuala_Lumpur' + interval '3 days' + interval '11 hours 30 minutes',
      true)
    RETURNING id INTO svc_evt;
  END IF;

  r := public.create_public_booking(tok, svc_sess, start_hold, 'Ahmad Test', 'ahmad.test@example.com', '012-1110001');
  id_hold := (r->>'booking_id')::uuid;
  r := public.create_public_booking(tok, svc_sess, start_pend, 'Siti Demo', 'siti.demo@example.com', '012-1110002');
  id_pend := (r->>'booking_id')::uuid;
  r := public.create_public_booking(tok, svc_sess, start_cash, 'Ravi Sample', 'ravi.sample@example.com', '012-1110003');
  id_cash := (r->>'booking_id')::uuid;
  r := public.create_public_booking(tok, svc_sess, start_onl, 'Mei Ling QA', 'meiling.qa@example.com', '012-1110004');
  id_online := (r->>'booking_id')::uuid;
  r := public.create_public_booking(tok, svc_evt, start_exp, 'Farid Expire', 'farid.expire@example.com', '012-1110005');
  id_exp := (r->>'booking_id')::uuid;

  UPDATE public.bookings SET status = 'hold', payment_channel = NULL, hold_until = now() + interval '15 minutes', updated_at = now()
  WHERE id = id_hold AND tenant_id = tn.id;

  UPDATE public.bookings SET status = 'confirmed', payment_channel = 'cash', updated_at = now()
  WHERE id = id_cash AND tenant_id = tn.id;
  UPDATE public.invoices i SET status = 'paid', paid_amt = i.total, updated_at = now()
  FROM public.bookings b
  WHERE b.id = id_cash AND b.tenant_id = tn.id AND i.id = b.invoice_id AND i.tenant_id = tn.id;

  UPDATE public.invoices i SET status = 'paid', paid_amt = i.total, updated_at = now()
  FROM public.bookings b
  WHERE b.id = id_online AND b.tenant_id = tn.id AND i.id = b.invoice_id AND i.tenant_id = tn.id;
  UPDATE public.bookings SET status = 'confirmed', payment_channel = coalesce(payment_channel, 'online'), updated_at = now()
  WHERE id = id_online AND tenant_id = tn.id AND status <> 'confirmed';

  UPDATE public.bookings SET status = 'expired', expired_at = now(), updated_at = now()
  WHERE id = id_exp AND tenant_id = tn.id;
END;
$$;
