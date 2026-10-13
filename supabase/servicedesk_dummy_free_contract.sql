-- M-Core Service Desk: free test contract for the dummy client account mikepapa.5701@gmail.com (tenant ATAS ANGIN MY SDN. BHD.).
-- WRITE-ONLY, rerun-safe. Run after servicedesk_all_v2.sql. Tenant resolved from that account's user_profiles row; inserts nothing
-- unless exactly one tenant matches, or if that tenant already has a non-deleted active contract. Plain SQL, no functions.
with m as (select distinct p.tenant_id as id from public.user_profiles p join auth.users u on u.id = p.id
           where lower(u.email) = 'mikepapa.5701@gmail.com' and p.tenant_id is not null),
t as (select id from m where (select count(*) from m) = 1)
insert into public.service_contracts (tenant_id, start_date, end_date, invoice_ref, payment_status, services, monthly_quota,
  sla_hours, mcore_access_free, renew_monthly_fee, status, notes, created_by)
select t.id, date '2026-10-13', date '2027-10-12', 'FREE-TEST', 'paid',
  coalesce((select array_agg(c.code order by c.sort) from public.service_catalog c where c.active and c.deleted_at is null), '{}'),
  null, 48, true, 0, 'active', 'Free test contract (dummy client account mikepapa.5701@gmail.com).',
  (select u.id from auth.users u where lower(u.email) = 'mikepaulfreelancer@gmail.com' limit 1)
from t
where not exists (select 1 from public.service_contracts k where k.tenant_id = t.id and k.status = 'active' and k.deleted_at is null);
