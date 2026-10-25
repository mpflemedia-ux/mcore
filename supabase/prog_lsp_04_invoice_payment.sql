-- Programme Lead -> Sales -> Payment · Phase 4-5: deposit invoice, seat hold, payment (manual transfer / QR via existing proof flow), HRD Corp
-- WRITE-ONLY: run after prog_lsp_03_registration.sql. Rerun-safe.
-- Invoices are issued by the programme tenant (seller). Self/company payers see the collection agent's account
-- (invoice-level override); HRD Corp invoices keep the tenant's own account. Payment proof reuses payment_claims
-- (public invoice link → upload receipt → Payments to review → Verify) with no change.

-- 1) programme money settings (all optional; nothing is assumed)
alter table public.prog_programmes add column if not exists deposit_per_pax numeric(14,2) check (deposit_per_pax is null or deposit_per_pax >= 0);
alter table public.prog_programmes add column if not exists balance_due_on date;
alter table public.prog_programmes add column if not exists capacity int check (capacity is null or capacity > 0);
alter table public.prog_programmes add column if not exists hold_days int not null default 7 check (hold_days between 1 and 60);
alter table public.prog_programmes add column if not exists hrd_hold_days int not null default 30 check (hrd_hold_days between 1 and 120);
alter table public.prog_programmes add column if not exists pay_bank_name text;
alter table public.prog_programmes add column if not exists pay_account_name text;
alter table public.prog_programmes add column if not exists pay_account_number text;
alter table public.prog_programmes add column if not exists pay_qr_url text;
alter table public.prog_programmes add column if not exists pay_note text;

-- 2) invoice-level payment account (null = tenant default, unchanged for every other invoice)
alter table public.invoices add column if not exists pay_bank_name text;
alter table public.invoices add column if not exists pay_account_name text;
alter table public.invoices add column if not exists pay_account_number text;
alter table public.invoices add column if not exists pay_qr_url text;
alter table public.invoices add column if not exists pay_note text;

