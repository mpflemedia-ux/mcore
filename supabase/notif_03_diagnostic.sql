-- READ-ONLY diagnostics. Shows what writes to public.notifications outside the repo, and RLS state.
-- 1) Triggers whose function body mentions notifications
select t.event_object_table as on_table, t.trigger_name, t.action_timing, t.event_manipulation, p.proname as function_name, p.prosecdef as security_definer
from information_schema.triggers t
join pg_trigger tg on tg.tgname = t.trigger_name
join pg_proc p on p.oid = tg.tgfoid
where pg_get_functiondef(p.oid) ilike '%notifications%'
order by 1, 2;
-- 2) All functions (incl. RPCs) that insert into notifications
select n.nspname as schema, p.proname as function_name, p.prosecdef as security_definer
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind = 'f' and pg_get_functiondef(p.oid) ilike '%insert into%notifications%'
order by 2;
-- 3) RLS on/off + existing policies on notifications
select relname, relrowsecurity from pg_class where relname in ('notifications','notification_settings');
select policyname, cmd, roles, qual, with_check from pg_policies where tablename = 'notifications';
-- 4) Volume by kind/category last 7 days
select coalesce(kind,'(none)') kind, coalesce(category,'(none)') category, count(*) from public.notifications
where created_at > now() - interval '7 days' group by 1, 2 order by 3 desc;
