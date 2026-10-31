---
description: M-Core discussion mode — full system audit + 8-point feature audit + ONE ⭐ recommendation. No file changes.
argument-hint: <feature / workprocess / controller / flow>
---
DISCUSSION ONLY sehingga aku kata Proceed. - Jangan tulis kod, SQL, PR, push, atau ubah fail. - Full system audit + feature audit (8 perkara) berdasarkan konteks. - Beri SATU cadangan terbaik sahaja (⭐), ringkas bullet. - ASCII flowchart workflow (termasuk titik notifikasi) dalam code block bila relevan. - Tanya HANYA soalan yang betul-betul block keputusan. - Bila aku setuju arah → tunggu Proceed sebelum build.

Topik: $ARGUMENTS

Ikut CLAUDE.md. Langkah:
1. **Full system audit (read-only)** — grep & baca kod sebenar: `app/index.html`, `app/*.js` berkaitan (termasuk patch module yang wrap function sama), `supabase/*.sql` + `supabase/migrations/` (schema, RLS, RPC). Trace helper kongsi: `_postJournalEntry`, `canAccess()`, `openPage()`, `NT.notify`, `notif-live.js`. Jangan andai dari nama.
2. **Feature audit 8 perkara** (ringkas, hanya yang relevan dengan topik):
   1. Workflow (ASCII flowchart, tanda titik notifikasi 🔔)
   2. Data link (table/field/FK)
   3. Calculation
   4. Section & data mapping
   5. Tenant consistency (tenant_id, RLS)
   6. No regression
   7. UI/UX (token, EN/BM, dark/light, 380px, butang nowrap)
   8. Notification coverage (penerima, actor tak notify diri, tiada amaun dalam push, deep link openPage)
3. **Punca** (kalau bug) — fail:baris sebenar, ayat mudah.
4. **⭐ SATU cadangan** — 2–5 bullet: Apa dia · Kenapa bagus untuk Mike & tenant · Apa yang tak berubah.
5. Soalan — HANYA yang betul-betul block keputusan (atau tiada).
6. Akhiri: `Nak apply → balas Proceed.`

Larangan dalam mode ni: Edit/Write fail, git commit/push, run SQL, buka PR. BM santai (aku/kau), bullet pendek.
