-- Bank statement lines (Phase 1) — optional cloud persist for bank recon
create table if not exists public.bank_statement_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  txn_date date not null,
  description text,
  amount numeric(18,2) not null,
  category text,
  fingerprint text not null,
  status text default 'imported',
  matched_type text,
  matched_id uuid,
  matched_ref text,
  imported_at timestamptz default now(),
  created_at timestamptz default now()
);

create unique index if not exists bank_statement_lines_tenant_fp
  on public.bank_statement_lines (tenant_id, fingerprint);

create index if not exists bank_statement_lines_tenant_date
  on public.bank_statement_lines (tenant_id, txn_date);

alter table public.bank_statement_lines enable row level security;

drop policy if exists bank_statement_lines_tenant on public.bank_statement_lines;
create policy bank_statement_lines_tenant on public.bank_statement_lines
  for all using (tenant_id::text = coalesce(auth.jwt() ->> 'tenant_id', ''))
  with check (tenant_id::text = coalesce(auth.jwt() ->> 'tenant_id', ''));
