-- Optional tax columns for invoices (SST). Safe to re-run.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS subtotal numeric;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_rate numeric default 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_amt numeric default 0;
