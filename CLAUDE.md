# NexERP — Claude Code Instructions

## Konteks Projek
Multi-tenant SaaS ERP untuk Malaysian SME, di bawah Phion Sdn Bhd (SSM: 202601023064).
Tagline: "ERP Yang Faham Bisnes Anda" | EN: "The ERP That Understands Your Business"

## Stack
- Frontend: Vanilla JS, HTML, CSS — **tiada framework** (jangan cadangkan React/Vue/dll)
- Backend/DB: Supabase (PostgreSQL + Auth + Storage + Realtime), Project ID: wjqhhnjlgoigoagsnsen, Region: Singapore
- Hosting: GitHub Pages — mpflemedia-ux.github.io/nexerp
- Repo: github.com/mpflemedia-ux/nexerp (public), branch aktif: main
- AI: Groq API (llama-3.3-70b-versatile)
- Libs: pdf-lib (PDF), Chart.js (charts), Tabler Icons, font Inter

## Status Semasa (per kod sebenar dalam index.html)
Dah siap/ada function untuk:
- ✅ Auth + App Shell + Sidebar navigation
- ✅ Dashboard (dengan Chart.js — sparkline, growth chart, donut charts)
- ✅ CRM — customer list/form/detail
- ✅ Sales — invoice list/form/detail, quotation list/form
- ✅ POS
- ✅ Inventory — product list/form, stock movements
- ✅ Accounting — Chart of Accounts, Journal Entries, Fiscal Years, Expense Claims
- ✅ Reports — P&L, Balance Sheet, Sales Report
- ✅ Settings

**Known gap:** `canAccess(module)` sekarang **hardcoded return true** untuk semua — permission check belum enforce betul-betul. Jangan assume ini dah selesai; kalau kerja pasal role-based access, ni kena fix dulu.

## Rules Kritikal — JANGAN LANGGAR
- Semua tables WAJIB ada `tenant_id`, semua queries WAJIB filter by tenant_id
- Soft delete sahaja — guna `deleted_at` column, jangan hard delete
- Semua UI text WAJIB ada versi EN + BM (guna pattern `APP.language==='bm' ? {...} : {...}` atau rujuk `LANG[APP.language]`)
- Default language: English, toggle ke BM melalui `toggleLang()`
- Semua PDF WAJIB auto-filename: `[TYPE]-[CODE]-[REFNO]-[DDMMYYYY].pdf`
- Jangan hardcode nama syarikat — guna `APP.tenant.name`
- Jangan render content luar `#main` container
- Guna `canAccess(module, feature)` sebelum render mana-mana page (tapi tengok "known gap" atas)
- Guna `openPage(page, params)` untuk navigation — **jangan** `showPage()`/`renderPage()`
- Guna `String(a)===String(b)` untuk ID comparison — **jangan** `parseInt()` pada ID (boleh jadi string/UUID)
- Ikut naming convention render function sedia ada: `render<Module><View>()` (contoh: `renderCustomerList`, `renderCOAForm`, `renderInvDetail`)

## Struktur Kod Sebenar (index.html)
```js
const APP = {
  tenant: { id, code, name, plan, config },
  user: { id, name, email, role, language, theme },
  tenantConfig: { modules{}, features{}, roles{} },
  language: 'en' | 'bm', theme: 'light' | 'dark', currentPage: null
}

const LANG = { en: {...}, bm: {...} }  // nav, common, dashboard, settings, dll
const NAV_ITEMS = [{ id, icon, label_en, label_bm, module }, ...]
```

### Key Functions (dah wujud — guna/extend, jangan re-invent)
- `canAccess(module)` — permission check (lihat known gap)
- `openPage(page, params={})` — navigation utama, switch-case ke render function
- `formatRM(amount)` — format RM X,XXX.XX (locale ms-MY)
- `formatDate(date)` — format DD/MM/YYYY (locale ms-MY)
- `validateIC(ic)` — regex `/^\d{6}-\d{2}-\d{4}$/`
- `validatePhone(p)` — regex `/^\+601[0-9]-\d{7,8}$/`
- `showToast(msg, type)` — notification
- `auditLog(action, table, id)` — log ke Supabase RPC `log_audit`
- `toggleLang()`, `toggleTheme()`, `applyTheme(t)`

### Bilingual Pattern (guna konsisten)
```js
const t = APP.language === 'bm' ? { key: 'Teks BM' } : { key: 'Text EN' }
// ATAU untuk shared LANG object:
const t = LANG[APP.language].moduleName
```

