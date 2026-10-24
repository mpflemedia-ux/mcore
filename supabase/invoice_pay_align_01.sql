-- Invoice pay align (t545u): one proof spine for booking + ordinary invoices.
-- WRITE-ONLY: run in Supabase SQL Editor as postgres. Rerun-safe. No CREATE FUNCTION, no dollar-quoting, no pgcrypto.
-- After this: public invoice link mounts the same bkpay panel (QR → upload → WA → status → receipt); staff Payments to review covers all claims; maker-checker on every claim; cron notifies non-booking claims with deep-link to queue.

-- 1) bkpay_pub: LEFT JOIN booking so ordinary invoices appear; booking rows unchanged
drop view if exists public.bkpay_pub;
create view public.bkpay_pub with (security_barrier = true) as
select i.id as invoice_id, i.tenant_id, i.ref_no, i.total, i.paid_amt, i.status as inv_status,
  encode(sha256(convert_to(i.public_token, 'UTF8')), 'hex') as token_hash,
  case when b.id is not null
    then 'BK' || upper(substr(replace(i.id::text, '-', ''), 1, 6))
    else 'INV' || upper(substr(replace(i.id::text, '-', ''), 1, 6))
  end as pay_ref,
  b.id as booking_id, b.quote_ref, b.status as bk_status, b.hold_until, b.starts_at, b.created_at as booked_at,
  s.name as service_name, s.deposit_pct,
  l.id as link_id,
  c.id as claim_id, c.status as claim_status, c.reject_reason, c.created_at as claim_at, c.notified_at as claim_seen_at,
  c.reviewed_at, c.amount as claim_amount, c.receipt_url, c.receipt_no
from public.invoices i
left join lateral (
  select b0.* from public.bookings b0
  where b0.invoice_id = i.id and b0.tenant_id = i.tenant_id
  order by b0.created_at desc nulls last
  limit 1
) b on true
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

