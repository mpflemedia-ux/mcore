-- ============================================================================
-- Migration: clean up invalid-format emails feeding ToyyibPay billEmail.
--
-- Bug: customers.email and tenants.email have no format constraint in the
-- DB, so bad data (e.g. a phone number typed into the email field) can
-- reach ToyyibPay's createBill call as-is. ToyyibPay rejects a malformed
-- billEmail outright, breaking the whole bill-creation request for that
-- customer/tenant. The Edge Functions now validate the format before
-- using it (falls back to a generic address instead of passing bad data
-- through) — this migration is the one-time cleanup of what's already
-- sitting in the DB, same regex as the Edge Function checks, applied to
-- EVERY tenant/customer with a bad value, not just the one that surfaced
-- the bug in testing.
--
-- Pattern matches supabase/functions/toyyibpay-create-bill/index.ts and
-- supabase/functions/toyyibpay-tenant-invoice-create-bill/index.ts's
-- EMAIL_RE exactly (Postgres `~` = regex match, `!~` = does not match).
-- Only touches non-empty, non-null values that fail the pattern — leaves
-- blank/null emails alone (those already correctly fall back at request
-- time, nothing to clean up).
--
-- NOTE: Supabase Edge Functions/migrations do NOT auto-deploy from GitHub —
-- run this manually in Supabase Dashboard -> SQL Editor. Safe to re-run.
-- ============================================================================

UPDATE public.customers
SET email = 'billing@mpflemedia.my'
WHERE email IS NOT NULL AND email != '' AND email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$';

UPDATE public.tenants
SET email = 'billing@mpflemedia.my'
WHERE email IS NOT NULL AND email != '' AND email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$';
