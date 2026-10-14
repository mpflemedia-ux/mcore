-- Run once after notif_01 (errors harmlessly with "already member" if run twice).
alter publication supabase_realtime add table public.notifications;
