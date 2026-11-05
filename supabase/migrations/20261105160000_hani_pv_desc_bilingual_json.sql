-- Hani PV (PV-0002, The Brozkey Club) — description now follows the UI language toggle
-- instead of showing EN+BM mashed together. app/pv-core.js's new X.descText() (and the public
-- sign page's local copy) detect description = JSON {"en":...,"bm":...} and pick the current
-- language; a plain-text description (every other PV) is returned unchanged.
-- Idempotent, write-only — run in Supabase SQL Editor. Safe to re-run.

update public.payment_vouchers
set description = jsonb_build_object(
  'en',
    'PAID — RM1,195.95' || E'\n' ||
    '- Basic: RM900.00' || E'\n' ||
    '- Service commission (41 heads, 5%/head, cap RM10): RM216.50' || E'\n' ||
    '  1xRM25, 27xRM65, 1xRM150, 8xRM349(cap RM10), 3xRM499(cap RM10), 1xRM624(cap RM10)' || E'\n' ||
    '- Product commission (5% x RM1,589 net sales): RM79.45' || E'\n' ||
    '  Moisturizer x7=RM455, Hairmask x4=RM356, Shampoo x2=RM178, Keratin x1=RM600' || E'\n' ||
    E'\n' ||
    'NOT PAID (informational, not in total) — RM199.90' || E'\n' ||
    '- Existing members (status M), 15 heads [s.4]: RM69.15' || E'\n' ||
    '- NM heads, no lead recorded (11/10 x2, 13/10 x2), 4 heads [s.5]: RM13.00' || E'\n' ||
    '- No status & no lead (03/10, 07/10 Haircut RM45), 2 heads [s.6]: RM4.50' || E'\n' ||
    '- No price recorded (13/10 Keratin, 21/10 Haircut), 2 heads [s.7(2)]: RM13.25' || E'\n' ||
    '- KPI/conversion bonus denied [s.7(6)]: RM100.00' || E'\n' ||
    '- Onsite allowance denied [s.7(8)]: RM0.00' || E'\n' ||
    E'\n' ||
    'Period: Oct 2026 · Part-time pay via PV (not Salary Disbursement — no double pay).',
  'bm',
    'DIBAYAR — RM1,195.95' || E'\n' ||
    '- Gaji asas: RM900.00' || E'\n' ||
    '- Komisen servis (41 kepala, 5%/kepala, had RM10): RM216.50' || E'\n' ||
    '  1xRM25, 27xRM65, 1xRM150, 8xRM349(had RM10), 3xRM499(had RM10), 1xRM624(had RM10)' || E'\n' ||
    '- Komisen produk (5% x RM1,589 jualan bersih): RM79.45' || E'\n' ||
    '  Moisturizer x7=RM455, Hairmask x4=RM356, Shampoo x2=RM178, Keratin x1=RM600' || E'\n' ||
    E'\n' ||
    'TIDAK DIBAYAR (makluman, tidak termasuk dalam jumlah) — RM199.90' || E'\n' ||
    '- Ahli sedia ada (status M), 15 kepala [s.4]: RM69.15' || E'\n' ||
    '- Kepala NM, tiada rekod lead (11/10 x2, 13/10 x2), 4 kepala [s.5]: RM13.00' || E'\n' ||
    '- Tiada status & tiada lead (03/10, 07/10 Gunting RM45), 2 kepala [s.6]: RM4.50' || E'\n' ||
    '- Tiada harga direkod (13/10 Keratin, 21/10 Gunting), 2 kepala [s.7(2)]: RM13.25' || E'\n' ||
    '- Bonus KPI/conversion ditolak [s.7(6)]: RM100.00' || E'\n' ||
    '- Elaun onsite ditolak [s.7(8)]: RM0.00' || E'\n' ||
    E'\n' ||
    'Tempoh: Okt 2026 · Gaji separuh masa via PV (bukan Penyaluran Gaji — tiada bayaran berganda).'
)::text,
updated_at = now()
where tenant_id = 'e25d49e8-a982-4b25-a73b-088d97e4e8f4'
  and source = 'svc'
  and source_ref = 'fff40bfb-ae25-49e0-905d-51314cbe21cd'
  and status <> 'void'
  and deleted_at is null;

insert into dev_roadmap_items (id, title, description, module, stage, started_at, completed_at)
select gen_random_uuid(),
  'Payment Vouchers: description follows EN/BM toggle (not fixed bilingual text)',
  'A PV description can now be JSON {"en":...,"bm":...} instead of plain text — app/pv-core.js''s X.descText() (and a local copy in the no-login pv-sign-pub.js) picks the current UI language (APP.language in-app, ?lang= on the public sign page) and falls back to the raw string unchanged for every existing plain-text PV description. Used by in-app PV detail (pv-single.js, pv-cards.js) and both print paths (pv-print.js HTML + PDF).',
  'accounting', 'completed', now(), now()
where not exists (
  select 1 from dev_roadmap_items where title = 'Payment Vouchers: description follows EN/BM toggle (not fixed bilingual text)'
);
