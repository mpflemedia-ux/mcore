reset role;

-- Admin -> Prompt Collections / Koleksi Prompt: Mike's own library of reusable
-- Claude Code prompts (Standing/Build/Discuss/Bug/UI-Mock/SQL/Notif/Comms/Test),
-- searchable, copy-to-clipboard, add/edit in-app. Platform-level content (no
-- tenant_id) -- mirrors dev_roadmap_items/learning_steps' shape, not a tenant
-- table. Write-only, idempotent. Run once in Supabase SQL Editor.

create table if not exists public.prompt_collections (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 1 and 200),
  description text check (description is null or length(description) <= 500),
  body text not null check (length(body) between 1 and 20000),
  category text not null check (category in ('standing','build','discuss','bug','ui_mock','sql','notif','comms','test')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists promptcoll_category_idx on public.prompt_collections (category) where deleted_at is null;

alter table public.prompt_collections enable row level security;
revoke all on public.prompt_collections from anon;

-- Read AND write restricted to platform_admin only (not "all authenticated") --
-- this holds internal engineering/workflow prompts (architecture hints, SQL
-- patterns, memory/locked-rules references), not public content like
-- learning_steps, so it must not be exposed to ordinary tenant users even
-- though the page itself already gates on isPlatformAdmin() client-side.
drop policy if exists promptcoll_read on public.prompt_collections;
create policy promptcoll_read on public.prompt_collections for select to authenticated using (
  deleted_at is null and exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.role = 'platform_admin'));
drop policy if exists promptcoll_ins on public.prompt_collections;
create policy promptcoll_ins on public.prompt_collections for insert to authenticated with check (
  exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.role = 'platform_admin'));
drop policy if exists promptcoll_upd on public.prompt_collections;
create policy promptcoll_upd on public.prompt_collections for update to authenticated
  using (exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.role = 'platform_admin'))
  with check (exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.role = 'platform_admin'));
-- No delete policy -- soft delete only (update deleted_at), per CLAUDE.md's
-- hard rule ("Soft delete sahaja"). Deliberately NOT copying
-- doDeleteDevRoadmapItem()'s hard sb.from(...).delete() precedent for this
-- new table.

grant select, insert, update on public.prompt_collections to authenticated;

notify pgrst, 'reload schema';

