-- Phase B+C: combo components, batch barcode tags, TikTok listed qty, Brzky Empire seed.
-- WRITE-ONLY / idempotent. Safe to run after 20261124140000. No secrets. Does not touch products.stock_qty.
-- Client hides these features until this SQL has been run.

create table if not exists public.ffm_combo_components (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  account_id uuid references public.ffm_accounts(id),
  parent_barcode text not null,
  component_barcode text not null,
  qty numeric not null check (qty > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index if not exists ffm_combo_components_uidx
  on public.ffm_combo_components (tenant_id, coalesce(account_id, '00000000-0000-0000-0000-000000000000'::uuid), parent_barcode, component_barcode)
  where deleted_at is null;
create index if not exists ffm_combo_components_tenant_idx
  on public.ffm_combo_components (tenant_id) where deleted_at is null;

create table if not exists public.sales_plan_batch_barcodes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  batch_id uuid not null references public.sales_plan_batches(id),
  account_id uuid references public.ffm_accounts(id),
  barcode text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index if not exists sales_plan_batch_barcodes_uidx
  on public.sales_plan_batch_barcodes (batch_id, barcode)
  where deleted_at is null;
create index if not exists sales_plan_batch_barcodes_tenant_idx
  on public.sales_plan_batch_barcodes (tenant_id, batch_id) where deleted_at is null;

do $$
declare t text;
begin
  foreach t in array array['ffm_combo_components','sales_plan_batch_barcodes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon', t);
    execute format('revoke insert, update, delete, truncate on table public.%I from authenticated', t);
    execute format('grant select on table public.%I to authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
    execute format('drop policy if exists %I on public.%I', t || '_tenant_read', t);
    execute format('create policy %I on public.%I for select to authenticated using (tenant_id = public.get_my_tenant_id() or public.is_platform_admin())', t || '_tenant_read', t);
  end loop;
end $$;

alter table public.ffm_product_links add column if not exists tiktok_listed_qty numeric;
alter table public.ffm_product_links drop constraint if exists ffm_product_links_listed_qty_check;
alter table public.ffm_product_links add constraint ffm_product_links_listed_qty_check
  check (tiktok_listed_qty is null or tiktok_listed_qty >= 0);

-- Seed combo + FH batch barcodes for Brzky Empire only (config data, not app code).
do $$
declare
  v_tid uuid := 'c60f2b79-7132-48ed-b35d-72b0dfd9a973';
  v_acct uuid;
  v_batch uuid;
  v_fh text := '9555277201526';
begin
  if not exists (select 1 from public.tenants x where x.id = v_tid) then
    raise notice 'Brzky Empire tenant not found — skip seed';
    return;
  end if;

  select a.id into v_acct
  from public.ffm_accounts a
  where a.tenant_id = v_tid and a.deleted_at is null and a.is_funded = true
  order by a.created_at
  limit 1;

  -- Combo parents: product code and, if linked, the FFM barcode.
  insert into public.ffm_combo_components (tenant_id, account_id, parent_barcode, component_barcode, qty)
  select v_tid, v_acct, x.parent, v_fh, x.qty
  from (values
    ('KV-COMBO-A-2X', 2::numeric),
    ('KV-COMBO-B-3X', 3::numeric)
  ) as x(parent, qty)
  where not exists (
    select 1 from public.ffm_combo_components c
    where c.tenant_id = v_tid and c.deleted_at is null
      and c.parent_barcode = x.parent and c.component_barcode = v_fh
      and coalesce(c.account_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(v_acct, '00000000-0000-0000-0000-000000000000'::uuid)
  );

  insert into public.ffm_combo_components (tenant_id, account_id, parent_barcode, component_barcode, qty)
  select v_tid, v_acct, l.barcode, v_fh, x.qty
  from (values
    ('KV-COMBO-A-2X', 2::numeric),
    ('KV-COMBO-B-3X', 3::numeric)
  ) as x(code, qty)
  join public.products p on p.tenant_id = v_tid and p.deleted_at is null and p.code = x.code
  join public.ffm_product_links l on l.tenant_id = v_tid and l.deleted_at is null and l.product_id = p.id
    and (v_acct is null or l.account_id = v_acct)
  where length(trim(l.barcode)) > 0
    and not exists (
      select 1 from public.ffm_combo_components c
      where c.tenant_id = v_tid and c.deleted_at is null
        and c.parent_barcode = l.barcode and c.component_barcode = v_fh
    );

  -- Funded batch: linked FFM account, else qty 1080, else code/label FH.
  select b.id into v_batch
  from public.sales_plan_batches b
  where b.tenant_id = v_tid and b.deleted_at is null
    and (
      (v_acct is not null and b.ffm_account_id = v_acct)
      or b.actual_qty = 1080 or b.target_qty = 1080
      or b.code ilike '%FH%' or coalesce(b.label, '') ilike '%FH%'
    )
  order by (b.ffm_account_id = v_acct) desc nulls last, b.sort_order
  limit 1;

  if v_batch is not null then
    insert into public.sales_plan_batch_barcodes (tenant_id, batch_id, account_id, barcode)
    select v_tid, v_batch, v_acct, v_fh
    where not exists (
      select 1 from public.sales_plan_batch_barcodes x
      where x.batch_id = v_batch and x.barcode = v_fh and x.deleted_at is null
    );
  else
    raise notice 'No funded sales plan batch found for Brzky Empire — tag the FH barcode in sales_plan_batch_barcodes after the batch exists.';
  end if;
end $$;

insert into public.dev_roadmap_items (title, description, module, stage, pr_url)
select v.title, v.descr, v.mod, 'completed', 'https://github.com/mpflemedia-ux/mcore'
from (values
  ('FFM: batch Sold from shipped DOs + combo expansion',
   'sales_plan_batch_barcodes + ffm_combo_components. Sold counts only shipped/delivered FFM DOs, expands KV-COMBO-A-2X=2 and KV-COMBO-B-3X=3, ignores other barcodes (e.g. 9555277201519), idempotent on order_sn. Deno tests included. UI hides until SQL is run.',
   'sales_plan'),
  ('Sales Plan: Stock value / Funded cost / repayment pace / oversell',
   'Renamed Stock cost to Stock value (TikTok price). Funded cost shows principal. Pace card: sales so far, target, balance, bottles left, days to due, On track/Watch/At risk. Manual TikTok listed stock with oversell alert. Stock/Recon filter by batch.',
   'sales_plan'),
  ('Logistics: FFM daily list + WhatsApp share',
   'New Today tab + FFM today button. Filters for status, courier, account, waybill. Share builds a daily plain-text EN/BM WhatsApp report (orders, waybills, cancelled, exception, pending review, stock physical/locked/available, repayment progress). No internal IDs.',
   'logistics')
) as v(title, descr, mod)
where not exists (select 1 from public.dev_roadmap_items d where d.title = v.title);
