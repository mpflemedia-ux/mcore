-- M-Core: Planner calendar fixes (post PR #998 verification) — roadmap entry only. Rerun-safe. No schema change.
insert into public.dev_roadmap_items (title, description, module, stage)
select 'Planner: calendar hardening (XSS, contrast, i18n, month range)', 'Planner calendar: local escape for chip title/attrs + assignee options (XSS fix), AA contrast for avatar/+N/legend, theme-aware type stripe colours (>=3:1 light+dark), EN/BM i18n keys (dow/more/less/prev/next), no-wrap Show less, debounced resize re-render, tenant_id on user_profiles lookup, calendar fetches visible month by date range (no 200-row cap).', 'core', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Planner: calendar hardening (XSS, contrast, i18n, month range)');
