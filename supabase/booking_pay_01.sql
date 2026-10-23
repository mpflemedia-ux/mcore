-- M-Core booking payment flow, step 1 of 4: columns, the token-scoped public view, policies, hardening.
-- WRITE-ONLY: run in Supabase SQL Editor (as postgres). Rerun-safe. Plain SQL only (no new functions, no dollar quoting, no pgcrypto; sha256() is core Postgres).
-- RUN ORDER: booking_pay_01.sql (THIS) -> booking_pay_02.sql -> booking_pay_03.sql -> booking_pay_04.sql. Needs pay_attach_01..04 + wa_doc_01 + customer booking migrations.
-- Until this runs the app keeps working: the public booking page shows DuitNow QR + WhatsApp backup only, the staff queue stays hidden.
-- How the public side is authorised without a function: the browser sends the invoice pay token in the request header x-bkpay.
-- The view bkpay_pub (owned by postgres, so it reads past RLS) returns ONLY the invoice whose public_token equals that header,
-- so a visitor can only ever see / act on their own booking. Policies below reuse the view as their check.
select 1 / (case when to_regclass('public.payment_claims') is null then 0 else 1 end) as pay_attach_03_present;
select 1 / (case when to_regclass('public.pay_settings') is null then 0 else 1 end) as pay_attach_04_present;
select 1 / (case when to_regclass('public.bookings') is null then 0 else 1 end) as bookings_present;

-- 1) columns
alter table public.booking_services add column if not exists deposit_pct numeric(5,2) check (deposit_pct is null or (deposit_pct > 0 and deposit_pct <= 100));
alter table public.pay_settings add column if not exists bk_grace_min int not null default 120 check (bk_grace_min between 10 and 2880);
alter table public.pay_settings add column if not exists bk_remind_min int not null default 30 check (bk_remind_min between 0 and 1440);
alter table public.payment_claims add column if not exists receipt_url text check (receipt_url is null or length(receipt_url) <= 2000);
alter table public.payment_claims add column if not exists receipt_no text check (receipt_no is null or length(receipt_no) <= 60);
alter table public.payment_claims add column if not exists ai_check jsonb check (ai_check is null or jsonb_typeof(ai_check) = 'object');
alter table public.payment_claims add column if not exists reminded_at timestamptz;
grant update (receipt_url, receipt_no, ai_check) on public.payment_claims to authenticated;

-- 2) token-scoped public view (one row only, for the invoice whose pay token is in header x-bkpay)
drop view if exists public.bkpay_pub;
create view public.bkpay_pub with (security_barrier = true) as
select i.id as invoice_id, i.tenant_id, i.ref_no, i.total, i.paid_amt, i.status as inv_status,
  encode(sha256(convert_to(i.public_token, 'UTF8')), 'hex') as token_hash,
  'BK' || upper(substr(replace(i.id::text, '-', ''), 1, 6)) as pay_ref,
  b.id as booking_id, b.quote_ref, b.status as bk_status, b.hold_until, b.starts_at, b.created_at as booked_at,
  s.name as service_name, s.deposit_pct,
  l.id as link_id,
  c.id as claim_id, c.status as claim_status, c.reject_reason, c.created_at as claim_at, c.notified_at as claim_seen_at,
  c.reviewed_at, c.amount as claim_amount, c.receipt_url, c.receipt_no
from public.invoices i
join public.bookings b on b.invoice_id = i.id and b.tenant_id = i.tenant_id
left join public.booking_services s on s.id = b.service_id and s.tenant_id = b.tenant_id
left join lateral (select l0.id from public.doc_public_links l0
  where l0.tenant_id = i.tenant_id and l0.doc_type = 'inv' and l0.doc_id = i.id
    and l0.token_hash = encode(sha256(convert_to(i.public_token, 'UTF8')), 'hex')
    and l0.revoked_at is null and l0.deleted_at is null and l0.expires_at > now()
  order by l0.created_at desc limit 1) l on true
