-- Keep planner in sync with booking status without rewriting create_public_booking.
CREATE OR REPLACE FUNCTION public._booking_planner_trg()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  PERFORM public._booking_sync_planner(NEW.id);
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_booking_planner ON public.bookings;
CREATE TRIGGER trg_booking_planner
  AFTER INSERT OR UPDATE OF status, starts_at, ends_at, customer_name, activity_id
  ON public.bookings
  FOR EACH ROW
  EXECUTE PROCEDURE public._booking_planner_trg();

-- Existing unconfirmed planner rows: cancel them so dashboard stays clean.
UPDATE public.platform_activities pa
SET status = 'cancelled', updated_at = now()
FROM public.bookings b
WHERE pa.id = b.activity_id
  AND b.status IS DISTINCT FROM 'confirmed'
  AND pa.status IS DISTINCT FROM 'cancelled';
