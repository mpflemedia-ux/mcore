-- ============================================================================
-- Migration: update dev_roadmap_items DESCRIPTION for "ToyyibPay Fasa B —
-- Tenant Invoice Payment" — stage stays 'in_progress' (real end-to-end
-- payment still not verified live). Data-only, no schema change, safe to
-- re-run.
-- ============================================================================

UPDATE public.dev_roadmap_items
SET description = 'ToyyibPay tenant invoice payment (BYO gateway) — create-bill + webhook deployed to repo. Fixed: billEmail format validation (customers.email/tenants.email had no DB constraint, bad data broke ToyyibPay createBill outright). Still awaiting live end-to-end verification (needs an active tenant_payment_config row + a test invoice with balance).',
    pr_url = 'https://github.com/mpflemedia-ux/mcore/pull/600'
WHERE title ILIKE '%toyyibpay%fasa b%' OR title ILIKE '%toyyibpay%tenant invoice%';
