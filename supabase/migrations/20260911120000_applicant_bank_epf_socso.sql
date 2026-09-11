-- Run in Supabase SQL Editor. Adds bank / EPF / SOCSO on job applicants.

ALTER TABLE public.job_applicants
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bank_account_name text,
  ADD COLUMN IF NOT EXISTS bank_account_no text,
  ADD COLUMN IF NOT EXISTS epf_no text,
  ADD COLUMN IF NOT EXISTS socso_no text;