-- 3) public invoice: same output as before + invoice override + pay_note
CREATE OR REPLACE FUNCTION public.get_public_invoice(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv invoices%ROWTYPE;
  items jsonb;
  tn tenants%ROWTYPE;
  cp jsonb;
  ovr boolean;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) < 8 THEN
    RAISE EXCEPTION 'Invalid token';
  END IF;
  SELECT * INTO inv FROM invoices WHERE public_token = trim(p_token) AND deleted_at IS NULL LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;
  SELECT * INTO tn FROM tenants WHERE id = inv.tenant_id;
  cp := coalesce(tn.config->'company_profile', '{}'::jsonb);
  ovr := nullif(trim(coalesce(inv.pay_account_number, '')), '') IS NOT NULL;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'description', description,
    'qty', qty,
    'unit_price', unit_price,
    'line_total', line_total
  ) ORDER BY created_at), '[]'::jsonb)
  INTO items
  FROM invoice_items WHERE invoice_id = inv.id;

  RETURN jsonb_build_object(
    'tenant_name', coalesce(nullif(tn.name,''), cp->>'name'),
    'logo_url', coalesce(nullif(tn.logo_url,''), cp->>'logo_url'),
    'payment_qr_url', CASE WHEN ovr THEN nullif(inv.pay_qr_url,'') ELSE coalesce(nullif(tn.payment_qr_url,''), cp->>'payment_qr_url') END,
    'ssm_no', coalesce(nullif(tn.ssm_no,''), cp->>'ssm_no'),
    'address', coalesce(nullif(tn.address,''), cp->>'address'),
    'address_line2', coalesce(nullif(tn.address_line2,''), cp->>'address_line2'),
    'city', coalesce(nullif(tn.city,''), cp->>'city'),
    'postcode', coalesce(nullif(tn.postcode,''), cp->>'postcode'),
    'state', coalesce(nullif(tn.state,''), cp->>'state'),
    'phone', coalesce(nullif(tn.phone,''), cp->>'phone'),
    'email', coalesce(nullif(tn.email,''), cp->>'email'),
    'bank_name', CASE WHEN ovr THEN inv.pay_bank_name ELSE coalesce(nullif(tn.bank_name,''), cp->>'bank_name') END,
    'account_name', CASE WHEN ovr THEN inv.pay_account_name ELSE coalesce(nullif(tn.account_name,''), cp->>'account_name') END,
    'account_number', CASE WHEN ovr THEN inv.pay_account_number ELSE coalesce(nullif(tn.account_number,''), cp->>'account_number') END,
    'pay_note', nullif(trim(coalesce(inv.pay_note, '')), ''),
    'ref_no', inv.ref_no,
    'issue_date', inv.issue_date,
    'due_date', inv.due_date,
    'customer_name', inv.customer_name,
    'subtotal', inv.subtotal,
    'tax_rate', inv.tax_rate,
    'tax_amt', inv.tax_amt,
    'total', inv.total,
    'paid_amt', inv.paid_amt,
    'status', inv.status,
    'items', items
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_public_invoice(text) TO anon, authenticated;

-- 4) one status for every enrolment, computed from its invoices (no stored status → no drift / double count)
--    draft: no invoice yet · held: deposit unpaid, hold running · verifying: receipt waiting for review
--    hrd_pending: HRD Corp invoice, approval not in yet · confirmed: deposit paid (or HRD approval no.)
--    paid_full: total paid >= programme fee · expired: hold ran out unpaid · cancelled
drop view if exists public.prog_enrolments_v;
create view public.prog_enrolments_v with (security_invoker = true) as
select e.*,
  di.ref_no as dep_ref, di.total as dep_total, coalesce(di.paid_amt, 0) as dep_paid, di.status as dep_status, di.public_token as dep_token, di.due_date as dep_due,
  bi.ref_no as bal_ref, bi.total as bal_total, coalesce(bi.paid_amt, 0) as bal_paid, bi.status as bal_status, bi.public_token as bal_token, bi.due_date as bal_due,
  (select count(*) from public.payment_claims c where c.tenant_id = e.tenant_id and c.deleted_at is null and c.status = 'pending'
     and c.invoice_id in (e.deposit_invoice_id, e.balance_invoice_id)) as claims_pending,
  (select count(*) from public.prog_participants p where p.enrolment_id = e.id and p.deleted_at is null and p.submitted_at is not null) as registered,
  case
    when e.cancelled_at is not null then 'cancelled'
    when e.deposit_invoice_id is null then 'draft'
    when coalesce(di.paid_amt, 0) + coalesce(bi.paid_amt, 0) >= coalesce(e.fee_total, 0) - 0.005 and coalesce(e.fee_total, 0) > 0 then 'paid_full'
    when e.funding = 'hrdcorp' and nullif(trim(coalesce(e.hrd_approval_no, '')), '') is not null then 'confirmed'
    when e.funding <> 'hrdcorp' and coalesce(di.paid_amt, 0) >= coalesce(di.total, 0) - 0.005 then 'confirmed'
    when exists (select 1 from public.payment_claims c where c.tenant_id = e.tenant_id and c.deleted_at is null and c.status = 'pending' and c.invoice_id = e.deposit_invoice_id) then 'verifying'
    when e.hold_until > now() then case when e.funding = 'hrdcorp' then 'hrd_pending' else 'held' end
    else 'expired'
  end as status
from public.prog_enrolments e
left join public.invoices di on di.id = e.deposit_invoice_id and di.tenant_id = e.tenant_id
left join public.invoices bi on bi.id = e.balance_invoice_id and bi.tenant_id = e.tenant_id
where e.deleted_at is null;
grant select on public.prog_enrolments_v to authenticated;

