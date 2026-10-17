-- Store Telegram bot username on tenant (shared across devices)
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS telegram_bot_username text;
