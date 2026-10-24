-- M-Core Booking flow rebuild (inbox spine): claim source, staff WA claim insert, owner self-verify,
-- notification toggles on pay_settings, cron deep-links -> Dashboard inbox, roadmap.
-- WRITE-ONLY. Run in Supabase SQL Editor AFTER booking_pay_01..04. Rerun-safe.
-- No CREATE FUNCTION. No dollar-quoting. No pgcrypto.
-- RUN ORDER: booking_flow_01.sql (THIS) then booking_flow_02_cron.sql (optional cron command refresh).

select 1 / (case when to_regclass('public.payment_claims') is null then 0 else 1 end) as payment_claims_present;
select 1 / (case when to_regclass('public.pay_settings') is null then 0 else 1 end) as pay_settings_present;

-- 1) claim source: upload (customer) | wa_staff (Terima di WA) | cash_close (soft-closed by Confirm cash)
alter table public.payment_claims add column if not exists source text;
update public.payment_claims set source = 'upload' where source is null;
alter table public.payment_claims alter column source set default 'upload';
-- allow null link/token for staff-created WA claims (anon upload path still supplies both)
alter table public.payment_claims alter column link_id drop not null;
alter table public.payment_claims alter column token drop not null;

-- 2) staff may insert wa_staff pending claims for a booking invoice of their tenant (PA full)
drop policy if exists payment_claims_staff_wa_ins on public.payment_claims;
create policy payment_claims_staff_wa_ins on public.payment_claims for insert to authenticated with check (
  status = 'pending'
  and deleted_at is null
  and payment_id is null
  and reviewed_by is null
  and reviewed_at is null
  and coalesce(source, 'upload') = 'wa_staff'
  and (
    exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin')
    or (
      tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid())
      and exists (
        select 1 from public.bookings b
        where b.invoice_id = payment_claims.invoice_id
          and b.tenant_id = payment_claims.tenant_id
      )
    )
  )
);

-- 3) owner may verify own booking claims; non-owner admin still maker-checker; PA full
drop policy if exists bkpay_checker on public.payment_claims;
create policy bkpay_checker on public.payment_claims as restrictive for update to authenticated using (
  exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin')
  or not exists (
    select 1 from public.bookings b
    where b.invoice_id = payment_claims.invoice_id and b.tenant_id = payment_claims.tenant_id
  )
  or exists (
    select 1 from public.user_profiles p
    where p.id = auth.uid() and lower(coalesce(p.role, '')) = 'owner'
  )
  or (
    exists (
      select 1 from public.user_profiles p
      where p.id = auth.uid() and lower(coalesce(p.role, '')) = 'admin'
    )
    and not exists (
      select 1 from public.invoices i
      where i.id = payment_claims.invoice_id
        and (to_jsonb(i)->>'created_by') = auth.uid()::text
    )
  )
);

-- 4) notification toggles + who receives (reuse pay_settings)
alter table public.pay_settings add column if not exists bk_n_new boolean not null default true;
alter table public.pay_settings add column if not exists bk_n_receipt boolean not null default true;
alter table public.pay_settings add column if not exists bk_n_remind boolean not null default true;
alter table public.pay_settings add column if not exists bk_n_digest boolean not null default true;
alter table public.pay_settings add column if not exists bk_n_who text not null default 'owner_admin';

-- grant source on insert for authenticated (staff WA)
grant insert (tenant_id, link_id, invoice_id, token, amount, paid_on, bank_ref, payer_name, note, files, source) on public.payment_claims to authenticated;
grant update (status, reject_reason, payment_id, reviewed_by, reviewed_at, notified_at, reminded_at, deleted_at, receipt_url, receipt_no, source) on public.payment_claims to authenticated;

notify pgrst, 'reload schema';

update public.dev_roadmap_items set stage = 'completed', module = 'sales',
  description = 'Booking flow rebuild: Dashboard Booking Inbox (Details|Proof|Docs|Actions), Terima di WA claim, owner self-verify, notif toggles on pay_settings, deep links to inbox, WA label split, deposit confirmed language, Confirm cash closes open claims.'
where title = 'Booking flow: inbox spine + WA + notif control';

insert into public.dev_roadmap_items (title, description, module, stage)
select 'Booking flow: inbox spine + WA + notif control',
  'Booking flow rebuild: Dashboard Booking Inbox (Details|Proof|Docs|Actions), Terima di WA claim, owner self-verify, notif toggles on pay_settings, deep links to inbox, WA label split, deposit confirmed language, Confirm cash closes open claims.',
  'sales', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Booking flow: inbox spine + WA + notif control');
