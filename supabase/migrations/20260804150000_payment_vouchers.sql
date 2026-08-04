-- Payment Vouchers
CREATE TABLE IF NOT EXISTS payment_vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  ref_no text,
  voucher_date date DEFAULT CURRENT_DATE,
  payee_name text,
  payee_type text DEFAULT 'other',
  supplier_id uuid,
  bill_id uuid,
  amount numeric NOT NULL DEFAULT 0,
  payment_method text,
  bank_name text,
  cheque_no text,
  description text,
  status text NOT NULL DEFAULT 'draft',
  paid_at timestamptz,
  prepared_by text,
  checked_by text,
  approved_by text,
  gl_debit text,
  gl_credit text,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_vouchers_tenant_idx ON payment_vouchers(tenant_id);
CREATE INDEX IF NOT EXISTS payment_vouchers_bill_idx ON payment_vouchers(bill_id);

ALTER TABLE payment_vouchers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY payment_vouchers_tenant_all ON payment_vouchers
    FOR ALL USING (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()))
    WITH CHECK (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