-- seats: everything except draft / expired / cancelled holds a seat
create or replace function public.prog_seats(p_programme uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare pg public.prog_programmes%rowtype; v_used int; v_conf int; v_hold int;
begin
  select * into pg from public.prog_programmes where id = p_programme and deleted_at is null;
  if not found then raise exception 'programme not found'; end if;
  perform public.prog__guard(pg.tenant_id, 'crm');
  select coalesce(sum(pax) filter (where status in ('confirmed','paid_full')), 0),
         coalesce(sum(pax) filter (where status in ('held','verifying','hrd_pending')), 0)
    into v_conf, v_hold
    from public.prog_enrolments_v where programme_id = pg.id;
  v_used := v_conf + v_hold;
  return jsonb_build_object('capacity', pg.capacity, 'confirmed', v_conf, 'held', v_hold, 'used', v_used,
    'available', case when pg.capacity is null then null else greatest(pg.capacity - v_used, 0) end);
end;
$fn$;
revoke all on function public.prog_seats(uuid) from public;
grant execute on function public.prog_seats(uuid) to authenticated;

-- internal: create one programme invoice (tenant series ref, public link token, agent account unless HRD Corp)
create or replace function public.prog__make_invoice(e public.prog_enrolments, pg public.prog_programmes, p_total numeric, p_due date, p_desc text)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare v_ref text; v_tok text; v_inv uuid; v_agent boolean;
begin
  if pg.tenant_id = public.get_my_tenant_id() then
    begin v_ref := public.next_ref_no('INV'); exception when others then v_ref := null; end;
  end if;
  if v_ref is null or length(trim(v_ref)) < 3 then
    v_ref := 'INV-PRG-' || to_char(now() at time zone 'Asia/Kuala_Lumpur', 'YYYYMMDD') || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  end if;
  v_tok := replace(gen_random_uuid()::text, '-', '') || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
  v_agent := e.funding <> 'hrdcorp' and nullif(trim(coalesce(pg.pay_account_number, '')), '') is not null;
  insert into public.invoices (
    tenant_id, customer_id, customer_name, ref_no, issue_date, due_date,
    subtotal, tax_rate, tax_amt, total, paid_amt, status, notes, public_token,
    pay_bank_name, pay_account_name, pay_account_number, pay_qr_url, pay_note
  ) values (
    pg.tenant_id, e.customer_id, e.payer_name, v_ref, (now() at time zone 'Asia/Kuala_Lumpur')::date, p_due,
    p_total, 0, 0, p_total, 0, 'unpaid', pg.code || ' · ' || p_desc, v_tok,
    case when v_agent then pg.pay_bank_name end, case when v_agent then pg.pay_account_name end,
    case when v_agent then pg.pay_account_number end, case when v_agent then pg.pay_qr_url end,
    case when v_agent then pg.pay_note end
  ) returning id into v_inv;
  begin
    insert into public.invoice_items (tenant_id, invoice_id, description, qty, unit_price, line_total)
    values (pg.tenant_id, v_inv, pg.name || ' — ' || p_desc, e.pax, round(p_total / e.pax, 2), p_total);
  exception when undefined_column then
    insert into public.invoice_items (invoice_id, description, qty, unit_price, line_total)
    values (v_inv, pg.name || ' — ' || p_desc, e.pax, round(p_total / e.pax, 2), p_total);
  end;
  return v_inv;
end;
$fn$;
revoke all on function public.prog__make_invoice(public.prog_enrolments, public.prog_programmes, numeric, date, text) from public;

-- staff: issue the first invoice and hold the seats (atomic capacity check)
--   self/company: deposit_per_pax x pax (or full fee when no deposit is set), hold = hold_days
--   hrdcorp:      full fee x pax on the tenant's own account, hold = hrd_hold_days, confirmed by approval no.
create or replace function public.prog_issue_deposit(p_enrolment uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare e public.prog_enrolments%rowtype; pg public.prog_programmes%rowtype; v_used int; v_fee numeric; v_amt numeric;
  v_hold timestamptz; v_inv uuid; v_cust uuid; v_code text; v_desc text;
begin
  select * into e from public.prog_enrolments where id = p_enrolment and deleted_at is null for update;
  if not found then raise exception 'enrolment not found'; end if;
  perform public.prog__guard(e.tenant_id, 'sales');
  if e.cancelled_at is not null then raise exception 'enrolment cancelled'; end if;
  if e.deposit_invoice_id is not null then raise exception 'invoice already issued'; end if;
  select * into pg from public.prog_programmes where id = e.programme_id and deleted_at is null for update;
  if coalesce(pg.fee_per_pax, 0) <= 0 then raise exception 'programme fee not set'; end if;

  if pg.capacity is not null then
    select coalesce(sum(pax), 0) into v_used from public.prog_enrolments_v
     where programme_id = pg.id and status in ('held','verifying','hrd_pending','confirmed','paid_full');
    if v_used + e.pax > pg.capacity then raise exception 'not enough seats'; end if;
  end if;

  -- customer: reuse by email in this tenant, else create (same pattern as public booking)
  if e.email is not null then
    select id into v_cust from public.customers where tenant_id = e.tenant_id and deleted_at is null and lower(email) = lower(e.email) limit 1;
  end if;
  if v_cust is null then
    if e.tenant_id = public.get_my_tenant_id() then
      begin v_code := public.next_ref_no('CUST'); exception when others then v_code := null; end;
    end if;
    if v_code is null or length(trim(v_code)) < 3 then v_code := 'CUST-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)); end if;
    insert into public.customers (tenant_id, code, name, email, phone)
    values (e.tenant_id, v_code, e.payer_name, e.email, e.phone) returning id into v_cust;
    begin update public.customers set source = 'Programme ' || pg.code where id = v_cust; exception when undefined_column then null; end;
  end if;
  e.customer_id := v_cust;

  v_fee := round(pg.fee_per_pax * e.pax, 2);
  if e.funding = 'hrdcorp' then
    v_amt := v_fee; v_hold := now() + make_interval(days => pg.hrd_hold_days); v_desc := 'Programme fee (HRD Corp)';
  elsif coalesce(pg.deposit_per_pax, 0) > 0 and pg.deposit_per_pax < pg.fee_per_pax then
    v_amt := round(pg.deposit_per_pax * e.pax, 2); v_hold := now() + make_interval(days => pg.hold_days); v_desc := 'Deposit';
  else
    v_amt := v_fee; v_hold := now() + make_interval(days => pg.hold_days); v_desc := 'Programme fee';
  end if;
  v_inv := public.prog__make_invoice(e, pg, v_amt, (v_hold at time zone 'Asia/Kuala_Lumpur')::date, v_desc || ' (' || e.pax || ' pax)');

  update public.prog_enrolments set customer_id = v_cust, fee_total = v_fee, deposit_total = v_amt,
    deposit_invoice_id = v_inv, hold_until = v_hold, updated_at = now() where id = e.id;
  update public.prog_leads set customer_id = v_cust, updated_at = now() where id = e.lead_id;
  return jsonb_build_object('ok', true, 'invoice_id', v_inv, 'amount', v_amt, 'hold_until', v_hold);
end;
$fn$;
revoke all on function public.prog_issue_deposit(uuid) from public;
grant execute on function public.prog_issue_deposit(uuid) to authenticated;

-- staff: extend a running/expired hold (capacity re-checked when the hold had expired)
create or replace function public.prog_extend_hold(p_enrolment uuid, p_days int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare v public.prog_enrolments_v%rowtype; pg public.prog_programmes%rowtype; v_used int; v_new timestamptz;
begin
  select * into v from public.prog_enrolments_v where id = p_enrolment;
  if not found then raise exception 'enrolment not found'; end if;
  perform public.prog__guard(v.tenant_id, 'sales');
  if p_days is null or p_days < 1 or p_days > 60 then raise exception 'invalid days'; end if;
  if v.status not in ('held','hrd_pending','expired','verifying') then raise exception 'nothing to extend'; end if;
  select * into pg from public.prog_programmes where id = v.programme_id for update;
  if v.status = 'expired' and pg.capacity is not null then
    select coalesce(sum(pax), 0) into v_used from public.prog_enrolments_v
     where programme_id = pg.id and status in ('held','verifying','hrd_pending','confirmed','paid_full');
    if v_used + v.pax > pg.capacity then raise exception 'not enough seats'; end if;
  end if;
  v_new := greatest(coalesce(v.hold_until, now()), now()) + make_interval(days => p_days);
  update public.prog_enrolments set hold_until = v_new, updated_at = now() where id = v.id;
  update public.invoices set due_date = (v_new at time zone 'Asia/Kuala_Lumpur')::date, updated_at = now()
   where id = v.deposit_invoice_id and tenant_id = v.tenant_id and status = 'unpaid';
  return jsonb_build_object('ok', true, 'hold_until', v_new);
end;
$fn$;
revoke all on function public.prog_extend_hold(uuid, int) from public;
grant execute on function public.prog_extend_hold(uuid, int) to authenticated;

-- staff: HRD Corp grant approval number -> confirmed
create or replace function public.prog_set_hrd_approval(p_enrolment uuid, p_no text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare e public.prog_enrolments%rowtype;
begin
  select * into e from public.prog_enrolments where id = p_enrolment and deleted_at is null for update;
  if not found then raise exception 'enrolment not found'; end if;
  perform public.prog__guard(e.tenant_id, 'sales');
  if e.funding <> 'hrdcorp' then raise exception 'not an HRD Corp enrolment'; end if;
  update public.prog_enrolments set hrd_approval_no = left(nullif(trim(coalesce(p_no, '')), ''), 80), updated_at = now() where id = e.id;
  return jsonb_build_object('ok', true);
end;
$fn$;
revoke all on function public.prog_set_hrd_approval(uuid, text) from public;
grant execute on function public.prog_set_hrd_approval(uuid, text) to authenticated;

-- staff: cancel an enrolment (frees seats; unpaid programme invoices are cancelled, paid ones are left for refund handling)
create or replace function public.prog_cancel_enrolment(p_enrolment uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare e public.prog_enrolments%rowtype;
begin
  select * into e from public.prog_enrolments where id = p_enrolment and deleted_at is null for update;
  if not found then raise exception 'enrolment not found'; end if;
  perform public.prog__guard(e.tenant_id, 'sales');
  if e.cancelled_at is not null then return jsonb_build_object('ok', true); end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'reason required'; end if;
  update public.prog_enrolments set cancelled_at = now(), cancel_reason = left(trim(p_reason), 500), updated_at = now() where id = e.id;
  update public.invoices set status = 'cancelled', updated_at = now()
   where tenant_id = e.tenant_id and id in (e.deposit_invoice_id, e.balance_invoice_id)
     and coalesce(paid_amt, 0) = 0 and status = 'unpaid';
  return jsonb_build_object('ok', true);
end;
$fn$;
revoke all on function public.prog_cancel_enrolment(uuid, text) from public;
grant execute on function public.prog_cancel_enrolment(uuid, text) to authenticated;

do $rd$
begin
  if exists (select 1 from public.dev_roadmap_items where title = 'Programme LSP · Phase 4-5: deposit invoice, seat hold, payment') then
    update public.dev_roadmap_items set stage = 'completed', module = 'sales' where title = 'Programme LSP · Phase 4-5: deposit invoice, seat hold, payment';
  else
    insert into public.dev_roadmap_items (title, description, module, stage)
    values ('Programme LSP · Phase 4-5: deposit invoice, seat hold, payment',
      'Deposit (or full-fee) invoice per enrolment with atomic seat HOLD; invoice-level collection-agent bank/QR + note (public link, print); manual transfer/QR proof via existing Payments to review; HRD Corp path (full fee, tenant own account, confirmed by approval no.); extend hold; cancel; status computed from invoices (prog_enrolments_v).',
      'sales', 'completed');
  end if;
exception when undefined_column or undefined_table then raise notice 'dev_roadmap skip: %', sqlerrm;
end $rd$;

notify pgrst, 'reload schema';
