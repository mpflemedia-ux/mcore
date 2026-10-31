---
description: M-Core final summary — 6 parts, all SQL in ONE block, commit URLs plain text.
argument-hint: [optional: fokus / commit range]
---
Tulis final summary untuk Mike (BM santai, aku/kau, bullet pendek). Konteks tambahan: $ARGUMENTS

Kumpul dari kerja sesi ni (`git log`, fail diubah, SQL ditulis). Format TEPAT 6 bahagian:

1. **Perubahan** — fail, function, table (senarai pendek)
2. **UI/UX** — apa nampak berbeza; EN/BM, dark/light, 380px/desktop
3. **Notifikasi** — siapa dapat apa (bell + push), bila, deep link; atau "Tiada perubahan"
4. **Cara test** — langkah sebenar (menu/butang sebenar) untuk sahkan isu asal selesai; guna akaun mikepapa.5701@gmail.com (ATAS ANGIN MY SDN. BHD.) bila perlu; ingatkan hard refresh / tutup-buka app kalau sw bump
5. **SQL** — SEMUA SQL dari semua fasa dalam **SATU** ```sql code block (idempotent, termasuk roadmap). Nyatakan: belum di-run, run di Supabase SQL Editor. Kalau tiada SQL, tulis "Tiada SQL".
6. **System Development** — item `dev_roadmap_items` yang ditanda `completed`

Akhir sekali: ulang URL commit/PR sebagai **plain text** (https://github.com/mpflemedia-ux/mcore/commit/<sha>).
Jangan ulang benda Mike dah tahu; tiada preamble.
