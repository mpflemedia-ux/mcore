-- Sales Plan — Targets tab + Weekly report: table layout -> card stack (mobile UX fix).
-- Pure UI/layout change (app/sales-plan-targets.js, app/sales-plan-targets-save.js,
-- app/sales-plan-css2.js, app/sales-plan-report.js) — no schema change needed, this
-- migration only records the System Development roadmap entry.
--
-- Idempotent — write-only, run in Supabase SQL Editor.

insert into dev_roadmap_items (id, title, description, module, stage, started_at, completed_at)
select gen_random_uuid(),
  'Sales Plan: Targets tab + Weekly report — table to card stack (mobile)',
  'Periods & targets / Weekly targets editor (Targets tab) and the Weekly report (Weekly performance / Monthly KPI / Milestones / Stock & financing) now render as stacked cards on screen instead of a fixed-width table that cut off columns on mobile (~380px). Targets editor keeps the same inline-editable inputs (no change to save/totals/validation logic). Weekly report keeps its original table for Print / Save PDF output unchanged (print-only), cards are screen-only.',
  'core', 'completed', now(), now()
where not exists (
  select 1 from dev_roadmap_items where title = 'Sales Plan: Targets tab + Weekly report — table to card stack (mobile)'
);
