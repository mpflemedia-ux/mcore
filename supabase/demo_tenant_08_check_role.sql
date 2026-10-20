-- ============================================================================
-- DEMO TENANT — role/permission diagnostic (read-only, changes nothing)
-- ============================================================================
select
  current_user,
  session_user,
  current_setting('role') as current_role_setting,
  has_schema_privilege(current_user, 'public', 'CREATE') as can_create_in_public,
  (select rolsuper from pg_roles where rolname = current_user) as is_superuser,
  (select array_agg(rolname) from pg_roles r
     join pg_auth_members m on m.member = r.oid
     join pg_roles g on g.oid = m.roleid
     where r.rolname = current_user) as member_of_roles;
