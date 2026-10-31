-- Payroll Reconciliation v3 — arrears repayment plan (idempotent; run after 20261101020000_payroll_recon_core.sql).
--   HR sets an instalment from month X. Run Payroll for month >= X calls payroll_arrears_apply(month, year):
--   for each payroll record of that month the previous allocations are reversed first, then the instalment
--   pays the employee's OLDEST outstanding months first. payroll_records.arrears_paid = what was allocated.
--   arrears_paid is a separate line (no EPF/SOCSO/EIS/PCB, net_pay unchanged). No journal is posted.

create table if not exists public.payroll_arrears_plans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  employee_id uuid not null,
  instalment numeric(14,2) not null check (instalment > 0),
  start_month int not null check (start_month between 1 and 12),
  start_year int not null check (start_year between 2000 and 2100),
  status text not null default 'active' check (status in ('active', 'paused', 'completed', 'cancelled')),
  note text check (note is null or length(note) <= 300),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists payroll_arrears_plans_emp_idx on public.payroll_arrears_plans (tenant_id, employee_id) where deleted_at is null;
create unique index if not exists payroll_arrears_plans_one_active on public.payroll_arrears_plans (tenant_id, employee_id)
  where status = 'active' and deleted_at is null;

create table if not exists public.payroll_arrears_allocations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  plan_id uuid not null,
  pay_record_id uuid not null,      -- payroll record (month) that carried the instalment
  target_record_id uuid not null,   -- older payroll record whose balance it paid down
  amount numeric(14,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists payroll_arrears_alloc_pay_idx on public.payroll_arrears_allocations (pay_record_id) where deleted_at is null;
create index if not exists payroll_arrears_alloc_target_idx on public.payroll_arrears_allocations (target_record_id) where deleted_at is null;
create index if not exists payroll_arrears_alloc_tenant_idx on public.payroll_arrears_allocations (tenant_id, plan_id);

alter table public.payroll_arrears_plans enable row level security;
alter table public.payroll_arrears_allocations enable row level security;
revoke all on public.payroll_arrears_plans from anon;
revoke all on public.payroll_arrears_allocations from anon;

drop policy if exists payroll_arrears_plans_read on public.payroll_arrears_plans;
create policy payroll_arrears_plans_read on public.payroll_arrears_plans for select to authenticated using (
  tenant_id = public.get_my_tenant_id() and public.payroll__is_hr(tenant_id));
drop policy if exists payroll_arrears_plans_ins on public.payroll_arrears_plans;
create policy payroll_arrears_plans_ins on public.payroll_arrears_plans for insert to authenticated with check (
  tenant_id = public.get_my_tenant_id() and public.payroll__is_hr(tenant_id)
  and exists (select 1 from public.employees e where e.id = employee_id and e.tenant_id = payroll_arrears_plans.tenant_id));
drop policy if exists payroll_arrears_plans_upd on public.payroll_arrears_plans;
create policy payroll_arrears_plans_upd on public.payroll_arrears_plans for update to authenticated
  using (tenant_id = public.get_my_tenant_id() and public.payroll__is_hr(tenant_id))
  with check (tenant_id = public.get_my_tenant_id() and public.payroll__is_hr(tenant_id));
drop policy if exists payroll_arrears_alloc_read on public.payroll_arrears_allocations;
create policy payroll_arrears_alloc_read on public.payroll_arrears_allocations for select to authenticated using (
  tenant_id = public.get_my_tenant_id() and public.payroll__is_hr(tenant_id));
grant select, insert, update on public.payroll_arrears_plans to authenticated;
grant select on public.payroll_arrears_allocations to authenticated;

-- reverse every live allocation carried by one pay record (restores the older balances)
create or replace function public.payroll__arrears_reverse(p_pay_record uuid)
returns numeric language plpgsql security definer set search_path = public as $$
declare
  a record;
  tot numeric := 0;
begin
  for a in select * from public.payroll_arrears_allocations where pay_record_id = p_pay_record and deleted_at is null for update loop
    update public.payroll_records set
      amount_paid = round(greatest(coalesce(amount_paid, 0) - a.amount, 0), 2),
      balance_outstanding = round(least(coalesce(net_pay, 0), coalesce(balance_outstanding, 0) + a.amount), 2)
    where id = a.target_record_id;
    update public.payroll_arrears_allocations set deleted_at = now() where id = a.id;
    tot := tot + a.amount;
  end loop;
  return tot;
end;
$$;

-- Called by Run Payroll after it saves month/year. Idempotent: re-run gives the same result.
create or replace function public.payroll_arrears_apply(p_month int, p_year int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  tid uuid := public.get_my_tenant_id();
  per int := p_year * 12 + p_month;
  r record;
  p public.payroll_arrears_plans%rowtype;
  t record;
  remaining numeric;
  x numeric;
  n_rec int := 0;
  total numeric := 0;
begin
  if auth.uid() is null or tid is null then raise exception 'Not signed in'; end if;
  if not public.payroll__is_hr(tid) then raise exception 'HR managers only'; end if;
  if p_month not between 1 and 12 or p_year not between 2000 and 2100 then raise exception 'Invalid period'; end if;
  for r in select pr.id, pr.employee_id from public.payroll_records pr
           where pr.tenant_id = tid and pr.month = p_month and pr.year = p_year for update loop
    perform public.payroll__arrears_reverse(r.id);
    update public.payroll_records set arrears_paid = 0 where id = r.id;
    select * into p from public.payroll_arrears_plans
      where tenant_id = tid and employee_id = r.employee_id and status = 'active' and deleted_at is null
        and (start_year * 12 + start_month) <= per
      order by created_at desc limit 1;
    if not found then continue; end if;
    remaining := p.instalment;
    for t in select pr.id, pr.balance_outstanding from public.payroll_records pr
             where pr.tenant_id = tid and pr.employee_id = r.employee_id and (pr.year * 12 + pr.month) < per
               and coalesce(pr.balance_outstanding, 0) > 0.009
             order by pr.year, pr.month for update loop
      exit when remaining <= 0.005;
      x := round(least(remaining, t.balance_outstanding), 2);
      if x <= 0 then continue; end if;
      update public.payroll_records set
        amount_paid = round(least(coalesce(net_pay, 0), coalesce(amount_paid, 0) + x), 2),
        balance_outstanding = round(greatest(coalesce(balance_outstanding, 0) - x, 0), 2)
      where id = t.id;
      insert into public.payroll_arrears_allocations (tenant_id, plan_id, pay_record_id, target_record_id, amount)
      values (tid, p.id, r.id, t.id, x);
      remaining := remaining - x;
    end loop;
    if p.instalment - remaining > 0 then
      update public.payroll_records set arrears_paid = round(p.instalment - remaining, 2) where id = r.id;
      n_rec := n_rec + 1;
      total := total + (p.instalment - remaining);
    end if;
  end loop;
  return jsonb_build_object('records', n_rec, 'total', round(total, 2));
end;
$$;

-- Deleting / reverting a payroll record: undo what it carried, and drop allocations that targeted it.
create or replace function public.payroll__arrears_on_delete()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  a record;
begin
  perform public.payroll__arrears_reverse(old.id);
  for a in select * from public.payroll_arrears_allocations where target_record_id = old.id and deleted_at is null loop
    update public.payroll_records set arrears_paid = round(greatest(coalesce(arrears_paid, 0) - a.amount, 0), 2) where id = a.pay_record_id;
    update public.payroll_arrears_allocations set deleted_at = now() where id = a.id;
  end loop;
  return old;
exception when others then
  raise warning 'payroll__arrears_on_delete skipped: %', sqlerrm;
  return old;
end;
$$;
drop trigger if exists payroll_arrears_on_delete_trg on public.payroll_records;
create trigger payroll_arrears_on_delete_trg before delete on public.payroll_records
  for each row execute function public.payroll__arrears_on_delete();

revoke all on function public.payroll__arrears_reverse(uuid) from public, anon, authenticated;
revoke all on function public.payroll_arrears_apply(int, int) from public, anon;
grant execute on function public.payroll_arrears_apply(int, int) to authenticated;

notify pgrst, 'reload schema';
