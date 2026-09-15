-- Customer booking: services, bookings, public token, RPCs
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS booking_public_token text;
CREATE UNIQUE INDEX IF NOT EXISTS tenants_booking_public_token_uidx
  ON public.tenants (booking_public_token)
  WHERE booking_public_token IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.booking_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'session',
  duration_min integer NOT NULL DEFAULT 60,
  price numeric(12,2) NOT NULL DEFAULT 0,
  capacity integer NOT NULL DEFAULT 1,
  weekday_mask integer NOT NULL DEFAULT 127,
  day_start time NOT NULL DEFAULT '09:00',
  day_end time NOT NULL DEFAULT '18:00',
  event_starts_at timestamptz,
  event_ends_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS booking_services_tenant_idx ON public.booking_services (tenant_id);

CREATE TABLE IF NOT EXISTS public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.booking_services(id) ON DELETE SET NULL,
  customer_id uuid,
  customer_name text,
  customer_email text,
  customer_phone text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'hold',
  hold_until timestamptz,
  invoice_id uuid,
  activity_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bookings_tenant_start_idx ON public.bookings (tenant_id, starts_at);
CREATE INDEX IF NOT EXISTS bookings_invoice_idx ON public.bookings (invoice_id);

ALTER TABLE public.booking_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS booking_services_tenant ON public.booking_services;
CREATE POLICY booking_services_tenant ON public.booking_services
  FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());

DROP POLICY IF EXISTS bookings_tenant ON public.bookings;
CREATE POLICY bookings_tenant ON public.bookings
  FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());

CREATE OR REPLACE FUNCTION public.ensure_booking_public_token()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  tid uuid;
  tok text;
BEGIN
  tid := public.get_my_tenant_id();
  IF tid IS NULL THEN RAISE EXCEPTION 'No tenant'; END IF;
  SELECT booking_public_token INTO tok FROM public.tenants WHERE id = tid;
  IF tok IS NULL OR length(tok) < 8 THEN
    tok := encode(gen_random_bytes(16), 'hex');
    UPDATE public.tenants SET booking_public_token = tok WHERE id = tid;
  END IF;
  RETURN tok;
END;
$fn$;
GRANT EXECUTE ON FUNCTION public.ensure_booking_public_token() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_public_booking_board(p_token text, p_date date DEFAULT CURRENT_DATE)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  tn public.tenants%ROWTYPE;
  services jsonb;
  booked jsonb;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) < 8 THEN
    RAISE EXCEPTION 'Invalid token';
  END IF;
  SELECT * INTO tn FROM public.tenants WHERE booking_public_token = trim(p_token) AND coalesce(is_active, true) = true LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking page not found'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id, 'name', s.name, 'kind', s.kind, 'duration_min', s.duration_min,
    'price', s.price, 'capacity', s.capacity, 'weekday_mask', s.weekday_mask,
    'day_start', s.day_start, 'day_end', s.day_end,
    'event_starts_at', s.event_starts_at, 'event_ends_at', s.event_ends_at
  ) ORDER BY s.name), '[]'::jsonb)
  INTO services
  FROM public.booking_services s
  WHERE s.tenant_id = tn.id AND s.is_active = true;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'service_id', b.service_id, 'starts_at', b.starts_at, 'ends_at', b.ends_at, 'status', b.status
  )), '[]'::jsonb)
  INTO booked
  FROM public.bookings b
  WHERE b.tenant_id = tn.id
    AND b.starts_at::date = p_date
    AND b.status IN ('hold', 'confirmed')
    AND (b.status <> 'hold' OR b.hold_until IS NULL OR b.hold_until > now());
  RETURN jsonb_build_object('tenant_name', tn.name, 'date', p_date, 'services', services, 'booked', booked);
