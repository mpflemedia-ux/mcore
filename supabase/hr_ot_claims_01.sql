reset role;

-- OT automation roadmap Phase 5-6: ot_claims table + Owner/Delegate approval workflow.
--
-- A claim is auto-detected client-side (app/index.html _otMaybeCreateClaim) whenever an
-- attendance row gets both clock_in and clock_out (real or auto-closed) and the employee is
-- OT-eligible, always created as 'pending' — it never affects pay until approved. Approved
-- claims are picked up by Payroll Run (Phase 7, hr_ot_payroll_integration_01.sql).
--
-- Approval model (agreed with tenant owner):
--   - Owner always approves — anyone's claim, including their own.
--   - A delegate (tenants.config.ot_delegates, a jsonb array of user_profiles.id) has the
--     SAME full approval power as owner, but scoped to OT only, and CANNOT approve their own
--     claim (separation of duties) — enforced here at the RLS level too, not just the UI,
--     by matching the claim's employee email against auth.email() (the delegate's own login
--     email — user_profiles has no email column, same linkage _hrResolveSelfEmployee() uses
--     client-side via Supabase Auth).
--   - manager/hr can create/update PENDING claims for any employee (e.g. editing someone
--     else's attendance) but cannot move a claim to approved/rejected — only owner/delegate
--     can change status away from pending.
--   - No RM/hour caps on delegate power by design — control comes from the 3 safeguards
--     above (no self-approve, owner sees everything via this same table, delegate list is
--     audit-logged on every change), not from configuration friction.
--
-- Write-only, idempotent, run once in Supabase SQL Editor. Run AFTER hr_ot_settings_01.sql.

CREATE TABLE IF NOT EXISTS public.ot_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  claim_date date NOT NULL,
  day_type text NOT NULL CHECK (day_type IN ('normal', 'restday', 'holiday')),
  hours_worked numeric NOT NULL DEFAULT 0,
  ot_hours numeric NOT NULL DEFAULT 0,
  hourly_rate numeric NOT NULL DEFAULT 0,
  daily_rate numeric NOT NULL DEFAULT 0,
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_hours numeric,
  approved_amount numeric,
  approved_by uuid REFERENCES public.user_profiles(id),
  approved_at timestamptz,
  note text,
  payroll_record_id uuid REFERENCES public.payroll_records(id),
  created_at timestamptz DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (tenant_id, employee_id, claim_date)
);
COMMENT ON TABLE public.ot_claims IS 'Auto-detected OT claims from attendance clock-in/out, pending Owner/Delegate approval before Payroll Run picks them up.';

CREATE INDEX IF NOT EXISTS idx_ot_claims_tenant_status ON public.ot_claims(tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ot_claims_employee_date ON public.ot_claims(employee_id, claim_date) WHERE deleted_at IS NULL;

ALTER TABLE public.ot_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ot_claims_select ON public.ot_claims;
CREATE POLICY ot_claims_select ON public.ot_claims
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT tenant_id FROM public.user_profiles WHERE id = auth.uid())
    AND (
      EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid()
          AND lower(trim(coalesce(up.role, ''))) IN ('owner', 'admin', 'platform_admin', 'manager', 'hr')
      )
      OR employee_id IN (SELECT id FROM public.my_employee_row())
      OR EXISTS (
        SELECT 1 FROM public.tenants t
        WHERE t.id = ot_claims.tenant_id AND t.config->'ot_delegates' @> to_jsonb(auth.uid()::text)
      )
    )
  );

-- Self or HR/manager can create/update a claim WHILE IT STAYS PENDING (auto-detect + its
-- idempotent recompute). Cannot move status away from pending through this policy.
DROP POLICY IF EXISTS ot_claims_write_self ON public.ot_claims;
CREATE POLICY ot_claims_write_self ON public.ot_claims
  FOR ALL TO authenticated
  USING (
    tenant_id = (SELECT tenant_id FROM public.user_profiles WHERE id = auth.uid())
    AND (
      employee_id IN (SELECT id FROM public.my_employee_row())
      OR EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid() AND lower(trim(coalesce(up.role, ''))) IN ('manager', 'hr')
      )
    )
    AND status = 'pending'
  )
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM public.user_profiles WHERE id = auth.uid())
    AND (
      employee_id IN (SELECT id FROM public.my_employee_row())
      OR EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid() AND lower(trim(coalesce(up.role, ''))) IN ('manager', 'hr')
      )
    )
    AND status = 'pending'
  );

