-- M-Core HR profile completion (P0 + P4). WRITE-ONLY: Mike runs in Supabase SQL Editor. Idempotent / rerun-safe.
-- 1) employees: department, employment type, contract end, 3 fixed allowances, annual leave + opening balance
-- 2) tenants: employer statutory numbers (KWSP / PERKESO / LHDN E / HRDF / zakat) + write RPC (owner/admin same tenant, or platform admin)
-- 3) onboarding B1–B6 answers now apply to those tenant columns (cob_allowed_cols + field targets) + backfill
-- 4) hr_contract_remind(): contract ends in <= 30 days -> one bell + push per employee per end date to owner/admin/HR (no amounts)
--    runs on app open (own tenant) and daily via pg_cron.

-- ---------- 1) employees ----------
alter table public.employees add column if not exists department text;
alter table public.employees add column if not exists employment_type text;
alter table public.employees add column if not exists contract_end_date date;
alter table public.employees add column if not exists fixed_allowance_type_1 text;
alter table public.employees add column if not exists fixed_allowance_1 numeric(12,2) not null default 0;
alter table public.employees add column if not exists fixed_allowance_type_2 text;
alter table public.employees add column if not exists fixed_allowance_2 numeric(12,2) not null default 0;
alter table public.employees add column if not exists fixed_allowance_type_3 text;
alter table public.employees add column if not exists fixed_allowance_3 numeric(12,2) not null default 0;
alter table public.employees add column if not exists annual_leave_days numeric(6,2);      -- null = default 14
alter table public.employees add column if not exists leave_opening_balance numeric(6,2);  -- carried-in balance at go-live
alter table public.employees add column if not exists leave_opening_year int;             -- year the opening balance belongs to

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'employees_employment_type_chk' and conrelid = 'public.employees'::regclass) then
    alter table public.employees add constraint employees_employment_type_chk
      check (employment_type is null or employment_type in ('permanent', 'contract')) not valid;
  end if;
end $$;

create index if not exists employees_tenant_department_idx on public.employees (tenant_id, department) where deleted_at is null;
create index if not exists employees_contract_end_idx on public.employees (contract_end_date) where deleted_at is null and employment_type = 'contract';

-- ---------- 2) tenants: employer statutory numbers ----------
alter table public.tenants add column if not exists kwsp_no text;
alter table public.tenants add column if not exists perkeso_no text;
alter table public.tenants add column if not exists lhdn_e_no text;
alter table public.tenants add column if not exists hrdf_no text;
alter table public.tenants add column if not exists zakat_no text;

create or replace function public.update_tenant_statutory_nos(p_tenant_id uuid, p_vals jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  caller_role text;
  caller_tid uuid;
begin
  select lower(coalesce(role, '')), tenant_id into caller_role, caller_tid from public.user_profiles where id = auth.uid();
  if caller_role is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  if not (caller_role = 'platform_admin' or (caller_role in ('owner', 'admin') and caller_tid = p_tenant_id)) then
    raise exception 'Only owner/admin can change employer numbers' using errcode = '42501';
  end if;
  p_vals := coalesce(p_vals, '{}'::jsonb);
  if jsonb_typeof(p_vals) <> 'object' then raise exception 'values must be an object' using errcode = '22023'; end if;
  update public.tenants set
    kwsp_no    = case when p_vals ? 'kwsp_no'    then nullif(btrim(p_vals->>'kwsp_no'), '')    else kwsp_no end,
    perkeso_no = case when p_vals ? 'perkeso_no' then nullif(btrim(p_vals->>'perkeso_no'), '') else perkeso_no end,
    lhdn_e_no  = case when p_vals ? 'lhdn_e_no'  then nullif(btrim(p_vals->>'lhdn_e_no'), '')  else lhdn_e_no end,
    hrdf_no    = case when p_vals ? 'hrdf_no'    then nullif(btrim(p_vals->>'hrdf_no'), '')    else hrdf_no end,
    zakat_no   = case when p_vals ? 'zakat_no'   then nullif(btrim(p_vals->>'zakat_no'), '')   else zakat_no end
  where id = p_tenant_id;
end;
$$;
revoke all on function public.update_tenant_statutory_nos(uuid, jsonb) from public, anon;
grant execute on function public.update_tenant_statutory_nos(uuid, jsonb) to authenticated;

-- ---------- 3) onboarding B1–B6 -> tenant columns ----------
create or replace function public.cob_allowed_cols() returns text[] language sql immutable as $$
  select array['name','ssm_no','incorporation_date','address','address_line2','city','postcode','state','email','phone',
               'bank_name','account_number','account_name','sst_gst_no','invoice_terms','logo_url',
               'kwsp_no','perkeso_no','lhdn_e_no','hrdf_no','zakat_no']
$$;

do $$
declare
  map jsonb := '{"B1":["epf_employer_no","kwsp_no"],"B2":["socso_employer_code","perkeso_no"],"B3":["lhdn_e_no","lhdn_e_no"],"B4":["hrdf_no","hrdf_no"],"B6":["zakat_note","zakat_no"]}';
