/* M-Core Service Desk - Share WhatsApp messages: 5 status templates EN/BM + service-specific Done wording by service_code. */
(function () {
  var SD = window.SD, W = window.SDW; if (!SD || !W || W.build) return;
  /* service-specific line for the Done message, by service_code (EN, BM) */
  var SVC = {
    payroll: ['Payslips, EPF/SOCSO/EIS reports & the bank file are ready for your review.', 'Slip gaji, laporan KWSP/PERKESO/EIS & fail bank sudah siap untuk semakan.'],
    bookkeeping: ['Your books are updated and the summary is ready for review.', 'Simpan kira telah dikemas kini dan ringkasan sedia untuk semakan.'],
    letters: ['Your letter / memo is ready to sign and send.', 'Surat / memo anda sudah siap untuk ditandatangan dan dihantar.'],
    sales_docs: ['Your quotation / invoice / PO / DO documents are ready.', 'Dokumen sebut harga / invois / PO / DO anda sudah siap.'],
    records: ['Your sales, purchase & expense records are updated.', 'Rekod jualan, belian & perbelanjaan anda telah dikemas kini.'],
    hr_records: ['Employee records, attendance, leave & claims are updated.', 'Rekod pekerja, kehadiran, cuti & tuntutan telah dikemas kini.'],
    reports: ['Your report is ready for review.', 'Laporan anda sudah siap untuk semakan.'],
    admin_docs: ['Your administrative documents are ready.', 'Dokumen pentadbiran anda sudah siap.'],
    kpi: ['Employee KPI sheets are ready for review.', 'Helaian KPI pekerja sudah siap untuk semakan.'],
    data_entry: ['Data entry into the system is complete.', 'Kemasukan data ke dalam sistem telah selesai.'],
    sop: ['Your SOP / workflow document is ready for review.', 'Dokumen SOP / aliran kerja anda sudah siap untuk semakan.'],
    crm_digitise: ['Customer records have been digitised.', 'Rekod pelanggan telah didigitalkan.']
  };
  W.svcLine = function (code, lang) { var x = SVC[code]; return x ? x[lang === 'bm' ? 1 : 0] : (lang === 'bm' ? 'Hasil kerja anda sudah siap untuk semakan.' : 'Your deliverables are ready for review.'); };
  W.svcName = function (code, lang) { var c = (SD.catalogList || []).find(function (x) { return x.code === code; }); return c ? (lang === 'bm' ? c.name_bm : c.name_en) : SD.svcName(code); };
  /* message text; o = { r, tpl, lang, name, url } - never includes internal notes, comments or file names */
  W.build = function (o) {
    var r = o.r, bm = o.lang === 'bm', T = function (en, b) { return bm ? b : en; }, s = W.sla(r), svc = W.svcName(r.service_code, o.lang);
    var due = SD.due(r), dd = due ? due.toLocaleDateString(bm ? 'ms-MY' : 'en-MY', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kuala_Lumpur' }) : '—';
    var hi = T('Hi', 'Hai') + (o.name ? ' ' + o.name : '') + ', ';
    var head = { received: T('Request Received', 'Permintaan Diterima'), need_info: T('Information Needed', 'Perlu Maklumat'), in_progress: T('In Progress', 'Dalam Proses'), done: T('Request Done', 'Permintaan Siap'), reminder: T('Reminder', 'Peringatan') }[o.tpl];
    var L = ['*' + head + ' · M-Core*', ''];
    L.push(hi + ({ received: T('we have received your request.', 'kami telah terima permintaan anda.'), need_info: T('we need a little more information to continue.', 'kami perlukan sedikit maklumat tambahan untuk teruskan.'), in_progress: T('your request is being worked on.', 'permintaan anda sedang diproses.'), done: T('your request is done ✅', 'permintaan anda sudah siap ✅'), reminder: r.status === 'delivered' ? T('a quick reminder to review your completed request.', 'peringatan untuk semak permintaan anda yang sudah siap.') : T('a quick reminder about your request.', 'peringatan tentang permintaan anda.') }[o.tpl]), '');
    L.push('🧾 *' + r.ref_no + '*', '📌 ' + r.title, '🛠️ ' + T('Service', 'Servis') + ': ' + svc);
    if (o.tpl === 'done' && s.x != null) L.push('⏱️ ' + (s.y != null ? T('Done in ' + s.x + ' hours (SLA ' + s.y + ' hours)', 'Siap dalam ' + s.x + ' jam (SLA ' + s.y + ' jam)') : T('Done in ' + s.x + ' hours', 'Siap dalam ' + s.x + ' jam')));
    else if (o.tpl === 'received' || o.tpl === 'in_progress') L.push('⏳ ' + T('Estimated completion', 'Anggaran siap') + ': ' + dd);
    L.push('');
    if (o.tpl === 'done') L.push(W.svcLine(r.service_code, o.lang), '');
    if (o.tpl === 'need_info') L.push(T('Please reply to this message or open M-Core → My Services to add the details.', 'Sila balas mesej ini atau buka M-Core → Servis Saya untuk tambah maklumat.'), '');
    if (o.tpl === 'reminder' && r.status !== 'delivered') L.push(T('We are still waiting for your reply so we can continue.', 'Kami masih menunggu maklum balas anda untuk teruskan.'), '');
    if (o.url) L.push('📂 ' + T('View result (valid 30 days)', 'Lihat hasil (sah 30 hari)') + ':', o.url, '', '✅ ' + T('Confirm', 'Sahkan') + ' / ✏️ ' + T('Request changes on the same link.', 'Minta pindaan di link yang sama.'), '');
    L.push('_' + T('Sent via M-Core', 'Dihantar melalui M-Core') + '_');
    return L.join('\n');
  };
})();
