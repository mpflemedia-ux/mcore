reset role;

-- Prompt Collections — seed the remaining 12 prompts (fetched verbatim from
-- Mike's own canonical library at m-core-prompt-library-mike-lhjb.pages.grok.bot,
-- rendered via a headless browser since the page's actual content lives in a
-- client-side "shared canvas" iframe that a plain HTTP fetch can't reach).
-- Combined with the 5 already seeded in prompt_collections_01.sql, this
-- brings the collection to the full 17/17 from Mike's library. Nothing here
-- is paraphrased or invented -- every body below is the exact rendered text.
-- Needs prompt_collections_01.sql already run. Write-only, idempotent.

-- Align the title with the library's canonical "(master)" suffix (content
-- already matches verbatim, only the title differed).
update public.prompt_collections set title = 'Proceed — Full engineer ship (master)'
where title = 'Proceed — Full engineer ship';

-- NOTE: 'System prompt — paste ke chat baru' and 'Real-client testing' are
-- NOT seeded here -- both contain Mike's real email and a real tenant UUID,
-- which don't belong in a public repo's permanent git history even though
-- the table itself is platform_admin-only. Given to Mike directly instead,
-- to run manually without ever touching git (see chat reply).

insert into public.prompt_collections (title, description, category, body)
select 'Hard rules checklist (jangan langgar)',
  'Semasa sebarang ubahan kod/SQL — checklist pantas sebelum ship.',
  'standing',
$body$1. Soft delete only (deleted_at). Never hard delete. 2. canAccess() sebelum render; RLS + tenant_id pada setiap table. 3. Compare ID: String(a) === String(b). 4. SQL write-only; idempotent; plain statements; note run order di atas fail. 5. Design tokens / CSS variables sahaja — dilarang hardcode hex/rgb baru. 6. Button label 1 baris (white-space: nowrap); wrap whole button ke baris bawah, bukan wrap teks dalam button. Brand pihak ketiga pada ICON sahaja. 7. i18n EN+BM key baru; semak BM (biasanya lebih panjang) kekal 1 baris dalam button. 8. Light + dark + mobile (~380) + desktop; tiada overflow/horizontal scroll. 9. Mirror app/ dan build/app/; bump ?v= cache-bust. 10. Jangan commit secrets/tokens. 11. Nickname employee = display name di mana implemented — jangan revert ke full name. 12. Edge Functions: beritahu Mike perlu deploy manual; jangan claim live.$body$
where not exists (select 1 from public.prompt_collections where title = 'Hard rules checklist (jangan langgar)');

insert into public.prompt_collections (title, description, category, body)
select 'Bug / layout dari screenshot',
  'Screenshot + ''Ni kenapa?'' / ''Ni terkeluar dari layout'' — fix pantas, minimal discussion.',
  'bug',
$body$Ni kenapa? / Ni terkeluar dari layout. [attach screenshot] Arahan: - Cari root cause dari kod sebenar (bukan andaian). - Fix minimal — jangan refactor besar kecuali perlu. - Ship (push/merge), report sebab dalam plain words + 1 screenshot selepas. - Semak light/dark + mobile/desktop supaya regression tak ada. - Kalau SQL perlu: tulis sahaja, jangan run.$body$
where not exists (select 1 from public.prompt_collections where title = 'Bug / layout dari screenshot');

insert into public.prompt_collections (title, description, category, body)
select 'Generate mock gelap 390 / 1280',
  'Proceed tanpa mockup attached, atau nak tengok UI sebelum build.',
  'ui_mock',
$body$Kau buat imej mock features ni daripada apa yang kau cadangkan, aku nak tengok. Rules: - Dark theme; widths 390 (mobile) dan 1280 (desktop), labelled jelas. - Label data sebagai "Contoh data / Example data". - Ikut design tokens / look M-Core (sidebar/header/warna/font/icon sedia ada) — bukan palette asing. - Jangan render OS/device chrome. - Selepas aku setuju mock → tunggu Proceed untuk build.$body$
where not exists (select 1 from public.prompt_collections where title = 'Generate mock gelap 390 / 1280');