-- 2) maker-checker for ALL claims (booking + invoice): PA full; owner always; admin not invoices.created_by
drop policy if exists bkpay_checker on public.payment_claims;
create policy bkpay_checker on public.payment_claims as restrictive for update to authenticated using (
  exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin')
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

-- 3) cron notify: booking + ordinary invoice claims; deep-link booking → Dashboard Inbox, invoice → Sales Payments to review
update cron.job set command =
  'with c as (update public.payment_claims pc set notified_at = now() where pc.status = ''pending'' and pc.notified_at is null and pc.deleted_at is null and coalesce((select ps.bk_n_receipt from public.pay_settings ps where ps.tenant_id = pc.tenant_id), true) returning pc.id, pc.tenant_id, pc.invoice_id, pc.amount) insert into public.notifications (tenant_id, user_id, title, body, category, kind, type, priority, link, ref_table, ref_id) select c.tenant_id, u.id, case when bk.id is not null then (case when u.language = ''bm'' then ''Resit bayaran tempahan untuk disemak'' else ''Booking payment receipt to review'' end) else (case when u.language = ''bm'' then ''Resit bayaran invois untuk disemak'' else ''Invoice payment receipt to review'' end) end, case when u.language = ''bm'' then concat_ws('' · '', bk.quote_ref, i.ref_no, ''RM '' || to_char(c.amount, ''FM999,999,990.00'')) || (case when bk.id is not null then ''. Buka Peti Tempahan untuk sahkan.'' else ''. Buka Bayaran untuk disemak.'' end) else concat_ws('' · '', bk.quote_ref, i.ref_no, ''RM '' || to_char(c.amount, ''FM999,999,990.00'')) || (case when bk.id is not null then ''. Open Booking Inbox to verify.'' else ''. Open Payments to review.'' end) end, ''sales'', ''action'', case when bk.id is not null then ''sales.booking_receipt'' else ''sales.invoice_receipt'' end, 2, case when bk.id is not null then jsonb_build_object(''page'', ''dashboard'', ''params'', jsonb_build_object(''bkid'', bk.id::text, ''bktab'', ''proof'', ''claim'', c.id::text)) else jsonb_build_object(''page'', ''sales'', ''params'', jsonb_build_object(''bkpq'', 1, ''claim'', c.id::text)) end, ''payment_claims'', c.id::text from c join public.invoices i on i.id = c.invoice_id and i.tenant_id = c.tenant_id left join lateral (select b.id, b.quote_ref from public.bookings b where b.tenant_id = c.tenant_id and b.invoice_id = c.invoice_id limit 1) bk on true join public.user_profiles u on u.tenant_id = c.tenant_id and coalesce(u.is_active, true) and lower(coalesce(u.role, '''')) = any (case when coalesce((select ps.bk_n_who from public.pay_settings ps where ps.tenant_id = c.tenant_id), ''owner_admin'') = ''owner'' then array[''owner''] else array[''owner'', ''admin''] end); with c as (update public.payment_claims pc set reminded_at = now() where pc.status = ''pending'' and pc.reminded_at is null and pc.deleted_at is null and coalesce((select ps.bk_n_remind from public.pay_settings ps where ps.tenant_id = pc.tenant_id), true) and coalesce((select ps.bk_remind_min from public.pay_settings ps where ps.tenant_id = pc.tenant_id), 30) > 0 and pc.created_at < now() - make_interval(mins => coalesce((select ps.bk_remind_min from public.pay_settings ps where ps.tenant_id = pc.tenant_id), 30)) returning pc.id, pc.tenant_id, pc.invoice_id, pc.amount, pc.created_at) insert into public.notifications (tenant_id, user_id, title, body, category, kind, type, priority, link, ref_table, ref_id) select c.tenant_id, u.id, case when bk.id is not null then (case when u.language = ''bm'' then ''Resit tempahan masih menunggu semakan'' else ''Booking receipt still waiting for review'' end) else (case when u.language = ''bm'' then ''Resit invois masih menunggu semakan'' else ''Invoice receipt still waiting for review'' end) end, case when u.language = ''bm'' then concat_ws('' · '', i.ref_no, ''RM '' || to_char(c.amount, ''FM999,999,990.00'')) || ''. Dihantar '' || to_char(c.created_at at time zone ''Asia/Kuala_Lumpur'', ''HH12:MI AM'') || '' (MYT).'' else concat_ws('' · '', i.ref_no, ''RM '' || to_char(c.amount, ''FM999,999,990.00'')) || ''. Sent '' || to_char(c.created_at at time zone ''Asia/Kuala_Lumpur'', ''HH12:MI AM'') || '' (MYT).'' end, ''sales'', ''action'', case when bk.id is not null then ''sales.booking_receipt_remind'' else ''sales.invoice_receipt_remind'' end, 2, case when bk.id is not null then jsonb_build_object(''page'', ''dashboard'', ''params'', jsonb_build_object(''bkid'', bk.id::text, ''bktab'', ''proof'', ''claim'', c.id::text)) else jsonb_build_object(''page'', ''sales'', ''params'', jsonb_build_object(''bkpq'', 1, ''claim'', c.id::text)) end, ''payment_claims'', c.id::text from c join public.invoices i on i.id = c.invoice_id and i.tenant_id = c.tenant_id left join lateral (select b.id from public.bookings b where b.tenant_id = c.tenant_id and b.invoice_id = c.invoice_id limit 1) bk on true join public.user_profiles u on u.tenant_id = c.tenant_id and coalesce(u.is_active, true) and lower(coalesce(u.role, '''')) = any (case when coalesce((select ps.bk_n_who from public.pay_settings ps where ps.tenant_id = c.tenant_id), ''owner_admin'') = ''owner'' then array[''owner''] else array[''owner'', ''admin''] end);'
where jobname = 'mcore-bkpay-notify';

