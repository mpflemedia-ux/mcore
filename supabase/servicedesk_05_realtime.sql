-- M-Core Service Desk - realtime (run LAST, once). If Postgres says a table "is already member of publication", it is already done.
alter publication supabase_realtime add table public.service_requests, public.service_request_events;
