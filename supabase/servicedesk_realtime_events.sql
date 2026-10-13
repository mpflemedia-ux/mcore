-- M-Core Service Desk realtime (optional, run alone AFTER servicedesk_all_v2.sql). Error 'already member of publication' = already done, harmless.
alter publication supabase_realtime add table public.service_request_events;
