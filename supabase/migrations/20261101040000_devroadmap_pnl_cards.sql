-- Dev roadmap: Income Statement (P&L) mobile card-stack layout -> completed.
-- No schema change needed for this fix (pure UI, app/index.html _pnlLoad()).
-- WRITE-ONLY, rerun-safe.
do $$
declare
  pr text := 'https://github.com/mpflemedia-ux/mcore/commits/main';
  ttl text := 'Reports: Income Statement (P&L) stacked-card layout, no mobile horizontal scroll';
  descr text := 'Income Statement revenue/expense lines were rendered in a <table> wrapped in a min-width:480px + overflow-x:auto div, which forced horizontal scrolling on 380px screens and duplicated the section label as the totals-row label. Replaced with one bordered row-card per account (design tokens only, no library), removed the forced min-width, and labeled totals as "Total Revenue"/"Total Expenses". Print/PDF export and AI Summary unaffected.';
begin
  if exists (select 1 from public.dev_roadmap_items where title = ttl) then
    update public.dev_roadmap_items set stage = 'completed', module = 'accounting', description = descr, pr_url = pr where title = ttl;
  else
    insert into public.dev_roadmap_items (title, description, module, stage, pr_url) values (ttl, descr, 'accounting', 'completed', pr);
  end if;
exception when undefined_column or undefined_table then
  raise notice 'dev_roadmap schema variant; skip: %', sqlerrm;
end $$;
