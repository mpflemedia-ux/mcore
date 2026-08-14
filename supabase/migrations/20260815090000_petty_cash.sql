-- Petty Cash (Imprest) — multi-tenant
CREATE TABLE IF NOT EXISTS public.petty_cash_floats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  holder_name text NOT NULL,
  holder_employee_id uuid NULL,
  issued_date date NOT NULL DEFAULT (CURRENT_DATE),
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz NULL,
  deleted_at timestamptz NULL
);

CREATE TABLE IF NOT EXISTS public.petty_cash_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  float_id uuid NOT NULL REFERENCES public.petty_cash_floats(id),
  expense_date date NOT NULL DEFAULT (CURRENT_DATE),
  merchant text NULL,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  description text NULL,
  receipt_status text NOT NULL DEFAULT 'ok' CHECK (receipt_status IN ('ok','damaged','missing')),
  receipt_note text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_pcf_tenant ON public.petty_cash_floats(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pce_float ON public.petty_cash_expenses(float_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pce_tenant ON public.petty_cash_expenses(tenant_id) WHERE deleted_at IS NULL;

ALTER TABLE public.petty_cash_floats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.petty_cash_expenses ENABLE ROW LEVEL SECURITY;

-- Permissive tenant policies (adjust if your project uses a standard tenant policy helper)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='petty_cash_floats' AND policyname='pcf_tenant_all') THEN
    CREATE POLICY pcf_tenant_all ON public.petty_cash_floats FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='petty_cash_expenses' AND policyname='pce_tenant_all') THEN
    CREATE POLICY pce_tenant_all ON public.petty_cash_expenses FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
