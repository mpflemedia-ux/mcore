-- Extend user_notification_prefs for Telegram channel toggles + OS phone flag
ALTER TABLE public.user_notification_prefs
  ADD COLUMN IF NOT EXISTS os_phone boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS telegram_sales boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS telegram_inventory boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS telegram_purchasing boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS telegram_finance boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS telegram_hr boolean DEFAULT false;

-- Ensure core event toggles exist (safe if already present)
ALTER TABLE public.user_notification_prefs
  ADD COLUMN IF NOT EXISTS muted boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS insight boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS overdue boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS low_stock boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS leave boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS outstation boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS sales boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS inventory boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS purchasing boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS finance boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS hr boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS dismissed jsonb DEFAULT '[]'::jsonb;

