-- SR Agent RETIRED (Nov 2026, owner request). WRITE-ONLY, rerun-safe. No data deleted (soft-delete rule):
-- switches every agent setting off and records it in System Development. Tables sd_agent_settings / sd_agent_runs are kept
-- as history; the Admin -> Agent tab is removed from the app and Edge Function sd-agent now answers 410 to every call.
update public.sd_agent_settings set enabled = false where enabled is distinct from false;

update public.dev_roadmap_items set stage = 'completed', module = 'core' where title = 'Service Desk: SR Agent retired';
insert into public.dev_roadmap_items (title, description, module, stage)
select 'Service Desk: SR Agent retired', 'External SR Agent (hourly scheduled task) removed at owner request: scheduled task deleted, Edge Function sd-agent replaced by a 410 stub, Admin -> Service Desk -> Agent tab and the "Request redo" button removed, agent settings switched off. Existing AI drafts can still be viewed and sent. Service Requests are handled by staff.', 'core', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Service Desk: SR Agent retired');

select tenant_id, enabled from public.sd_agent_settings;
