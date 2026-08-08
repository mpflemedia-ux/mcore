-- Minimal credit notes for invoice refunds / credit memos
CREATE TABLE IF NOT EXISTS credit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  ref_no text,
  invoice_id uuid,
  customer_id uuid,
  customer_name text,
  credit_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric NOT NULL DEFAULT 0,
  reason text,
  status text NOT NULL DEFAULT 'posted',
  refunded boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by uuid,
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS credit_notes_tenant_idx ON credit_notes(tenant_id);
CREATE INDEX IF NOT EXISTS credit_notes_invoice_idx ON credit_notes(invoice_id);

ALTER TABLE credit_notes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY credit_notes_tenant_all ON credit_notes
    FOR ALL USING (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()))
    WITH CHECK (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
