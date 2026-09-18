ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS bank_account_no text;
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS bank_account_name text;
