-- M-Core Service Desk: re-link tickets to the tenant's active paid contract (fallback that needs NO edge-function deploy).
-- WRITE-ONLY. Run in Supabase SQL Editor. Rerun-safe. Tenant pinned by id: Phion Sdn. Bhd. = c40847f5-63c1-49d5-8e28-8eae95f12ed5.
-- Rule: a ticket whose contract_id is null, deleted, or points to an unpaid contract is moved to the tenant's
-- currently active paid contract (status active, not deleted, start <= today <= end; invoice_ref 'FREE%' counts as paid).

-- 0) PREVIEW (run this alone first; read-only)
with t as (select id from public.tenants where id = 'c40847f5-63c1-49d5-8e28-8eae95f12ed5'),
good as (
  select c.id, c.tenant_id from public.service_contracts c
  where c.tenant_id in (select id from t) and c.deleted_at is null and c.status = 'active'
    and (c.payment_status = 'paid' or c.invoice_ref ilike 'FREE%')
    and (c.start_date is null or c.start_date <= current_date) and (c.end_date is null or current_date <= c.end_date)
  order by c.end_date desc nulls last limit 1)
select r.ref_no, r.status, r.contract_id as old_contract, oc.invoice_ref as old_invoice_ref, oc.payment_status as old_payment,
       oc.deleted_at as old_deleted, g.id as new_contract
from public.service_requests r
left join public.service_contracts oc on oc.id = r.contract_id
cross join good g
where r.tenant_id in (select id from t) and r.deleted_at is null
  and (r.contract_id is null or oc.id is null or oc.deleted_at is not null
       or not (oc.payment_status = 'paid' or coalesce(oc.invoice_ref, '') ilike 'FREE%'))
order by r.created_at;

-- 1) RE-LINK
with t as (select id from public.tenants where id = 'c40847f5-63c1-49d5-8e28-8eae95f12ed5'),
good as (
  select c.id from public.service_contracts c
  where c.tenant_id in (select id from t) and c.deleted_at is null and c.status = 'active'
    and (c.payment_status = 'paid' or c.invoice_ref ilike 'FREE%')
    and (c.start_date is null or c.start_date <= current_date) and (c.end_date is null or current_date <= c.end_date)
  order by c.end_date desc nulls last limit 1)
update public.service_requests r
set contract_id = (select id from good)
where r.tenant_id in (select id from t) and r.deleted_at is null
  and exists (select 1 from good)
  and (r.contract_id is null
       or not exists (select 1 from public.service_contracts oc where oc.id = r.contract_id and oc.deleted_at is null
                      and (oc.payment_status = 'paid' or coalesce(oc.invoice_ref, '') ilike 'FREE%')));

-- 2) In-app downloads: storage read also accepts a FREE% contract (same rule as the app + sd-result)
drop policy if exists service_files_read on storage.objects;
create policy service_files_read on storage.objects for select to authenticated using (
  bucket_id = 'service-files' and (
    exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin')
    or ((storage.foldername(name))[1] = (select p.tenant_id::text from public.user_profiles p where p.id = auth.uid())
        and exists (select 1 from public.service_contracts c where c.tenant_id::text = (storage.foldername(name))[1]
                    and (c.payment_status = 'paid' or coalesce(c.invoice_ref, '') ilike 'FREE%') and c.deleted_at is null))));

-- 3) System Development
update public.dev_roadmap_items set stage = 'completed', module = 'service_desk',
  description = 'Result files unlock when the ticket contract is paid OR the tenant has an active paid contract (FREE% counts as paid); app + sd-result aligned; Phion tickets re-linked.'
  where title = 'Service Desk: paid-unlock fix';
insert into public.dev_roadmap_items (title, description, module, stage)
  select 'Service Desk: paid-unlock fix', 'Result files unlock when the ticket contract is paid OR the tenant has an active paid contract (FREE% counts as paid); app + sd-result aligned; Phion tickets re-linked.', 'service_desk', 'completed'
  where not exists (select 1 from public.dev_roadmap_items where title = 'Service Desk: paid-unlock fix');
