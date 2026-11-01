-- Dev roadmap: Reports module — stacked-card layout across Balance Sheet, Trial Balance,
-- SST Report and Custom Report (Income Statement / P&L done in a prior migration).
-- AR Aging and AP Aging already had DK card treatment (dk-acct.js) — unchanged.
-- No schema change needed (pure UI). WRITE-ONLY, rerun-safe.
do $$
declare
  pr text := 'https://github.com/mpflemedia-ux/mcore/commits/main';
  ttl text := 'Reports: stacked-card layout for Balance Sheet, Trial Balance, SST, Custom Report';
  descr text := 'Extended the Income Statement card-stack fix to the rest of Reports. Balance Sheet (_bsLoad): same row-card treatment per account line, removed forced min-width/horizontal scroll, fixed a real bug where the "As Of: <date>" line showed "undefined: <date>" (the asOf label was missing from _bsLoad''s local t object), and removed a duplicate Total Assets line that repeated the same figure twice. Trial Balance (_tbLoad): row-cards showing Debit/Credit per account. SST Report and Custom Report: registered with the existing DK.list card engine (dk-acct.js) — same mechanism already used for AR/AP Aging, chart of accounts, journal entries etc, so no new UI code was needed, just two new DK.list() calls. Sales Report was already a stat-card grid, left unchanged.';
begin
  if exists (select 1 from public.dev_roadmap_items where title = ttl) then
    update public.dev_roadmap_items set stage = 'completed', module = 'accounting', description = descr, pr_url = pr where title = ttl;
  else
    insert into public.dev_roadmap_items (title, description, module, stage, pr_url) values (ttl, descr, 'accounting', 'completed', pr);
  end if;
exception when undefined_column or undefined_table then
  raise notice 'dev_roadmap schema variant; skip: %', sqlerrm;
end $$;
