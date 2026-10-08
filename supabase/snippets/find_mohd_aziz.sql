select src, code, name, extra
from (
  select 'employee' as src, t.code, e.name, coalesce(e.bank_account_no, '') || ' deleted=' || coalesce(e.deleted_at::text, '') as extra
  from public.employees e
  join public.tenants t on t.id = e.tenant_id
  where upper(t.code) in ('BROZKY99', 'THEBRO41')
    and (e.name ilike '%aziz%' or e.name ilike '%haime%' or coalesce(e.bank_account_no, '') like '%4973014044%')
  union all
  select 'payroll', t.code, coalesce(e.name, '(tiada staff)'), pr.month::text || '/' || pr.year::text || ' net=' || pr.net_pay::text
  from public.payroll_records pr
  join public.tenants t on t.id = pr.tenant_id
  left join public.employees e on e.id = pr.employee_id
  where upper(t.code) = 'BROZKY99'
    and pr.year = 2026
    and pr.month = 9
) x
order by src, name;