## Supabase Tables (dah setup)
- Core: plans, tenants, branches, user_profiles, invitations, doc_counters, audit_logs
- CRM: customers, customer_contacts
- Inventory: product_categories, products, warehouses, stock_movements
- Sales: quotations, quotation_items, invoices, invoice_items, payments, payment_allocations
- POS: pos_sessions, pos_transactions, pos_transaction_items
- Accounting: fiscal_years, chart_of_accounts, journal_entries, journal_lines, bank_accounts, fixed_assets, depreciation_schedule, expense_claims, expense_claim_items

## Key RPCs (dah setup dalam Supabase)
- `register_tenant(user_id, name, code, full_name, entity_type, industry, plan_code)`
- `complete_onboarding(tenant_id, company_data, fiscal_year, coa_template)`
- `seed_chart_of_accounts(tenant_id, template)`
- `next_ref_no(doc_type)` — 'INV'|'QUO'|'RCP'|'RCT'|'POS'|'EXP'|'JNL'|'AST'
- `log_audit(action, table_name, record_id, old_data, new_data)`

## Malaysia Standards
- Date: DD/MM/YYYY | Time: 12hr AM/PM | Timezone: GMT+8
- Currency: RM X,XXX.XX | Week start: Monday
- IC format: XXXXXX-XX-XXXX | Phone: +601X-XXXXXXX | Postcode: 5 digit
- SST: 8% | LHDN e-Invoice: optional toggle

## Financial Reporting Standard
MPERS (Malaysia Private Entities Reporting Standard) — Statement of Financial Position, Income Statement, Notes to Account, comparative figures (tahun semasa vs tahun lepas), fixed assets guna straight-line depreciation + NBV schedule.

## Design System
- Primary: #2563EB | Secondary: #7C3AED | Success: #16A34A | Warning: #D97706 | Danger: #DC2626
- Font: Inter | Dark/Light guna CSS variables (`data-theme` attribute)

## Testing / Preview Workflow
Tiada local dev server — perubahan di-test dengan push terus ke GitHub, then verify live di **mpflemedia-ux.github.io/nexerp**. Bila buat perubahan:
1. Commit + push ke branch `main`
2. Tunggu GitHub Pages rebuild (biasanya <1 minit)
3. Refresh mpflemedia-ux.github.io/nexerp untuk verify perubahan
4. Kalau perubahan besar/berisiko (contoh: ubah struktur APP/LANG, ubah auth flow), bagitau dulu sebelum push supaya boleh direview dulu

## Keselamatan API Key
- `SUPABASE_URL` dan `SUPABASE_ANON` key **memang sengaja hardcoded** dalam index.html — ini normal untuk Supabase, sebab anon key direka untuk expose client-side. Proteksi sebenar datang dari **RLS (Row Level Security) policies** kat Supabase DB level, bukan dari sembunyi key ni.
- **PENTING:** sebab tu RLS policies untuk setiap table WAJIB enforce tenant isolation betul-betul — kalau RLS ada gap, satu tenant boleh nampak/edit data tenant lain walaupun app-level check (canAccess, tenant_id filter) dah betul.
- Groq API key **jangan** hardcode terus dalam index.html macam Supabase anon key — key AI provider macam ni ialah secret sebenar (bukan public-facing macam Supabase anon key). Kalau perlu panggil Groq, guna Supabase Edge Function sebagai proxy supaya key tak terdedah kat client.

## Struktur Fail — JANGAN SPLIT
index.html adalah **single-file** (HTML+CSS+JS sekali, macam pattern MP WorkSpace). Jangan cadangkan atau buat refactor ke multiple files, component-based structure, atau framework (React/Vue/dll) walaupun untuk "code cleanliness" — ini rule sengaja, bukan technical debt.

## "Jangan Sentuh" Tanpa Confirm Dulu
Struktur `APP` object dan `LANG` object dipakai across semua module (CRM, Sales, POS, Inventory, Accounting, Reports). Kalau nak ubah struktur asas ni (contoh: tambah/tukar key dalam APP.tenant atau APP.user), kena check dan bagitau impact ke semua module lain dulu sebelum ubah — sebab satu perubahan struktur boleh break banyak render function sekali gus.

## Git
- Commit format: `feat/fix/ui/db/docs: description`
- Repo public — jangan commit API key/secret (selain Supabase anon key yang memang sengaja public) dalam kod

## Bahasa Komunikasi
Bila reply dalam chat/PR description, guna Bahasa Melayu Malaysia — tidak formal tapi sopan, guna "aku/kau".
