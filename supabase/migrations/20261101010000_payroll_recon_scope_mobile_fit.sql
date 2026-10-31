-- Roadmap only (no data change): Payroll Reconciliation button scoped to HR & Payroll + modal fits phone.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.dev_roadmap_items WHERE title = 'HR: Payroll Reconciliation button scope + mobile modal fit') THEN
    UPDATE public.dev_roadmap_items
       SET stage = 'completed',
           module = 'hr',
           description = 'payroll-recon.js v2: Reconciliation button now only in the HR & Payroll page header (next to Add Employee), injected after renderEmployeeList and removed off-page; old isHrPage() matched the sidebar label "HR & Payroll" on every page (and the phone still ran the cached floating ?v=3). Modal uses .cob-modal/.cob-mbox: title + Close on one row, padded stat cards, table in .cob-scroll; closes on page change/backdrop. Column relabelled Net Pay (value is net_pay). EN/BM labels. payroll-recon.js?v=4, sw v56.'
     WHERE title = 'HR: Payroll Reconciliation button scope + mobile modal fit';
  ELSE
    INSERT INTO public.dev_roadmap_items (title, description, module, stage)
    VALUES (
      'HR: Payroll Reconciliation button scope + mobile modal fit',
      'payroll-recon.js v2: Reconciliation button now only in the HR & Payroll page header (next to Add Employee), injected after renderEmployeeList and removed off-page; old isHrPage() matched the sidebar label "HR & Payroll" on every page (and the phone still ran the cached floating ?v=3). Modal uses .cob-modal/.cob-mbox: title + Close on one row, padded stat cards, table in .cob-scroll; closes on page change/backdrop. Column relabelled Net Pay (value is net_pay). EN/BM labels. payroll-recon.js?v=4, sw v56.',
      'hr',
      'completed'
    );
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN
  RAISE NOTICE 'dev_roadmap schema variant; skip: %', SQLERRM;
END $$;
