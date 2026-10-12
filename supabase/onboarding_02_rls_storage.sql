-- M-Core Onboarding Checklist - part 2/5: helpers, RLS, private storage bucket. Run after part 1.
-- Platform admin = user_profiles.role 'platform_admin' (existing public.is_platform_admin()).
create or replace function public.cob_my_tenant() returns uuid
language sql stable security definer set search_path = public as $$
  select tenant_id from public.user_profiles where id = auth.uid()
$$;
create or replace function public.cob_is_tenant_admin(p_tenant uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_profiles
    where id = auth.uid() and tenant_id = p_tenant and lower(coalesce(role,'')) in ('owner','admin'))
$$;
create or replace function public.cob_can_read(p_tenant uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_platform_admin() or public.cob_is_tenant_admin(p_tenant)
$$;
create or replace function public.cob_can_read_path(p_folder text) returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  if p_folder is null or p_folder !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
  return public.cob_can_read(p_folder::uuid);
end $$;
grant execute on function public.cob_my_tenant(), public.cob_is_tenant_admin(uuid), public.cob_can_read(uuid), public.cob_can_read_path(text) to authenticated;

-- file version number: next per item (versions are kept, never overwritten)
create or replace function public.cob_files_version() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select coalesce(max(version_no), 0) + 1 into new.version_no from public.cob_files where item_id = new.item_id;
  select tenant_id into new.tenant_id from public.cob_items where id = new.item_id;
  new.uploaded_by := auth.uid();
  return new;
end $$;
drop trigger if exists cob_files_version_trg on public.cob_files;
create trigger cob_files_version_trg before insert on public.cob_files for each row execute function public.cob_files_version();

create or replace function public.cob_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
do $$ declare t text; begin
  foreach t in array array['cob_master_versions','cob_master_sections','cob_master_items','cob_checklists','cob_items'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_touch', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.cob_touch()', t || '_touch', t);
  end loop;
end $$;

alter table public.cob_master_versions enable row level security;
alter table public.cob_master_sections enable row level security;
alter table public.cob_master_items enable row level security;
alter table public.cob_checklists enable row level security;
alter table public.cob_items enable row level security;
alter table public.cob_files enable row level security;
alter table public.cob_submissions enable row level security;
alter table public.cob_comments enable row level security;
alter table public.cob_events enable row level security;

-- Master: everyone signed in reads published; platform admin reads/writes all (no hard delete: soft delete only)
drop policy if exists cob_mv_read on public.cob_master_versions;
create policy cob_mv_read on public.cob_master_versions for select to authenticated using (status = 'published' or public.is_platform_admin());
drop policy if exists cob_mv_ins on public.cob_master_versions;
create policy cob_mv_ins on public.cob_master_versions for insert to authenticated with check (public.is_platform_admin());
drop policy if exists cob_mv_upd on public.cob_master_versions;
create policy cob_mv_upd on public.cob_master_versions for update to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
do $$ declare t text; begin
  foreach t in array array['cob_master_sections','cob_master_items'] loop
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_platform_admin() or exists (select 1 from public.cob_master_versions v where v.id = version_id and v.status = ''published''))', t || '_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_ins', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.is_platform_admin())', t || '_ins', t);
    execute format('drop policy if exists %I on public.%I', t || '_upd', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin())', t || '_upd', t);
  end loop;
end $$;

-- Tenant data: owner/admin of that tenant + platform admin read. Writes go through the cob_* RPCs (part 3),
-- except: platform admin may update checklist PIC/target date; tenant admins insert files + comments.
do $$ declare t text; begin
  foreach t in array array['cob_checklists','cob_items','cob_files','cob_submissions','cob_comments'] loop
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.cob_can_read(tenant_id))', t || '_read', t);
  end loop;
end $$;
drop policy if exists cob_checklists_pa_upd on public.cob_checklists;
create policy cob_checklists_pa_upd on public.cob_checklists for update to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
drop policy if exists cob_files_ins on public.cob_files;
create policy cob_files_ins on public.cob_files for insert to authenticated
  with check (exists (select 1 from public.cob_items i where i.id = item_id and public.cob_can_read(i.tenant_id)));
drop policy if exists cob_comments_ins on public.cob_comments;
create policy cob_comments_ins on public.cob_comments for insert to authenticated
  with check (user_id = auth.uid() and public.cob_can_read(tenant_id)
    and exists (select 1 from public.cob_items i where i.id = item_id and i.tenant_id = cob_comments.tenant_id)
    and is_platform = public.is_platform_admin());
drop policy if exists cob_events_read on public.cob_events;
create policy cob_events_read on public.cob_events for select to authenticated using (public.cob_can_read(tenant_id));

-- Private storage: onboarding-docs/{tenant_id}/{item_id}/v{n}-{file}. Insert + read only (versions kept).
insert into storage.buckets (id, name, public, file_size_limit)
values ('onboarding-docs', 'onboarding-docs', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = 10485760;
drop policy if exists cob_docs_read on storage.objects;
create policy cob_docs_read on storage.objects for select to authenticated
  using (bucket_id = 'onboarding-docs' and public.cob_can_read_path((storage.foldername(name))[1]));
drop policy if exists cob_docs_insert on storage.objects;
create policy cob_docs_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'onboarding-docs' and public.cob_can_read_path((storage.foldername(name))[1]));
-- Explicit table privileges (RLS above still decides which rows).
grant select on public.cob_master_versions, public.cob_master_sections, public.cob_master_items, public.cob_checklists, public.cob_items,
  public.cob_files, public.cob_submissions, public.cob_comments, public.cob_events to authenticated;
grant insert, update on public.cob_master_versions, public.cob_master_sections, public.cob_master_items to authenticated;
grant update on public.cob_checklists to authenticated;
grant insert on public.cob_files, public.cob_comments to authenticated;
