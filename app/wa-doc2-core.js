/* WhatsApp document share (Phase 2) - core: EN/BM strings (LANG.*.waDoc2), tenant templates, pay-online line. Needs wa_doc_01.sql + wa_doc_02.sql. v1 */
(function () {
  if (!window.WAD || window.WAD2) return;
  var W = WAD, X = window.WAD2 = {}, ready = null, cache = {}, PAY = {};
  var S = {
    en: { tplCard: 'WhatsApp message templates', tplCardD: 'Edit the text your team sends on WhatsApp. Leave a template unchanged to use the M-Core default.', tplEdit: 'Edit templates', tplTitle: 'WhatsApp templates', tplPick: 'Template', tags: 'Tap a tag to insert it', preview: 'Live preview (example data)', save: 'Save', reset: 'Reset to default', custom: 'Custom', deflt: 'Default', saved: 'Template saved', resetOk: 'Back to the default template', resetAsk: 'Reset this template to the M-Core default?', tooLong: 'Too long (max 2000 characters)', empty: 'Template cannot be empty', gInv: 'Invoice', gQuo: 'Quotation', gBk: 'Booking', gPos: 'POS receipt', payLine: 'Pay online: {u}', payNow: 'Pay online', payWait: 'Preparing…', payFail: 'Online payment failed: ', bulk: 'Send one by one', bulkTitle: 'Send one by one', bulkD: 'Pick invoices. WhatsApp opens for each one in turn; tap Next after each.', selAll: 'Select all', start: 'Start ({n})', next: 'Next', stop: 'Stop', skip: 'Skip', runOf: '{i} of {n}', runNext: 'Next: {r} · {c}', runDone: 'Done · {s} sent, {k} skipped', sentToday: 'Sent today', noneSel: 'Pick at least one invoice', noUnpaid: 'No unpaid invoices', accTitle: 'Accept this quotation?', accept: 'Accept', decline: 'Decline', reason: 'Reason (optional)', yourName: 'Your name (optional)', confirmDecl: 'Send decline', accDone: 'Thank you. You accepted this quotation on {t}.', decDone: 'You declined this quotation on {t}.', accFail: 'Could not send your answer. Please try again or contact {c}.', accPill: 'Accepted by customer · {t}', decPill: 'Declined by customer · {t}', convert: 'Convert to invoice', accBell: '{r} accepted', decBell: '{r} declined', accBody: '{c} accepted the quotation at {t}.', decBody: '{c} declined the quotation at {t}.{x}' },
    bm: { tplCard: 'Templat mesej WhatsApp', tplCardD: 'Ubah teks yang pasukan anda hantar di WhatsApp. Biarkan templat tanpa perubahan untuk guna templat asal M-Core.', tplEdit: 'Ubah templat', tplTitle: 'Templat WhatsApp', tplPick: 'Templat', tags: 'Tekan tag untuk masukkan', preview: 'Pratonton langsung (data contoh)', save: 'Simpan', reset: 'Set semula ke asal', custom: 'Diubah', deflt: 'Asal', saved: 'Templat disimpan', resetOk: 'Kembali ke templat asal', resetAsk: 'Set semula templat ini ke templat asal M-Core?', tooLong: 'Terlalu panjang (maks 2000 aksara)', empty: 'Templat tidak boleh kosong', gInv: 'Invois', gQuo: 'Sebut harga', gBk: 'Tempahan', gPos: 'Resit POS', payLine: 'Bayar dalam talian: {u}', payNow: 'Bayar dalam talian', payWait: 'Menyediakan…', payFail: 'Bayaran dalam talian gagal: ', bulk: 'Hantar satu per satu', bulkTitle: 'Hantar satu per satu', bulkD: 'Pilih invois. WhatsApp dibuka untuk setiap satu; tekan Seterusnya selepas setiap satu.', selAll: 'Pilih semua', start: 'Mula ({n})', next: 'Seterusnya', stop: 'Henti', skip: 'Langkau', runOf: '{i} daripada {n}', runNext: 'Seterusnya: {r} · {c}', runDone: 'Selesai · {s} dihantar, {k} dilangkau', sentToday: 'Dihantar hari ini', noneSel: 'Pilih sekurang-kurangnya satu invois', noUnpaid: 'Tiada invois belum bayar', accTitle: 'Terima sebut harga ini?', accept: 'Terima', decline: 'Tolak', reason: 'Sebab (pilihan)', yourName: 'Nama anda (pilihan)', confirmDecl: 'Hantar penolakan', accDone: 'Terima kasih. Anda telah menerima sebut harga ini pada {t}.', decDone: 'Anda telah menolak sebut harga ini pada {t}.', accFail: 'Jawapan tidak dapat dihantar. Sila cuba lagi atau hubungi {c}.', accPill: 'Diterima pelanggan · {t}', decPill: 'Ditolak pelanggan · {t}', convert: 'Tukar ke invois', accBell: '{r} diterima', decBell: '{r} ditolak', accBody: '{c} menerima sebut harga pada {t}.', decBody: '{c} menolak sebut harga pada {t}.{x}' }
  };
  X.S = S;
  try { if (window.LANG) ['en', 'bm'].forEach(function (l) { if (LANG[l] && !LANG[l].waDoc2) LANG[l].waDoc2 = S[l]; }); } catch (e) {}
  X.t = function (k, lang, v) {
    var l = lang || (W.bm() ? 'bm' : 'en'), d = (window.LANG && LANG[l] && LANG[l].waDoc2) || S[l], s = d[k] != null ? d[k] : (S.en[k] || k);
    return v ? s.replace(/\{(\w+)\}/g, function (m, x) { return v[x] != null ? v[x] : m; }) : s;
  };
  X.ready = function () {
    if (!W.tid()) return Promise.resolve(false);
    if (!ready) ready = W.ready().then(function (ok) {
      if (!ok) return false;
      return Promise.all([sb.from('wa_templates').select('id').limit(1), sb.from('doc_responses').select('id').limit(1)]).then(function (a) {
        if (a[0].error || a[1].error) { console.info('[wa-doc2] hidden until supabase/wa_doc_02.sql is run'); return false; }
        return X.loadTpl().then(function () { X.ok = true; return true; });
      }, function () { return false; });
    });
    return ready;
  };
  /* template keys: k, doc, label (Phase 1 label keys), tags */
  var TG = { inv: ['name', 'doc_no', 'amount', 'due_date', 'days_late', 'link', 'pay_link', 'company'], quo: ['name', 'doc_no', 'amount', 'due_date', 'link', 'company'], booking: ['name', 'service', 'when', 'doc_no', 'company'], pos: ['doc_no', 'amount', 'items', 'company'] };
  X.KEYS = [['inv_send', 'inv', 'newInv'], ['reminder_friendly', 'inv', 'tFriendly'], ['reminder_firm', 'inv', 'tFirm'], ['reminder_final', 'inv', 'tFinal'], ['thanks', 'inv', 'thanks'],
    ['quo_send', 'quo', 'newQuo'], ['followup', 'quo', 'followup'], ['confirm', 'booking', 'confirm'], ['remind_day', 'booking', 'dayBefore'], ['reschedule', 'booking', 'resched'], ['receipt', 'pos', 'receipt']]
    .map(function (a) { return { k: a[0], doc: a[1], label: a[2], tags: TG[a[1]].concat(/^reminder_firm/.test(a[0]) ? ['pay_by'] : []) }; });
  X.key = function (k) { return X.KEYS.filter(function (x) { return x.k === k; })[0]; };
  var orig = W.tpl;
  X.defaultBody = function (k, lang) {
    var m = X.key(k) || { doc: 'inv' }, c = { name: '{name}', ref: '{doc_no}', amt: '{amount}', bal: '{amount}', due: '{due_date}', n: '{days_late}', by: '{pay_by}', link: '{link}', co: '{company}', svc: '{service}', when: '{when}', items: '{items}' };
    c.what = W.what ? W.what(m.doc, lang, '{doc_no}', '{amount}') : '{doc_no} {amount}';
    return orig(k, lang, c);
  };
  X.render = function (body, v) {
    return String(body).split('\n').filter(function (ln) { return !((ln.indexOf('{pay_link}') >= 0 && !v.pay_link) || (ln.indexOf('{link}') >= 0 && !v.link)); }).join('\n')
      .replace(/\{(\w+)\}/g, function (m, x) { return v[x] != null ? String(v[x]) : m; }).replace(/\n{3,}/g, '\n\n').trim();
  };
  X.loadTpl = function () {
    return sb.from('wa_templates').select('id,template_key,lang,body').eq('tenant_id', W.tid()).is('deleted_at', null).then(function (r) {
      cache = {}; (r.data || []).forEach(function (x) { cache[x.template_key + '|' + x.lang] = x; });
    }, function () {});
  };
  X.custom = function (k, lang) { return cache[k + '|' + lang] || null; };
  function payUrl(c) { return c && c.link && PAY[c.link] ? c.link.split('#')[0] + '#pay' : ''; }
  W.tpl = function (k, lang, c) {
    var row = X.ok && c && !c.pl ? cache[k + '|' + lang] : null, pu = /^(inv_send|reminder_)/.test(k) ? payUrl(c) : '', out;
    if (row) {
      out = X.render(row.body, { name: c.name, doc_no: c.ref || '', amount: /^reminder/.test(k) ? c.bal : c.amt, due_date: c.due, days_late: c.n, link: c.link || '', pay_link: pu, company: c.co, pay_by: c.by, service: c.svc, when: c.when, items: c.items });
      if (pu && row.body.indexOf('{pay_link}') >= 0) return out;
    } else out = orig(k, lang, c);
    return pu && out.indexOf(pu) < 0 ? out + '\n' + X.t('payLine', lang, { u: pu }) : out;
  };
  var oEnsure = W.ensureLink;
  W.ensureLink = function (type, id, lang) {
    return oEnsure(type, id, lang).then(function (L) {
      if (type !== 'inv' || !X.ok) return L;
      return Promise.resolve(sb.rpc('has_active_toyyibpay_config_for_invoice', { p_token: L.token })).then(function (r) { if (r && r.data === true) PAY[L.url] = 1; return L; }, function () { return L; });
    });
  };
  X.allowedOwner = function () { var r = String((window.APP && APP.user && APP.user.role) || '').toLowerCase(); return W.allowed('sales') && (r === 'owner' || r === 'admin'); };
})();
