-- M-Core payment attachments, Phase 2: accounting integrity - void archive (reason / by / at kept forever) for customer and supplier payments.
-- Write-only; run in Supabase SQL Editor. Rerun-safe. Plain SQL only (no new functions, no dollar quoting, no pgcrypto).
-- RUN ORDER: pay_attach_01.sql -> pay_attach_02.sql (THIS) -> pay_attach_03.sql -> pay_attach_04.sql.
-- The first statement stops here with "division by zero" if pay_attach_01 has not been run.
-- Until this runs, Void keeps today's behaviour. After it runs, Void asks for a reason, checks the books lock (owner / PA only inside a
-- locked period), posts a REVERSAL journal (also for partial voids; journals are no longer deleted) and archives the payment here.
-- Why an archive and not an in-place status = 'void': payments / payment_allocations / supplier_payments are read by the invoice +
-- customer statement + bank recon + backup screens AND by database functions that are not in the repo (record_invoice_payment_from_gateway,
-- demo reset RPCs). A void flag on the live row cannot be guaranteed to be excluded everywhere, so the live tables keep their meaning
-- (only real payments) and the voided payment moves here with its full snapshot.
select 1 / (case when to_regclass('public.doc_attachments') is null then 0 else 1 end) as pay_attach_01_present;

create table if not exists public.payment_voids (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  kind text not null check (kind in ('payment', 'supplier_payment')),
  payment_id uuid not null,
  invoice_id uuid,
  bill_id uuid,
  ref_no text check (ref_no is null or length(ref_no) <= 80),
  payment_date date,
  payment_method text check (payment_method is null or length(payment_method) <= 40),
  amount numeric(14, 2) not null,
  reason text not null check (length(btrim(reason)) between 3 and 500),
  snapshot jsonb not null default '{}'::jsonb,
  reversal_entry_id uuid,
  voided_by uuid,
  voided_at timestamptz not null default now(),
  deleted_at timestamptz);
create index if not exists payment_voids_doc_idx on public.payment_voids (tenant_id, invoice_id, voided_at) where deleted_at is null;
create index if not exists payment_voids_bill_idx on public.payment_voids (tenant_id, bill_id, voided_at) where deleted_at is null;
create index if not exists payment_voids_pay_idx on public.payment_voids (tenant_id, payment_id);
alter table public.payment_voids enable row level security;
revoke all on public.payment_voids from anon;
drop policy if exists payment_voids_read on public.payment_voids;
create policy payment_voids_read on public.payment_voids for select to authenticated using (
  tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid())
  or exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin'));
-- insert only (an archive is never edited); voided_by is you, or NULL for a platform admin (silent support)
drop policy if exists payment_voids_ins on public.payment_voids;
create policy payment_voids_ins on public.payment_voids for insert to authenticated with check (
  deleted_at is null
  and tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid())
  and (voided_by = auth.uid()
    or (voided_by is null and exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin'))));
-- update: only to attach the reversal journal id right after the void (same person, or PA)
drop policy if exists payment_voids_upd on public.payment_voids;
create policy payment_voids_upd on public.payment_voids for update to authenticated
  using (tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid())
    and (voided_by = auth.uid() or exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'platform_admin')))
  with check (tenant_id = (select p.tenant_id from public.user_profiles p where p.id = auth.uid()));
grant select, insert on public.payment_voids to authenticated;
grant update (reversal_entry_id) on public.payment_voids to authenticated;
drop policy if exists pa_vo_ins on public.payment_voids;
create policy pa_vo_ins on public.payment_voids as restrictive for insert to authenticated with check (not exists (select 1 from public.platform_support_sessions s where s.actor_id = auth.uid() and s.ended_at is null and s.view_only and s.deleted_at is null and s.tenant_id = payment_voids.tenant_id));

notify pgrst, 'reload schema';

update public.dev_roadmap_items set stage = 'completed', module = 'accounting',
  description = 'Payment attachments Phase 2: void with reason + archive (payment_voids, by / at, proof files kept), reversal journal on every void incl. partial (no more journal deletes), books-lock check on void and on removing proof (owner / PA only inside a locked period), bank recon matches on the payment bank ref.'
where title = 'Payment attachments (Phase 2)';
insert into public.dev_roadmap_items (title, description, module, stage)
select 'Payment attachments (Phase 2)', 'Payment attachments Phase 2: void with reason + archive (payment_voids, by / at, proof files kept), reversal journal on every void incl. partial (no more journal deletes), books-lock check on void and on removing proof (owner / PA only inside a locked period), bank recon matches on the payment bank ref.', 'accounting', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Payment attachments (Phase 2)');
