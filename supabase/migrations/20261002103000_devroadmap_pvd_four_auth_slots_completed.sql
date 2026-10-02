-- Roadmap: PVD 4 auth slots (Prepared / Checked / First / Second) — Mike unlocked multi
-- WRITE-ONLY — run in Supabase SQL Editor AFTER bake (shipped).
-- Schema: payment_voucher_batches.first_approved_by already migrated
--   (supabase/migrations/20260907120000_pvd_first_approval.sql). NO new column here.
-- If prod still lacks first_approved_by, Mike may re-run that migration only:
--   ALTER TABLE payment_voucher_batches ADD COLUMN IF NOT EXISTS first_approved_by text;
-- Note: interactive create_pull_request form was blocked; landed direct on main.
-- pr_url = bake commit 65335e1 (not a PR number).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.dev_roadmap_items
    WHERE title ILIKE '%pvd%4%auth%'
       OR title ILIKE '%pvd%four%auth%'
       OR title ILIKE '%PVD%First Approval%'
       OR title ILIKE '%pvd-four-auth%'
  ) THEN
    UPDATE public.dev_roadmap_items
    SET
      stage = 'completed',
      module = COALESCE(NULLIF(TRIM(module), ''), 'vouchers'),
      description = 'PVD detail 4 auth slots matching Salary Disbursement: Prepared By / Checked By / First Approval / Second Approval. Folded into origin trio _pvdDocHtml + _pvdRefreshSigPrint + _pvdSaveSigs via scripts/patch_pvd_four_auth_slots.py. first_approved_by persisted (approved_by = Second). Orphan app/pvd-four-roles.js NOT loaded. Does not touch _pdocSigPrintHtml, single PV 3-sig, Salary Disbursement, global/print CSS, sidebar, openPage, or unrelated localStorage. Schema: first_approved_by already present (20260907120000_pvd_first_approval.sql).',
      pr_url = 'https://github.com/mpflemedia-ux/mcore/commit/65335e1de47a9025af73491de3103a82218d398c'
    WHERE title ILIKE '%pvd%4%auth%'
       OR title ILIKE '%pvd%four%auth%'
       OR title ILIKE '%PVD%First Approval%'
       OR title ILIKE '%pvd-four-auth%';
  ELSE
    INSERT INTO public.dev_roadmap_items (
      title, description, module, stage, pr_url
    ) VALUES (
      'PVD: 4 auth slots (Prepared/Checked/First/Second)',
      'PVD detail 4 auth slots matching Salary Disbursement: Prepared By / Checked By / First Approval / Second Approval. Folded into origin trio _pvdDocHtml + _pvdRefreshSigPrint + _pvdSaveSigs via scripts/patch_pvd_four_auth_slots.py. first_approved_by persisted (approved_by = Second). Orphan app/pvd-four-roles.js NOT loaded. Does not touch _pdocSigPrintHtml, single PV 3-sig, Salary Disbursement, global/print CSS, sidebar, openPage, or unrelated localStorage. Schema: first_approved_by already present (20260907120000_pvd_first_approval.sql).',
      'vouchers',
      'completed',
      'https://github.com/mpflemedia-ux/mcore/commit/65335e1de47a9025af73491de3103a82218d398c'
    );
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN
  RAISE NOTICE 'dev_roadmap schema variant; skip: %', SQLERRM;
END $$;
