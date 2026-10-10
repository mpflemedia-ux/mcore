-- Extend sales commission rules for type, tiers, pay timing and validity.
alter table public.sales_commission_rules
  add column if not exists rule_type text not null default 'flat',
  add column if not exists tiers jsonb null,
  add column if not exists pay_when text not null default 'on_paid',
  add column if not exists new_customer_only boolean not null default false,
  add column if not exists valid_from date null,
  add column if not exists valid_to date null,
  add column if not exists unit_amount numeric(14,2) null,
  add column if not exists target_amount numeric(14,2) null,
  add column if not exists bonus_amount numeric(14,2) null;

alter table public.sales_commission_rules drop constraint if exists sales_commission_rules_rule_type_check;
alter table public.sales_commission_rules
  add constraint sales_commission_rules_rule_type_check
  check (rule_type in ('flat','tiered','target','bonus','unit','split'));

alter table public.sales_commission_rules drop constraint if exists sales_commission_rules_pay_when_check;
alter table public.sales_commission_rules
  add constraint sales_commission_rules_pay_when_check
  check (pay_when in ('on_issue','on_paid'));
