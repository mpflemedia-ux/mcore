-- WhatsApp notify settings on tenant (Phase 3 — owner designated number)
-- Safe to re-run

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS wa_notify_phone text,
  ADD COLUMN IF NOT EXISTS wa_notify_enabled boolean DEFAULT false;

COMMENT ON COLUMN public.tenants.wa_notify_phone IS 'Designated WhatsApp number for owner alerts (60...)';
COMMENT ON COLUMN public.tenants.wa_notify_enabled IS 'When true, Nex may send Cloud API alerts to wa_notify_phone';
