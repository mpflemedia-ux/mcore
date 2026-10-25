-- ============================================================================
-- Roadmap: Dashboard card shortcuts chip wrap
-- WRITE ONLY — run in Supabase SQL Editor after deploy. Never auto-executed.
-- ============================================================================

reset role;

update public.dev_roadmap_items set stage = 'completed', module = 'dashboard',
  description = 'Dashboard CARD SHORTCUTS: replace uneven btn wrap with scoped chip/pill flex-wrap (.dash-card-shortcuts + .dash-shortcut-chip). Equal padding/gap, min-height 40px, theme vars (light+dark), EN/BM labels unchanged, scroll targets (_dbScrollToSec) unchanged. No schema/business-logic change. SQL: supabase/dashboard_card_shortcuts_chip_wrap_01.sql.'
where title = 'Dashboard card shortcuts chip wrap';
insert into public.dev_roadmap_items (title, description, module, stage)
select 'Dashboard card shortcuts chip wrap',
  'Dashboard CARD SHORTCUTS: replace uneven btn wrap with scoped chip/pill flex-wrap (.dash-card-shortcuts + .dash-shortcut-chip). Equal padding/gap, min-height 40px, theme vars (light+dark), EN/BM labels unchanged, scroll targets (_dbScrollToSec) unchanged. No schema/business-logic change. SQL: supabase/dashboard_card_shortcuts_chip_wrap_01.sql.',
  'dashboard', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Dashboard card shortcuts chip wrap');
