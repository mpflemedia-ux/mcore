ALTER TABLE public.leave_requests
  ADD COLUMN IF NOT EXISTS is_half_day boolean NOT NULL DEFAULT false;
ALTER TABLE public.leave_requests
  ADD COLUMN IF NOT EXISTS half_session text;
