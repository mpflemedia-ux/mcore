-- Roadmap: platform admin never hard-blocked from Enter tenant (Service Desk consent). WRITE-ONLY, rerun-safe. Plain SQL.
update public.dev_roadmap_items set stage = 'completed', module = 'service_desk',
  description = 'Enter tenant: if client has not enabled Support Access, platform admin gets an EN/BM confirm and enters as before (no module restriction); enter is still logged by enter_support_tenant in Audit Log. With consent: request picker + module restriction; no open request -> confirm instead of block.',
  pr_url = 'https://github.com/mpflemedia-ux/mcore/commit/8e9084d81eed8e9100942d988c78f3fd9878199c'
where title = 'Service Desk: platform admin Enter tenant not blocked by consent';
insert into public.dev_roadmap_items (title, description, module, stage, pr_url)
select 'Service Desk: platform admin Enter tenant not blocked by consent', 'Enter tenant: if client has not enabled Support Access, platform admin gets an EN/BM confirm and enters as before (no module restriction); enter is still logged by enter_support_tenant in Audit Log. With consent: request picker + module restriction; no open request -> confirm instead of block.', 'service_desk', 'completed', 'https://github.com/mpflemedia-ux/mcore/commit/8e9084d81eed8e9100942d988c78f3fd9878199c'
where not exists (select 1 from public.dev_roadmap_items where title = 'Service Desk: platform admin Enter tenant not blocked by consent');
