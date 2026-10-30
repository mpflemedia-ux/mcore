/* DK share — one WhatsApp share entry for every document (wraps WAD.open). Registry + tenant-editable EN/BM templates (WAD2 editor) + "share one by one" queue. v1 */
(function () {
  if (window.DKS) return;
  var REG = {}, active = null, Q = null;
  function bm() { return window.APP && APP.language === 'bm'; }
  function L(en, b) { return bm() ? b : en; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function toast(m, k) { try { showToast(m, k || 'success'); } catch (e) {} }

  /* ---------- default templates (c: name, ref, amt, due, link, co, status, period, extra) ---------- */
  var T = {
    do_send: { label: ['Delivery note', 'Nota penghantaran'], desc: ['DO details + confirm-received link', 'Butiran DO + pautan sahkan terima'], doc: 'do',
      en: function (c) { return 'Hi ' + c.name + ', your delivery ' + c.ref + ' is on the way.' + (c.link ? '\nPlease tap to confirm once you receive it: ' + c.link : '') + '\n– ' + c.co; },
      bm: function (c) { return 'Salam ' + c.name + ', penghantaran ' + c.ref + ' anda dalam perjalanan.' + (c.link ? '\nSila ketik untuk sahkan setelah diterima: ' + c.link : '') + '\n– ' + c.co; } },
    do_remind: { label: ['Confirm reminder', 'Peringatan pengesahan'], desc: ['Ask the customer to confirm receipt', 'Minta pelanggan sahkan penerimaan'], doc: 'do',
      en: function (c) { return 'Hi ' + c.name + ', a gentle reminder to confirm delivery ' + c.ref + (c.link ? ':\n' + c.link : '.') + '\nThank you!\n– ' + c.co; },
      bm: function (c) { return 'Salam ' + c.name + ', peringatan mesra untuk sahkan penghantaran ' + c.ref + (c.link ? ':\n' + c.link : '.') + '\nTerima kasih!\n– ' + c.co; } },
    rcpt_send: { label: ['Payment receipt', 'Resit bayaran'], desc: ['Thank-you + receipt PDF', 'Terima kasih + PDF resit'], doc: 'rcpt',
      en: function (c) { return 'Hi ' + c.name + ', thank you! We received ' + c.amt + ' for ' + c.ref + '.\nThe receipt is attached.\n– ' + c.co; },
      bm: function (c) { return 'Salam ' + c.name + ', terima kasih! Kami telah menerima ' + c.amt + ' bagi ' + c.ref + '.\nResit dilampirkan.\n– ' + c.co; } },
    soa_send: { label: ['Statement of account', 'Penyata akaun'], desc: ['Outstanding balance + statement PDF', 'Baki tertunggak + PDF penyata'], doc: 'soa',
      en: function (c) { return 'Hi ' + c.name + ', here is your statement of account as at ' + c.due + '.\nOutstanding: ' + c.amt + '\nThe statement PDF is attached.\n– ' + c.co; },
      bm: function (c) { return 'Salam ' + c.name + ', berikut penyata akaun anda setakat ' + c.due + '.\nBaki tertunggak: ' + c.amt + '\nPDF penyata dilampirkan.\n– ' + c.co; } },
    cn_send: { label: ['Credit note', 'Nota kredit'], desc: ['Credit amount + PDF', 'Amaun kredit + PDF'], doc: 'cn',
      en: function (c) { return 'Hi ' + c.name + ', credit note ' + c.ref + ' for ' + c.amt + ' has been issued to your account.\n– ' + c.co; },
      bm: function (c) { return 'Salam ' + c.name + ', nota kredit ' + c.ref + ' berjumlah ' + c.amt + ' telah dikeluarkan ke akaun anda.\n– ' + c.co; } },
    leave_result: { label: ['Leave decision', 'Keputusan cuti'], desc: ['Tell the staff the result', 'Maklumkan keputusan kepada staf'], doc: 'leave',
      en: function (c) { return 'Hi ' + c.name + ', your leave (' + c.period + ') is ' + c.status + '.\n– HR, ' + c.co; },
      bm: function (c) { return 'Salam ' + c.name + ', permohonan cuti anda (' + c.period + ') telah ' + c.status + '.\n– HR, ' + c.co; } },
    ot_result: { label: ['Overtime decision', 'Keputusan OT'], desc: ['Tell the staff the result', 'Maklumkan keputusan kepada staf'], doc: 'ot',
      en: function (c) { return 'Hi ' + c.name + ', your overtime claim (' + c.period + ') is ' + c.status + '.\n– HR, ' + c.co; },
      bm: function (c) { return 'Salam ' + c.name + ', tuntutan OT anda (' + c.period + ') telah ' + c.status + '.\n– HR, ' + c.co; } },
    exp_result: { label: ['Expense claim update', 'Status tuntutan perbelanjaan'], desc: ['Claim status for the claimant', 'Status tuntutan untuk penuntut'], doc: 'exp',
      en: function (c) { return 'Hi ' + c.name + ', your expense claim ' + c.ref + ' (' + c.amt + ') is ' + c.status + '.\n– ' + c.co; },
      bm: function (c) { return 'Salam ' + c.name + ', tuntutan perbelanjaan ' + c.ref + ' (' + c.amt + ') anda telah ' + c.status + '.\n– ' + c.co; } },
    adv_result: { label: ['Advance decision', 'Keputusan pendahuluan'], desc: ['Tell the staff the result (no amount)', 'Maklumkan keputusan (tanpa amaun)'], doc: 'adv',
      en: function (c) { return 'Hi ' + c.name + ', your cash advance request (' + c.period + ') is ' + c.status + '. Details are in M-Core.\n– HR, ' + c.co; },
      bm: function (c) { return 'Salam ' + c.name + ', permohonan pendahuluan tunai anda (' + c.period + ') telah ' + c.status + '. Butiran dalam M-Core.\n– HR, ' + c.co; } },
    po_send: { label: ['Purchase order', 'Pesanan belian'], desc: ['PO to the supplier + PDF', 'PO kepada pembekal + PDF'], doc: 'po',
      en: function (c) { return 'Dear ' + c.name + ', please find our purchase order ' + c.ref + ' (' + c.amt + ') attached.' + (c.due ? '\nRequired by: ' + c.due : '') + '\nKindly confirm the delivery date.\n– ' + c.co; },
      bm: function (c) { return 'Kepada ' + c.name + ', dilampirkan pesanan belian kami ' + c.ref + ' (' + c.amt + ').' + (c.due ? '\nDiperlukan sebelum: ' + c.due : '') + '\nSila sahkan tarikh penghantaran.\n– ' + c.co; } },
    bill_remit: { label: ['Remittance advice', 'Nasihat remitans'], desc: ['Tell the supplier we paid', 'Maklumkan pembekal bayaran dibuat'], doc: 'bill',
      en: function (c) { return 'Dear ' + c.name + ', we have paid ' + c.amt + ' for your bill ' + c.ref + (c.due ? ' on ' + c.due : '') + '.\nRemittance advice attached.\n– ' + c.co; },
      bm: function (c) { return 'Kepada ' + c.name + ', kami telah membayar ' + c.amt + ' bagi bil ' + c.ref + (c.due ? ' pada ' + c.due : '') + '.\nNasihat remitans dilampirkan.\n– ' + c.co; } },
    grn_send: { label: ['Goods received note', 'Nota terimaan barang'], desc: ['Confirm what we received', 'Sahkan barang yang diterima'], doc: 'grn',
      en: function (c) { return 'Dear ' + c.name + ', we received the goods for ' + c.ref + (c.due ? ' on ' + c.due : '') + '. GRN attached.\n– ' + c.co; },
      bm: function (c) { return 'Kepada ' + c.name + ', kami telah menerima barang bagi ' + c.ref + (c.due ? ' pada ' + c.due : '') + '. GRN dilampirkan.\n– ' + c.co; } },
    ssoa_send: { label: ['Supplier statement', 'Penyata pembekal'], desc: ['Balance with the supplier + PDF', 'Baki dengan pembekal + PDF'], doc: 'ssoa',
      en: function (c) { return 'Dear ' + c.name + ', attached is our statement with you as at ' + c.due + '.\nBalance: ' + c.amt + '\nPlease let us know if anything differs.\n– ' + c.co; },
      bm: function (c) { return 'Kepada ' + c.name + ', dilampirkan penyata kami dengan anda setakat ' + c.due + '.\nBaki: ' + c.amt + '\nSila maklumkan jika ada perbezaan.\n– ' + c.co; } },
    wo_send: { label: ['Work order', 'Arahan kerja'], desc: ['Send the WO to the team', 'Hantar WO kepada pasukan'], doc: 'wo',
      en: function (c) { return 'Work order ' + c.ref + ': ' + c.name + ' (' + c.status + ').\nPDF attached.\n– ' + c.co; },
      bm: function (c) { return 'Arahan kerja ' + c.ref + ': ' + c.name + ' (' + c.status + ').\nPDF dilampirkan.\n– ' + c.co; } },
    comm_send: { label: ['Commission statement', 'Penyata komisen'], desc: ['Statement PDF to the salesperson', 'PDF penyata kepada jurujual'], doc: 'comm',
      en: function (c) { return 'Hi ' + c.name + ', your commission statement for ' + c.period + ' is ready. The PDF is attached.\n– ' + c.co; },
      bm: function (c) { return 'Salam ' + c.name + ', penyata komisen anda bagi ' + c.period + ' telah sedia. PDF dilampirkan.\n– ' + c.co; } },
    sign_req: { label: ['Ask to sign', 'Minta tandatangan'], desc: ['Ask a teammate to sign in M-Core', 'Minta rakan tandatangan dalam M-Core'], doc: '',
      en: function (c) { return 'Hi ' + c.name + ', please review and sign ' + c.ref + ' in M-Core (Notifications → tap the request).' + (c.link ? '\n' + c.link : '') + '\n– ' + c.co; },
      bm: function (c) { return 'Salam ' + c.name + ', sila semak dan tandatangan ' + c.ref + ' dalam M-Core (Notifikasi → ketik permintaan).' + (c.link ? '\n' + c.link : '') + '\n– ' + c.co; } }
  };
  var TAGS = ['name', 'doc_no', 'amount', 'due_date', 'link', 'company', 'status', 'period'];
  var added = false;
  function addI18n() {
    var S = window.__WAD_S, TT = window.__WAD_T;
    ['en', 'bm'].forEach(function (l, i) {
      var lab = {};
      Object.keys(T).forEach(function (k) { lab['dk_' + k] = T[k].label[i]; lab['dk_' + k + 'D'] = T[k].desc[i]; });
      if (S && S[l]) Object.assign(S[l], lab);
      try { if (window.LANG && LANG[l] && LANG[l].waDoc && LANG[l].waDoc !== (S && S[l])) Object.keys(lab).forEach(function (k) { if (!LANG[l].waDoc[k]) LANG[l].waDoc[k] = lab[k]; }); } catch (e) {}
      if (TT) { TT[l] = TT[l] || {}; Object.keys(T).forEach(function (k) { if (!TT[l][k]) TT[l][k] = T[k][l]; }); }
    });
    // WAD2 template editor: make every DK key tenant-editable (EN/BM, tags, preview, reset)
    var X = window.WAD2;
    if (X && X.KEYS && !added) {
      added = true;
      Object.keys(T).forEach(function (k) { if (!X.key(k)) X.KEYS.push({ k: k, doc: T[k].doc || 'dk', label: 'dk_' + k, tags: TAGS }); });
    }
  }
  // WAD2 editor groups docs by a private map; label our optgroups once the editor paints
  var GL = { do: ['Delivery orders', 'Pesanan penghantaran'], rcpt: ['Receipts', 'Resit'], soa: ['Statements', 'Penyata'], cn: ['Credit notes', 'Nota kredit'],
    leave: ['Leave', 'Cuti'], ot: ['Overtime', 'Kerja lebih masa'], exp: ['Expense claims', 'Tuntutan perbelanjaan'], adv: ['Cash advance', 'Pendahuluan tunai'],
    po: ['Purchase orders', 'Pesanan belian'], bill: ['Supplier bills', 'Bil pembekal'], grn: ['Goods received', 'Terimaan barang'], ssoa: ['Supplier statements', 'Penyata pembekal'],
    wo: ['Work orders', 'Arahan kerja'], comm: ['Commission', 'Komisen'], dk: ['Signatures', 'Tandatangan'] };
  new MutationObserver(function () {
    var s = document.querySelector('#wd2-tpl #wd2-k'); if (!s || s.dataset.dk) return; s.dataset.dk = '1';
    s.querySelectorAll('optgroup').forEach(function (g) {
      if (g.label && g.label !== 'undefined') return;
      var o = g.querySelector('option'), m = o && window.WAD2 && WAD2.key(o.value), gl = m && GL[m.doc];
      if (gl) g.label = L(gl[0], gl[1]);
    });
  }).observe(document.documentElement, { childList: true, subtree: true });

  function render(k, lang, v) {
    var W = window.WAD; addI18n();
    var c = { name: v.name || '-', ref: v.ref || '', amt: v.amt || '', bal: v.amt || '', due: v.due || '', link: v.link || '', co: v.co || (W && W.company ? W.company() : 'M-Core'), status: v.status || '', period: v.period || '' };
    var out = W && W.tpl ? W.tpl(k, lang, c) : (T[k] ? T[k][lang](c) : '');
    if (!out && T[k]) out = T[k][lang](c);
    // extra DK tags in tenant-custom bodies
    return String(out).replace(/\{(status|period)\}/g, function (m, x) { return c[x] || ''; });
  }

  /* ---------- registry ---------- */
  // cfg: {doc, mod, tpls:[keys], linkKeys:[keys needing a public link], k(rec)->key, load(id)->Promise<{ref,to,phone,recipientKind,vars,model,link(lang)->Promise<{url,link_id,expires_at}>}>, pdfName}
  function reg(cfg) { REG[cfg.doc] = cfg; }
  function has(doc) {
    var W = window.WAD; if (!W || !W.open) return false;
    if (doc === 'inv') return !!W.shareInv; if (doc === 'quo') return !!W.shareQuo;
    var c = REG[doc]; if (!c) return false;
    try { return !c.mod || !W.allowed || W.allowed(c.mod); } catch (e) { return true; }
  }
  function canFiles() { try { return !!(navigator.canShare && navigator.canShare({ files: [new File(['x'], 'x.pdf', { type: 'application/pdf' })] })); } catch (e) { return false; } }
  function share(doc, id, opt) {
    var W = window.WAD; opt = opt || {};
    if (!W || !W.open) { toast(L('WhatsApp share not available', 'Kongsi WhatsApp tiada'), 'error'); return Promise.resolve(false); }
    if (doc === 'inv' && W.shareInv) { W.shareInv(id, opt); return Promise.resolve(true); }
    if (doc === 'quo' && W.shareQuo) { W.shareQuo(id, opt); return Promise.resolve(true); }
    var cfg = REG[doc]; if (!cfg) return Promise.resolve(false);
    addI18n();
    return Promise.resolve(W.ready ? W.ready() : true).then(function (ok) {
      if (ok === false) { toast(L('WhatsApp share log is not set up yet (run wa_doc_01.sql + dk_phase0_kit.sql).', 'Log kongsi WhatsApp belum disediakan (jalankan wa_doc_01.sql + dk_phase0_kit.sql).'), 'warning'); return false; }
      return cfg.load(id).then(function (d) {
        if (!d) { toast(L('Document not found', 'Dokumen tidak dijumpai'), 'error'); return false; }
        var pdfP = null, getPdf = d.model && window.DKD ? function () { return pdfP || (pdfP = DKD.file(d.model).catch(function () { return null; })); } : null;
        var links = {};
        active = { doc: doc, id: id, pdf: getPdf, done: opt.done };
        W.open({
          docType: doc, docId: id, docRef: d.ref, to: d.to, phone: d.phone || '', recipientKind: d.recipientKind || 'customer',
          tpls: (cfg.tpls || []).map(function (k) { return { k: k, label: 'dk_' + k, desc: 'dk_' + k + 'D' }; }),
          k: opt.k || (cfg.k ? cfg.k(d) : cfg.tpls[0]),
          file: getPdf,
          build: function (k, lang) {
            var lp = d.link && (cfg.linkKeys || []).indexOf(k) >= 0 ? (links[lang] || (links[lang] = d.link(lang))) : Promise.resolve(null);
            return Promise.resolve(lp).then(function (lk) {
              var v = Object.assign({}, d.vars || {}, { ref: d.ref, link: lk && lk.url || '' });
              return { text: render(k, lang, v), link_id: lk && lk.link_id || null, expires_at: lk && lk.expires_at || null };
            });
          }
        });
        return true;
      });
    }).catch(function (e) { toast(L('Share failed: ', 'Kongsi gagal: ') + (e && e.message || e), 'error'); return false; });
  }
  // desktop: no file share -> the text goes out; download the PDF so it can be attached
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest && e.target.closest('.wad-bg [data-a=send]');
    if (!b || !active || !active.pdf || b.disabled) return;
    if (!canFiles()) active.pdf().then(function (f) { if (f && window.DKD) { DKD.download(f); toast(L('PDF downloaded — attach it in WhatsApp', 'PDF dimuat turun — lampirkan dalam WhatsApp')); } });
  }, true);
  document.addEventListener('wad:shared', function (e) {
    var d = e.detail || {}, c = REG[d.doc_type];
    if (c && c.onShared) try { c.onShared(d.doc_id, d); } catch (x) {}
  });

  /* ---------- "share one by one" queue (works for inv/quo too: waits for the sheet to open, then close) ---------- */
  function pill() {
    var p = document.querySelector('.dk-qp');
    if (!Q) { if (p) p.remove(); return; }
    if (!p) { p = document.createElement('div'); p.className = 'dk-qp no-print'; document.body.appendChild(p); }
    p.innerHTML = '<span>' + esc(L('Sharing', 'Berkongsi') + ' ' + (Q.i + 1) + '/' + Q.ids.length) + '</span><button type="button" class="btn btn-outline btn-sm">' + esc(L('Stop', 'Henti')) + '</button>';
    p.querySelector('button').onclick = stop;
  }
  function stop() { Q = null; pill(); try { WAD.closeSheet(); } catch (e) {} active = null; }
  function queue(doc, ids) {
    ids = (ids || []).filter(Boolean); if (!ids.length) return;
    if (!has(doc)) return toast(L('WhatsApp share not available for this document', 'Kongsi WhatsApp tiada untuk dokumen ini'), 'warning');
    Q = { doc: doc, ids: ids, i: 0 };
    var step = function () {
      if (!Q) return;
      if (Q.i >= Q.ids.length) { Q = null; pill(); toast(L('Done — all shared', 'Selesai — semua dikongsi')); return; }
      pill();
      var my = Q, seen = false, t0 = Date.now();
      share(doc, Q.ids[Q.i]).then(function (ok) {
        if (!ok) { my.i++; return setTimeout(step, 250); }
        var iv = setInterval(function () {
          if (Q !== my) return clearInterval(iv);
          var open = !!document.querySelector('.wad-bg .wad-sh');
          if (open) seen = true;
          if ((seen && !open) || (!seen && Date.now() - t0 > 10000)) { clearInterval(iv); active = null; my.i++; setTimeout(step, 250); }
        }, 350);
      });
    };
    step();
  }
  window.addEventListener('hashchange', function () { if (Q) stop(); });

  if (window.DK && DK.css) DK.css('dk-share-css',
    '.dk-qp{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:10001;display:flex;align-items:center;gap:10px;flex-wrap:wrap;' +
    'background:var(--bg-card);color:var(--text);border:1px solid var(--border);border-radius:999px;padding:6px 8px 6px 14px;box-shadow:var(--shadow-lg,var(--shadow));font-size:13px;font-weight:700;max-width:calc(100vw - 24px)}' +
    '.dk-qp .btn{white-space:nowrap}');

  window.DKS = { reg: reg, has: has, share: share, queue: queue, stop: stop, render: render, T: T, L: L };
  addI18n();
  document.addEventListener('DOMContentLoaded', addI18n);
})();
