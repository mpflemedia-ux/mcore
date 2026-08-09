# NexERP Handover — Claude Code (2026-08-09)

Live: https://mpflemedia-ux.github.io/nexerp/app/  
Landing: https://mpflemedia-ux.github.io/nexerp/  
Repo: mpflemedia-ux/nexerp · branch `main` · single-file app `app/index.html` (~2MB)

## Stack
- Vanilla JS SPA, Supabase (Auth + Postgres + Edge `ai-proxy`)
- Tenant isolation via `tenant_id` + RLS
- Double-entry: `journal_entries` + `journal_lines` + `default_account_mappings`
- Bilingual EN/BM (DBP), dark/light theme
- GitHub Pages deploy from `main`

---

## DONE (recent + established)

### Platform / UX
- [x] Landing page day/dark mode (`index.html` root, `phion_theme`)
- [x] App intro video: Skip visible, 8s hard dismiss, Esc, session timeout (PR #224)
- [x] Fixed critical `openPage` SyntaxError (closeUserDropdown wrongly in default params) (PR #225)
- [x] User dropdown auto-close (open vs active class bug) (PR #223)
- [x] Dashboard redesign: Revenue/P&L focus, charts, Day/Week/Month/Year + date pickers
- [x] Collection rate = collected/billed (includes unpaid)
- [x] Cost KPI delta inverted (Expenses/Payroll: up=red)
- [x] KPI cards: Revenue, Net P&L, Collected, Rate, Expenses, Overdue, Invoices, POS, Payroll, Customers, Top Product, Top Invoice
- [x] Soft period lock (localStorage; gates journal write)
- [x] Journal reverse entry
- [x] Role permissions (`canAccess`)

### Sales / POS / AR
- [x] paid_amt partial payments; Dashboard sales = Paid+Partial + POS
- [x] Credit notes + migration
- [x] Invoice/Quotation print (company header, signatures)
- [x] Overdue filter + dashboard widget
- [x] Customer SOA + payment history; Supplier SOA
- [x] Soft-delete masters with open-doc warnings

### Purchasing / Stock
- [x] PO status filters + soft-delete
- [x] GRN ↔ PO qty sync harden
- [x] Stock out on POS/invoice; movements filter
- [x] Supplier bill payment + void + journals

### HR / Payroll
- [x] Salary Disbursement print (5/page, signatures, employer contrib, landscape batch)
- [x] Payroll journals + toast if default accounts missing
- [x] Bank name/account on payslip / disbursement

### Accounting
- [x] P&L / BS period labels
- [x] Payment Vouchers (batch + single, print, share)
- [x] Expense claims filters + journal safety
- [x] Admin audit log viewer
- [x] Opening balance / COA / fiscal year tabs exist

### Bank Recon (2026-08-09)
- [x] **Phase 1:** CSV/paste import, MY keyword rules category, fingerprint dedupe, heuristic+AI match, confirm **link only** (no auto journal), localStorage per tenant, back-dated dates kept
- [x] **Phase 2:** AI Refine Other (extra rules + optional `ai-proxy` categorize_bank)
- [x] **Phase 3:** Post Unmatched → Journal (opt-in confirm, cash + GL resolve, period lock, source_table `bank_recon`, skip Owner Drawings & confirmed matches)
- [x] Migration file ready (optional): `supabase/migrations/20260809000000_bank_statement_lines.sql` — **user will run SQL later**
- [ ] PDF bank statement parsers (Maybank/HLB) — **NOT done** (learn from MP WorkSpace)
- [ ] Server-side pattern table / category↔GL map table — localStorage patterns only
- [ ] AI-proxy action `categorize_bank` may need edge function support (graceful fail if missing)

---

## NOT DONE / GAPS (priority for Claude)

### High
1. **PDF bank import** — pdf.js + Maybank/CIMB parsers + dedupe by running balance (see MP WorkSpace `_brParseMaybank`, FIX_MAYBANK_DEDUP.md)
2. **Wire bank lines to Supabase** after user runs migration — replace localStorage primary
3. **e-Invoice MyInvois** compliance (JSON exists partially — verify)
4. **Period lock server-side** (now localStorage only)
5. **Brzky Empire / tenant data quality** — default accounts + payroll journal backfill verification

### Medium
6. Customer statements polish / email-share all docs
7. BOM / manufacturing deeper than product form
8. Fixed assets full lifecycle (list + dep exists)
9. Bank recon: map categories → COA explicitly in Settings UI
10. Favicon / PWA manifest icon size warning

### Low / tech debt
11. Split `app/index.html` monolith when feasible
12. GitHub Pages OIDC deploy flakes (historical)
13. `allowfullscreen` iframe console warning (intro YouTube)

---

## Bank Recon — design rules (do not violate)

1. Match/link first; **never** auto-post journal without user confirm  
2. Confirmed match to invoice/payment = **no second journal** for same money  
3. `txn_date` = bank date (back-dated OK); respect `assertNotPeriodLocked` on post  
4. Fingerprint dedupe on import  
5. Financial reports only move when payment updated or journal posted  

---

## Key files
- `app/index.html` — all app logic  
- `index.html` — Phion landing  
- `supabase/migrations/*`  
- Edge: `ai-proxy` (reconcile_match, etc.)

## Test checklist (user)
- [ ] Dashboard KPIs + range filter + pickers  
- [ ] Bank Recon: import → category → match → confirm  
- [ ] Bank Recon: Refine Other  
- [ ] Bank Recon: Post Unmatched (needs Default Cash account)  
- [ ] Intro Skip / no SyntaxError in console  
- [ ] Run `20260809000000_bank_statement_lines.sql` when ready  

## Recent PR refs (approx)
#212–#225 UX/dashboard/intro; #232 Bank Recon Phase 1; Phase 2–3 on follow-up branch this session