begin
  begin
    update public.cob_master_items m set fields = (
      select coalesce(jsonb_agg(case when x.e->>'key' = map->m.code->>0 then x.e || jsonb_build_object('target', map->m.code->>1) else x.e end order by x.ord), '[]'::jsonb)
      from jsonb_array_elements(m.fields) with ordinality x(e, ord))
    where m.code in ('B1','B2','B3','B4','B6') and m.deleted_at is null and jsonb_typeof(m.fields) = 'array';
    update public.cob_items i set fields = (
      select coalesce(jsonb_agg(case when x.e->>'key' = map->i.code->>0 then x.e || jsonb_build_object('target', map->i.code->>1) else x.e end order by x.ord), '[]'::jsonb)
      from jsonb_array_elements(i.fields) with ordinality x(e, ord))
    where i.code in ('B1','B2','B3','B4','B6') and i.deleted_at is null and jsonb_typeof(i.fields) = 'array';
    -- backfill from answers already given (only where the tenant column is still empty)
    update public.tenants t set kwsp_no = s.v from (select tenant_id, max(nullif(btrim(answers->>'epf_employer_no'), '')) v from public.cob_items where code = 'B1' and deleted_at is null group by tenant_id) s
      where s.tenant_id = t.id and s.v is not null and nullif(btrim(t.kwsp_no), '') is null;
    update public.tenants t set perkeso_no = s.v from (select tenant_id, max(nullif(btrim(answers->>'socso_employer_code'), '')) v from public.cob_items where code = 'B2' and deleted_at is null group by tenant_id) s
      where s.tenant_id = t.id and s.v is not null and nullif(btrim(t.perkeso_no), '') is null;
    update public.tenants t set lhdn_e_no = s.v from (select tenant_id, max(nullif(btrim(answers->>'lhdn_e_no'), '')) v from public.cob_items where code = 'B3' and deleted_at is null group by tenant_id) s
      where s.tenant_id = t.id and s.v is not null and nullif(btrim(t.lhdn_e_no), '') is null;
    update public.tenants t set hrdf_no = s.v from (select tenant_id, max(nullif(btrim(answers->>'hrdf_no'), '')) v from public.cob_items where code = 'B4' and deleted_at is null group by tenant_id) s
      where s.tenant_id = t.id and s.v is not null and nullif(btrim(t.hrdf_no), '') is null;
    update public.tenants t set zakat_no = s.v from (select tenant_id, max(nullif(btrim(answers->>'zakat_note'), '')) v from public.cob_items where code = 'B6' and deleted_at is null group by tenant_id) s
      where s.tenant_id = t.id and s.v is not null and nullif(btrim(t.zakat_no), '') is null;
  exception when undefined_table or undefined_column then
    raise notice 'onboarding tables not installed; skip B-item targets: %', sqlerrm;
  end;
end $$;

-- ---------- 4) contract expiry reminder ----------
create or replace function public.hr_contract_remind()
returns int language plpgsql security definer set search_path = public as $$
declare
  r record;
  tid uuid := case when auth.uid() is null then null else public.get_my_tenant_id() end;
  k int := 0;
  n int;
begin
  if auth.uid() is not null and tid is null then return 0; end if;
  for r in
    select e.id, e.tenant_id, e.name, e.contract_end_date, (e.contract_end_date - current_date) as d
    from public.employees e
    where e.deleted_at is null and e.employment_type = 'contract'
      and e.contract_end_date between current_date and current_date + 30
      and (tid is null or e.tenant_id = tid)
  loop
    begin
      insert into public.notifications (tenant_id, user_id, actor_id, title, body, category, kind, type, priority, link, ref_table, ref_id, group_key)
      select r.tenant_id, u.id, null,
        left(case when u.language = 'bm' then 'Kontrak pekerja tamat dalam ' || r.d || ' hari' else 'Employee contract ends in ' || r.d || ' days' end, 200),
        left(coalesce(r.name, '-') || ' · ' || to_char(r.contract_end_date, 'DD/MM/YYYY') || case when u.language = 'bm' then ' · Sambung atau tamatkan kontrak.' else ' · Renew or end the contract.' end, 500),
        'hr', 'for_you', 'approval.hr_contract', case when r.d <= 7 then 1 else 0 end,
        jsonb_build_object('page', 'hr', 'params', jsonb_build_object('view', 'employee-form', 'id', r.id), 'icon', 'ti-file-time'),
        'employees', r.id, 'empctr:' || r.id || ':' || r.contract_end_date
      from public.user_profiles u
      where u.tenant_id = r.tenant_id and coalesce(u.is_active, true)
        and lower(coalesce(u.role, '')) in ('owner', 'admin', 'hr')
        and not exists (select 1 from public.notifications x where x.user_id = u.id and x.group_key = 'empctr:' || r.id || ':' || r.contract_end_date);
      get diagnostics n = row_count;
      k := k + n;
    exception when others then
      raise warning 'hr_contract_remind skipped %: %', r.id, sqlerrm;
    end;
  end loop;
  return k;
end;
$$;
revoke all on function public.hr_contract_remind() from public, anon;
grant execute on function public.hr_contract_remind() to authenticated;

do $$
begin
  begin
    create extension if not exists pg_cron;
    perform cron.unschedule(jobid) from cron.job where jobname = 'mcore-hr-contract-remind';
    perform cron.schedule('mcore-hr-contract-remind', '30 0 * * *', 'select public.hr_contract_remind()'); -- 08:30 MYT daily
  exception when others then
    raise notice 'pg_cron not available; reminder still runs on app open: %', sqlerrm;
  end;
end $$;

notify pgrst, 'reload schema';
