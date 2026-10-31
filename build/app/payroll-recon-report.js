/* PAYROLL_RECON_REPORT_V1 — employee salary & statutory reconciliation report (EN/BM, letterhead, print/PDF),
 * saved snapshot, one-time WhatsApp sign link, reset (void), signed list on the employee profile.
 * View: openPage('hr',{view:'payroll-recon-report', emp:<employee id> | id:<report id>, month, year})
 * PRC.reportHtml(snap, lang, opts) is standalone (no APP) — public-recon.html reuses it.
 * Snapshot never holds IC / bank numbers: name, staff_code, position, department, join date only.
 * SQL: supabase/migrations/20261101020200_payroll_recon_reports.sql
 */
(function () {
  var PRC = window.PRC = window.PRC || {};
  if (PRC._reportV1) return;
  PRC._reportV1 = true;

  var MON = {
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    bm: ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember']
  };
  var MS = {
    en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    bm: ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis']
  };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function n2(v) { return Number(v || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function r2(n) { return Math.round(Number(n || 0) * 100) / 100; }
  function per(m, y) { return Number(y) * 12 + Number(m); }
  function ms(lang, m, y) { return MS[lang][(m || 1) - 1] + ' ' + y; }
  function ml(lang, m, y) { return MON[lang][(m || 1) - 1] + ' ' + y; }
  function range(lang, list) {
    if (!list.length) return '—';
    var a = list[0], b = list[list.length - 1];
    return per(a.m, a.y) === per(b.m, b.y) ? ms(lang, a.m, a.y) : ms(lang, a.m, a.y) + ' – ' + ms(lang, b.m, b.y);
  }
  function dmy(iso) { if (!iso) return ''; var d = new Date(iso); if (isNaN(d)) return String(iso); var p = function (x) { return (x < 10 ? '0' : '') + x; }; return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear(); }

  /* ---------- document CSS (paper colours, accent = brand primary) ---------- */
  PRC.reportCss = function () {
    return '.prc-doc{--a:#0E7490;--ink:#0F172A;--mut:#64748B;--line:#E2E8F0;--tint:#E8F4F7;background:#fff;color:var(--ink);font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;font-size:11px;line-height:1.4;max-width:820px;margin:0 auto;border:1px solid var(--line);border-radius:10px;overflow:hidden;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
      '.prc-doc *{box-sizing:border-box}' +
      '.prc-doc .lh{display:flex;align-items:center;gap:12px;background:var(--a);color:#fff;padding:14px 22px}' +
      '.prc-doc .lh img{height:34px;max-width:120px;object-fit:contain;background:#fff;border-radius:6px;padding:2px}' +
      '.prc-doc .lh .lg{width:34px;height:34px;border-radius:6px;background:var(--a);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px}' +
      '.prc-doc .lh .co{flex:1;min-width:0}.prc-doc .lh .cn{font-size:15px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;overflow-wrap:anywhere}' +
      '.prc-doc .lh .cs{font-size:9.5px;color:#CBD5E1;overflow-wrap:anywhere}' +
      '.prc-doc .lh .tag{font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:#CBD5E1;text-align:right;white-space:nowrap}' +
      '.prc-doc .pad{padding:16px 22px 18px}' +
      '.prc-doc .top{display:flex;flex-wrap:wrap;gap:14px 22px;align-items:flex-start;margin-bottom:6px}' +
      '.prc-doc .ttl{flex:1 1 300px;min-width:0}.prc-doc .eyebrow{font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:var(--a);font-weight:700}' +
      '.prc-doc h1{font-size:21px;line-height:1.15;margin:4px 0 4px;color:var(--a);font-weight:800}' +
      '.prc-doc .period{font-size:12px;color:var(--mut)}' +
      '.prc-doc .who{flex:1 1 240px;min-width:0;border-left:2px solid var(--line);padding-left:14px;display:grid;grid-template-columns:auto 1fr;gap:4px 12px;font-size:10.5px}' +
      '.prc-doc .who .k{color:var(--mut);text-transform:uppercase;font-size:8.5px;letter-spacing:.06em;padding-top:2px;white-space:nowrap}.prc-doc .who .v{font-weight:600;overflow-wrap:anywhere}' +
      '.prc-doc h2{font-size:13px;font-weight:800;text-transform:uppercase;margin:16px 0 6px;color:var(--ink);break-after:avoid}' +
      '.prc-doc .tw{overflow-x:auto;-webkit-overflow-scrolling:touch}' +
      '.prc-doc table{width:100%;min-width:0;border-collapse:collapse;font-size:10.5px}' +
      '.prc-doc th{background:var(--tint);color:var(--ink);font-size:8.5px;text-transform:uppercase;letter-spacing:.05em;text-align:left;padding:6px 8px;border-bottom:1px solid #CFE3EA;vertical-align:bottom;white-space:normal;font-weight:700}' +
      '.prc-doc td{padding:5px 8px;border-bottom:1px solid var(--line);vertical-align:top;font-size:inherit;white-space:normal}.prc-doc tbody tr:hover{background:none}' +
      '.prc-doc .r{text-align:right;white-space:nowrap}' +
      '.prc-doc tr.tot td{background:var(--tint);font-weight:800;font-size:11.5px;border-bottom:0}' +
      '.prc-doc tr.tot td.big{font-size:13px}' +
      '.prc-doc .st{font-weight:600;white-space:nowrap}.prc-doc .st.ok{color:#15803D}.prc-doc .st.bad{color:#B91C1C}.prc-doc .st.warn{color:#B45309}.prc-doc .st.mut{color:var(--mut)}' +
      '.prc-doc .note{font-size:10px;color:var(--mut);margin-top:5px}' +
      '.prc-doc .ack{font-size:11px;margin:4px 0 0}' +
      '.prc-doc .sig{display:flex;flex-wrap:wrap;gap:18px 40px;margin-top:16px;break-inside:avoid}' +
      '.prc-doc .sig>div{flex:1 1 220px;min-width:0}' +
      '.prc-doc .sig .lab{font-size:10px;font-weight:800;text-transform:uppercase;color:var(--a);letter-spacing:.04em}' +
      '.prc-doc .sig .box{height:54px;border-bottom:1.5px solid #334155;display:flex;align-items:flex-end}' +
      '.prc-doc .sig .box img{max-height:52px;max-width:200px}.prc-doc .sig .box span{font-size:12px;padding-bottom:4px}' +
      '.prc-doc .sig .nm{font-weight:800;font-size:11.5px;margin-top:4px;text-transform:uppercase}.prc-doc .sig .ps{font-size:10px;color:var(--mut)}' +
      '.prc-doc .ft{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;border-top:1px solid var(--line);margin-top:16px;padding-top:8px;font-size:8.5px;color:var(--mut);letter-spacing:.1em;text-transform:uppercase}' +
      '.prc-doc .void{border:2px solid #B91C1C;color:#B91C1C;font-weight:800;text-align:center;padding:6px;margin-bottom:10px;letter-spacing:.1em}' +
      '@media (max-width:600px){.prc-doc .pad{padding:14px 12px}.prc-doc .lh{padding:12px}.prc-doc .lh .tag{display:none}.prc-doc h1{font-size:18px}.prc-doc .who{border-left:0;padding-left:0;border-top:1px solid var(--line);padding-top:8px}.prc-doc th,.prc-doc td{padding:5px 5px}.prc-doc table{font-size:10px}}' +
      '@media print{.prc-doc{border:0;border-radius:0;max-width:none}.prc-doc .tw{overflow:visible}.prc-doc tr{break-inside:avoid}}';
  };
  function ensureCss() {
    if (document.getElementById('prc-doc-css')) return;
    var s = document.createElement('style'); s.id = 'prc-doc-css'; s.textContent = PRC.reportCss();
    (document.head || document.documentElement).appendChild(s);
  }
  PRC.ensureCss = ensureCss;
  PRC._buildSnap = function (id) { return buildSnap(id); };

  /* ---------- renderer ---------- */
  PRC.reportHtml = function (snap, lang, opts) {
    lang = lang === 'bm' ? 'bm' : 'en';
    opts = opts || {};
    var B = lang === 'bm';
    function T(en, bm) { return B ? bm : en; }
    var s = snap || {}, tn = s.tenant || {}, e = s.emp || {}, rows = s.months || [], tot = s.totals || {}, plan = s.plan;
    var hasUp = rows.some(function (r) { return r.status === 'upcoming'; });
    var past = rows.filter(function (r) { return r.status !== 'upcoming'; });
    var nrRows = past.filter(function (r) { return r.stat_nr; });
    var outRows = past.filter(function (r) { return r.bal > 0.01; });
    var upRows = rows.filter(function (r) { return r.status === 'upcoming'; });
    var stName = {
      settled: [T('Settled', 'Selesai'), 'ok'], partial: [T('Partial', 'Separa'), 'warn'], outstanding: [T('Outstanding', 'Tertunggak'), 'bad'],
      withheld: [T('Statutory not remitted', 'Berkanun belum diremit'), 'bad'], upcoming: [T('Upcoming', 'Akan datang'), 'mut']
    };
    var fromL = s.from ? ml(lang, s.from.m, s.from.y) : '—', toL = s.to ? ml(lang, s.to.m, s.to.y) : '—';
    var h = '<div class="prc-doc">';
    h += '<div class="lh">' + (tn.logo ? '<img src="' + esc(tn.logo) + '" alt="">' : '<div class="lg">' + esc(String(tn.name || '?').charAt(0).toUpperCase()) + '</div>') +
      '<div class="co"><div class="cn">' + esc(tn.name || '') + '</div><div class="cs">' + esc([tn.ssm ? T('SSM ', 'SSM ') + tn.ssm : '', tn.address].filter(Boolean).join(' · ')) + '</div></div>' +
      '<div class="tag">' + esc(T('Employee financial reconciliation', 'Rekonsiliasi kewangan pekerja')) + '</div></div>';
    h += '<div class="pad">';
    if (opts.voided) h += '<div class="void">' + esc(T('VOID — replaced / reset', 'BATAL — diganti / diset semula')) + '</div>';
    h += '<div class="top"><div class="ttl"><div class="eyebrow">' + esc(T('Employee financial reconciliation', 'Rekonsiliasi kewangan pekerja')) + (s.ref_no ? ' · ' + esc(s.ref_no) : '') + '</div>' +
      '<h1>' + esc(T('Salary & Statutory Contribution Reconciliation', 'Rekonsiliasi Gaji & Caruman Berkanun')) + '</h1>' +
      '<div class="period">' + esc(T('Period: ', 'Tempoh: ') + fromL + ' – ' + toL) + '</div></div>' +
      '<div class="who">' +
        '<span class="k">' + esc(T('Employee name', 'Nama pekerja')) + '</span><span class="v">' + esc(e.name || '') + '</span>' +
        (e.staff_code ? '<span class="k">' + esc(T('Staff ID', 'ID staf')) + '</span><span class="v">' + esc(e.staff_code) + '</span>' : '') +
        (e.position ? '<span class="k">' + esc(T('Designation', 'Jawatan')) + '</span><span class="v">' + esc(e.position) + '</span>' : '') +
        '<span class="k">' + esc(T('Company', 'Syarikat')) + '</span><span class="v">' + esc(tn.name || '') + (tn.ssm ? ' (' + esc(tn.ssm) + ')' : '') + '</span>' +
        (e.join_date ? '<span class="k">' + esc(T('Join date', 'Tarikh mula')) + '</span><span class="v">' + esc(dmy(e.join_date)) + '</span>' : '') +
        '<span class="k">' + esc(T('Report date', 'Tarikh laporan')) + '</span><span class="v">' + esc(dmy(s.generated_at)) + '</span>' +
      '</div></div>';

    /* 1. summary */
    var upNet = r2(upRows.reduce(function (a, r) { return a + r.net; }, 0));
    function col(ex, inc) { return '<td class="r">' + ex + '</td>' + (hasUp ? '<td class="r">' + inc + '</td>' : ''); }
    var curL = upRows.length ? ms(lang, upRows[0].m, upRows[0].y) : '';
    h += '<h2>1. ' + esc(T('Summary', 'Ringkasan')) + '</h2><div class="tw"><table><thead><tr><th>' + esc(T('Item', 'Perkara')) + '</th>' +
      (hasUp ? '<th class="r">' + esc(T('Amount (RM)', 'Amaun (RM)')) + '<br>(' + esc(T('excl. ', 'tanpa ') + curL) + ')</th><th class="r">' + esc(T('Amount (RM)', 'Amaun (RM)')) + '<br>(' + esc(T('incl. ', 'termasuk ') + curL) + ')</th>' : '<th class="r">' + esc(T('Amount (RM)', 'Amaun (RM)')) + '</th>') +
      '</tr></thead><tbody>' +
      '<tr><td>' + esc(T('Total gross salary entitlement', 'Jumlah gaji kasar yang layak')) + '</td>' + col(n2(tot.gross_past), n2(tot.gross_all)) + '</tr>' +
      '<tr><td>' + esc(T('Total salary paid (actual cash received)', 'Jumlah gaji dibayar (tunai diterima)')) + '</td>' + col(n2(tot.paid), n2(tot.paid)) + '</tr>' +
      '<tr><td>' + esc(T('Total salary outstanding', 'Jumlah gaji tertunggak') + (outRows.length ? ' (' + range(lang, outRows) + ')' : '')) + '</td>' + col(n2(tot.out), n2(tot.out)) + '</tr>' +
      (hasUp ? '<tr><td>' + esc(curL + T(' salary (upcoming)', ' gaji (akan datang)')) + '</td>' + col('—', n2(upNet)) + '</tr>' : '') +
      '<tr><td>' + esc(T('Deductions not yet remitted', 'Potongan belum diremit') + (nrRows.length ? ' (' + range(lang, nrRows) + ')' : '')) + '</td>' + col(n2(tot.ded_nr), n2(tot.ded_nr)) + '</tr>' +
      '<tr><td>' + esc(T('Employer contributions not yet remitted', 'Caruman majikan belum diremit') + (nrRows.length ? ' (' + range(lang, nrRows) + ')' : '')) + '</td>' + col(n2(tot.er_nr), n2(tot.er_nr)) + '</tr>' +
      '<tr class="tot"><td>' + esc(T('Total unresolved amount', 'Jumlah belum selesai')) + '</td>' + col('<span class="big">' + n2(tot.unresolved_past) + '</span>', '<span class="big">' + n2(tot.unresolved_all) + '</span>') + '</tr>' +
      '</tbody></table></div>';

    /* 2. monthly */
    h += '<h2>2. ' + esc(T('Salary payments reconciliation', 'Rekonsiliasi bayaran gaji')) + '</h2><div class="tw"><table><thead><tr>' +
      '<th>' + esc(T('Month', 'Bulan')) + '</th><th class="r">' + esc(T('Gross (RM)', 'Kasar (RM)')) + '</th><th class="r">' + esc(T('Received (RM)', 'Diterima (RM)')) + '</th>' +
      '<th class="r">' + esc(T('Statutory deducted (RM)', 'Potongan berkanun (RM)')) + '</th><th class="r">' + esc(T('Outstanding (RM)', 'Tertunggak (RM)')) + '</th><th>' + esc(T('Status', 'Status')) + '</th></tr></thead><tbody>' +
      (rows.length ? rows.map(function (r) {
        var st = stName[r.status] || [r.status, ''];
        return '<tr><td style="white-space:nowrap">' + esc(ms(lang, r.m, r.y)) + '</td><td class="r">' + n2(r.gross) + '</td><td class="r">' + n2(r.paid) + (r.arrears > 0 ? '<div class="note">+' + n2(r.arrears) + ' ' + esc(T('arrears', 'tunggakan')) + '</div>' : '') + '</td>' +
          '<td class="r">' + n2(r.stat) + '</td><td class="r">' + (r.status === 'upcoming' ? n2(r.net) : n2(r.bal)) + '</td><td><span class="st ' + st[1] + '">' + esc(st[0]) + '</span>' +
          (r.status !== 'withheld' && r.stat_nr ? '<div class="st bad" style="font-size:9px">' + esc(T('Statutory not remitted', 'Berkanun belum diremit')) + '</div>' : '') + '</td></tr>';
      }).join('') : '<tr><td colspan="6" class="note">' + esc(T('No payroll records in this period.', 'Tiada rekod gaji dalam tempoh ini.')) + '</td></tr>') +
      '<tr class="tot"><td>' + esc(T('Total', 'Jumlah')) + '</td><td class="r">' + n2(tot.gross_all) + '</td><td class="r">' + n2(tot.paid) + '</td><td class="r">' + n2(tot.stat_all) + '</td><td class="r">' + n2(r2(tot.out + upNet)) + '</td><td>—</td></tr>' +
      '</tbody></table></div>';

    /* 3. statutory */
    var items = s.statutory || [];
    h += '<h2>3. ' + esc(T('Statutory items to verify', 'Perkara berkanun untuk disemak')) + '</h2><div class="tw"><table><thead><tr><th>' + esc(T('Item', 'Perkara')) + '</th><th class="r">' + esc(T('Amount (RM)', 'Amaun (RM)')) + '</th><th>' + esc(T('Period', 'Tempoh')) + '</th><th>' + esc(T('Notes', 'Catatan')) + '</th></tr></thead><tbody>' +
      '<tr><td>' + esc(T('Employee deductions (EPF/SOCSO/EIS/PCB) not remitted', 'Potongan pekerja (KWSP/PERKESO/SIP/PCB) belum diremit')) + '</td><td class="r"><b>' + n2(tot.ded_nr) + '</b></td><td>' + esc(range(lang, nrRows)) + '</td><td>' + esc(nrRows.length ? T('Deducted from salary; no paid remittance found for these months', 'Dipotong dari gaji; tiada bayaran remitan ditemui untuk bulan ini') : T('All remitted', 'Semua diremit')) + '</td></tr>' +
      '<tr><td>' + esc(T('Employer contributions (EPF/SOCSO/EIS) not remitted', 'Caruman majikan (KWSP/PERKESO/SIP) belum diremit')) + '</td><td class="r"><b>' + n2(tot.er_nr) + '</b></td><td>' + esc(range(lang, nrRows)) + '</td><td>' + esc(T('Subject to KWSP / PERKESO statement', 'Tertakluk kepada penyata KWSP / PERKESO')) + '</td></tr>' +
      items.map(function (it) {
        return '<tr><td>' + esc((it.ref_no || '') + (it.label ? ' · ' + it.label : '')) + '</td><td class="r">' + n2(it.amount) + '</td><td>' + esc(it.m ? ms(lang, it.m, it.y) : '—') + '</td><td><span class="st ' + (it.paid ? 'ok' : 'mut') + '">' + esc(it.paid ? T('Remitted', 'Diremit') + (it.paid_date ? ' ' + dmy(it.paid_date) : '') : T('Not paid yet', 'Belum dibayar')) + '</span></td></tr>';
      }).join('') +
      '</tbody></table></div>';

    /* 4. repayment plan */
    h += '<h2>4. ' + esc(T('Repayment plan', 'Pelan bayaran balik')) + '</h2>';
    if (plan && plan.status !== 'cancelled') {
      var months = plan.instalment > 0 ? Math.ceil(tot.out / plan.instalment) : 0;
      h += '<div class="tw"><table><tbody>' +
        '<tr><td>' + esc(T('Instalment per month (paid with salary, no EPF/SOCSO/PCB)', 'Ansuran sebulan (dibayar bersama gaji, tiada KWSP/PERKESO/PCB)')) + '</td><td class="r"><b>' + n2(plan.instalment) + '</b></td></tr>' +
        '<tr><td>' + esc(T('Starting from', 'Bermula')) + '</td><td class="r">' + esc(ml(lang, plan.start_month, plan.start_year)) + '</td></tr>' +
        '<tr><td>' + esc(T('Arrears paid to date', 'Tunggakan dibayar setakat ini')) + '</td><td class="r">' + n2(tot.arrears_paid) + '</td></tr>' +
        '<tr><td>' + esc(T('Salary outstanding remaining', 'Baki gaji tertunggak')) + '</td><td class="r">' + n2(tot.out) + '</td></tr>' +
        (months > 0 ? '<tr><td>' + esc(T('Estimated instalments to clear', 'Anggaran bilangan ansuran')) + '</td><td class="r">' + months + '</td></tr>' : '') +
        '</tbody></table></div>';
    } else {
      h += '<div class="note" style="font-size:11px">' + esc(T('No repayment plan has been set yet. Outstanding salary will be settled as agreed in writing.', 'Tiada pelan bayaran balik ditetapkan lagi. Gaji tertunggak akan dijelaskan seperti dipersetujui secara bertulis.')) + '</div>';
    }

    /* 5. totals breakdown */
    h += '<h2>5. ' + esc(T('Total unresolved amounts (breakdown)', 'Jumlah belum selesai (pecahan)')) + '</h2><div class="tw"><table><thead><tr><th>' + esc(T('Component', 'Komponen')) + '</th>' +
      (hasUp ? '<th class="r">' + esc(T('excl. ', 'tanpa ') + curL) + '</th><th class="r">' + esc(T('incl. ', 'termasuk ') + curL) + '</th>' : '<th class="r">' + esc(T('Amount (RM)', 'Amaun (RM)')) + '</th>') + '</tr></thead><tbody>' +
      '<tr><td>' + esc(T('Salary outstanding', 'Gaji tertunggak')) + '</td>' + col(n2(tot.out), n2(tot.out)) + '</tr>' +
      (hasUp ? '<tr><td>' + esc(curL + T(' salary (upcoming)', ' gaji (akan datang)')) + '</td>' + col('—', n2(upNet)) + '</tr>' : '') +
      '<tr><td>' + esc(T('Deductions not yet remitted', 'Potongan belum diremit')) + '</td>' + col(n2(tot.ded_nr), n2(tot.ded_nr)) + '</tr>' +
      '<tr><td>' + esc(T('Employer contributions not yet remitted', 'Caruman majikan belum diremit')) + '</td>' + col(n2(tot.er_nr), n2(tot.er_nr)) + '</tr>' +
      '<tr class="tot"><td>' + esc(T('Total unresolved amount', 'Jumlah belum selesai')) + '</td>' + col('<span class="big">' + n2(tot.unresolved_past) + '</span>', '<span class="big">' + n2(tot.unresolved_all) + '</span>') + '</tr>' +
      '</tbody></table></div>';

    /* 6. acknowledgement */
    var sig = opts.sig || {};
    h += '<h2>6. ' + esc(T('Acknowledgement', 'Pengakuan')) + '</h2>' +
      '<p class="ack">' + esc(T('I acknowledge that I have reviewed this reconciliation of my salary and statutory contributions with ' + (tn.name || 'the company') + ' for the period stated above. Outstanding amounts will be settled under the repayment plan above, or as otherwise agreed in writing.',
        'Saya mengaku telah menyemak rekonsiliasi gaji dan caruman berkanun saya bersama ' + (tn.name || 'syarikat') + ' bagi tempoh di atas. Amaun tertunggak akan dijelaskan mengikut pelan bayaran balik di atas, atau seperti dipersetujui secara bertulis.')) + '</p>' +
      '<div class="note">' + esc(T('Prepared from company payroll records and payment vouchers on ' + dmy(s.generated_at) + '. Figures should be checked against payslips and KWSP / PERKESO / EIS statements.',
        'Disediakan daripada rekod gaji dan baucar bayaran syarikat pada ' + dmy(s.generated_at) + '. Angka perlu disemak dengan slip gaji dan penyata KWSP / PERKESO / SIP.')) + '</div>' +
      '<div class="sig"><div><div class="lab">' + esc(T('Signed by employee', 'Ditandatangani pekerja')) + '</div>' +
        '<div class="box">' + (sig.img ? '<img src="' + esc(sig.img) + '" alt="">' : (sig.name ? '<span>✓ ' + esc(T('Signed electronically', 'Ditandatangani secara elektronik')) + '</span>' : '')) + '</div>' +
        '<div class="nm">' + esc(sig.name || e.name || '') + '</div><div class="ps">' + esc(e.position || '') + '</div></div>' +
        '<div><div class="lab">' + esc(T('Date', 'Tarikh')) + '</div><div class="box"><span>' + esc(sig.at ? dmy(sig.at) : '') + '</span></div><div class="ps">' + esc(T('Signature date', 'Tarikh tandatangan')) + '</div>' +
        (s.prepared_by ? '<div class="ps" style="margin-top:6px">' + esc(T('Prepared by: ', 'Disediakan oleh: ') + s.prepared_by) + '</div>' : '') + '</div></div>' +
      '<div class="ft"><span>' + esc((tn.name || '') + ' / ' + T('Employee reconciliation', 'Rekonsiliasi pekerja')) + '</span><span>' + esc(s.ref_no || T('Draft', 'Draf')) + '</span></div>';
    h += '</div></div>';
    return h;
  };

  /* ================= in-app (needs APP + sb) ================= */
  function U() { return window._prcUtil || null; }
  function isBm() { try { return APP.language === 'bm'; } catch (e) { return false; } }
  function L(en, bm) { return isBm() ? bm : en; }
  function tid() { return window.APP && APP.tenant && APP.tenant.id; }
  function toast(m, t) { try { if (typeof showToast === 'function') showToast(esc(m), t || 'info'); } catch (e) {} }
  function $(id) { return document.getElementById(id); }
  function nowMY() { var d = new Date(Date.now() + 8 * 3600000); return { m: d.getUTCMonth() + 1, y: d.getUTCFullYear() }; }

  async function buildSnap(empId) {
    var t = tid();
    var res = await Promise.all([
      sb.from('employees').select('*').eq('id', empId).eq('tenant_id', t).single(),
      typeof _pdocGetTenant === 'function' ? _pdocGetTenant() : Promise.resolve({ name: APP.tenant.name }),
      sb.from('tenants').select('ssm_no').eq('id', t).single(),
      sb.from('payroll_records').select('*').eq('tenant_id', t).eq('employee_id', empId).order('year').order('month'),
      sb.rpc('payroll_recon_statutory_items', { p_since: null }),
      sb.from('payroll_arrears_plans').select('*').eq('tenant_id', t).eq('employee_id', empId).is('deleted_at', null).order('created_at', { ascending: false }).limit(1)
    ]);
    if (res[0].error) throw res[0].error;
    var e = res[0].data || {}, tn = res[1] || {}, recs = res[3].data || [];
    var statOk = !res[4].error, items = statOk ? (res[4].data || []) : [];
    var paidSet = {};
    items.forEach(function (s) { if (s.paid && s.period_month) paidSet[s.period_year + '-' + s.period_month] = 1; });
    var cur = nowMY(), curP = per(cur.m, cur.y);
    recs = recs.filter(function (r) { return per(r.month, r.year) <= curP; });
    function stat(r) { return r2(Number(r.epf_employee || 0) + Number(r.socso_employee || 0) + Number(r.eis_employee || 0) + Number(r.pcb || 0)); }
    function er(r) { return r2(Number(r.epf_employer || 0) + Number(r.socso_employer || 0) + Number(r.eis_employer || 0)); }
    function nr(r) { return statOk && stat(r) + er(r) > 0 && per(r.month, r.year) < curP && !paidSet[r.year + '-' + r.month]; }
    var firstOut = null;
    recs.forEach(function (r) { var p = per(r.month, r.year); if ((Number(r.balance_outstanding || 0) > 0.01 && p < curP) || nr(r)) { if (firstOut == null || p < firstOut) firstOut = p; } });
    var fromP = firstOut;
    if (fromP == null) {
      var jd = e.join_date ? new Date(e.join_date) : null;
      fromP = jd && !isNaN(jd) ? per(jd.getMonth() + 1, jd.getFullYear()) : (recs[0] ? per(recs[0].month, recs[0].year) : curP);
    }
    var months = recs.filter(function (r) { return per(r.month, r.year) >= fromP; }).map(function (r) {
      var net = r2(r.net_pay), b = r2(r.balance_outstanding), paid = r2(net - b), st = stat(r), p = per(r.month, r.year);
      var status;
      if (p >= curP && paid <= 0.01 && b > 0.01) status = 'upcoming';
      else if (b > 0.01) status = paid > 0.01 ? 'partial' : 'outstanding';
      else status = nr(r) ? 'withheld' : 'settled';
      return { m: Number(r.month), y: Number(r.year), gross: r2(net + st), net: net, paid: paid, arrears: r2(r.arrears_paid), stat: st, er: er(r), bal: b, status: status, stat_nr: nr(r) };
    });
    var past = months.filter(function (r) { return r.status !== 'upcoming'; });
    function sum(list, k) { return r2(list.reduce(function (a, r) { return a + Number(r[k] || 0); }, 0)); }
    var tot = {
      gross_past: sum(past, 'gross'), gross_all: sum(months, 'gross'), paid: sum(months, 'paid'), out: sum(past, 'bal'), stat_all: sum(months, 'stat'),
      ded_nr: sum(past.filter(function (r) { return r.stat_nr; }), 'stat'), er_nr: sum(past.filter(function (r) { return r.stat_nr; }), 'er'),
      arrears_paid: sum(recs, 'arrears_paid')
    };
    var upNet = sum(months.filter(function (r) { return r.status === 'upcoming'; }), 'net');
    tot.unresolved_past = r2(tot.out + tot.ded_nr + tot.er_nr);
    tot.unresolved_all = r2(tot.unresolved_past + upNet);
    var from = months[0] ? { m: months[0].m, y: months[0].y } : { m: ((fromP - 1) % 12) + 1, y: Math.floor((fromP - 1) / 12) };
    var stItems = items.filter(function (s) { return s.period_month && per(s.period_month, s.period_year) >= per(from.m, from.y) && per(s.period_month, s.period_year) <= curP; })
      .map(function (s) { return { ref_no: s.ref_no, label: s.label, amount: r2(s.amount), paid: !!s.paid, paid_date: s.paid_date, m: Number(s.period_month), y: Number(s.period_year) }; })
      .sort(function (a, b) { return per(a.m, a.y) - per(b.m, b.y); });
    var plan = (res[5].data || [])[0] || null;
    var code = String(e.staff_code || 'EMP').replace(/[^A-Za-z0-9-]/g, '').slice(0, 20) || 'EMP';
    var d = new Date(Date.now() + 8 * 3600000), p2 = function (x) { return (x < 10 ? '0' : '') + x; };
    var stamp = d.getUTCFullYear() + p2(d.getUTCMonth() + 1) + p2(d.getUTCDate()) + p2(d.getUTCHours()) + p2(d.getUTCMinutes());
    return {
      v: 1, ref_no: 'REC-' + code + '-' + stamp, generated_at: new Date().toISOString(),
      prepared_by: (APP.user && (APP.user.name || APP.user.email)) || '',
      tenant: { name: tn.name || (APP.tenant && APP.tenant.name) || '', ssm: (res[2].data && res[2].data.ssm_no) || '', address: typeof _pdocAddressLine === 'function' ? _pdocAddressLine(tn) : '', logo: tn.logo_url || '' },
      emp: { id: e.id, name: e.name || '', staff_code: e.staff_code || '', position: e.position || '', department: e.department || '', join_date: e.join_date || null },
      from: from, to: { m: cur.m, y: cur.y }, months: months, statutory: stItems,
      plan: plan ? { instalment: r2(plan.instalment), start_month: plan.start_month, start_year: plan.start_year, status: plan.status } : null,
      totals: tot, stat_ok: statOk
    };
  }

  var V = { snap: null, rep: null, lang: 'en', emp: null, params: {}, sigImg: null };

  var PRC_REPORT = window.PRC_REPORT = window.PRC_REPORT || {};
  PRC_REPORT.renderView = async function (params) {
    params = params || {};
    var main = $('main'); if (!main) return;
    var u = U();
    if (!u || !u.isHR()) { main.innerHTML = '<div class="empty-state"><i class="ti ti-lock"></i><h3>' + esc(L('HR managers only', 'Pengurus HR sahaja')) + '</h3></div>'; return; }
    ensureCss();
    V.params = params; V.rep = null; V.snap = null; V.sigImg = null;
    V.lang = params.lang === 'bm' || params.lang === 'en' ? params.lang : (isBm() ? 'bm' : 'en');
    main.innerHTML = '<div class="prc-empty">' + esc(L('Loading…', 'Memuatkan…')) + '</div>';
    try {
      if (params.id) {
        var q = await sb.from('payroll_recon_reports').select('*').eq('id', params.id).eq('tenant_id', tid()).is('deleted_at', null).single();
        if (q.error) throw q.error;
        V.rep = q.data; V.snap = q.data.snapshot; V.emp = q.data.employee_id;
        if (!params.lang) V.lang = q.data.lang || V.lang;
        if (q.data.sig_path && q.data.status === 'signed') {
          try { var su = await sb.storage.from('doc-files').createSignedUrl(q.data.sig_path, 900); V.sigImg = su && su.data && su.data.signedUrl; } catch (e) {}
        }
      } else if (params.emp) {
        V.emp = params.emp;
        V.snap = await buildSnap(params.emp);
      } else throw new Error(L('No employee selected', 'Tiada pekerja dipilih'));
    } catch (e) { main.innerHTML = '<div class="prc-empty" style="color:var(--danger)">' + esc(L('Error', 'Ralat')) + ': ' + esc(e.message || e) + '</div>'; return; }
    var hist = [];
    try {
      var hq = await sb.from('payroll_recon_reports').select('id,ref_no,status,signer_name,signed_at,created_at').eq('tenant_id', tid()).eq('employee_id', V.emp).is('deleted_at', null).order('created_at', { ascending: false }).limit(10);
      hist = hq.data || [];
    } catch (e) {}
    paintView(hist);
  };

  function statusLine() {
    var r = V.rep;
    if (!r) return L('Draft — not saved yet. Save to keep a copy and share it for signature.', 'Draf — belum disimpan. Simpan untuk menyimpan salinan dan kongsi untuk tandatangan.');
    if (r.status === 'saved') return L('Saved ', 'Disimpan ') + r.ref_no;
    if (r.status === 'shared') return L('Shared for signature — waiting for the employee', 'Dikongsi untuk tandatangan — menunggu pekerja') + ' · ' + r.ref_no;
    if (r.status === 'signed') return L('Signed by ', 'Ditandatangani oleh ') + (r.signer_name || '') + ' · ' + dmy(r.signed_at) + ' · ' + r.ref_no;
    if (r.status === 'void') return L('Void (reset) ', 'Batal (diset semula) ') + r.ref_no;
    return r.status;
  }
  function paintView(hist) {
    var main = $('main'); if (!main) return;
    var r = V.rep, s = V.snap || {}, p = V.params;
    var back = "openPage('hr',{view:'payroll-recon'" + (p.month ? ',month:' + Number(p.month) + ',year:' + Number(p.year) : '') + "})";
    var btns = '<button class="btn btn-outline btn-sm" onclick="_prcRepLang()"><i class="ti ti-language"></i> ' + (V.lang === 'bm' ? 'EN' : 'BM') + '</button>' +
      '<button class="btn btn-outline btn-sm" onclick="_prcRepPrint()"><i class="ti ti-printer"></i> ' + esc(L('Print / Save PDF', 'Cetak / Simpan PDF')) + '</button>';
    if (!r) btns += '<button class="btn btn-outline btn-sm" id="prc-rep-save" onclick="_prcRepSave()"><i class="ti ti-device-floppy"></i> ' + esc(L('Save', 'Simpan')) + '</button>';
    if (!r || r.status === 'saved' || r.status === 'shared') btns += '<button class="btn btn-primary btn-sm" id="prc-rep-share" onclick="_prcRepShare()"><i class="ti ti-brand-whatsapp"></i> ' + esc(L('Share for signature', 'Kongsi untuk tandatangan')) + '</button>';
    if (r && (r.status === 'saved' || r.status === 'shared')) btns += '<button class="btn btn-outline btn-sm" onclick="_prcRepCopy()"><i class="ti ti-link"></i> ' + esc(L('Copy link', 'Salin pautan')) + '</button>';
    if (r && (r.status === 'shared' || r.status === 'signed')) btns += '<button class="btn btn-outline btn-sm" style="color:var(--danger)" onclick="_prcRepReset()"><i class="ti ti-rotate"></i> ' + esc(L('Reset', 'Set semula')) + '</button>';
    if (r && r.status === 'void') btns += '<button class="btn btn-primary btn-sm" onclick="openPage(\'hr\',{view:\'payroll-recon-report\',emp:\'' + esc(r.employee_id) + '\'})"><i class="ti ti-refresh"></i> ' + esc(L('New report', 'Laporan baru')) + '</button>';
    var icon = !r ? 'ti-pencil' : r.status === 'signed' ? 'ti-circle-check" style="color:var(--success)' : r.status === 'void' ? 'ti-ban" style="color:var(--danger)' : 'ti-clock';
    var histHtml = hist.filter(function (h) { return !r || h.id !== r.id; }).slice(0, 6).map(function (h) {
      return '<div class="prc-row"><span class="k"><a class="prc-link" onclick="openPage(\'hr\',{view:\'payroll-recon-report\',id:\'' + esc(h.id) + '\'})">' + esc(h.ref_no) + '</a></span><span class="v" style="font-weight:500;color:var(--text-3)">' + esc(repStatus(h)) + '</span></div>';
    }).join('');
    main.innerHTML =
      '<div class="page-header no-print"><div>' +
        '<div class="page-title">' + esc(L('Reconciliation report', 'Laporan rekonsiliasi')) + '</div>' +
        '<div class="prc-back" onclick="' + back + '">← ' + esc(L('Reconciliation', 'Rekonsiliasi')) + '</div>' +
      '</div><div class="prc-hacts">' + btns + '</div></div>' +
      '<div class="prc-bar no-print"><div class="msg"><i class="ti ' + icon + '"></i> ' + esc(statusLine()) + '</div></div>' +
      (histHtml ? '<div class="card no-print" style="padding:10px 12px;margin-bottom:12px"><div class="prc-cap" style="margin-top:0">' + esc(L('Other reports for this employee', 'Laporan lain untuk pekerja ini')) + '</div>' + histHtml + '</div>' : '') +
      '<div id="prc-doc-host">' + PRC.reportHtml(s, V.lang, { voided: r && r.status === 'void', sig: r && r.status === 'signed' ? { name: r.signer_name, at: r.signed_at, img: V.sigImg } : null }) + '</div>';
  }
  function repStatus(h) {
    return { saved: L('Saved', 'Disimpan'), shared: L('Waiting signature', 'Menunggu tandatangan'), signed: L('Signed', 'Ditandatangani') + (h.signed_at ? ' ' + dmy(h.signed_at) : ''), void: L('Void', 'Batal') }[h.status] || h.status;
  }

  window._prcRepLang = function () { V.lang = V.lang === 'bm' ? 'en' : 'bm'; paintView([]); };
  window._prcRepPrint = function () {
    var s = V.snap || {};
    try { if (typeof _pdocSetPageOrientation === 'function') _pdocSetPageOrientation('portrait'); } catch (e) {}
    var d = new Date(), p2 = function (x) { return (x < 10 ? '0' : '') + x; };
    try { if (typeof _pdocSetPrintFilename === 'function') _pdocSetPrintFilename('REC-' + ((s.emp && s.emp.staff_code) || 'EMP') + '-' + (s.ref_no || 'DRAFT').replace(/^REC-[^-]*-/, '') + '-' + p2(d.getDate()) + p2(d.getMonth() + 1) + d.getFullYear()); } catch (e) {}
    setTimeout(function () { window.print(); }, 60);
  };
  async function saveRep() {
    if (V.rep) return V.rep;
    var s = V.snap;
    var q = await sb.from('payroll_recon_reports').insert({
      tenant_id: tid(), employee_id: V.emp, ref_no: s.ref_no, lang: V.lang, snapshot: s, status: 'saved', created_by: APP.user && APP.user.id,
      period_from: s.from ? s.from.y + '-' + (s.from.m < 10 ? '0' : '') + s.from.m + '-01' : null,
      period_to: s.to ? s.to.y + '-' + (s.to.m < 10 ? '0' : '') + s.to.m + '-01' : null
    }).select('*').single();
    if (q.error) throw q.error;
    V.rep = q.data;
    try { if (typeof auditLog === 'function') auditLog('create', 'payroll_recon_reports', q.data.id, undefined, { ref_no: s.ref_no }); } catch (e) {}
    return V.rep;
  }
  window._prcRepSave = async function () {
    var b = $('prc-rep-save'); if (b) b.disabled = true;
    try { await saveRep(); toast(L('Report saved', 'Laporan disimpan'), 'success'); paintView([]); }
    catch (e) { toast(e.message || String(e), 'error'); if (b) b.disabled = false; }
  };
  function waPhone(p) {
    var d = String(p || '').replace(/\D/g, '');
    if (!d) return '';
    if (d.indexOf('60') === 0) return d;
    if (d.charAt(0) === '0') return '6' + d;
    if (d.charAt(0) === '1') return '60' + d;
    return d;
  }
  async function newLink() {
    var rep = await saveRep();
    var q = await sb.rpc('prc_sign_link_create', { p_report: rep.id });
    if (q.error) throw q.error;
    var tok = q.data && q.data.token;
    if (!tok) throw new Error('No token');
    var theme = '';
    try { theme = document.documentElement.getAttribute('data-theme') || localStorage.getItem('mcore_theme') || ''; } catch (e) {}
    theme = theme === 'dark' || theme === 'light' ? theme : '';
    var base = (location.origin + location.pathname).replace(/index\.html$/, '').replace(/[^\/]*\.html$/, '').replace(/\/?$/, '/');
    rep.status = 'shared';
    return base + 'public-recon.html?prc_sign=' + encodeURIComponent(tok) + '&lang=' + V.lang + (theme ? '&theme=' + theme : '');
  }
  window._prcRepShare = async function () {
    var b = $('prc-rep-share'); if (b) b.disabled = true;
    var w = null;
    try { w = window.open('', '_blank'); } catch (e) {}
    try {
      var link = await newLink();
      var e = await sb.from('employees').select('*').eq('id', V.emp).eq('tenant_id', tid()).single();
      var emp = e.data || {}, s = V.snap || {}, bm = V.lang === 'bm';
      var msg = bm
        ? 'Salam ' + (emp.name || '') + ', sila semak dan tandatangan laporan rekonsiliasi gaji anda (' + V.rep.ref_no + ') daripada ' + ((s.tenant && s.tenant.name) || '') + ':\n' + link
        : 'Hi ' + (emp.name || '') + ', please review and sign your salary reconciliation report (' + V.rep.ref_no + ') from ' + ((s.tenant && s.tenant.name) || '') + ':\n' + link;
      var ph = waPhone(emp.phone);
      var url = (ph ? 'https://wa.me/' + ph : 'https://wa.me/') + '?text=' + encodeURIComponent(msg);
      if (w) w.location.href = url; else window.location.href = url;
      try { if (typeof auditLog === 'function') auditLog('update', 'payroll_recon_reports', V.rep.id, undefined, { action: 'share_sign_link' }); } catch (x) {}
      toast(ph ? L('WhatsApp opened — send the message', 'WhatsApp dibuka — hantar mesej') : L('No phone on profile — pick the contact in WhatsApp', 'Tiada telefon pada profil — pilih kenalan dalam WhatsApp'), 'success');
      paintView([]);
    } catch (e) { if (w) try { w.close(); } catch (x) {} toast(e.message || String(e), 'error'); if (b) b.disabled = false; }
  };
  window._prcRepCopy = async function () {
    try {
      var link = await newLink();
      try { await navigator.clipboard.writeText(link); toast(L('New sign link copied (older links stop working)', 'Pautan tandatangan baru disalin (pautan lama tidak lagi sah)'), 'success'); }
      catch (e) { window.prompt(L('Copy this link', 'Salin pautan ini'), link); }
      paintView([]);
    } catch (e) { toast(e.message || String(e), 'error'); }
  };
  window._prcRepReset = async function () {
    if (!V.rep) return;
    if (!window.confirm(L('Reset this report? It becomes VOID, the sign link stops working and you can create a new report.', 'Set semula laporan ini? Ia menjadi BATAL, pautan tandatangan tidak lagi sah dan anda boleh buat laporan baru.'))) return;
    try {
      var q = await sb.rpc('prc_sign_reset', { p_report: V.rep.id });
      if (q.error) throw q.error;
      try { if (typeof auditLog === 'function') auditLog('update', 'payroll_recon_reports', V.rep.id, undefined, { action: 'reset_void' }); } catch (x) {}
      toast(L('Report reset (void)', 'Laporan diset semula (batal)'), 'success');
      openPage('hr', { view: 'payroll-recon-report', id: V.rep.id });
    } catch (e) { toast(e.message || String(e), 'error'); }
  };

  /* ---------- employee profile: signed reconciliation reports ---------- */
  var prof = { id: null, busy: false };
  function profileCard() {
    if (!window.APP || !window.sb || !tid()) return;
    var u = U(); if (!u || !u.isHR()) return;
    var btn = document.querySelector('#main button[onclick*="_employeeSave"]');
    var m = btn && String(btn.getAttribute('onclick') || '').match(/_employeeSave\('([0-9a-f-]{36})'/);
    var id = m && m[1];
    var old = $('prc-emp-reports');
    if (!id) { prof.id = null; return; }
    if (old && old.getAttribute('data-emp') === id) return;
    if (prof.busy) return;
    prof.busy = true;
    Promise.resolve(sb.from('payroll_recon_reports').select('id,ref_no,status,signer_name,signed_at,created_at').eq('tenant_id', tid()).eq('employee_id', id).is('deleted_at', null).neq('status', 'void').order('created_at', { ascending: false }).limit(10)).then(function (q) {
      prof.busy = false;
      if (q.error) return;
      var rows = q.data || [];
      var host = $('main'); if (!host || $('prc-emp-reports')) return;
      var c = document.createElement('div');
      c.id = 'prc-emp-reports'; c.className = 'card no-print'; c.setAttribute('data-emp', id);
      c.style.cssText = 'padding:14px 16px;margin-top:16px';
      c.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:6px"><div style="font-size:14px;font-weight:600"><i class="ti ti-scale"></i> ' + esc(L('Reconciliation reports', 'Laporan rekonsiliasi')) + '</div>' +
        '<button class="btn btn-outline btn-sm" style="white-space:nowrap" onclick="openPage(\'hr\',{view:\'payroll-recon-report\',emp:\'' + id + '\'})"><i class="ti ti-file-text"></i> ' + esc(L('Report', 'Laporan')) + '</button></div>' +
        (rows.length ? rows.map(function (h) {
          return '<div class="prc-row" style="border-top:1px solid var(--border)"><span class="k"><a class="prc-link" onclick="openPage(\'hr\',{view:\'payroll-recon-report\',id:\'' + esc(h.id) + '\'})">' + esc(h.ref_no) + '</a></span><span class="v" style="color:' + (h.status === 'signed' ? 'var(--success)' : 'var(--text-3)') + '">' + esc(repStatus(h)) + '</span></div>';
        }).join('') : '<div style="font-size:12px;color:var(--text-3)">' + esc(L('No reports yet.', 'Tiada laporan lagi.')) + '</div>');
      var anchor = btn.closest('.card') || null;
      if (anchor && anchor.parentNode === host) host.insertBefore(c, anchor.nextSibling); else host.appendChild(c);
    }, function () { prof.busy = false; });
  }
  if (window.APP) setInterval(function () { try { profileCard(); } catch (e) {} }, 1500);
})();
