-- Fix: user_profiles.id (not user_id). Booking create no longer blocked by planner.

CREATE OR REPLACE FUNCTION public._booking_sync_planner(p_booking_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $body$
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
  ttl := 'Booking ' || coalesce(b.quote_ref, '') || ': ' || svc_name || ' -- ' || coalesce(b.customer_name, '');

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
    SET title = ttl,
        starts_at = b.starts_at,
        ends_at = b.ends_at,
        notes = 'booking:' || b.id::text,
        status = 'open',
        updated_at = now()
    WHERE id = b.activity_id;
    RETURN b.activity_id;
  END IF;

  SELECT id INTO owner_id
  FROM public.user_profiles
  WHERE tenant_id = b.tenant_id
    AND lower(coalesce(role, '')) IN ('owner', 'admin')
  LIMIT 1;
  IF owner_id IS NULL THEN
    SELECT id INTO owner_id
    FROM public.user_profiles
    WHERE tenant_id = b.tenant_id
    LIMIT 1;
  END IF;
  IF owner_id IS NULL THEN RETURN NULL; END IF;

  INSERT INTO public.platform_activities (
    owner_user_id, tenant_id, title, activity_type, starts_at, ends_at, notes, status
  ) VALUES (
    owner_id, b.tenant_id, ttl, 'appointment', b.starts_at, b.ends_at, 'booking:' || b.id::text, 'open'
  ) RETURNING id INTO act_id;

  UPDATE public.bookings SET activity_id = act_id WHERE id = b.id;
  RETURN act_id;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'planner sync failed for %: %', p_booking_id, SQLERRM;
  RETURN NULL;
END;
$body$;
