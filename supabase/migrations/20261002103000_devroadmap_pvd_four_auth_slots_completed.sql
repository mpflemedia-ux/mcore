-- Roadmap: PVD 4 auth slots (Prepared / Checked / First / Second) — Mike unlocked multi
-- WRITE-ONLY — run in Supabase SQL Editor AFTER PR merge + bake.
-- Schema: payment_voucher_batches.first_approved_by already migrated
--   (supabase/migrations/20260907120000_pvd_first_approval.sql). NO new column here.
-- If prod still lacks first_approved_by, Mike may re-run that migration only:
--   ALTER TABLE payment_voucher_batches ADD COLUMN IF NOT EXISTS first_approved_by text;
-- Replace PR_URL_PLACEHOLDER after merge.

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
      pr_url = 'PR_URL_PLACEHOLDER'
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
      'PR_URL_PLACEHOLDER'
    );
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN
  RAISE NOTICE 'dev_roadmap schema variant; skip: %', SQLERRM;
END $$;