insert into public.prompt_collections (title, description, category, body)
select 'Mockup replication (bila ada mockup)',
  'Mike bagi mockup/screenshot sebagai source of truth untuk build UI.',
  'ui_mock',
$body$Build ikut mockup yang aku bagi. Tambah rules ni pada senior-engineer / Proceed prompt: - Mockup = single source of truth. - Sebelum coding: inventory SETIAP elemen pada setiap screen; note ambiguity + interpretasi yang kau pilih. - Jangan render OS/device chrome. - Bind content ke data sebenar — jangan hardcode sample dalam production UI. - Schema missing → cadang SQL (write-only), jangan invent table diam-diam tanpa SQL. - Theme variable baru: wajib dark + light values; no hardcoded colours. - Icon dari set sedia ada (Tabler ti ti-*). - Feature baru dalam fail kecil ≤12KB; hide sampai SQL run. - Test: mobile + laptop, light+dark, EN+BM. - Report penuh bila siap (ringkasan, SQL, had, langkah test BM, screenshots).$body$
where not exists (select 1 from public.prompt_collections where title = 'Mockup replication (bila ada mockup)');

insert into public.prompt_collections (title, description, category, body)
select 'SQL write-only + System Development',
  'Setiap fasa yang ada migration atau lepas ship UI-only (roadmap upsert).',
  'sql',
$body$SQL rules: - TULIS SAHAJA — jangan run. Aku run manual di Supabase SQL Editor. - Idempotent (if not exists / guarded insert/update). Plain SQL; no CREATE FUNCTION; no $$; no pgcrypto. - Note RUN ORDER di header fail (cth. run after wa_doc_01.sql). - Satu value sensitif / satu langkah copy — tunggu aku reply "dah" sebelum next (lihat prompt Secrets). - Gabung SEMUA SQL fasa dalam SATU code block di ringkasan akhir. Roadmap (wajib selepas ship): update public.dev_roadmap_items set stage = 'completed', module = '<module>', description = coalesce(...) where title = '<Title tepat>'; insert into public.dev_roadmap_items (title, description, module, stage) select '<Title>', '<desc>', '<module>', 'completed' where not exists ( select 1 from public.dev_roadmap_items where title = '<Title>' ); Nota: table guna column stage (bukan status/deleted_at).$body$
where not exists (select 1 from public.prompt_collections where title = 'SQL write-only + System Development');

insert into public.prompt_collections (title, description, category, body)
select 'Notification coverage checklist',
  'Feature ada event orang lain perlu tahu — paste bersama Proceed atau sebagai audit fokus.',
  'notif',
$body$Audit & implement notifikasi ikut sistem sedia ada: 1. Senarai event penting (create/assign/status/approve/reject/komen/mention/due/payment/error). 2. Helper/table SAMA dengan module lain — no parallel mechanism. 3. In-app bell+badge AND push phone. 4. Penerima: role/assignee/approver/owner + canAccess/RLS; skip pelaku; no cross-tenant leak. 5. i18n EN/BM; push tanpa data sensitif berlebihan. 6. Deep link openPage() (app buka dari tutup). 7. 1 event = 1 notif/penerima; no spam. 8. Backfill event lama yang sepatutnya ada notif — senaraikan dalam ringkasan. 9. Test sebenar: push + bell + deep link + badge + mark as read. PA: dapat notif task/request semua tenant. Owner: tenant sendiri.$body$
where not exists (select 1 from public.prompt_collections where title = 'Notification coverage checklist');

insert into public.prompt_collections (title, description, category, body)
select 'Cara reply (jimat usage)',
  'Standing — selalu. Boleh paste reminder bila reply jadi panjang.',
  'comms',
$body$Cara reply: - BM aku/kau, short bullets, lead dengan jawapan. - Jangan re-explain apa aku dah tahu; elak preamble/filler. - Diff/snippet relevan sahaja — bukan kod penuh tak berkaitan. - Link PR/raw/commit: ulang plain text URL (bukan card preview sahaja). - Fail untuk copy-paste: paste kandungan sebenar dalam code block. - Step untuk aku: nama/id/lokasi sebenar — no placeholder kecuali aku kena isi. - Ringkasan Proceed: apa berubah | UI/UX | notif | cara test | SQL satu block | roadmap completed.$body$
where not exists (select 1 from public.prompt_collections where title = 'Cara reply (jimat usage)');