-- Seed: the 5 prompts whose exact body text was verified verbatim this
-- session (PDF export + the "Proceed" ceremony Mike just re-pasted live).
-- The remaining categories (Standing's own "System prompt paste chat baru",
-- Bug, UI/Mock, SQL, Notif, Comms, Test -- 12 prompts per Mike's PDF index)
-- are NOT seeded: their exact text was never captured in this session, so
-- nothing here is guessed or fabricated. Add them via "+ Add Prompt" in the
-- page, or a future session once their exact text is confirmed.
insert into public.prompt_collections (title, description, category, body)
select 'Proceed — Full engineer ship',
  'Koleksi prompt untuk proses pembangunan dan penghantaran penuh engineer.',
  'build',
$body$## 1. Sebelum mula — Full System Audit
Sebelum sentuh mana-mana feature, faham SISTEM PENUH dulu:
- Trace module berkaitan (schema, RLS, shared helpers: _postJournalEntry, canAccess(), openPage(), renderBankRecon(), dsb.)
- Faham hubung silang modul (CRM ↔ Sales ↔ Accounting ↔ Payroll ↔ Projects ↔ Service Desk)
- Fetch & baca kod sebenar — jangan andaikan dari nama function/table
- Audit DESIGN SYSTEM: CSS tokens (primary/secondary/danger/success/bg/surface/border/text/muted); class button (primary/outline/danger/icon) + size/radius/padding/hover/active/disabled; komponen (card, modal, input, textarea, dropdown, badge, tab, toast, empty state, activity/comment, action bar); font/spacing/radius/shadow/icon set; dark/light toggle; i18n EN/BM; breakpoint mobile vs desktop
- Audit SISTEM NOTIFIKASI: table + helper create/hantar; saluran in-app bell+badge & push phone (SW/web push/subscription); penerima via role/assignee/approver/owner/tenant + canAccess/RLS; deep link openPage(); read/unread + preference; senarai event yang SUDAH vs BELUM trigger notif

## 2. Audit Feature Spesifik — cover SEMUA 8
1. Workflow — input→output ASCII flowchart (termasuk titik notifikasi)
2. Data Link — table/field/FK/dependency
3. Calculation — formula betul; tiada double-count / missing case
4. Section & Data Mapping — UI section ↔ data source tepat
5. Tenant Consistency — sama rata semua tenant kecuali by design
6. No Regression — jangan ganggu feature sedia ada
7. UI/UX Consistency — ikut Seksyen 3
8. Notification Coverage — ikut Seksyen 4

## 3. UI/UX Consistency (wajib)
- Warna = token sedia ada sahaja. Dilarang hardcode hex/rgb baru.
- Button pihak ketiga: class sistem; brand colour pada ICON sahaja (kecuali precedent sedia ada).
- Teks button WAJIB 1 baris (white-space: nowrap); width auto ikut kandungan.
- Button tak muat → turun baris bawah (flex-wrap + gap sekata); mobile boleh full-width stack. Badge/status & kawalan lain dalam kumpulan sendiri.
- Background/surface/komponen/tipografi/icon ikut pattern sedia ada — reuse, jangan cipta baru kalau dah wujud.
- Bahasa: i18n EN+BM key baru, naming convention sedia ada; semak 1 baris dalam KEDUA bahasa.
- Dark & light kontras OK; responsive ~380 + desktop; tiada overflow / teks potong / scroll mendatar.
- State hover/active/disabled/loading/empty/error ikut pattern.
- Elemen sedia ada yang off-theme — betulkan sekali; senaraikan dalam ringkasan.

## 4. Notification Coverage (wajib)
- Kenal pasti event: create, assign, status, submit/approve/reject, komen/mention, due/overdue, payment/disbursement, dokumen siap, error.
- Guna helper/table notifikasi SAMA — dilarang mekanisme berasingan.
- Kedua saluran: in-app (bell+badge) DAN push phone.
- Penerima tepat (role/assignee/approver/owner) + canAccess/RLS; pelaku sendiri jangan terima; tiada leak cross-tenant.
- Kandungan i18n EN/BM ringkas; tiada data sensitif berlebihan dalam push (cth. angka gaji penuh).
- Deep link openPage() termasuk dari app tutup.
- Satu event = satu notif per penerima; elak duplikat.
- Feature sedia ada yang sepatutnya ada notif tapi belum — tambah sekali, senaraikan.
- Test sebenar: push + bell + deep link + badge + mark as read.

## 5. Cadangan
Lepas audit, beri SATU cadangan sahaja: paling clean, simple, reliable. Jangan menu opsyen.

## 6. Eksekusi
- Multi-fasa: autonomous sampai habis — jangan stop confirm setiap fasa.
- SQL: tulis sahaja, jangan run — aku run di Supabase SQL Editor.
- PR: buat DAN merge (atau push main bila PR form blocked).
- Self-verify apa yang kau boleh (console, fetch repo, curl, baca live code).
- Link (PR/raw/commit): ulang plain text URL dalam reply.
- Rujuk fail untuk copy-paste: paste kandungan SEBENAR dalam code block, bukan path sahaja.
- Bila aku kena klik/run: step-by-step nama/id/lokasi sebenar — no placeholder.
- Selepas setiap fasa berjaya: update Admin → System Development (dev_roadmap_items) stage='completed' (atau insert baru).

## 7. Reply — jimat usage
- Jangan re-explain; no preamble/filler.
- Bullet ringkas; diff/snippet relevan sahaja.

## 8. Ringkasan akhir
1. Apa berubah — fail, function, table (pendek).
2. UI/UX — class/token/i18n key + elemen diselaraskan (termasuk button 1 baris).
3. Notifikasi — event → penerima → saluran → deep link (+ event lama yang baru ditambah).
4. Cara test — dark/light, EN/BM, mobile/desktop, button 1 baris, notif phone+bell+deep link.
5. SQL — SEMUA fasa dalam SATU code block copy-paste.
6. System Development — item mana completed.$body$
where not exists (select 1 from public.prompt_collections where title = 'Proceed — Full engineer ship');

insert into public.prompt_collections (title, description, category, body)
select 'Bincang dulu — discussion only',
  'Nak audit / cadangan / flow tanpa kod. Guna bila belum ready build.',
  'discuss',
$body$Tak perlu buat apa2 lagi, kita bincang dulu tentang [feature / workprocess / controller / flow]. DISCUSSION ONLY sehingga aku kata Proceed. - Jangan tulis kod, SQL, PR, push, atau ubah fail. - Full system audit + feature audit (8 perkara) berdasarkan konteks. - Beri SATU cadangan terbaik sahaja (⭐), ringkas bullet. - ASCII flowchart workflow (termasuk titik notifikasi) dalam code block bila relevan. - Tanya HANYA soalan yang betul-betul block keputusan. - Bila aku setuju arah → tunggu Proceed sebelum build.$body$
where not exists (select 1 from public.prompt_collections where title = 'Bincang dulu — discussion only');

insert into public.prompt_collections (title, description, category, body)
select 'Cadangan terbaik sahaja (⭐)',
  'Selepas audit, nak 1 arah clear tanpa menu opsyen.',
  'discuss',
$body$Beri aku cadangan tambah baik yang terbaik sahaja, untuk aku dan memudahkan aku dan tenant buat kerja. Peraturan: - SATU cadangan sahaja (⭐). Jangan senarai pelbagai opsyen. - 2–5 bullet: apa, kenapa, apa tak berubah (data/flow/notif kalau UI-only). - Tamat dengan: Nak apply → balas Proceed.$body$
where not exists (select 1 from public.prompt_collections where title = 'Cadangan terbaik sahaja (⭐)');

insert into public.prompt_collections (title, description, category, body)
select 'Cadangan tambahan (bila diminta)',
  'Mike tanya ''ada cadangan tambahan?'' — kemudian barulah list, mark ⭐ top picks.',
  'discuss',
$body$Ada cadangan tambahan? Format reply: - Numbered list, satu baris setiap cadangan + kenapa ia membantu. - Mark top picks dengan ⭐. - Jangan build sehingga aku Proceed (atau Proceed + pilih nombor / "semua").$body$
where not exists (select 1 from public.prompt_collections where title = 'Cadangan tambahan (bila diminta)');

insert into public.prompt_collections (title, description, category, body)
select 'ASCII workflow + A4 PDF',
  'Nak nampak flow penuh sebelum Proceed; atau dokumentasi untuk client/team.',
  'discuss',
$body$Sediakan workflow penuh dalam format ASCII flowchart (code block) DAN A4 PDF. PDF rules: - A4 portrait (landscape hanya kalau terlalu lebar); margin ~8–10 mm; isi penuh page, padat tapi readable. - Monospace; auto-size supaya baris terpanjang tak wrap (min ~6.5 pt); split by phase across pages; jangan potong box. - Header: nama feature, "M-Core", tarikh Asia/Kuala_Lumpur. Footer: "1 / N". White bg, black text. - Re-open PDF untuk confirm nothing cut sebelum hantar. - Include titik notifikasi dalam flowchart.$body$
where not exists (select 1 from public.prompt_collections where title = 'ASCII workflow + A4 PDF');

-- System Development
update public.dev_roadmap_items set stage = 'completed', module = 'admin',
  description = 'Admin -> Prompt Collections / Koleksi Prompt: platform_admin-only library of reusable Claude Code prompts (Standing/Build/Discuss/Bug/UI-Mock/SQL/Notif/Comms/Test), searchable, category-filterable, copy-to-clipboard, add/edit in-app (soft delete). Platform-level content (no tenant_id), RLS restricted to platform_admin for both read and write. New table prompt_collections; new sub-page under Admin (view=prompt-collections, reuses _adminTabs()/renderAdmin() routing). Seeded with 5 prompts whose exact text was verified this session; remaining categories added as their text is confirmed.'
where title = 'Admin: Prompt Collections / Koleksi Prompt';
insert into public.dev_roadmap_items (title, description, module, stage)
select 'Admin: Prompt Collections / Koleksi Prompt',
  'Admin -> Prompt Collections / Koleksi Prompt: platform_admin-only library of reusable Claude Code prompts (Standing/Build/Discuss/Bug/UI-Mock/SQL/Notif/Comms/Test), searchable, category-filterable, copy-to-clipboard, add/edit in-app (soft delete). Platform-level content (no tenant_id), RLS restricted to platform_admin for both read and write. New table prompt_collections; new sub-page under Admin (view=prompt-collections, reuses _adminTabs()/renderAdmin() routing). Seeded with 5 prompts whose exact text was verified this session; remaining categories added as their text is confirmed.',
  'admin', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Admin: Prompt Collections / Koleksi Prompt');
