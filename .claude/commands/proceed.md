---
description: M-Core build mode after Mike says Proceed — run all phases autonomously, test, push main, roadmap SQL, 6-part summary.
argument-hint: <apa yang dipersetujui / skop>
---
Mike dah kata **Proceed**. Skop: $ARGUMENTS

Ikut CLAUDE.md. Jalankan SEMUA fasa sampai habis — jangan berhenti tanya tiap fasa.

1. **Sync**: `git pull origin main`. Pastikan tiada perubahan lain tertimpa.
2. **Rancang fasa** (todo list): P1, P2, … — setiap fasa kecil & boleh diverify.
3. **Setiap fasa**:
   - Root cause / tempat ubah dalam kod sebenar → **minimal change**, zero regression.
   - Logik baru → patch module `app/<feature>.js` (IIFE + guard + feature-detect) atau edit minimum dalam index.html. Jangan split/refactor index.html.
   - tenant_id dalam setiap query/RLS · soft delete `deleted_at` · teks EN/BM · token CSS sedia ada sahaja · butang `nowrap` + container `flex-wrap` · tiada label "NEW".
   - Notifikasi: `NT.notify` / `notif-live` → bell + push, penerima betul, actor tak notify diri, tiada RM/gaji dalam push, `link:{page,params}` deep link.
   - SQL: **tulis sahaja, JANGAN run**, idempotent, simpan `supabase/migrations/<YYYYMMDDHHMMSS>_<nama>.sql`.
   - Roadmap: SQL idempotent `dev_roadmap_items` (title, description, module, stage='completed') — update kalau wujud, insert kalau tiada.
4. **Cache bust**: bump `?v=N` pada setiap script disentuh dalam `app/index.html` + `const CACHE='mcore-shell-vNN'` dalam `app/sw.js` (kalau app code berubah).
5. **Verify**: `node --check` fail JS disentuh; semak light + dark, ~380px + desktop; kalau bug dari screenshot → ambil screenshot selepas fix.
6. **Commit & push** ke `main`: `feat/fix/ui/db/docs: …`. Tiada secret/data peribadi (IC, akaun bank, key) dalam commit.
7. Tamat dengan `/summary` (6 bahagian, semua SQL dalam satu block, URL commit plain text).

Kalau terjumpa blocker sebenar (data hilang, keputusan bisnes) → berhenti dan tanya satu soalan sahaja.
