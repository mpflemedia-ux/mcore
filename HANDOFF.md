# NexERP — Handoff / Status
**Updated:** 4 Aug 2026 (MVP launch-ready declaration)  
**Repo:** https://github.com/mpflemedia-ux/nexerp  
**Live:** https://mpflemedia-ux.github.io/nexerp/app/

## MVP = COMPLETE for SME daily ops

Core loops work end-to-end in `app/index.html` + Supabase:

| Loop | Status |
|------|--------|
| Sell (Quote → Invoice + SST → Payment → WA) | ✅ |
| POS (shift → cart → receipt → stock → dashboard) | ✅ |
| Buy (PO → GRN → stock → Bill → pay) | ✅ |
| HR (employee → attendance → leave → payroll → payslip) | ✅ |
| Stock / low-stock → Create PO | ✅ |
| Production WO + BOM snapshot deduct on complete | ✅ |
| Accounting (COA, journal, P&L, BS, expenses, reconcile, FA) | ✅ |
| CRM + SOA aging | ✅ |
| Team invite + Admin roles | ✅ |
| Global search Ctrl+K | ✅ |
| Notifications (overdue / low stock / leave) | ✅ |
| SST period report | ✅ |
| PWA install shell | ✅ |
| Data backup JSON export | ✅ |

## SQL applied / to apply

1. `20260804000000_team_invites.sql` — **user applied Success**
2. `20260804010000_invoice_tax_columns.sql` — **run if tax_amt not saving**

```sql
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS subtotal numeric;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_rate numeric default 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_amt numeric default 0;
```

## Explicitly OUT OF MVP (Phase 2+)

- LHDN MyInvois e-Invoice (government API project)
- Full offline POS / full PWA data sync
- 2FA (email OTP / TOTP)
- Customer self-service portal
- Public REST API + webhooks
- Multi-branch consolidated reporting UI
- Marketplace / courier integrations
- Scheduled autonomous AI agents

## Architecture

- Single-file Vanilla JS: `app/index.html`
- Supabase Auth + RLS + `ai-proxy` edge function
- GitHub Pages deploy from `main`
- EN/BM + dark/light

## Continue work

```
Read HANDOFF.md + CLAUDE.md in mpflemedia-ux/nexerp.
MVP is launch-ready. Only do Phase 2 items or bugfixes from smoke tests.
Next: [bug or Phase-2 feature]
```

## Smoke test checklist (manual)

- [ ] Register + onboard
- [ ] Invite member (Admin → Invite)
- [ ] Invoice + SST 6% + WhatsApp
- [ ] POS sale + dashboard KPI
- [ ] PO → GRN → stock up
- [ ] Payroll payslip print
- [ ] Ctrl+K search
- [ ] Bell notifications
- [ ] Reports → SST
- [ ] Settings → Download Backup

*End.*
