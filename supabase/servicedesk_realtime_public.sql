-- M-Core Service Desk Public Link realtime (optional, run alone AFTER servicedesk_06_public_link.sql). 'already member' error = done, harmless.
alter publication supabase_realtime add table public.service_public_requests;
