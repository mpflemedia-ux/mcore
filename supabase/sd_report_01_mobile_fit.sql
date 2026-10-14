-- Monthly Reports (laporan_bulanan) mobile fit + dark-mode readability — roadmap entry only.
-- WRITE ONLY. Idempotent. No schema change.
insert into public.dev_roadmap_items (title, description, module, stage)
select 'Monthly Reports: mobile fit + dark mode', 'Report pack follows app theme on screen (pdoc preview no longer forces white), Operations shows service names, tables fit card width (no 520px min), content clear of the phone FAB stack. PDF output unchanged.', 'service_desk', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Monthly Reports: mobile fit + dark mode');
