# NexERP — Handoff Document
**Updated:** 4 Aug 2026 · Branch base: `main`  
**Repo:** https://github.com/mpflemedia-ux/nexerp  
**Live app:** https://mpflemedia-ux.github.io/nexerp/app/  
**Tenant under test:** ATAS ANGIN MY SDN. BHD.

---

## 1. Architecture (must follow)

| Layer | Choice |
|--------|--------|
| Frontend | **Single file** `app/index.html` (~10.5k+ lines) Vanilla JS |
| Backend | Supabase (PostgreSQL + Auth + RLS + Edge `ai-proxy`) |
| Hosting | GitHub Pages |
| AI | Groq via `sb.functions.invoke('ai-proxy', …)` |
| i18n | `LANG` object EN/BM · `APP.language` |
| Theme | CSS vars · `data-theme` / `.dark` |

**Rules (from CLAUDE.md / practice):**
- Always filter by `tenant_id` + soft-delete `deleted_at`
- Prefer vertical slices, not rewrites
- Bilingual labels for every new UI
- PR small, merge to `main` (Pages deploys from main)

---

## 2. What is DONE (real code audit)

### Core ops
- Auth, multi-tenant, onboarding wizard  
- Dashboard KPIs (incl. POS sales), People (attendance today), Recent Activity  
- CRM customers + **SOA + aging** + WhatsApp SOA  
- Sales: Quotation → Invoice → Payment, print, **SST 0/6/8%**, WhatsApp invoice  
- POS: shift, cart, tender/change, receipt, barcode, WhatsApp receipt, stock out  
- Inventory: products, movements, reorder, low-stock → **Create PO**  
- Purchasing: Suppliers, **PO → GRN (stock in) → Supplier Bills**  
- Logistics DO (manual), Production WO (manual, no real BOM deduct)  
- HR: employees, payroll EPF/SOCSO/EIS/PCB, payslip, salary disbursement  
- Attendance + Leave (CRUD / approve basic)  
- Job applicants + AI scan form  
- Accounting: COA, journals, FY, expenses, bank reconcile (AI), fixed assets  
- Reports: P&L, BS, sales report, custom report builder  
- Settings company profile (SST type, SSM, etc.)  
- AI chat + many tools (insight, tax, receipt, fraud, etc.)

### Platform / UX (recent)
- **Admin → Team** (role/status; self row read-only)  
- **Admin → All Clients** (platform emails: mpflemedia/phion)  
- **Team invite** (`team_invites` + RPC `join_tenant_by_invite`) — **SQL migration must be applied**  
- **Global Search** Ctrl/Cmd+K — customers, invoices, quotations, products  
- `last_login` stamp on session load  

### Recent merged PRs (examples)
- WhatsApp share, SST + SOA, purchasing polish, Admin, invite, global search (#93–#99 area)

---

## 3. What is NOT done / weak

| Item | Notes |
|------|--------|
| LHDN MyInvois e-Invoice | Not started (gov API) |
| SST-02 formal report | Invoice SST only |
| 2FA | No |
| Offline POS / PWA | No |
| Vendor feature toggles / billing | Admin clients list only |
| Multi-branch UI | Table may exist; no full product |
| Real BOM auto-deduct | Production is free-text materials |
| Customer portal | No |
| Public API / webhooks | No |
| Scheduled AI agents | No |
| Email auto-send (Resend) | Draft/WA only |
| Invite SQL | Applied by user 4 Aug — confirm on other envs |

---

## 4. Critical ops notes

### Team invite (already coded)
1. Supabase SQL: `supabase/migrations/20260804000000_team_invites.sql`  
2. Admin → Invite member → share link `?invite=TOKEN`  
3. New user Register (invite field auto) → joins tenant  

### Platform admin
- Auto if email contains `mpflemedia` or `phion`  
- Or: `localStorage.setItem('nexerp_platform_admin','1')`  

### GitHub token
- Do **not** commit tokens. Rotate if exposed in chat history.

---

## 5. Recommended next work (priority order)

1. **Smoke-test money loop** on ATAS ANGIN (manual QA)  
   Quote→Invoice+SST→Pay→WA · POS→Dashboard · PO→GRN→stock · Payroll  
2. **SST-02 summary report** (period aggregate tax_amt) — if columns exist  
3. **Notifications** in-app (overdue, low stock) — simple table or derived  
4. **Leave/Attendance** edge cases + payroll link  
5. **e-Invoice** only after product stable (separate project)  

Avoid: marketplace, driver app, full rewrite.

---

## 6. How to continue (Grok or Claude)

```text
You are continuing NexERP (Phion). Read HANDOFF.md and CLAUDE.md first.
Repo: mpflemedia-ux/nexerp — edit app/index.html primarily.
Stack: Vanilla JS single-file + Supabase. Always tenant_id + soft delete + EN/BM.
Do not rewrite modules that already work. Small PRs to main.
Next task: [paste specific task]
```

### Local workflow
```bash
git clone https://github.com/mpflemedia-ux/nexerp.git
cd nexerp
# edit app/index.html
# SQL changes → supabase/migrations/YYYYMMDD_*.sql + run in Supabase SQL editor
```

### Deploy
Push/merge to `main` → GitHub Pages serves `/app/`.

---

## 7. Session state (4 Aug 2026)

- User asked autonomous build until usage limit; handoff MD required.  
- Last feature shipped this session: **Global Search + last_login**.  
- Invite SQL: user reported **Success** on Supabase.  
- Admin self-row: fixed (badges, not dead dropdowns).  

**Suggested first message for next chat:**  
“Read HANDOFF.md — continue with smoke-test fixes / SST-02 report.”

---

*End of handoff.*