END;
$fn$;
GRANT EXECUTE ON FUNCTION public.get_public_booking_board(text, date) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_public_booking(
  p_token text, p_service_id uuid, p_starts_at timestamptz, p_name text, p_email text, p_phone text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  tn public.tenants%ROWTYPE;
  svc public.booking_services%ROWTYPE;
  ends_at timestamptz;
  taken int;
  cust_id uuid;
  book_id uuid;
  inv_id uuid;
  inv_tok text;
  owner_id uuid;
  act_id uuid;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) < 8 THEN RAISE EXCEPTION 'Invalid token'; END IF;
  IF p_name IS NULL OR length(trim(p_name)) < 2 THEN RAISE EXCEPTION 'Name required'; END IF;
  SELECT * INTO tn FROM public.tenants WHERE booking_public_token = trim(p_token) AND coalesce(is_active, true) = true LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking page not found'; END IF;
  SELECT * INTO svc FROM public.booking_services WHERE id = p_service_id AND tenant_id = tn.id AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Service not found'; END IF;
  IF svc.kind = 'event' AND svc.event_starts_at IS NOT NULL THEN
    p_starts_at := svc.event_starts_at;
    ends_at := coalesce(svc.event_ends_at, svc.event_starts_at + make_interval(mins => svc.duration_min));
  ELSE
    ends_at := p_starts_at + make_interval(mins => svc.duration_min);
  END IF;
  SELECT count(*) INTO taken FROM public.bookings b
  WHERE b.tenant_id = tn.id AND b.service_id = svc.id
    AND b.status IN ('hold', 'confirmed')
    AND (b.status <> 'hold' OR b.hold_until IS NULL OR b.hold_until > now())
    AND b.starts_at < ends_at AND b.ends_at > p_starts_at;
  IF taken >= svc.capacity THEN RAISE EXCEPTION 'Slot full'; END IF;
  IF p_email IS NOT NULL AND length(trim(p_email)) > 3 THEN
    SELECT id INTO cust_id FROM public.customers
    WHERE tenant_id = tn.id AND lower(email) = lower(trim(p_email)) LIMIT 1;
  END IF;
  IF cust_id IS NULL THEN
    INSERT INTO public.customers (tenant_id, name, email, phone)
    VALUES (tn.id, trim(p_name), nullif(trim(p_email), ''), nullif(trim(p_phone), ''))
    RETURNING id INTO cust_id;
  END IF;
  INSERT INTO public.bookings (
    tenant_id, service_id, customer_id, customer_name, customer_email, customer_phone,
    starts_at, ends_at, status, hold_until
  ) VALUES (
    tn.id, svc.id, cust_id, trim(p_name), nullif(trim(p_email), ''), nullif(trim(p_phone), ''),
    p_starts_at, ends_at, 'hold', now() + interval '15 minutes'
  ) RETURNING id INTO book_id;
  inv_tok := encode(gen_random_bytes(16), 'hex');
  BEGIN
    INSERT INTO public.invoices (
      tenant_id, customer_id, customer_name, issue_date, due_date, total, status, notes, public_token
    ) VALUES (
      tn.id, cust_id, trim(p_name), CURRENT_DATE, CURRENT_DATE,
      coalesce(svc.price, 0), 'unpaid',
      'Booking '||svc.name||' '||to_char(p_starts_at AT TIME ZONE 'Asia/Kuala_Lumpur', 'YYYY-MM-DD HH24:MI'),
      inv_tok
    ) RETURNING id INTO inv_id;
    INSERT INTO public.invoice_items (invoice_id, description, qty, unit_price, line_total)
    VALUES (inv_id, svc.name, 1, coalesce(svc.price, 0), coalesce(svc.price, 0));
    UPDATE public.bookings SET invoice_id = inv_id WHERE id = book_id;
  EXCEPTION WHEN OTHERS THEN
    inv_id := NULL; inv_tok := NULL;
  END;
  BEGIN
    SELECT user_id INTO owner_id FROM public.profiles
    WHERE tenant_id = tn.id AND lower(coalesce(role,'')) IN ('owner','admin') LIMIT 1;
    IF owner_id IS NOT NULL THEN
      INSERT INTO public.platform_activities (
        owner_user_id, tenant_id, title, activity_type, starts_at, ends_at, notes, status
      ) VALUES (
        owner_id, tn.id, 'Booking: '||svc.name||' — '||trim(p_name),
        'appointment', p_starts_at, ends_at, 'booking:'||book_id::text, 'open'
      ) RETURNING id INTO act_id;
      UPDATE public.bookings SET activity_id = act_id WHERE id = book_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    act_id := NULL;
  END;
  RETURN jsonb_build_object(
    'booking_id', book_id, 'status', 'hold', 'starts_at', p_starts_at, 'ends_at', ends_at,
    'service', svc.name, 'amount', coalesce(svc.price, 0), 'invoice_id', inv_id, 'pay_token', inv_tok
  );
END;
$fn$;
GRANT EXECUTE ON FUNCTION public.create_public_booking(text, uuid, timestamptz, text, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public._booking_on_invoice_paid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF NEW.status = 'paid' AND (OLD.status IS DISTINCT FROM 'paid') THEN
    UPDATE public.bookings SET status = 'confirmed', updated_at = now()
    WHERE invoice_id = NEW.id AND status IN ('hold', 'confirmed');
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
  IF EXISTS (SELECT 1 FROM public.dev_roadmap_items WHERE title ILIKE '%customer booking%' OR title ILIKE '%booking public%') THEN
    UPDATE public.dev_roadmap_items
    SET stage = 'completed',
        description = 'Public booking link + dashboard card + planner appointment + invoice hold/confirm.',
        module = coalesce(module, 'planner')
    WHERE title ILIKE '%customer booking%' OR title ILIKE '%booking public%';
  ELSE
    INSERT INTO public.dev_roadmap_items (title, description, module, stage)
    VALUES ('Customer Booking — public link + dashboard',
      'Public booking link + dashboard card + planner appointment + invoice hold/confirm.',
      'planner', 'completed');
  END IF;
END;
$rd$;
