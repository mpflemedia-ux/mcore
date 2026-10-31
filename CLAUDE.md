# M-Core (NexERP) — Claude Code Instructions

Multi-tenant SaaS ERP untuk SME Malaysia, di bawah Phion Sdn Bhd (SSM: 202601023064).
Tagline: "ERP Yang Faham Bisnes Anda" | EN: "The ERP That Understands Your Business"
Owner: **Mike**. Reply dalam BM santai, guna **aku/kau**, bullet pendek, tiada preamble.

## Stack
- Frontend: Vanilla JS/HTML/CSS — **tiada framework** (jangan cadang React/Vue/dll). Tabler Icons, Inter + Space Grotesk, Chart.js, pdf-lib
- Backend: Supabase (Postgres + Auth + Storage + Realtime + Edge Functions), project `wjqhhnjlgoigoagsnsen` (Singapore)
- Hosting: GitHub Pages, domain **mpflemedia.my** → app di **mpflemedia.my/app/** (repo lama `nexerp` dah tak guna)
- Repo: github.com/mpflemedia-ux/mcore (public), branch `main` (push terus ke main)
- AI: Groq via edge function `ai-proxy` (key tak pernah di client)

## Peta Sistem (kod sebenar)
- `app/index.html` (~2.3 MB) — monolith: APP/LANG, shell, router `openPage()`, kebanyakan render function, payroll (`_calcPayroll`), `_postJournalEntry`, System Development (`renderAdminDevRoadmap`).
- `app/*.js` (~300 fail) — **patch modules** dimuat dengan `<script src="./x.js?v=N">` dalam index.html. Corak: IIFE + guard (`if (window.X) return`), wrap/extend function global sedia ada, feature-detect table (42P01/PGRST205 → senyap, tiada UI).
- `app/sw.js` — service worker, `const CACHE='mcore-shell-vNN'` (bump bila app code berubah).
- Public pages: `app/public.html`, `app/public-sd.html` (Salary Disbursement sign/share), `app/public-pv.html`, `app/dk-public.html`.
- `supabase/*.sql` — SQL feature (contoh `notif_01_redesign.sql`, `sd_approval_01.sql`); `supabase/migrations/<YYYYMMDDHHMMSS>_*.sql` — migration bertimestamp (corak terkini); `supabase/functions/` — edge fns (`ai-proxy`, `push-send`, `ffm-api`, `ffm-cron`, `ffm-webhook`, `send-email`, `telegram-*`, `toyyibpay-*`, `sd-agent`, `sd-result`, `pj-*`, `tiktok-sync`). `supabase/snippets/` = scratch, jangan commit data tenant.

### Modul utama → fail
- **HR & Payroll**: index.html (`renderEmployeeList`, `_calcPayroll` + `_socsoEisBand`, `openPage('hr',{view})`), `hr-profile.js` (dept, kontrak, 3 elaun tetap, cuti), `hr-import.js` (import E1–E6), `employee-*.js`, `leave-*.js`, `ot-payroll-resync.js` (OT approve → `payroll_records.ot_amount`), `payslip-*.js`.
- **Salary Disbursement** (`view:'salary-disbursement'`): `renderSalaryDisbursement` dalam index.html + `sd-signatures.js`, `sd-tools.js`, `sd-print-batch.js`, `sd-approve-pub.js`, `public-sd.html`. Tables: `salary_disbursement_batches`, `sd_approvals`, `sd_sign_links`, `sd_signatures`, `doc_public_links`.
  - ⚠️ Prefix `sd-*.js` juga dipakai **Service Desk** (`window.SD`, `sd-core.js`, `sd-wa-*`, `sd-pub-*`, tables `service_*`). Baca header fail dulu.
- **Accounting**: `_postJournalEntry({description, entryDate, entryType, lines, sourceTable, sourceId, dryRun})`, `journal_entries/journal_lines`, `acc-*.js`, `jnl-*.js`, `reco-*.js`; Payment Vouchers `pv-*.js` (`window.PVX`), `pay-*.js`.
- **CRM / Sales / Inventory / POS**: index.html + `crm-*.js`, `bo-*.js`, `*-table-fit.js`, `pdoc-*.js`.
- **Onboarding checklist**: `onboarding-*.js` (`window.COB`), tables `cob_master_items`, `cob_items` (answers tanpa target column kekal dalam `cob_items.answers`; `cob_allowed_cols()` kawal column tenant yang boleh ditulis).
- **Sales Plan**: `sales-plan-*.js` (12 fail).
- **Notifications**: `notif-core.js` (`window.NT`, `NT.notify`), `notif-live.js` (item live dari source table: leave, OT, SD approvals…), `notif-bell.js`, `notif-page.js`, `notif-push*.js` (Web Push → edge fn `push-send`), `notif-settings.js`. Tables `notifications`, `notification_settings`, `push_subscriptions`.
- **FFM (Flash Fulfillment) connector**: `ffm-core.js`, `ffm-hub.js`, `ffm-po.js`, `ffm-do.js` + edge fns `ffm-*`. Credential write-only ke edge fn.
- **Platform admin / support mode**: `isPlatformAdmin()`, `pa-core.js` (PA Enter, view-only, 60-min idle), `support-tenant.js`, `admin-*.js`.
- **Mobile card kit**: `dk-cards.js` (list table → cards), `dk-*.js`.
- **RBAC**: `role-permissions-sync.js` (lihat bawah).

### Struktur APP / LANG
```js
const APP = { tenant:{id,code,name,plan,config}, user:{id,name,email,role,language,theme},
  tenantConfig:{modules,features,roles}, language:'en'|'bm', theme:'light'|'dark', currentPage }
const LANG = { en:{...}, bm:{...} }
const NAV_ITEMS = [{ id, icon, label_en, label_bm, module }, ...]
```
Jangan ubah struktur asas APP/LANG tanpa audit impak semua modul + bagitau Mike dulu.

### Key functions (guna/extend, jangan re-invent)
- `canAccess(module)`, `canDelete(module)`, `canMutate(module)`, `_rpAllowView(page, view)`, `isPlatformAdmin()`
- `openPage(page, params={})` — navigation & deep link (**jangan** `showPage()`/`renderPage()`)
- `_postJournalEntry(...)`, `NT.notify(o)`, `NT.userForEmp(empId)`
- `formatRM`, `formatDate`, `validateIC` (`/^\d{6}-\d{2}-\d{4}$/`), `validatePhone`, `showToast(msg,type)`, `auditLog(action,table,id)` → RPC `log_audit`
- `toggleLang()`, `toggleTheme()`, `applyTheme(t)`
- RPC: `register_tenant`, `complete_onboarding`, `seed_chart_of_accounts`, `next_ref_no(doc_type)`, `log_audit`, `get_my_role_modules()`, `has_module(text)`

**RBAC (least-privilege):** `canAccess` baca `user_profiles.module_override` → `tenants.config.roles[role]` → `_DEFAULT_ROLE_MODULES`/`RP_ROLE_DEFAULTS`. Owner/admin bypass. Child key (cth `acc_expense`) **tak** elevate parent (`accounting`). Parent key beri semua child view via `allowView`. View tak dipetakan = deny. Delete/void = Owner/Admin sahaja (`canDelete`).

## Peraturan Kerja (WAJIB)
### 1. Full system audit dulu
- Trace modul berkaitan: schema, RLS, helper kongsi (`_postJournalEntry`, `canAccess()`, `openPage()`, `NT.notify`, `notif-live`), dan patch module yang wrap function sama.
- Faham kaitan modul (CRM ↔ Sales ↔ Accounting ↔ Payroll ↔ Notifications) sebelum ubah.
- Baca **kod sebenar** (grep index.html + app/*.js + supabase/*.sql). Jangan andai dari nama function/table.

### 2. Feature audit — 8 perkara
1. **Workflow** — input → output, ASCII flowchart (termasuk titik notifikasi)
2. **Data link** — table/field, FK, dependency
3. **Calculation** — formula betul, tiada double-count / kes tertinggal
4. **Section & data mapping** — UI section ↔ sumber data tepat
5. **Tenant consistency** — sama rata semua tenant kecuali by design/config
6. **No regression** — tak pecahkan feature sedia ada
7. **UI/UX consistency** — token, EN/BM, dark/light, 380px
8. **Notification coverage** — siapa patut dapat bell + push, deep link

### 3. SATU cadangan ⭐ sahaja
Timbang pro/kontra dalam kepala; beri yang paling bersih/simple/reliable. Format (2–5 bullet):
- **Apa dia** · **Kenapa bagus untuk Mike & tenant** · **Apa yang tak berubah**
- Akhiri: `Nak apply → balas Proceed.`

### 4. Discussion mode (template Mike, verbatim)
> DISCUSSION ONLY sehingga aku kata Proceed. - Jangan tulis kod, SQL, PR, push, atau ubah fail. - Full system audit + feature audit (8 perkara) berdasarkan konteks. - Beri SATU cadangan terbaik sahaja (⭐), ringkas bullet. - ASCII flowchart workflow (termasuk titik notifikasi) dalam code block bila relevan. - Tanya HANYA soalan yang betul-betul block keputusan. - Bila aku setuju arah → tunggu Proceed sebelum build.

Bila template ni muncul: **jangan** sentuh fail. Setuju arah ≠ Proceed — tunggu perkataan "Proceed".

### 5. Lepas "Proceed"
- Jalankan **semua fasa sampai habis** secara autonomi — jangan berhenti tanya tiap fasa.
- Self-verify apa yang boleh (baca kod live, test URL, screenshot 380px + desktop, light + dark).
- Lepas setiap fasa: tulis SQL update `dev_roadmap_items` (stage `'completed'`, insert kalau tiada).
- Push ke `main`. PR (kalau guna) — create **dan** merge sendiri.

## Peraturan Engineering
- **Root cause dalam kod sebenar → minimal fix → zero regression.** Jangan refactor benda tak diminta.
- **Jangan split/refactor index.html** atau tukar ke framework. Feature baru/fix besar → patch module kecil `app/<feature>.js` + `<script>` tag dengan `?v=`.
- **SQL: tulis sahaja, JANGAN run.** Idempotent (`IF NOT EXISTS`, `ON CONFLICT`, `DO $$ … $$`, `to_regclass()` guard), semua dalam **SATU** code block. Mike run di Supabase SQL Editor. Simpan juga dalam `supabase/migrations/<timestamp>_<nama>.sql`.
- **tenant_id** wajib dalam setiap table, query (`.eq('tenant_id', APP.tenant.id)`) dan RLS. RLS ialah perlindungan sebenar (anon key memang public).
- **Soft delete** (`deleted_at`) — jangan hard delete (kecuali flow sedia ada yang memang delete, cth payroll record/journal).
- **EN/BM** untuk semua teks UI: `APP.language==='bm' ? 'BM' : 'EN'` atau `LANG[APP.language].x`. Default EN.
- **Design tokens sedia ada sahaja** (tiada hex baru): `--primary`, `--primary-dark`, `--primary-light`, `--on-primary`, `--secondary`, `--success`, `--warning`, `--danger`, `--info`, `--bg`, `--bg-card`, `--bg-sidebar`, `--text`, `--text-2`, `--text-3`, `--text-inv`, `--border`, `--border-2`, `--shadow-sm/--shadow/--shadow-lg`, `--radius-sm/--radius/--radius-lg`, `--font`, `--transition`. Dark override di `[data-theme="dark"]`. Class sedia ada: `.btn .btn-outline .btn-sm`, dll.
- **Butang**: teks satu baris (`white-space:nowrap`), container `flex-wrap:wrap` + gap. Ikon sahaja → ada `title`/aria-label.
- **Check**: dark + light, mobile ~380px + desktop. Tiada label/badge "NEW".
- **Cache bust**: bump `?v=N` pada script yang disentuh + `mcore-shell-vNN` dalam `app/sw.js` setiap kali app code berubah.
- **Notifikasi**: guna helper sama (`NT.notify` / item `notif-live`) → bell in-app + phone push. Penerima betul (role/user), **actor tak notify diri sendiri**, **tiada amaun sensitif (RM/gaji) dalam push**, `link` = deep link `openPage` (`{page, params}`).
- **Rahsia**: key (FFM, Groq, dll) **tak boleh** masuk chat, repo, atau client code — hanya melalui UI Accounts write-only → edge function. Supabase anon key sahaja yang memang public.
- Jangan hardcode nama syarikat (guna `APP.tenant.name`). Render dalam `#main` sahaja. ID compare `String(a)===String(b)` (jangan `parseInt` ID). Naming `render<Module><View>()`.
- **PDF filename**: `[TYPE]-[CODE]-[REFNO]-[DDMMYYYY].pdf`.
- **Bug dari screenshot**: lepas fix, terangkan punca dalam ayat mudah + screenshot selepas fix; check light/dark + mobile/desktop.
- Arahan untuk Mike (klik UI, run SQL): langkah sebenar, nama/id sebenar, tiada placeholder. Bila rujuk fail untuk copy-paste → paste isi sebenar, bukan path sahaja.

## Malaysia Standards
- Tarikh DD/MM/YYYY · masa 12h AM/PM · GMT+8 · RM X,XXX.XX · minggu mula Isnin
- IC XXXXXX-XX-XXXX · telefon +601X-XXXXXXX · poskod 5 digit · SST 8% · LHDN e-Invoice toggle
- Laporan kewangan: MPERS (SOFP, Income Statement, Notes, perbandingan tahun lepas, straight-line depreciation + NBV)

## Testing / Deploy
- Tiada local dev server. Push ke `main` → GitHub Pages rebuild (<1 min) → hard refresh **mpflemedia.my/app/** (SW mungkin perlu tutup/buka app sekali).
- Akaun klien sebenar untuk test: **mikepapa.5701@gmail.com** — ATAS ANGIN MY SDN. BHD. **Jangan cadang buat akaun test baru.**
- Perubahan berisiko (struktur APP/LANG, auth flow, RLS besar) → terangkan impak dulu sebelum push.

## Final Summary (lepas semua fasa) — 6 bahagian
1. **Perubahan** — fail, function, table
2. **UI/UX** — apa nampak berbeza (EN/BM, dark/light, 380px)
3. **Notifikasi** — siapa dapat apa, bila, deep link (atau "tiada perubahan")
4. **Cara test** — langkah ringkas sahkan isu asal selesai
5. **SQL** — SEMUA SQL semua fasa dalam **satu** code block (termasuk roadmap)
6. **System Development** — item `dev_roadmap_items` yang ditanda `completed`

Ulang URL commit/PR sebagai **plain text**.

## Konteks Tenant (tiada data sensitif)
- **ATAS ANGIN MY SDN. BHD.** — akaun klien sebenar Mike (test).
- **Nurbella Empire Sdn Bhd** (Yan, Kedah) — HR: ada department, kebanyakan staf kontrak; Shazwani (Finance & Admin) sahkan data. Data HR diimport Okt 2026.
- **Brzky Empire / KeraVive** — Sales Plan + inventory flow.
- **FFM connector** — ON HOLD (arahan Mike 31.10.2026). Jangan sambung build tanpa arahan.
- IC, akaun bank, key → jangan tulis dalam repo/chat.

## Caveat Diketahui
- PERKESO/EIS: `_socsoEisBand` (siling RM6,000) — sahkan band dengan jadual rasmi PERKESO sebelum ubah apa-apa kiraan.
- `ANNUAL_LEAVE_ENTITLEMENT = 14` masih fallback dalam index.html; per-pekerja guna `employees.annual_leave_days` (`hr-profile.js`).
- Data import Excel: IC hilang leading zero, tarikh jadi teks, day/month tertukar — semak dulu.
- `sd-*` prefix bertindih (Service Desk vs Salary Disbursement).

## Git
- Commit: `feat/fix/ui/db/docs: description`. Repo public — jangan commit secret/data peribadi.
- Slash commands: `.claude/commands/discuss.md`, `proceed.md`, `summary.md`. Versi chat (Grok/Claude chat): `docs/ai/grok-instructions.md`.