-- Owner/platform_admin: full access, any claim, any status, including their own (approval
-- authority doesn't need separation-of-duties against the person who owns the business).
-- Delegate: same full access EXCEPT their own claim (blocked via employee-email match).
DROP POLICY IF EXISTS ot_claims_write_approver ON public.ot_claims;
CREATE POLICY ot_claims_write_approver ON public.ot_claims
  FOR ALL TO authenticated
  USING (
    tenant_id = (SELECT tenant_id FROM public.user_profiles WHERE id = auth.uid())
    AND (
      EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid() AND lower(trim(coalesce(up.role, ''))) IN ('owner', 'platform_admin')
      )
      OR (
        EXISTS (
          SELECT 1 FROM public.tenants t
          WHERE t.id = ot_claims.tenant_id AND t.config->'ot_delegates' @> to_jsonb(auth.uid()::text)
        )
        AND NOT EXISTS (
          -- Delegate's own email comes from auth.email() (the JWT claim for the logged-in
          -- user) — user_profiles has no email column, that lives in Supabase Auth only.
          SELECT 1 FROM public.employees e
          WHERE e.id = ot_claims.employee_id
            AND e.email IS NOT NULL AND auth.email() IS NOT NULL
            AND lower(trim(e.email)) = lower(trim(auth.email()))
        )
      )
    )
  )
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM public.user_profiles WHERE id = auth.uid())
    AND (
      EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid() AND lower(trim(coalesce(up.role, ''))) IN ('owner', 'platform_admin')
      )
      OR (
        EXISTS (
          SELECT 1 FROM public.tenants t
          WHERE t.id = ot_claims.tenant_id AND t.config->'ot_delegates' @> to_jsonb(auth.uid()::text)
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.employees e
          WHERE e.id = ot_claims.employee_id
            AND e.email IS NOT NULL AND auth.email() IS NOT NULL
            AND lower(trim(e.email)) = lower(trim(auth.email()))
        )
      )
    )
  );

-- System Development
update public.dev_roadmap_items set stage = 'completed', module = 'hr',
  description = 'OT automation roadmap Phase 5-6: ot_claims table — OT auto-detected from attendance clock-in/out (Akta Kerja 1955 Ordinary Rate of Pay formula, tenant-editable multipliers from Tetapan Gaji & OT), always created pending. Owner/Delegate approval queue (OT Approvals page) with partial-hour adjustment; a delegate (tenants.config.ot_delegates) has full approval power but cannot approve their own claim (RLS-enforced, not just UI), owner can approve anyone including themselves. manager/hr can create/edit pending claims but cannot approve. Staff see their own claim status on the Attendance page.'
  where title = 'HR: OT Claims + Owner/Delegate Approval (OT roadmap Phase 5-6)';
insert into public.dev_roadmap_items (title, description, module, stage)
  select 'HR: OT Claims + Owner/Delegate Approval (OT roadmap Phase 5-6)', 'OT automation roadmap Phase 5-6: ot_claims table — OT auto-detected from attendance clock-in/out (Akta Kerja 1955 Ordinary Rate of Pay formula, tenant-editable multipliers from Tetapan Gaji & OT), always created pending. Owner/Delegate approval queue (OT Approvals page) with partial-hour adjustment; a delegate (tenants.config.ot_delegates) has full approval power but cannot approve their own claim (RLS-enforced, not just UI), owner can approve anyone including themselves. manager/hr can create/edit pending claims but cannot approve. Staff see their own claim status on the Attendance page.', 'hr', 'completed'
  where not exists (select 1 from public.dev_roadmap_items where title = 'HR: OT Claims + Owner/Delegate Approval (OT roadmap Phase 5-6)');