left join lateral (select c0.* from public.payment_claims c0
  where c0.tenant_id = i.tenant_id and c0.invoice_id = i.id and c0.deleted_at is null
  order by c0.created_at desc limit 1) c on true
where i.deleted_at is null and i.public_token is not null and length(i.public_token) >= 16
  and i.public_token = nullif(coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json->>'x-bkpay', '');
revoke all on public.bkpay_pub from public, anon, authenticated;
grant select on public.bkpay_pub to anon, authenticated;

-- 3) anon may register the claim link (doc_public_links row) for ITS OWN booking invoice token only
drop policy if exists bkpay_link_ins on public.doc_public_links;
create policy bkpay_link_ins on public.doc_public_links for insert to anon with check (
  doc_type = 'inv' and revoked_at is null and deleted_at is null and created_by is null
  and expires_at > now() and expires_at <= now() + interval '31 days'
  and exists (select 1 from public.bkpay_pub v where v.invoice_id = doc_public_links.doc_id and v.tenant_id = doc_public_links.tenant_id and v.token_hash = doc_public_links.token_hash));
grant insert (tenant_id, doc_type, doc_id, token_hash, expires_at) on public.doc_public_links to anon;

-- 4) bookings: anon sees its own booking row and may only FREEZE the hold (hold_until -> null) while its receipt is pending review
drop policy if exists bkpay_bk_sel on public.bookings;
create policy bkpay_bk_sel on public.bookings for select to anon using (exists (select 1 from public.bkpay_pub v where v.booking_id = bookings.id));
drop policy if exists bkpay_bk_freeze on public.bookings;
create policy bkpay_bk_freeze on public.bookings for update to anon
  using (status in ('hold', 'pending_payment') and exists (select 1 from public.bkpay_pub v where v.booking_id = bookings.id and v.claim_status = 'pending'))
  with check (hold_until is null and status in ('hold', 'pending_payment'));
revoke update on public.bookings from anon;
grant select (id, tenant_id, status, hold_until, invoice_id) on public.bookings to anon;
grant update (hold_until) on public.bookings to anon;

-- 5) HARDENING (existing gap): Supabase default privileges gave anon SELECT on every payment_claims column, and the anon read policy is
--    "deleted_at is null", so anyone with the public anon key could list all tenants' claims (token, bank ref, payer, files).
--    Keep only the columns the public page needs (id, link_id, status, created_at, deleted_at).
revoke select, update, delete, truncate, references, trigger on public.payment_claims from anon;
grant select (id, link_id, status, created_at, deleted_at) on public.payment_claims to anon;
--    Same gap on doc_public_links (anon could read created_by = staff user id). Back to the columns wa_doc_01 intended.
revoke select, update, delete, truncate, references, trigger on public.doc_public_links from anon;
grant select (id, tenant_id, doc_type, doc_id, token_hash, expires_at, revoked_at, deleted_at) on public.doc_public_links to anon;

-- 6) maker-checker for booking invoices: only owner / admin may approve or reject, never the user who created the invoice.
--    Platform admin keeps full access. to_jsonb(...)->>'created_by' works whether or not invoices has that column.
drop policy if exists bkpay_checker on public.payment_claims;
create policy bkpay_checker on public.payment_claims as restrictive for update to authenticated using (
  exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin')
  or not exists (select 1 from public.bookings b where b.invoice_id = payment_claims.invoice_id and b.tenant_id = payment_claims.tenant_id)
  or (exists (select 1 from public.user_profiles p where p.id = auth.uid() and lower(coalesce(p.role, '')) in ('owner', 'admin'))
      and not exists (select 1 from public.invoices i where i.id = payment_claims.invoice_id and (to_jsonb(i)->>'created_by') = auth.uid()::text)));

-- 7) check (read-only)
select count(*) as bkpay_pub_rows_without_header from public.bkpay_pub;
select column_name from information_schema.columns where table_schema = 'public' and table_name = 'payment_claims' and column_name in ('receipt_url', 'receipt_no', 'ai_check', 'reminded_at') order by 1;

notify pgrst, 'reload schema';
