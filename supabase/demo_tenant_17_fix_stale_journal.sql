-- ============================================================================
-- DEMO TENANT — PART 17: one-time correction for stale journal entries
--
-- Why: the morning's manual Settings -> Backfill Journals run (before Part
-- 15/16 existed) already posted a journal entry for INV-2601-0001's
-- RM2,500 partial payment. When Part 15 later settled the remaining
-- RM12,500 balance, its self-contained GL auto-poster saw "this invoice
-- already has a journal entry" and skipped it entirely (it checks per
-- invoice, not per payment) - so the new RM12,500 never got posted, and
-- Dashboard Revenue/Net Profit stayed stale.
--
-- Fix: wipe this tenant's journal_entries/journal_lines (safe - every
-- other seeded row is untouched, and reseed_demo_data()'s not-exists
-- guards mean nothing else gets duplicated) and re-run reseed_demo_data(),
-- whose GL auto-post loop will then see a clean slate and post every
-- paid invoice/POS/expense claim correctly in one pass - same as a real
-- Reset Demo Data click would do going forward, since that wipes
-- journal_entries first every time.
-- ============================================================================

reset role;

delete from journal_lines
where tenant_id = (select id from tenants where code = 'DEMO' and is_demo = true);

delete from journal_entries
where tenant_id = (select id from tenants where code = 'DEMO' and is_demo = true);

select public.reseed_demo_data();
