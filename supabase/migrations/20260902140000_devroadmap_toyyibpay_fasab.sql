-- ============================================================================
-- Migration: dev_roadmap_items entry for "ToyyibPay Fasa B — Tenant Invoice
-- Payment". Data-only, no schema change. Safe to re-run.
--
-- stage is 'in_progress' here, NOT 'completed' — end-to-end payment
-- (customer actually paying a real invoice through a tenant's own
-- ToyyibPay account) has not been verified live yet. Mike: run
-- 20260902100000/110000/120000/130000 migrations first if not already
-- done, confirm tenant_payment_config's real column names match what
-- toyyibpay-tenant-invoice-create-bill/webhook expect (see PR #598's
-- description — this session could not inspect the live table), set up
-- an active tenant_payment_config row + a fresh test invoice with a
-- balance, then run the UPDATE below (or re-run this file after editing
-- 'in_progress' to 'completed') once a real payment verifies end-to-end.
--
-- NOTE: Supabase Edge Functions/migrations do NOT auto-deploy from GitHub —
-- run this manually in Supabase Dashboard -> SQL Editor.
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.dev_roadmap_items WHERE title ILIKE '%toyyibpay%fasa b%' OR title ILIKE '%toyyibpay%tenant invoice%') THEN
    UPDATE public.dev_roadmap_items
    SET stage = 'in_progress',
        description = 'ToyyibPay tenant invoice payment (BYO gateway) — create-bill + webhook deployed to repo, awaiting live end-to-end verification (needs an active tenant_payment_config row + a test invoice with balance).',
        pr_url = 'https://github.com/mpflemedia-ux/mcore/pull/598'
    WHERE title ILIKE '%toyyibpay%fasa b%' OR title ILIKE '%toyyibpay%tenant invoice%';
  ELSE
    INSERT INTO public.dev_roadmap_items (title, description, module, stage, pr_url)
    VALUES (
      'ToyyibPay Fasa B — Tenant Invoice Payment',
      'ToyyibPay tenant invoice payment (BYO gateway) — create-bill + webhook deployed to repo, awaiting live end-to-end verification (needs an active tenant_payment_config row + a test invoice with balance).',
      'billing',
      'in_progress',
      'https://github.com/mpflemedia-ux/mcore/pull/598'
    );
  END IF;
END $$;
