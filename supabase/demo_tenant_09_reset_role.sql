-- ============================================================================
-- DEMO TENANT — reset role (read-only in effect, changes nothing persistent)
-- session_user is 'postgres' but current_user got SET to 'authenticated'
-- somewhere in this SQL Editor session, which lacks CREATE on schema public.
-- This resets the role back for the current session.
-- ============================================================================
reset role;

select current_user, session_user, has_schema_privilege(current_user, 'public', 'CREATE') as can_create_in_public;
