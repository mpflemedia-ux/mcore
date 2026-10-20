-- ============================================================================
-- DEMO TENANT — fix: force-delete the 2 broken auth users
-- Run this in Supabase SQL Editor. The raw INSERT into auth.users from Part 1
-- produced rows that are malformed enough that even the Dashboard's own
-- "Delete user" fails ("Database error loading user") - so this deletes them
-- directly via SQL instead, in dependency order (children first).
--
-- Wrapped as a SECURITY DEFINER function (not a plain anonymous DO block):
-- the SQL Editor's session role does not have direct SELECT/DELETE on
-- auth.users (confirmed by the "permission denied for table users" error on
-- the first attempt), the same reason Mike's own register_tenant() etc. are
-- all SECURITY DEFINER functions rather than plain blocks.
--
-- AFTER running this: go to Supabase Dashboard -> Authentication -> Users ->
-- "Add User" and create BOTH accounts fresh there (NOT via SQL this time):
--   demo.owner@mpflemedia.my / password: mcore123 / tick "Auto Confirm User"
--   demo.staff@mpflemedia.my / password: mcore123 / tick "Auto Confirm User"
-- Then copy both new User UIDs and send them back - a follow-up SQL file will
-- re-link user_profiles + the Planner entries to the new UIDs.
-- ============================================================================

-- session role sometimes gets stuck on 'authenticated' instead of 'postgres'
-- in this SQL Editor (seen earlier - RESET ROLE fixed it), which blocks
-- CREATE on schema public. Reset it first so this runs in one shot.
reset role;

create or replace function public._fix_demo_auth_cleanup()
returns jsonb
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid;
  v_owner_id uuid;
  v_staff_id uuid;
begin
  select id into v_tenant_id from tenants where code = 'DEMO';
  select id into v_owner_id from auth.users where email = 'demo.owner@mpflemedia.my';
  select id into v_staff_id from auth.users where email = 'demo.staff@mpflemedia.my';

  -- Planner entries reference the owner's auth id directly
  if v_tenant_id is not null then
    delete from platform_activities where tenant_id = v_tenant_id;
  end if;

  -- user_profiles.id references auth.users(id) - delete explicitly rather
  -- than relying on an assumed ON DELETE CASCADE
  if v_owner_id is not null then
    delete from user_profiles where id = v_owner_id;
  end if;
  if v_staff_id is not null then
    delete from user_profiles where id = v_staff_id;
  end if;

  -- auth internals, children first. Sessions/refresh_tokens deletes are
  -- best-effort (wrapped individually) since neither account ever completed
  -- a successful login - they almost certainly have no rows there anyway,
  -- and the exact column type varies across Supabase versions.
  if v_owner_id is not null then
    delete from auth.identities where user_id = v_owner_id;
    begin delete from auth.sessions where user_id = v_owner_id; exception when others then null; end;
    begin delete from auth.refresh_tokens where user_id = v_owner_id::text; exception when others then null; end;
    delete from auth.users where id = v_owner_id;
  end if;

  if v_staff_id is not null then
    delete from auth.identities where user_id = v_staff_id;
    begin delete from auth.sessions where user_id = v_staff_id; exception when others then null; end;
    begin delete from auth.refresh_tokens where user_id = v_staff_id::text; exception when others then null; end;
    delete from auth.users where id = v_staff_id;
  end if;

  return jsonb_build_object(
    'owner_deleted', v_owner_id is not null,
    'staff_deleted', v_staff_id is not null
  );
end;
$$;

grant execute on function public._fix_demo_auth_cleanup() to authenticated;

select public._fix_demo_auth_cleanup();

-- sanity check: should return 0 rows
select email, id from auth.users where email in ('demo.owner@mpflemedia.my', 'demo.staff@mpflemedia.my');

-- one-off function, no longer needed once the cleanup above has run
drop function if exists public._fix_demo_auth_cleanup();