-- 4) morning digest: include all claims (booking + invoice)
update cron.job set command =
  'with y as (select ((now() at time zone ''Asia/Kuala_Lumpur'')::date - 1) d), t as (select pc.tenant_id, count(*) filter (where pc.status = ''pending'') np, coalesce(sum(pc.amount) filter (where pc.status = ''pending''), 0) ap, count(*) filter (where pc.status = ''approved'' and (pc.reviewed_at at time zone ''Asia/Kuala_Lumpur'')::date = (select d from y)) nv, coalesce(sum(coalesce(p.amount, pc.amount)) filter (where pc.status = ''approved'' and (pc.reviewed_at at time zone ''Asia/Kuala_Lumpur'')::date = (select d from y)), 0) av, count(*) filter (where pc.status = ''rejected'' and (pc.reviewed_at at time zone ''Asia/Kuala_Lumpur'')::date = (select d from y)) nr from public.payment_claims pc left join public.payments p on p.id = pc.payment_id and p.tenant_id = pc.tenant_id where pc.deleted_at is null and (pc.status = ''pending'' or pc.reviewed_at > now() - interval ''3 days'') and coalesce((select ps.bk_n_digest from public.pay_settings ps where ps.tenant_id = pc.tenant_id), true) group by pc.tenant_id) insert into public.notifications (tenant_id, user_id, title, body, category, kind, type, priority, link) select t.tenant_id, u.id, case when u.language = ''bm'' then ''Bayaran: ringkasan pagi'' else ''Payments: morning summary'' end, case when u.language = ''bm'' then t.np || '' menunggu semakan (RM '' || to_char(t.ap, ''FM999,999,990.00'') || '') · '' || t.nv || '' disahkan semalam (RM '' || to_char(t.av, ''FM999,999,990.00'') || '') · '' || t.nr || '' ditolak semalam'' else t.np || '' waiting for review (RM '' || to_char(t.ap, ''FM999,999,990.00'') || '') · '' || t.nv || '' verified yesterday (RM '' || to_char(t.av, ''FM999,999,990.00'') || '') · '' || t.nr || '' rejected yesterday'' end, ''sales'', ''for_you'', ''sales.booking_pay_digest'', case when t.np > 0 then 1 else 0 end, jsonb_build_object(''page'', ''sales'', ''params'', jsonb_build_object(''bkpq'', 1)) from t join public.user_profiles u on u.tenant_id = t.tenant_id and coalesce(u.is_active, true) and lower(coalesce(u.role, '''')) = any (case when coalesce((select ps.bk_n_who from public.pay_settings ps where ps.tenant_id = t.tenant_id), ''owner_admin'') = ''owner'' then array[''owner''] else array[''owner'', ''admin''] end) where t.np + t.nv + t.nr > 0;'
where jobname = 'mcore-bkpay-morning';

-- 5) roadmap
insert into public.dev_roadmap_items (title, description, module, stage)
select 'Invoice pay align (one proof spine)', 'Ordinary invoices reuse payment_claims + bkpay_pub (LEFT JOIN booking). Public: QR → upload → WA → reject visible → receipt. Staff: one Payments to review for booking+invoice; Verify = Record Payment + slip + receipt PDF; maker-checker owner/admin not created_by; cron notify + deep-link. Hide hold/deposit/grace for inv-only.', 'sales', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Invoice pay align (one proof spine)');
update public.dev_roadmap_items set stage = 'completed', module = 'sales',
  description = 'Ordinary invoices reuse payment_claims + bkpay_pub (LEFT JOIN booking). Public: QR → upload → WA → reject visible → receipt. Staff: one Payments to review for booking+invoice; Verify = Record Payment + slip + receipt PDF; maker-checker owner/admin not created_by; cron notify + deep-link. Hide hold/deposit/grace for inv-only.'
where title = 'Invoice pay align (one proof spine)' and stage is distinct from 'completed';

-- 6) check (read-only)
select count(*) as bkpay_pub_rows_without_header from public.bkpay_pub;
select jobid, jobname, active from cron.job where jobname like 'mcore-bkpay-%' order by jobname;
select title, stage from public.dev_roadmap_items where title = 'Invoice pay align (one proof spine)';

notify pgrst, 'reload schema';
