CREATE TABLE IF NOT EXISTS payment_voucher_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  ref_no text,
  batch_date date DEFAULT CURRENT_DATE,
  title text,
  status text DEFAULT 'draft',
  total_amount numeric DEFAULT 0,
  line_count int DEFAULT 0,
  prepared_by text,
  checked_by text,
  approved_by text,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payment_voucher_batch_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  batch_id uuid NOT NULL REFERENCES payment_voucher_batches(id) ON DELETE CASCADE,
  sort_order int DEFAULT 1,
  payee_name text,
  amount numeric DEFAULT 0,
  payment_method text,
  bank_name text,
  cheque_no text,
  description text,
  bill_id uuid,
  voucher_id uuid,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pvd_batch_tenant_idx ON payment_voucher_batches(tenant_id);
CREATE INDEX IF NOT EXISTS pvd_lines_batch_idx ON payment_voucher_batch_lines(batch_id);

ALTER TABLE payment_voucher_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_voucher_batch_lines ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY pvd_batches_tenant ON payment_voucher_batches FOR ALL
    USING (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()))
    WITH CHECK (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY pvd_lines_tenant ON payment_voucher_batch_lines FOR ALL
    USING (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()))
    WITH CHECK (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
