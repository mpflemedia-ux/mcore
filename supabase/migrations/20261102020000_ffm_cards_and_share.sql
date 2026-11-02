-- FFM hub: Products/Stock/Reconciliation tabs → stacked cards (same DK.list engine as
-- Accounting/Sales/Purchases/Ops/Staff; Accounts & Funded tabs already rendered per-account
-- cards, untouched). Reconciliation also gets "Share via WhatsApp" (reuses RPTShare /
-- report_share_links — report_type is a free-text column, no new table/RPC needed).
--
-- Bug fix found while wiring the new FFM share button: _repShareToolbar() (app/index.html)
-- built its onclick="..." attribute with JSON.stringify(title) — which always returns a
-- double-quoted string — nested inside that SAME double-quoted onclick attribute. The
-- browser's HTML parser ends a double-quoted attribute at the first literal `"`, so for
-- every report (Trial Balance, Income Statement, Balance Sheet, SST, Custom Report) the
-- onclick value was silently truncated at RPTShare.share('<type>', (missing title and
-- closing parens) — a JS syntax error on click, so NONE of the 5 existing "Share" buttons
-- actually worked. Fixed by HTML-entity-escaping the embedded quotes (&quot;) so the
-- attribute parses as one value and the browser's own HTML-entity decoding restores the
-- real quotes before the onclick runs as JS. No DB change — JS-only fix, listed here only
-- for the roadmap record.
--
-- Idempotent. Write-only — run in Supabase SQL Editor.

do $$
declare
  pr text := 'https://github.com/mpflemedia-ux/mcore/commits/main';
begin
  insert into public.dev_roadmap_items (title, description, module, stage, pr_url)
  select v.title, v.descr, 'logistics', 'completed', pr
  from (values
    ('FFM Products/Stock/Reconciliation tabs: stacked cards',
     'Converted the three remaining plain-<table> tabs in the FFM hub (Accounts and Funded already rendered per-account cards) to the same DK.list card-stack engine used across Accounting/Sales/Purchases/Ops/Staff (app/dk-ffm.js, new patch module). Products: product name as title, barcode as subtitle, FFM sync status as the card badge, pack size in the expand body. Stock: added one aggregated "Low"/blank status column (any linked FFM account below reorder point) so the collapsed card still flags low stock without opening it — per-account avail/total + M-Core stock move to the expand body (status column auto-detected by header name so it still works regardless of how many FFM accounts are connected). Reconciliation: product as title, the colour-coded +/- difference as the card badge (colour preserved via the same inline style DK already reads for status pills), M-Core qty/FFM total (incl. per-account breakdown) in the expand body.'),
    ('FFM Reconciliation: Share via WhatsApp',
     'Added the same "Share via WhatsApp" + "Manage shared links" buttons already shipped for Income Statement/Balance Sheet/Trial Balance/SST/Custom Report (RPTShare, report_share_links) to the FFM Reconciliation tab — report_type is a free-text column so no schema change was needed, just RPTShare.setSnapshot(''ffm_recon'', {...}) + the existing _repShareToolbar(''ffm_recon'', title) helper. Recipient opens a frozen, point-in-time snapshot (no login) of the day''s product/M-Core/FFM-total/difference table; link expires in 7 days, revocable, Owner/Admin/Manager only — same rules as every other report share.'),
    ('Bug fix: Share-via-WhatsApp button was broken on all 5 existing reports',
     '_repShareToolbar() (app/index.html) nested JSON.stringify(title)''s double quotes inside its own double-quoted onclick="..." attribute, so the browser''s HTML parser truncated the attribute at the first embedded quote — RPTShare.share(''<type>'', was missing its title argument and closing parens, a JS syntax error on click. Found while reusing this helper for the new FFM Reconciliation share button; fixed by HTML-entity-escaping the embedded quotes (&quot;) so the attribute parses as one value. All 5 existing report Share buttons (Trial Balance, Income Statement, Balance Sheet, SST, Custom Report) were silently non-functional until this fix — confirm Share now opens the WhatsApp sheet instead of doing nothing.')
  ) as v(title, descr)
  where not exists (select 1 from public.dev_roadmap_items d where d.title = v.title);

  update public.dev_roadmap_items set stage = 'completed', pr_url = pr
  where title in (
    'FFM Products/Stock/Reconciliation tabs: stacked cards',
    'FFM Reconciliation: Share via WhatsApp',
    'Bug fix: Share-via-WhatsApp button was broken on all 5 existing reports'
  );
exception when undefined_column or undefined_table then
  raise notice 'dev_roadmap schema variant; skip: %', sqlerrm;
end $$;