insert into public.prompt_collections (title, description, category, body)
select 'Teks WhatsApp / copy-paste',
  'Mike minta mesej/format untuk copy ke WhatsApp atau mana-mana paste sekali tap.',
  'comms',
$body$Bila aku minta teks untuk WhatsApp / copy-paste: - Letak FULL mesej dalam fenced code block supaya aku copy sekali tap. - Jangan letak dalam prose chat sahaja. - Kalau ada beberapa versi (friendly/firm/final), setiap versi code block berasingan + label pendek.$body$
where not exists (select 1 from public.prompt_collections where title = 'Teks WhatsApp / copy-paste');

insert into public.prompt_collections (title, description, category, body)
select 'Secrets / settings — satu value, tunggu dah',
  'Mike kena isi setting, secret, token, atau nilai copy-paste berturutan.',
  'comms',
$body$Bila aku kena isi nilai (settings/secrets): - Guide step-by-step. - SATU value per code box untuk copy-paste. - Beri SATU langkah pada satu masa. - Tunggu aku confirm "dah" sebelum langkah seterusnya. - Jangan dump semua secret dalam satu mesej. - Jangan commit secret ke repo.$body$
where not exists (select 1 from public.prompt_collections where title = 'Secrets / settings — satu value, tunggu dah');

insert into public.prompt_collections (title, description, category, body)
select 'Self-verify sebelum claim siap',
  'Sebelum ringkasan akhir Proceed — checklist verify.',
  'test',
$body$Sebelum claim siap: - Console check, fetch fail repo, curl/test URL, baca live code — buat sendiri. - Widths: 360/390/412/430/1280/1440 × light/dark × EN/BM (minimum 390 dark). - Owner + PA mode jika relevan. - No horizontal overflow; button teks 1 baris; AA contrast; no pageerror. - Notif: push + bell + deep link bila feature ada event. - Screenshots: shots/<phase><feature><width><theme><lang>.png - Live Pages cache ~10 min; kalau aku nampak lama: close PWA/tab + hard refresh; confirm ?v= pada index.$body$
where not exists (select 1 from public.prompt_collections where title = 'Self-verify sebelum claim siap');

-- System Development
update public.dev_roadmap_items set stage = 'completed', module = 'admin',
  description = 'Admin -> Prompt Collections / Koleksi Prompt: platform_admin-only library of reusable Claude Code prompts (Standing/Build/Discuss/Bug/UI-Mock/SQL/Notif/Comms/Test), searchable, category-filterable, copy-to-clipboard, add/edit in-app (soft delete). Platform-level content (no tenant_id), RLS restricted to platform_admin for both read and write. 15/17 prompts seeded from Mike''s canonical library (verbatim, fetched via headless browser since the source page renders through a client-side iframe); the remaining 2 (System prompt paste-to-new-chat, Real-client testing) contain a real email + tenant UUID and were handed to Mike to run manually rather than committed to the public repo.'
where title = 'Admin: Prompt Collections / Koleksi Prompt';
insert into public.dev_roadmap_items (title, description, module, stage)
select 'Admin: Prompt Collections / Koleksi Prompt',
  'Admin -> Prompt Collections / Koleksi Prompt: platform_admin-only library of reusable Claude Code prompts (Standing/Build/Discuss/Bug/UI-Mock/SQL/Notif/Comms/Test), searchable, category-filterable, copy-to-clipboard, add/edit in-app (soft delete). Platform-level content (no tenant_id), RLS restricted to platform_admin for both read and write. 15/17 prompts seeded from Mike''s canonical library (verbatim, fetched via headless browser since the source page renders through a client-side iframe); the remaining 2 (System prompt paste-to-new-chat, Real-client testing) contain a real email + tenant UUID and were handed to Mike to run manually rather than committed to the public repo.',
  'admin', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Admin: Prompt Collections / Koleksi Prompt');
