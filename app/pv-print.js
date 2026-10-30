/* Payment Vouchers — print / PDF / WhatsApp PDF share v1 (loads after pv-core.js, pv-signatures.js).
   PVP.print(kind, id)            light A4 portrait sheet (theme forced light while printing), signature images.
   PVP.pdf(kind, id, {download})  pdf-lib (already loaded by index.html) -> File; draws the signature PNGs.
   PVP.sharePdf(kind, id)         WAD sheet with the PDF attached (desktop: PDF downloads to attach by hand).
   kind: 'pv' (payment_vouchers) | 'pvd' (payment_voucher_batches + lines). No amounts in the WhatsApp text. */
(function () {
  if (window.PVP || !window.PVX) return;
  var X = window.PVX, L = X.L, esc = X.esc, rm = X.rm;
  var P = window.PVP = {};
  function $(id) { return document.getElementById(id); }

  async function data(kind, id) {
    var tn = {}; try { tn = await _pdocGetTenant(); } catch (e) { tn = { name: (APP.tenant && APP.tenant.name) || '' }; }
    if (kind === 'pvd') {
      var b = (await sb.from('payment_voucher_batches').select('*').eq('id', id).eq('tenant_id', X.tid()).maybeSingle()).data;
      if (!b) throw new Error(L('Not found', 'Tidak dijumpai'));
      var ls = (await sb.from('payment_voucher_batch_lines').select('*').eq('batch_id', id).eq('tenant_id', X.tid()).order('sort_order')).data || [];
      return { kind: kind, tn: tn, ref: b.ref_no || 'PVD', date: b.batch_date, status: b.status, title: b.title || '', note: b.notes || b.description || '', lines: ls,
        total: X.r2(ls.reduce(function (s, l) { return s + (Number(l.amount) || 0); }, 0)), phone: '', to: null };
    }
    var v = (await sb.from('payment_vouchers').select('*').eq('id', id).eq('tenant_id', X.tid()).maybeSingle()).data;
    if (!v) throw new Error(L('Not found', 'Tidak dijumpai'));
    return { kind: kind, tn: tn, ref: v.ref_no || 'PV', date: v.voucher_date, status: v.status, title: v.payee_name || '', note: v.description || '', lines: [v],
      total: X.r2(v.amount), phone: v.phone || '', to: v.payee_name || null, v: v };
  }
  function docTitle(kind) { return kind === 'pvd' ? L('PAYMENT VOUCHER DISBURSEMENT', 'PENYALURAN BAUCAR BAYARAN') : L('PAYMENT VOUCHER', 'BAUCAR BAYARAN'); }
  function fname(d) { var s = function (x) { try { return _pdocSlug(x); } catch (e) { return String(x || '').replace(/[^a-zA-Z0-9-]/g, ''); } }; return (d.kind === 'pvd' ? 'PVD' : 'PV') + '_' + s(d.ref) + (d.kind === 'pv' ? '_' + s(d.title) : '') + '.pdf'; }
  function bankOf(l) { return [l.bank_name, l.bank_account_no].filter(Boolean).join(' · '); }
  function payOf(l) { return X.methodLabel(l.payment_method) + (l.cheque_no ? ' · ' + l.cheque_no : '') + (l.pay_ref ? ' · ' + l.pay_ref : ''); }

  /* ---------- print ---------- */
  function css() {
    if ($('pvp-css')) return;
    var s = document.createElement('style'); s.id = 'pvp-css';
    s.textContent =
      '#pvp-print{display:none}' +
      '.pvp-sheet{background:var(--bg-card);color:var(--text);font-size:11px;line-height:1.4;padding:0}' +
      '.pvp-h{display:flex;justify-content:space-between;gap:16px;border-bottom:2px solid var(--pdoc-accent,var(--primary));padding:0 0 10px;margin:0 0 12px}' +
      '.pvp-co{display:flex;gap:10px;align-items:center;min-width:0}.pvp-co img{max-height:44px;max-width:120px;object-fit:contain}' +
      '.pvp-con{font-size:15px;font-weight:800;color:var(--pdoc-accent,var(--primary))}.pvp-cos{font-size:10px;color:var(--text-2)}' +
      '.pvp-doc{text-align:right}.pvp-dt{font-size:14px;font-weight:800;letter-spacing:.04em}.pvp-dm{font-size:10px;color:var(--text-2)}' +
      '.pvp-sum{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:0 0 12px}' +
      '.pvp-sum div{border:1px solid var(--border);border-radius:6px;padding:6px 8px}.pvp-sum span{display:block;font-size:9px;color:var(--text-3);text-transform:uppercase}.pvp-sum b{font-size:12px}' +
      '.pvp-t{width:100%;border-collapse:collapse;margin:0 0 10px}.pvp-t th{background:var(--bg-hover);font-size:9px;text-transform:uppercase;text-align:left;padding:6px;border-bottom:1px solid var(--border)}' +
      '.pvp-t td{padding:6px;border-bottom:1px solid var(--border);vertical-align:top}.pvp-t .pvp-r{text-align:right;white-space:nowrap}.pvp-t tfoot td{font-weight:800;border-top:2px solid var(--text)}' +
      '.pvp-mu{color:var(--text-3);font-size:10px}.pvp-note{font-size:10px;color:var(--text-2);margin:0 0 14px}' +
      '.pvp-sgrid{display:grid;gap:12px;margin:22px 0 0;page-break-inside:avoid;break-inside:avoid}' +
      '.pvp-sg{text-align:center;min-width:0}.pvp-sgi{height:52px;display:flex;align-items:flex-end;justify-content:center}.pvp-sgi img{max-height:50px;max-width:100%;object-fit:contain}' +
      '.pvp-sgl{border-top:1px solid var(--text);margin:2px 6px 4px}.pvp-sgn{font-weight:700;font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.pvp-sgr{font-size:9px;color:var(--text-2);text-transform:uppercase}.pvp-sgd{font-size:9px;color:var(--text-3)}' +
      '.pvp-foot{margin:16px 0 0;font-size:9px;color:var(--text-3);text-align:center}' +
      '@media print{html.pvp-on body>*:not(#pvp-print){display:none!important}html.pvp-on #pvp-print{display:block!important}' +
      'html.pvp-on .pvp-sheet{background:none}.pvp-t th{-webkit-print-color-adjust:exact;print-color-adjust:exact}}';
    document.head.appendChild(s);
  }
  async function sheetHtml(d, docId) {
    var tn = d.tn || {}, acc = ''; try { acc = _pdocAccentGet('pv'); } catch (e) {}
    var addr = ''; try { addr = _pdocAddressLine(tn); } catch (e) {}
    var rows = d.lines.map(function (l, i) {
      return '<tr><td>' + (i + 1) + '</td><td><b>' + esc(l.payee_name || '') + '</b>' + (l.description ? '<div class="pvp-mu">' + esc(l.description) + '</div>' : '') + '</td>' +
        '<td>' + esc(bankOf(l) || '—') + '</td><td>' + esc(payOf(l)) + '</td><td>' + esc(X.catLabel(l.category) || '') + '</td><td class="pvp-r">' + esc(rm(l.amount)) + '</td></tr>';
    }).join('');
    var sig = ''; try { sig = window.PVS ? await PVS.printHtml(d.kind, docId, d.total) : ''; } catch (e) {}
    return '<div class="pvp-sheet"' + (acc ? ' style="--pdoc-accent:' + esc(acc) + '"' : '') + '>' +
      '<div class="pvp-h"><div class="pvp-co">' + (tn.logo_url ? '<img alt="" src="' + esc(tn.logo_url) + '">' : '') + '<div><div class="pvp-con">' + esc(tn.name || '') + '</div>' +
      (addr ? '<div class="pvp-cos">' + esc(addr) + '</div>' : '') + (tn.phone ? '<div class="pvp-cos">' + esc(tn.phone) + '</div>' : '') + '</div></div>' +
      '<div class="pvp-doc"><div class="pvp-dt">' + esc(docTitle(d.kind)) + '</div><div class="pvp-dm">' + esc(d.ref) + '</div><div class="pvp-dm">' + esc(L('Date', 'Tarikh') + ': ' + X.dmy(d.date)) + '</div>' +
      '<div class="pvp-dm">' + esc(L('Status', 'Status') + ': ' + X.stLabel(d.status)) + '</div></div></div>' +
      '<div class="pvp-sum"><div><span>' + esc(d.kind === 'pvd' ? L('Title', 'Tajuk') : L('Payee', 'Penerima')) + '</span><b>' + esc(d.title || '—') + '</b></div>' +
      '<div><span>' + esc(d.kind === 'pvd' ? L('Payees', 'Penerima') : L('Method', 'Kaedah')) + '</span><b>' + esc(d.kind === 'pvd' ? String(d.lines.length) : X.methodLabel(d.lines[0].payment_method)) + '</b></div>' +
      '<div><span>' + esc(L('Total', 'Jumlah')) + '</span><b>' + esc(rm(d.total)) + '</b></div></div>' +
      '<table class="pvp-t"><thead><tr><th>#</th><th>' + esc(L('Payee', 'Penerima')) + '</th><th>' + esc(L('Bank · Account no.', 'Bank · No. akaun')) + '</th><th>' + esc(L('Method', 'Kaedah')) + '</th><th>' + esc(L('Category', 'Kategori')) + '</th><th class="pvp-r">' + esc(L('Amount (RM)', 'Jumlah (RM)')) + '</th></tr></thead>' +
      '<tbody>' + rows + '</tbody><tfoot><tr><td colspan="5">' + esc(L('TOTAL', 'JUMLAH')) + '</td><td class="pvp-r">' + esc(rm(d.total)) + '</td></tr></tfoot></table>' +
      (d.note && d.kind === 'pvd' ? '<div class="pvp-note">' + esc(d.note) + '</div>' : '') + sig +
      '<div class="pvp-foot">' + esc(L('Generated by M-Core', 'Dijana oleh M-Core')) + '</div></div>';
  }
  var prev = null;
  function exitPrint() {
    var h = document.documentElement; h.classList.remove('pvp-on');
    if (prev === 'dark') h.setAttribute('data-theme', 'dark');
    prev = null; var p = $('pvp-print'); if (p) p.remove();
  }
  P.print = async function (kind, id) {
    css();
    try {
      X.toast(L('Preparing print…', 'Menyediakan cetakan…'));
      var d = await data(kind, id);
      var html = await sheetHtml(d, id);
      var p = $('pvp-print'); if (p) p.remove();
      p = document.createElement('div'); p.id = 'pvp-print'; p.innerHTML = html; document.body.appendChild(p);
      var h = document.documentElement; prev = h.getAttribute('data-theme');
      if (prev === 'dark') h.setAttribute('data-theme', 'light');
      h.classList.add('pvp-on');
      try { _pdocSetPageOrientation('portrait'); } catch (e) {}
      try { _pdocSetPrintFilename(fname(d).replace(/\.pdf$/, '')); } catch (e) {}
      var imgs = p.querySelectorAll('img'), wait = Array.prototype.map.call(imgs, function (im) { return im.complete ? null : new Promise(function (r) { im.onload = im.onerror = r; setTimeout(r, 2500); }); });
      await Promise.all(wait);
      window.addEventListener('afterprint', function () { setTimeout(exitPrint, 50); }, { once: true });
      setTimeout(function () { window.print(); setTimeout(function () { if (document.documentElement.classList.contains('pvp-on') && !window.matchMedia('print').matches) exitPrint(); }, 1500); }, 60);
    } catch (e) { exitPrint(); X.toast(L('Print failed: ', 'Gagal cetak: ') + X.errMsg(e), 'error'); }
  };

  /* ---------- PDF (pdf-lib) ---------- */
  function clean(s) {
    return String(s == null ? '' : s).replace(/[−–—]/g, '-').replace(/·/g, '|').replace(/…/g, '...').replace(/[\u00a0\u2007\u202f]/g, ' ')
      .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[^\x20-\x7E]/g, '');
  }
  function b64(dataUrl) { var s = atob(String(dataUrl).split(',')[1] || ''), u = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
  async function fetchBuf(url) {
    if (!url) return null;
    try { return await Promise.race([fetch(url).then(function (r) { return r.ok ? r.arrayBuffer() : null; }), new Promise(function (r) { setTimeout(function () { r(null); }, 3000); })]); } catch (e) { return null; }
  }
  async function embed(doc, buf) {
    if (!buf) return null; var u = new Uint8Array(buf);
    try { return u[0] === 0x89 ? await doc.embedPng(buf) : (u[0] === 0xFF ? await doc.embedJpg(buf) : null); } catch (e) { return null; }
  }
  async function pdfBytes(d, docId) {
    var PL = window.PDFLib; if (!PL) throw new Error(L('PDF library not loaded', 'Pustaka PDF tidak dimuatkan'));
    var doc = await PL.PDFDocument.create();
    var F = await doc.embedFont(PL.StandardFonts.Helvetica), B = await doc.embedFont(PL.StandardFonts.HelveticaBold);
    var acc = PL.rgb(0.055, 0.455, 0.565), ink = PL.rgb(0.06, 0.09, 0.16), mut = PL.rgb(0.39, 0.45, 0.55), line = PL.rgb(0.89, 0.91, 0.94), soft = PL.rgb(0.97, 0.98, 0.99);
    var W = 595.28, H = 841.89, x0 = 40, x1 = W - 40, pg = doc.addPage([W, H]), y = H - 44;
    var tx = function (s, x, yy, sz, f, c) { s = clean(s); if (s) pg.drawText(s, { x: x, y: yy, size: sz, font: f || F, color: c || ink }); };
    var rt = function (s, x, yy, sz, f, c) { s = clean(s); tx(s, x - (f || F).widthOfTextAtSize(s, sz), yy, sz, f, c); };
    var fit = function (s, sz, f, max) { s = clean(s); while (s.length > 1 && (f || F).widthOfTextAtSize(s, sz) > max) s = s.slice(0, -2) + '.'; return s; };
    var hline = function (yy, t) { pg.drawLine({ start: { x: x0, y: yy }, end: { x: x1, y: yy }, thickness: t || 0.6, color: line }); };
    var tn = d.tn || {}, lx = x0;
    var logo = await embed(doc, await fetchBuf(tn.logo_url));
    if (logo) { var sc = Math.min(40 / logo.width, 40 / logo.height); pg.drawImage(logo, { x: x0, y: y - 34, width: logo.width * sc, height: logo.height * sc }); lx = x0 + 50; }
    tx(fit(tn.name || '', 14, B, 290), lx, y - 8, 14, B, acc);
    var addr = ''; try { addr = _pdocAddressLine(tn); } catch (e) {}
    tx(fit(addr, 8, F, 290), lx, y - 21, 8, F, mut); tx(fit(tn.phone || '', 8, F, 290), lx, y - 31, 8, F, mut);
    rt(docTitle(d.kind), x1, y - 8, 12, B, ink);
    rt(d.ref, x1, y - 21, 9, F, mut); rt(L('Date', 'Tarikh') + ': ' + X.dmy(d.date), x1, y - 32, 9, F, mut); rt(L('Status', 'Status') + ': ' + X.stLabel(d.status), x1, y - 43, 9, F, mut);
    y -= 54; pg.drawLine({ start: { x: x0, y: y }, end: { x: x1, y: y }, thickness: 1.6, color: acc });
    y -= 18;
    tx(fit((d.kind === 'pvd' ? L('Title', 'Tajuk') : L('Payee', 'Penerima')) + ': ' + (d.title || '-'), 10, B, 330), x0, y, 10, B, ink);
    rt(L('Total', 'Jumlah') + ': ' + rm(d.total), x1, y, 11, B, acc);
    y -= 20;
    var C = [x0 + 4, x0 + 22, x0 + 170, x0 + 300, x0 + 380], RX = x1 - 4;
    var head = function () {
      pg.drawRectangle({ x: x0, y: y - 6, width: x1 - x0, height: 18, color: soft });
      [['#', 0], [L('PAYEE', 'PENERIMA'), 1], [L('BANK | ACCOUNT', 'BANK | AKAUN'), 2], [L('METHOD', 'KAEDAH'), 3], [L('CATEGORY', 'KATEGORI'), 4]].forEach(function (h) { tx(h[0], C[h[1]], y, 7.5, B, mut); });
      rt(L('AMOUNT (RM)', 'JUMLAH (RM)'), RX, y, 7.5, B, mut); y -= 18;
    };
    head();
    d.lines.forEach(function (l, i) {
      var hgt = l.description ? 26 : 16;
      if (y - hgt < 170 && i < d.lines.length - 1) { pg = doc.addPage([W, H]); y = H - 50; head(); }
      tx(String(i + 1), C[0], y, 9, F, mut);
      tx(fit(l.payee_name || '', 9, B, C[2] - C[1] - 6), C[1], y, 9, B, ink);
      tx(fit(bankOf(l) || '-', 8.5, F, C[3] - C[2] - 6), C[2], y, 8.5, F, ink);
      tx(fit(payOf(l), 8.5, F, C[4] - C[3] - 6), C[3], y, 8.5, F, ink);
      tx(fit(X.catLabel(l.category) || '', 8.5, F, RX - 70 - C[4]), C[4], y, 8.5, F, ink);
      rt(rm(l.amount).replace(/^RM\s*/, ''), RX, y, 9, F, ink);
      if (l.description) tx(fit(l.description, 7.5, F, C[3] - C[1] - 6), C[1], y - 10, 7.5, F, mut);
      y -= hgt - 4; hline(y + 4); y -= 8;
    });
    pg.drawLine({ start: { x: x0, y: y + 8 }, end: { x: x1, y: y + 8 }, thickness: 1.2, color: ink });
    tx(L('TOTAL', 'JUMLAH'), C[1], y - 4, 10, B, ink); rt(rm(d.total), RX, y - 4, 10, B, ink);
    y -= 30;
    if (d.kind === 'pvd' && d.note) { tx(fit(d.note, 8.5, F, x1 - x0), x0, y, 8.5, F, mut); y -= 16; }
    // signatures
    var cells = [];
    try {
      var set = await X.settings(), req = X.requiredRoles(set, d.total);
      cells = (window.PVS ? await PVS.images(d.kind, docId) : X.ROLES.map(function (r) { return { role: r.r, label: X.roleLabel(r.r), name: '', date: '', img: '' }; }))
        .filter(function (c) { return req.indexOf(c.role) >= 0 || c.name; });
    } catch (e) {}
    if (cells.length) {
      if (y < 120) { pg = doc.addPage([W, H]); y = H - 60; }
      var cw = (x1 - x0) / cells.length;
      for (var i = 0; i < cells.length; i++) {
        var c = cells[i], cx = x0 + cw * i, by = y - 56;
        if (c.img) {
          var im = null; try { im = /^data:image\/png/.test(c.img) ? await doc.embedPng(b64(c.img)) : await doc.embedJpg(b64(c.img)); } catch (e) { im = null; }
          if (im) { var s2 = Math.min((cw - 20) / im.width, 46 / im.height); pg.drawImage(im, { x: cx + (cw - im.width * s2) / 2, y: by + 4, width: im.width * s2, height: im.height * s2 }); }
        }
        pg.drawLine({ start: { x: cx + 8, y: by }, end: { x: cx + cw - 8, y: by }, thickness: 0.8, color: ink });
        var ctr = function (s, yy, sz, f, col) { s = fit(s, sz, f, cw - 10); tx(s, cx + (cw - f.widthOfTextAtSize(s, sz)) / 2, yy, sz, f, col); };
        ctr(c.name || ' ', by - 11, 8.5, B, ink); ctr(String(c.label).toUpperCase(), by - 21, 7, F, mut); ctr(L('Date', 'Tarikh') + ': ' + (c.date || ''), by - 30, 7, F, mut);
      }
    }
    var pages = doc.getPages();
    pages.forEach(function (p, k) { var s = clean(d.ref + '  |  ' + (k + 1) + '/' + pages.length + '  |  M-Core'); p.drawText(s, { x: (W - F.widthOfTextAtSize(s, 7)) / 2, y: 22, size: 7, font: F, color: mut }); });
    return await doc.save();
  }
  function fileOf(bytes, name) { try { return new File([bytes], name, { type: 'application/pdf' }); } catch (e) { var b = new Blob([bytes], { type: 'application/pdf' }); b.name = name; return b; } }
  function dl(f) { var u = URL.createObjectURL(f), a = document.createElement('a'); a.href = u; a.download = f.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 4000); }
  P.file = async function (kind, id) { var d = await data(kind, id); return fileOf(await pdfBytes(d, id), fname(d)); };
  P.pdf = async function (kind, id, o) {
    o = o || {};
    if (o.download) X.toast(L('Preparing PDF…', 'Menyediakan PDF…'));
    try { var f = await P.file(kind, id); if (o.download) { dl(f); X.toast(L('PDF downloaded', 'PDF dimuat turun'), 'success'); } return f; }
    catch (e) { X.toast(L('PDF failed: ', 'PDF gagal: ') + X.errMsg(e), 'error'); return null; }
  };

  /* ---------- WhatsApp PDF share ---------- */
  function canFiles() { try { return !!(navigator.canShare && navigator.canShare({ files: [new File(['x'], 'x.pdf', { type: 'application/pdf' })] })); } catch (e) { return false; } }
  var active = null;
  P.sharePdf = async function (kind, id) {
    var W = window.WAD; if (!W) return X.toast(L('WhatsApp share not available', 'Kongsi WhatsApp tiada'), 'error');
    var d; try { d = await data(kind, id); } catch (e) { return X.toast(X.errMsg(e), 'error'); }
    var pdfP = null, getPdf = function () { return pdfP || (pdfP = P.file(kind, id).catch(function () { return null; })); };
    active = { pdf: getPdf, seen: false };
    W.open({
      docType: kind, docId: id, docRef: d.ref, to: d.to, phone: d.phone || '', recipientKind: 'other',
      k: 'pv_pdf', tpls: [{ k: 'pv_pdf', label: 'pvPdf', desc: 'pvPdfD' }], file: getPdf,
      build: function (k, lang) {
        var bmL = lang === 'bm', co = (W.company && W.company()) || (d.tn && d.tn.name) || '';
        var nm = kind === 'pv' && d.to ? d.to : '';
        var text = bmL
          ? (nm ? 'Salam ' + nm + ',\n' : '') + (kind === 'pvd' ? 'Penyaluran baucar bayaran ' : 'Baucar bayaran ') + d.ref + ' (' + X.dmy(d.date) + ') dilampirkan sebagai PDF.\n– ' + co
          : (nm ? 'Hi ' + nm + ',\n' : '') + (kind === 'pvd' ? 'Payment voucher disbursement ' : 'Payment voucher ') + d.ref + ' (' + X.dmy(d.date) + ') is attached as a PDF.\n– ' + co;
        return { text: text };
      }
    });
  };
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest && e.target.closest('.wad-bg [data-a=send]');
    if (!b || !active || b.disabled) return;
    var a = active;
    if (!canFiles()) a.pdf().then(function (f) { if (f) { dl(f); X.toast(L('PDF downloaded — attach it in WhatsApp', 'PDF dimuat turun — lampirkan dalam WhatsApp'), 'success'); } });
  }, true);
  setInterval(function () { if (!active) return; if (document.querySelector('.wad-bg')) active.seen = true; else if (active.seen) active = null; }, 800);
})();
