-- ============================================================================
-- Migration: mark "ToyyibPay Fasa A — Online Payment" completed in
-- dev_roadmap_items (Admin -> System Development).
--
-- Data-only migration — no schema change. dev_roadmap_items is not created
-- by any migration in this repo (set up directly by Mike, like
-- platform_payment_config), so this only UPDATEs a matching existing row
-- or INSERTs a new one if none exists — never both, never a duplicate.
-- completed_at is intentionally not set here — the existing DB trigger on
-- dev_roadmap_items auto-sets it when stage changes to 'completed'.
--
-- NOTE: Supabase Edge Functions/migrations do NOT auto-deploy from GitHub —
-- run this manually in Supabase Dashboard -> SQL Editor. Safe to re-run.
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.dev_roadmap_items WHERE title ILIKE '%toyyibpay%') THEN
    UPDATE public.dev_roadmap_items
    SET stage = 'completed',
        description = 'ToyyibPay subscription payment (create-bill + webhook) — live production, verified end-to-end 2 Sep 2026 (RM99 Starter plan, sandbox test).',
        pr_url = 'https://github.com/mpflemedia-ux/mcore/pull/594'
    WHERE title ILIKE '%toyyibpay%';
  ELSE
    INSERT INTO public.dev_roadmap_items (title, description, module, stage, pr_url)
    VALUES (
      'ToyyibPay Fasa A — Online Payment',
      'ToyyibPay subscription payment (create-bill + webhook) — live production, verified end-to-end 2 Sep 2026 (RM99 Starter plan, sandbox test).',
      'billing',
      'completed',
      'https://github.com/mpflemedia-ux/mcore/pull/594'
    );
  END IF;
END $$;
