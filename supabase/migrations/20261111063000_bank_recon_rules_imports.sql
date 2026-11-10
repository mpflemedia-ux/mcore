-- Bank Reconciliation (Nov 2026): tenant category rules ("Remember for next time")
-- + statement import log (duplicate / overlapping import warning).
-- Idempotent — write-only, run in Supabase SQL Editor. Soft delete only (no DELETE policy).

-- 1) Remembered rules: pattern (counterparty words) + direction → category
create table if not exists public.bank_recon_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  pattern text not null,
  direction text not null,
  category text not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'bank_recon_rules_direction_ck') then
    alter table public.bank_recon_rules add constraint bank_recon_rules_direction_ck check (direction in ('in','out'));
  end if;
end $$;
create unique index if not exists bank_recon_rules_tenant_pattern_dir
  on public.bank_recon_rules (tenant_id, pattern, direction);
create index if not exists bank_recon_rules_tenant_live
  on public.bank_recon_rules (tenant_id) where deleted_at is null;

alter table public.bank_recon_rules enable row level security;
drop policy if exists bank_recon_rules_select on public.bank_recon_rules;
create policy bank_recon_rules_select on public.bank_recon_rules for select to authenticated
  using (tenant_id = public.get_my_tenant_id());
drop policy if exists bank_recon_rules_insert on public.bank_recon_rules;
create policy bank_recon_rules_insert on public.bank_recon_rules for insert to authenticated
  with check (tenant_id = public.get_my_tenant_id());
drop policy if exists bank_recon_rules_update on public.bank_recon_rules;
create policy bank_recon_rules_update on public.bank_recon_rules for update to authenticated
  using (tenant_id = public.get_my_tenant_id()) with check (tenant_id = public.get_my_tenant_id());
drop policy if exists platform_admin_all on public.bank_recon_rules;
create policy platform_admin_all on public.bank_recon_rules for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- 2) Import log: one row per statement import (account last 4 digits only)
create table if not exists public.bank_recon_imports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  bank text,
  acct4 text,
  period_from date not null,
  period_to date not null,
  line_count integer not null default 0,
  total_in numeric(18,2) not null default 0,
  total_out numeric(18,2) not null default 0,
  created_by uuid,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists bank_recon_imports_tenant_period
  on public.bank_recon_imports (tenant_id, period_from, period_to) where deleted_at is null;

alter table public.bank_recon_imports enable row level security;
drop policy if exists bank_recon_imports_select on public.bank_recon_imports;
create policy bank_recon_imports_select on public.bank_recon_imports for select to authenticated
  using (tenant_id = public.get_my_tenant_id());
drop policy if exists bank_recon_imports_insert on public.bank_recon_imports;
create policy bank_recon_imports_insert on public.bank_recon_imports for insert to authenticated
  with check (tenant_id = public.get_my_tenant_id());
drop policy if exists bank_recon_imports_update on public.bank_recon_imports;
create policy bank_recon_imports_update on public.bank_recon_imports for update to authenticated
  using (tenant_id = public.get_my_tenant_id()) with check (tenant_id = public.get_my_tenant_id());
drop policy if exists platform_admin_all on public.bank_recon_imports;
create policy platform_admin_all on public.bank_recon_imports for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- 3) System Development (dev_roadmap_items) — one item per phase, stage completed
do $$
declare
  items text[][] := array[
    array['Bank Recon: new categories + Interest Income auto-detect',
      'Phase A: 18 new Bank Recon categories (EN/BM, direction, GL default). Interest/faedah/profit payout/hibah → Interest Income (rule + never sent to AI). Loan Repayment, Tax Payment (LHDN/SST), Deposit = manual-only; Customer Receipt / Supplier Payment = link-only (match only, never Post Unmatched). Refund posts to the opposite default (in → General Expense, out → Sales Revenue). Gateway fees → Platform & Payment Fees. Existing stored values unchanged.'],
    array['Bank Recon: category dropdown by direction + groups',
      'Phase B: per-line dropdown shows only money-in or money-out categories (two-way Refund/Deposit/Internal Transfer for both), grouped Income / Operating Expenses / Payroll & Statutory / Assets-Liabilities-Equity; current value always kept. Hints for Entertainment (~50% deductible) and link-only/manual-only.'],
    array['Bank Recon: Apply to all similar',
      'Phase C: after picking a category, "Apply to N similar" sets the same category on other uncategorised lines with the same counterparty (same direction). reco-tools.js.'],
    array['Bank Recon: remembered tenant rules',
      'Phase D: "Remember for next time?" saves pattern → category in bank_recon_rules (tenant_id, soft delete, RLS); next import applies it first (source tenant_rule). Only explicit user saves create rules; localStorage fallback when table missing; learned patterns unchanged.'],
    array['Bank Recon: quick filter chips + progress',
      'Phase E: chips All / Uncategorised / Other / AI suggested / Uncertain and "X/N done" counter in reco-sort-filter.js (v3).'],
    array['Bank Recon: automatic balance check',
      'Phase F: Maybank/Ryt text readers read opening + closing balance; banner checks opening + IN − OUT = closing (passes on Ryt Oct 2026: 0.00 + 1,336.35 − 1,318.37 = 17.98).'],
    array['Bank Recon: duplicate import warning',
      'Phase G: before Import & Auto-Categorize, warns when an overlapping statement period (same account last 4 / unknown) was already imported (bank_recon_imports) or lines already exist (bank_statement_lines fingerprints). sw v96.']
  ];
  i int;
begin
  for i in 1 .. array_length(items, 1) loop
    if exists (select 1 from public.dev_roadmap_items where title = items[i][1]) then
      update public.dev_roadmap_items set stage = 'completed', module = 'accounting', description = items[i][2]
       where title = items[i][1];
    else
      insert into public.dev_roadmap_items (title, description, module, stage)
      values (items[i][1], items[i][2], 'accounting', 'completed');
    end if;
  end loop;
exception when undefined_column or undefined_table then
  raise notice 'dev_roadmap schema variant; skip: %', sqlerrm;
end $$;
