-- M-Core Projects: Phion task "Follow up Shamsul - login ezBiz & semak nama BABA FOOD GLOBAL" for Ann3. Write-only, rerun-safe.
-- Tenant pinned c40847f5-63c1-49d5-8e28-8eae95f12ed5. Assignee = employee with nickname exactly 'Ann3' (case-insensitive) in that
-- tenant; inserted ONLY if exactly one match (else 0 rows). Project 'Phion Client Follow-up' (kind client) created once if missing.

-- 0) Check first (read-only): must return exactly 1 row.
select id, name, nickname from public.employees
where tenant_id = 'c40847f5-63c1-49d5-8e28-8eae95f12ed5' and deleted_at is null and lower(btrim(nickname)) = 'ann3';

-- 1) Project (once)
insert into public.projects (tenant_id, name, kind)
select 'c40847f5-63c1-49d5-8e28-8eae95f12ed5', 'Phion Client Follow-up', 'client'
where exists (select 1 from public.tenants where id = 'c40847f5-63c1-49d5-8e28-8eae95f12ed5')
  and not exists (select 1 from public.projects where tenant_id = 'c40847f5-63c1-49d5-8e28-8eae95f12ed5' and name = 'Phion Client Follow-up' and deleted_at is null);

-- 2) Task
with e as (select id from public.employees where tenant_id = 'c40847f5-63c1-49d5-8e28-8eae95f12ed5' and deleted_at is null and lower(btrim(nickname)) = 'ann3'),
e1 as (select id from e where (select count(*) from e) = 1),
p as (select id, tenant_id from public.projects where tenant_id = 'c40847f5-63c1-49d5-8e28-8eae95f12ed5' and name = 'Phion Client Follow-up' and deleted_at is null order by created_at limit 1)
insert into public.project_tasks (tenant_id, project_id, title, column_key, tag, assignee_employee_id, start_date, due_date, progress, notes, sort_order, is_important, is_urgent)
select p.tenant_id, p.id, 'Follow up Shamsul: login ezBiz & semak nama BABA FOOD GLOBAL', 'backlog', 'Follow up', e1.id, date '2026-10-13', date '2026-10-16', 0,
'Klien: En. Shamsul. Masalah: lupa ID pengguna / kata laluan ezBiz SSM, dan mahu tahu sama ada masih boleh guna nama perniagaan lama.

Maklumat SSM (salinan sijil dilampirkan dalam Fail projek ini: ssm_baba_food_global.jpg):
- Nama perniagaan: BABA FOOD GLOBAL
- No. pendaftaran: 202403009230 (CA0378378-P)
- Jenis: Pemilikan tunggal
- Alamat: No 10, Jalan LEP 3/12, Taman Lestari Putra, Bandar Putra Permai, 43300 Seri Kembangan, Selangor
- Tarikh mula: 09-01-2024 | Tarikh luput: 08-01-2025 (sudah tamat lebih 1 tahun)
- Aktiviti: Jualan runcit semua jenis makanan dan minuman

Langkah:
1. Dapatkan daripada Shamsul: No. IC (MyKad) dan emel yang didaftarkan di ezBiz (serta no. telefon jika emel sudah tidak aktif).
2. Reset login ezBiz: buka https://ezbiz.ssm.com.my > klik "Lupa ID Pengguna / Kata Laluan" > masukkan No. IC / emel berdaftar > ikut pautan reset yang dihantar ke emel. Jika emel lama tidak boleh diakses, Shamsul perlu hubungi SSM (Careline / kaunter SSM) untuk kemas kini emel.
3. Selepas login, semak status perniagaan BABA FOOD GLOBAL di ezBiz (Senarai perniagaan > status: luput / ditamatkan).
4. Semak ketersediaan nama: di ezBiz guna fungsi semakan nama perniagaan; atau beli carian maklumat di SSM e-Search / e-Info https://www.ssm-einfo.my.
5. Terangkan kepada Shamsul:
   - Pemilikan tunggal yang luput lebih 1 tahun mungkin sudah dianggap ditamatkan dan nama boleh dilepaskan untuk orang lain.
   - Jika status masih "luput" dan nama masih tersedia: boleh perbaharui (renew) di ezBiz, biasanya dikenakan kompaun kerana lewat; atau daftar semula dengan nama yang sama.
   - Jika nama sudah diambil orang lain: perlu pilih nama baharu.
6. Laporkan hasil (status nama, kos/kompaun anggaran, langkah seterusnya) dalam nota tugasan ini dan kepada Mike.

Tarikh akhir: 16/10/2026.', 
  (select coalesce(max(k.sort_order), 0) + 1 from public.project_tasks k where k.project_id = p.id and k.column_key = 'backlog' and k.deleted_at is null), true, false
from p cross join e1
where not exists (select 1 from public.project_tasks k where k.project_id = p.id and k.title = 'Follow up Shamsul: login ezBiz & semak nama BABA FOOD GLOBAL' and k.deleted_at is null);
