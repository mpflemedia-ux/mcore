-- M-Core Service Desk - READ-ONLY status check. Every row should say true after servicedesk_all_v2.sql.
select 'table ' || t as item, to_regclass('public.' || t) is not null as ok
from unnest(array['service_catalog','service_contracts','service_requests','service_request_events','support_access_consents','service_report_packs']) t
union all select 'catalog rows = 12', (select count(*) from public.service_catalog where to_regclass('public.service_catalog') is not null) = 12
union all select 'policies on service tables (expect 17)', (select count(*) from pg_policies where schemaname = 'public' and tablename in ('service_catalog','service_contracts','service_requests','service_request_events','support_access_consents','service_report_packs')) = 17
union all select 'bucket service-files', exists (select 1 from storage.buckets where id = 'service-files')
union all select 'storage policies (expect 2)', (select count(*) from pg_policies where schemaname = 'storage' and policyname in ('service_files_read','service_files_insert')) = 2
union all select 'realtime: service_requests', exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'service_requests')
union all select 'realtime: service_request_events', exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'service_request_events')
union all select 'my role is platform_admin', exists (select 1 from public.user_profiles where lower(coalesce(role,'')) = 'platform_admin');
