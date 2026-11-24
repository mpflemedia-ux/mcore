-- Phase A: allow FFM-native (TikTok) outbound DOs into ffm_shipments, persist courier + pickup time.
-- WRITE-ONLY / idempotent. Does not touch products.stock_qty. No secrets.
-- Run in Supabase SQL Editor before or with the later funded-batch migration.

alter table public.ffm_shipments alter column delivery_order_id drop not null;

alter table public.ffm_shipments add column if not exists courier text;
alter table public.ffm_shipments add column if not exists pickup_at timestamptz;
alter table public.ffm_shipments add column if not exists source text not null default 'mcore';

create index if not exists ffm_shipments_source_idx
  on public.ffm_shipments (tenant_id, source, status)
  where deleted_at is null;

insert into public.dev_roadmap_items (title, description, module, stage, pr_url)
select
  'FFM: import outbound DOs + persist courier/pickup',
  'Nullable ffm_shipments.delivery_order_id so TikTok/FFM-native orders can be stored without a M-Core DO. New courier, pickup_at, source columns. Cron/webhook pull /order/getOrderList and persist expressCompany. 30-min poll kept. M-Core stock untouched.',
  'logistics',
  'completed',
  'https://github.com/mpflemedia-ux/mcore'
where not exists (
  select 1 from public.dev_roadmap_items
  where title = 'FFM: import outbound DOs + persist courier/pickup'
);
