-- Learning Center v2 · 01 schema (idempotent, safe to re-run). Run BEFORE lc_02_content.sql.
-- Fixes order_index vs sort_order mismatch by keeping BOTH columns in sync; adds per-step image columns.
alter table public.learning_chapters add column if not exists sort_order int, add column if not exists order_index int, add column if not exists deleted_at timestamptz;
alter table public.learning_lessons  add column if not exists sort_order int, add column if not exists order_index int, add column if not exists deleted_at timestamptz;
alter table public.learning_steps    add column if not exists step_no int, add column if not exists order_index int, add column if not exists deleted_at timestamptz,
  add column if not exists image_path text, add column if not exists image_alt_en text, add column if not exists image_alt_bm text;
update public.learning_chapters set order_index = sort_order where order_index is null and sort_order is not null;
update public.learning_chapters set sort_order = order_index where sort_order is null and order_index is not null;
update public.learning_lessons  set order_index = sort_order where order_index is null and sort_order is not null;
update public.learning_lessons  set sort_order = order_index where sort_order is null and order_index is not null;
update public.learning_steps    set order_index = step_no where order_index is null and step_no is not null;
update public.learning_steps    set step_no = order_index where step_no is null and order_index is not null;
-- read access for signed-in users (global content, not tenant data)
alter table public.learning_chapters enable row level security;
alter table public.learning_lessons  enable row level security;
alter table public.learning_steps    enable row level security;
drop policy if exists lc2_read_chapters on public.learning_chapters;
create policy lc2_read_chapters on public.learning_chapters for select to authenticated using (deleted_at is null);
drop policy if exists lc2_read_lessons on public.learning_lessons;
create policy lc2_read_lessons on public.learning_lessons for select to authenticated using (deleted_at is null);
drop policy if exists lc2_read_steps on public.learning_steps;
create policy lc2_read_steps on public.learning_steps for select to authenticated using (deleted_at is null);
-- platform admins may edit content (direct subquery on user_profiles)
drop policy if exists lc2_pa_write_steps on public.learning_steps;
create policy lc2_pa_write_steps on public.learning_steps for all to authenticated
  using (exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.role = 'platform_admin'))
  with check (exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.role = 'platform_admin'));
