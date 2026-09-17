ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS join_date date;

UPDATE public.employees
SET join_date = COALESCE(join_date, probation_start_date, created_at::date)
WHERE join_date IS NULL;
