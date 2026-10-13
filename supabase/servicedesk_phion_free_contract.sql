-- M-Core Service Desk: free internal contract for Phion (tenant c40847f5-63c1-49d5-8e28-8eae95f12ed5). WRITE-ONLY, rerun-safe.
-- Run after servicedesk_all_v2.sql. Inserts nothing if Phion already has a non-deleted active contract. Plain SQL, no functions.
insert into public.service_contracts (tenant_id, start_date, end_date, invoice_ref, payment_status, services, monthly_quota,
  sla_hours, mcore_access_free, renew_monthly_fee, status, notes, created_by)
select t.id, date '2026-10-13', date '2027-10-12', 'FREE-PHION', 'paid',
  coalesce((select array_agg(c.code order by c.sort) from public.service_catalog c where c.active and c.deleted_at is null), '{}'),
  null, 48, true, 0, 'active', 'Free internal contract (Phion, M-Core in-house).',
  (select u.id from auth.users u where lower(u.email) = 'mikepaulfreelancer@gmail.com' limit 1)
from public.tenants t
where t.id = 'c40847f5-63c1-49d5-8e28-8eae95f12ed5'
  and not exists (select 1 from public.service_contracts k where k.tenant_id = t.id and k.status = 'active' and k.deleted_at is null);
