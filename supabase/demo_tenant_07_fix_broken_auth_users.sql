-- ============================================================================
-- DEMO TENANT — fix: force-delete the 2 broken auth users
-- Run this in Supabase SQL Editor. The raw INSERT into auth.users from Part 1
-- produced rows that are malformed enough that even the Dashboard's own
-- "Delete user" fails ("Database error loading user") - so this deletes them
-- directly via SQL instead, in dependency order (children first).
--
-- AFTER running this: go to Supabase Dashboard -> Authentication -> Users ->
-- "Add User" and create BOTH accounts fresh there (NOT via SQL this time):
--   demo.owner@mpflemedia.my / password: mcore123 / tick "Auto Confirm User"
--   demo.staff@mpflemedia.my / password: mcore123 / tick "Auto Confirm User"
-- Then copy both new User UIDs and send them back - a follow-up SQL file will
-- re-link user_profiles + the Planner entries to the new UIDs.
-- ============================================================================

do $$
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
    raise notice 'force-deleted demo.owner@mpflemedia.my (%)', v_owner_id;
  else
    raise notice 'demo.owner@mpflemedia.my not found, nothing to delete';
  end if;

  if v_staff_id is not null then
    delete from auth.identities where user_id = v_staff_id;
    begin delete from auth.sessions where user_id = v_staff_id; exception when others then null; end;
    begin delete from auth.refresh_tokens where user_id = v_staff_id::text; exception when others then null; end;
    delete from auth.users where id = v_staff_id;
    raise notice 'force-deleted demo.staff@mpflemedia.my (%)', v_staff_id;
  else
    raise notice 'demo.staff@mpflemedia.my not found, nothing to delete';
  end if;
end $$;

-- sanity check: both should return 0 rows
select email, id from auth.users where email in ('demo.owner@mpflemedia.my', 'demo.staff@mpflemedia.my');
