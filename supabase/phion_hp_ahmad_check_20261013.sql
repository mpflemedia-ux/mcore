-- READ-ONLY check before phion_hp_ahmad_progress_20261013.sql. Expect exactly 1 tenant and 1 employee row.
select 'tenant' as kind, id, name, code from public.tenants where (name ilike '%phion%' or code ilike '%phion%') and deleted_at is null;
select 'employee' as kind, e.id, e.name, e.nickname, e.tenant_id from public.employees e
where e.deleted_at is null and e.tenant_id in (select id from public.tenants where (name ilike '%phion%' or code ilike '%phion%') and deleted_at is null)
  and (e.name ilike '%ahmad%' or e.nickname ilike '%ahmad%');
select 'existing project' as kind, p.id, p.name from public.projects p
where p.deleted_at is null and p.name = 'Phion Visibility & Sales – Hp Ahmad';
