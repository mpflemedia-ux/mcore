/* dk-doc.js — M-Core document kit (window.DKD). Reads the final .pdoc paper markup into a model, renders it as an
   on-screen card view (all widths) with a sticky action footer, keeps the paper hidden on screen (.dk-src) but printed
   (light A4, "like SD"), adds print signature boxes, and builds an A4 PDF with pdf-lib. Tokens only on screen. v3 (docked sticky action bar) */
(function () {
  if (window.DKD) return;
  function bm() { try { return APP.language === 'bm'; } catch (e) { return false; } }
  function L(en, b) { return bm() ? b : en; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function txt(el) { return el ? String(el.innerText != null && el.innerText !== '' ? el.innerText : el.textContent || '').replace(/[ \t]+/g, ' ').trim() : ''; }
  function toast(m, k) { try { showToast(m, k || 'success'); } catch (e) {} }

  var css = '' +
    '.dk-doc{max-width:820px;margin:0 auto 16px;display:flex;flex-direction:column;gap:12px;min-width:0}' +
    '.dk-doc-card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);box-shadow:var(--shadow-sm,none);padding:14px 16px;min-width:0;overflow:hidden}' +
    '.dk-doc-hd{display:flex;gap:12px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap}' +
    '.dk-doc-co{display:flex;gap:10px;align-items:center;min-width:0}.dk-doc-co img{width:40px;height:40px;object-fit:contain;border-radius:var(--radius-sm,6px);flex:0 0 auto}' +
    '.dk-doc-co b{display:block;font-size:15px;color:var(--text);overflow-wrap:anywhere}.dk-doc-co small{display:block;color:var(--text-3);font-size:12px;overflow-wrap:anywhere}' +
    '.dk-doc-ti{font-size:11.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--primary);white-space:nowrap}' +
    '.dk-doc-meta{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px 14px;margin-top:12px}' +
    '.dk-doc-meta div{min-width:0}.dk-doc-meta span{display:block;font-size:11.5px;color:var(--text-3)}.dk-doc-meta b{display:block;font-size:13.5px;color:var(--text);overflow-wrap:anywhere}' +
    '.dk-doc-lb{font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--text-3);margin:0 0 8px}' +
    '.dk-doc-party b{font-size:15px;color:var(--text);display:block;overflow-wrap:anywhere}.dk-doc-party div{font-size:13px;color:var(--text-2);overflow-wrap:anywhere;white-space:pre-line}' +
    '.dk-doc-it{display:flex;gap:10px;justify-content:space-between;align-items:flex-start;padding:9px 0;border-bottom:1px solid var(--border);min-width:0}.dk-doc-it:last-child{border-bottom:0}' +
    '.dk-doc-it>div{min-width:0}.dk-doc-it b{font-size:13.5px;color:var(--text);display:block;overflow-wrap:anywhere;font-weight:600}.dk-doc-it small{font-size:12px;color:var(--text-3)}' +
    '.dk-doc-it>span{font-weight:700;white-space:nowrap;color:var(--text);font-size:13.5px}' +
    '.dk-doc-tot{display:flex;justify-content:space-between;gap:10px;padding:4px 0;font-size:13.5px;color:var(--text-2)}.dk-doc-tot span:last-child{white-space:nowrap}' +
    '.dk-doc-tot.g{border-top:2px solid var(--primary);margin-top:6px;padding-top:10px;font-weight:800;font-size:16px;color:var(--text)}.dk-doc-tot.g span:last-child{color:var(--primary)}' +
    '.dk-doc-note{font-size:13px;color:var(--text-2);white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.5}' +
    '.dk-doc-note img{max-width:160px;height:auto;display:block;margin:6px 0;background:#fff;border-radius:var(--radius-sm,6px)}' +
    '.dk-doc-ft{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.dk-doc-ft .btn{white-space:nowrap}' +
    /* v2 sticky action bar: a docked bar (solid page bg + top border token), not a floating card. It is the LAST child of
       .dk-doc so it only pins while the document is on screen, then parks under the last card (signatures/timeline) —
       never on top of it once you reach the end. Full width of the doc column, safe-area aware, single-line buttons. */
    '.dk-doc-ft.sticky{position:sticky;bottom:calc(-1 * var(--dk-ft-off,0px));z-index:30;background:var(--bg);border-top:1px solid var(--border);margin:0;' +
    'padding:10px 0 calc(10px + env(safe-area-inset-bottom,0px));flex-wrap:wrap}' +
    '.dk-doc-ft.sticky .btn{flex:1 1 0;min-width:max-content;justify-content:center}' +
    '@media(max-width:900px){.dk-doc-ft.sticky{padding-right:60px}}' + /* clear the bottom-right FAB stack, same as SD */
    '@media(min-width:901px){.dk-doc-ft.sticky{position:static;border-top:0;background:transparent;padding:4px 0 0}.dk-doc-ft.sticky .btn{flex:0 0 auto}}' +
    '.dk-doc:has(>.dk-doc-ft.sticky){scroll-margin-bottom:64px}' +
    '.dk-sigbox{display:none}' +
    '.pdoc.dk-gen .pdoc-table th{text-align:left;padding:8px 10px;font-size:11px;text-transform:uppercase;letter-spacing:.04em}.pdoc.dk-gen .pdoc-table td{padding:8px 10px;vertical-align:top}.pdoc.dk-gen .pdoc-table .r{text-align:right;white-space:nowrap}' +
    '.pdoc.dk-gen .dk-ptot{max-width:300px;margin:12px 0 0 auto}.pdoc.dk-gen .dk-ptot>div{display:flex;justify-content:space-between;gap:12px;padding:4px 0;font-size:13px}.pdoc.dk-gen .dk-ptot>div.g{font-weight:800;font-size:15px;margin-top:4px;padding-top:8px}' +
    '.pdoc.dk-gen .pdoc-notes{margin-top:14px;font-size:12px;white-space:pre-wrap;line-height:1.5}' +
    '@media print{.dk-doc{display:none!important}.pdoc.dk-src{display:block!important}.dk-sigbox{display:table!important}' +
    'body.dk-print-one .pdoc:not(.dk-one),body.dk-print-one .pdoc.dk-src:not(.dk-one){display:none!important}body.dk-print-one .pdoc.dk-one{display:block!important}}' +
    '.pdoc.dk-one.dk-tmp{position:fixed;left:-10000px;top:0;width:794px}@media print{.pdoc.dk-one.dk-tmp{position:static;left:auto;width:auto}}';
  function addCss() { if (document.getElementById('dk-doc-css')) return; var s = document.createElement('style'); s.id = 'dk-doc-css'; s.textContent = css; document.head.appendChild(s); }

  /* ---------- parse .pdoc → model ---------- */
  function parse(p, extra) {
    extra = extra || {};
    var m = { co: '', sub: '', logo: '', title: '', meta: [], party: null, cols: [], rows: [], tots: [], notes: [], sigs: extra.sigs || [], foot: '', accent: '' };
    if (!p) return m;
    m.co = txt(p.querySelector('.pdoc-company-name'));
    m.sub = txt(p.querySelector('.pdoc-company-sub'));
    var im = p.querySelector('.pdoc-logo-row img'); m.logo = im ? im.getAttribute('src') || '' : '';
    m.title = txt(p.querySelector('.pdoc-title-bar'));
    var meta = p.querySelector('.pdoc-meta');
    if (meta) String(meta.innerHTML).split(/<br\s*\/?>/i).forEach(function (h) {
      var d = document.createElement('div'); d.innerHTML = h; var s = txt(d); if (!s) return;
      var i = s.indexOf(':'); m.meta.push(i > 0 ? { k: s.slice(0, i).trim(), v: s.slice(i + 1).trim() } : { k: '', v: s });
    });
    var band = p.querySelector('.pdoc-band');
    if (band) m.party = { name: txt(band.querySelector('.pdoc-band-name')), lines: Array.prototype.map.call(band.querySelectorAll('.pdoc-band-sub,.pdoc-band-item'), txt).filter(Boolean) };
    var tb = Array.prototype.filter.call(p.querySelectorAll('table.pdoc-table'), function (t) { return t.querySelector('thead'); })[0];
    if (tb) {
      m.cols = Array.prototype.map.call(tb.querySelectorAll('thead th'), txt);
      Array.prototype.forEach.call(tb.querySelectorAll('tbody tr'), function (tr) {
        var c = Array.prototype.map.call(tr.children, txt);
        if (c.length >= 2 || (c.length === 1 && c[0])) m.rows.push(c);
      });
      if (m.rows.length === 1 && m.rows[0].length === 1) m.rows = [];
    }
    // totals: flex rows with two spans
    Array.prototype.forEach.call(p.querySelectorAll('div'), function (d) {
      if (d.closest('.pdoc-header,.pdoc-band,table,.no-print,.pdoc-pay-block')) return;
      var sp = d.children; if (sp.length !== 2 || sp[0].tagName !== 'SPAN' || sp[1].tagName !== 'SPAN') return;
      if (!/space-between/.test(d.getAttribute('style') || '')) return;
      m.tots.push({ k: txt(sp[0]), v: txt(sp[1]), g: /border-top/.test(d.getAttribute('style') || '') });
    });
    var pay = p.querySelector('.pdoc-pay-block');
    if (pay) { var q = pay.querySelector('img'); m.notes.push({ k: txt(pay.firstElementChild) || L('Payment', 'Pembayaran'), v: Array.prototype.slice.call(pay.children, 1).filter(function (x) { return x.tagName !== 'IMG'; }).map(txt).filter(Boolean).join('\n'), img: q ? q.getAttribute('src') : '' }); }
    Array.prototype.forEach.call(p.querySelectorAll('.pdoc-inv-terms,.pdoc-terms,.pdoc-notes,[data-dk-note]'), function (n) { var s = txt(n.querySelector('.dk-nv') || n); if (s) m.notes.push({ k: n.getAttribute('data-dk-note') || L('Terms', 'Terma'), v: s }); });
    m.foot = txt(p.querySelector('.pdoc-footer-note'));
    try { m.accent = getComputedStyle(p).getPropertyValue('--pdoc-accent').trim(); } catch (e) {}
    Object.keys(extra).forEach(function (k) { if (k !== 'sigs') m[k] = extra[k]; });
    return m;
  }

  /* ---------- screen card view ---------- */
  function money(s) { return /\d/.test(s || ''); }
  function itemsHtml(m) {
    if (!m.rows.length) return '';
    var c = m.cols, n = c.length;
    return '<div class="dk-doc-card"><div class="dk-doc-lb">' + esc(c[0] || L('Items', 'Item')) + ' (' + m.rows.length + ')</div>' + m.rows.map(function (r) {
      if (r.length === 1) return '<div class="dk-doc-it"><div><small>' + esc(r[0]) + '</small></div></div>';
      var last = r[r.length - 1], mid = [];
      for (var i = 1; i < r.length - 1; i++) if (r[i]) mid.push((c[i] && n > 3 ? c[i] + ' ' : '') + r[i]);
      if (r.length === 2 && !money(last)) { mid.push(last); last = ''; }
      return '<div class="dk-doc-it"><div><b>' + esc(r[0]) + '</b>' + (mid.length ? '<small>' + esc(mid.join(' · ')) + '</small>' : '') + '</div>' + (last ? '<span>' + esc(last) + '</span>' : '') + '</div>';
    }).join('') + '</div>';
  }
  function view(m, o) {
    o = o || {};
    var meta = m.meta.filter(function (x) { return x.v; });
    var h = '<div class="dk-doc-card"><div class="dk-doc-hd"><div class="dk-doc-co">' + (m.logo ? '<img src="' + esc(m.logo) + '" alt="">' : '') + '<div><b>' + esc(m.co) + '</b>' + (m.sub ? '<small>' + esc(m.sub) + '</small>' : '') + '</div></div>' +
      '<div class="dk-doc-ti">' + esc(m.title) + '</div></div>' +
      (meta.length ? '<div class="dk-doc-meta">' + meta.map(function (x) { return '<div><span>' + esc(x.k) + '</span><b>' + esc(x.v) + '</b></div>'; }).join('') + '</div>' : '') + '</div>';
    if (m.party && (m.party.name || m.party.lines.length)) h += '<div class="dk-doc-card dk-doc-party"><div class="dk-doc-lb">' + esc(o.partyLabel || L('Bill to', 'Kepada')) + '</div><b>' + esc(m.party.name) + '</b>' + m.party.lines.map(function (l) { return '<div>' + esc(l) + '</div>'; }).join('') + '</div>';
    h += itemsHtml(m);
    if (m.tots.length) h += '<div class="dk-doc-card">' + m.tots.map(function (t) { return '<div class="dk-doc-tot' + (t.g ? ' g' : '') + '"><span>' + esc(t.k) + '</span><span>' + esc(t.v) + '</span></div>'; }).join('') + '</div>';
    (m.notes || []).forEach(function (n) { h += '<div class="dk-doc-card"><div class="dk-doc-lb">' + esc(n.k) + '</div>' + (n.img ? '<div class="dk-doc-note"><img src="' + esc(n.img) + '" alt="QR"></div>' : '') + '<div class="dk-doc-note">' + esc(n.v) + '</div></div>'; });
    if (o.extraHtml) h += o.extraHtml;
    h += '<div class="dk-doc-sign"></div><div class="dk-doc-tl"></div>';
    h += '<div class="dk-doc-ft sticky no-print"></div>';
    return h;
  }
  /* mount(pdoc, {doc, id, ref, actions:[{label, icon, cls, onClick}], sign:true, print:true, pdf:true, share:true, partyLabel, name}) */
  /* Sticky offsets are measured from the scroll container's PADDING edge, so #main's padding-bottom (24px, or 84px when a
     payslip bar class lingers) left the bar hovering above the screen edge with content peeking under it. Pull it down by
     the scroller's actual padding-bottom so it docks flush to the bottom of the viewport. */
  function scroller(el) { for (var n = el.parentElement; n && n !== document.body; n = n.parentElement) { var oy = getComputedStyle(n).overflowY; if (oy === 'auto' || oy === 'scroll') return n; } return null; }
  function dockFt(ft) {
    var fit = function () { if (!ft.isConnected) { window.removeEventListener('resize', fit); return; } var sc = scroller(ft); var pb = sc ? parseFloat(getComputedStyle(sc).paddingBottom) || 0 : 0; ft.style.setProperty('--dk-ft-off', pb + 'px'); };
    fit(); window.addEventListener('resize', fit);
  }
  function mount(p, o) {
    addCss(); o = o || {};
    if (!p || !p.parentNode) return null;
    var hs = p.parentNode; // undo the phone h-scroll wrapper (pv-preview-scroll) — the card view replaces it
    if (hs.classList && hs.classList.contains('pdoc-hscroll')) { hs.parentNode.insertBefore(p, hs); hs.remove(); p.style.minWidth = ''; p.style.maxWidth = ''; p.style.margin = ''; }
    p.classList.add('dk-src');
    var prev = p.previousElementSibling; if (prev && prev.classList.contains('dk-doc')) prev.remove();
    var m = parse(p, o.model);
    var w = document.createElement('div'); w.className = 'dk-doc no-print'; w.innerHTML = view(m, o);
    p.parentNode.insertBefore(w, p); p.classList.add('dk-src');
    var ft = w.querySelector('.dk-doc-ft'), acts = [];
    if (o.share !== false && o.doc && window.DKS && DKS.has(o.doc)) acts.push({ label: 'WhatsApp', icon: 'ti-brand-whatsapp', cls: 'btn-outline dk-wa', onClick: function () { DKS.share(o.doc, o.id); } });
    if (o.pdf !== false) acts.push({ label: 'PDF', icon: 'ti-file-download', cls: 'btn-outline', onClick: function (b) { busy(b, file(parse(p, o.model), o.name).then(download)); } });
    if (o.print !== false) acts.push({ label: L('Print', 'Cetak'), icon: 'ti-printer', cls: 'btn-outline', onClick: function () { print(p, o); } });
    (o.actions || []).forEach(function (a) { acts.push(a); });
    acts.forEach(function (a) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-sm ' + (a.cls || 'btn-outline');
      b.innerHTML = (a.icon ? '<i class="ti ' + a.icon + '"></i> ' : '') + esc(a.label); b.onclick = function () { a.onClick(b); };
      if (a.disabled) b.disabled = true; ft.appendChild(b);
    });
    if (!acts.length) ft.remove(); else dockFt(ft);
    if (o.sign !== false && o.doc && window.DKSign && DKSign.has(o.doc)) DKSign.panel(w.querySelector('.dk-doc-sign'), o.doc, o.id, { pdoc: p, ref: o.ref });
    if (o.id && o.doc && o.timeline !== false && window.DK && DK.timeline) {
      var tl = w.querySelector('.dk-doc-tl'); tl.className = 'dk-doc-card dk-doc-tl';
      tl.innerHTML = '<div class="dk-doc-lb">' + esc(L('Timeline', 'Garis masa')) + '</div><div style="color:var(--text-3);font-size:13px">' + esc(L('Loading history…', 'Memuat sejarah…')) + '</div>';
      DK.timeline(o.doc, o.id).then(function (ev) { tl.innerHTML = '<div class="dk-doc-lb">' + esc(L('Timeline', 'Garis masa')) + '</div><div class="dk-tl" style="margin:0;border:0;padding:0">' + DK.tlHtml(ev) + '</div>'; }, function () { tl.remove(); });
    } else { var t0 = w.querySelector('.dk-doc-tl'); if (t0) t0.remove(); }
    return { el: w, model: m };
  }
  function busy(b, pr) { if (b) b.classList.add('dk-busy'); return Promise.resolve(pr).then(function (x) { if (b) b.classList.remove('dk-busy'); return x; }, function (e) { if (b) b.classList.remove('dk-busy'); toast(L('PDF failed: ', 'PDF gagal: ') + (e && e.message || e), 'error'); }); }

  /* ---------- print: light A4 from the paper (+ signature boxes) ---------- */
  function sigBoxes(p, slots) {
    if (!p) return; var old = p.querySelector('.dk-sigbox'); if (old) old.remove();
    if (!slots || !slots.length) return;
    var cells = slots.map(function (s) {
      return '<td style="text-align:center;vertical-align:top;padding:0 10px;border:none;background:transparent">' +
        '<div style="height:44px;font-size:10px;color:#64748B;display:flex;align-items:flex-end;justify-content:center">' + (s.at ? esc(s.at) : '') + '</div>' +
        '<div style="width:140px;margin:0 auto 6px;border-top:1.5px solid #334155;height:0"></div>' +
        '<div style="font-size:12px;font-weight:600;color:#0F172A;min-height:15px">' + esc(s.name || '') + '</div>' +
        '<div style="font-size:8px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:#64748B">' + esc(s.label || '') + '</div></td>';
    }).join('');
    var t = document.createElement('table'); t.className = 'dk-sigbox pdoc-sig-print-table';
    t.style.cssText = 'width:100%;margin:20px 0 8px;border-collapse:collapse;table-layout:fixed'; t.innerHTML = '<tr>' + cells + '</tr>';
    var ft = p.querySelector('.pdoc-footer-note'); if (ft) p.insertBefore(t, ft); else p.appendChild(t);
  }
  function print(p, o) {
    o = o || {};
    try { if (o.title && typeof _pdocSetTitle === 'function') _pdocSetTitle(o.title); } catch (e) {}
    document.body.classList.add('dk-printing');
    setTimeout(function () { try { window.print(); } finally { document.body.classList.remove('dk-printing'); try { if (typeof _pdocRestoreTitle === 'function') _pdocRestoreTitle(); } catch (e) {} } }, 60);
  }

  /* ---------- PDF (pdf-lib, A4) ---------- */
  function clean(s) {
    return String(s == null ? '' : s).replace(/[−–—]/g, '-').replace(/·/g, '.').replace(/…/g, '...').replace(/[\u00a0\u2007\u202f]/g, ' ')
      .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/×/g, 'x').replace(/[^\x20-\x7E\n]/g, '');
  }
  function fetchBuf(url) {
    if (!url) return Promise.resolve(null);
    return Promise.race([fetch(url).then(function (r) { return r.ok ? r.arrayBuffer() : null; }), new Promise(function (res) { setTimeout(function () { res(null); }, 3000); })]).catch(function () { return null; });
  }
  function hexRgb(P, h, d) { var x = /^#?([0-9a-f]{6})$/i.exec(String(h || '').trim()); if (!x) return d; var n = parseInt(x[1], 16); return P.rgb((n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255); }
  async function embedImg(doc, url) {
    var buf = await fetchBuf(url); if (!buf) return null;
    try { var u = new Uint8Array(buf); return u[0] === 0x89 ? await doc.embedPng(buf) : (u[0] === 0xFF ? await doc.embedJpg(buf) : null); } catch (e) { return null; }
  }
  async function pdfOf(models) {
    var P = window.PDFLib; if (!P) throw new Error('PDF library not loaded');
    models = [].concat(models);
    var doc = await P.PDFDocument.create();
    var F = await doc.embedFont(P.StandardFonts.Helvetica), B = await doc.embedFont(P.StandardFonts.HelveticaBold);
    var ink = P.rgb(0.06, 0.09, 0.16), mut = P.rgb(0.39, 0.45, 0.55), line = P.rgb(0.89, 0.91, 0.94), soft = P.rgb(0.97, 0.98, 0.99), white = P.rgb(1, 1, 1);
    var W = 595.28, H = 841.89, X = 40, R = W - 40;
    for (var mi = 0; mi < models.length; mi++) {
      var m = models[mi], acc = hexRgb(P, m.accent, P.rgb(0.055, 0.455, 0.565)), pg = doc.addPage([W, H]), y = H - 42;
      var need = function (h) { if (y - h < 50) { pg = doc.addPage([W, H]); y = H - 42; } };
      var tx = function (s, x, yy, sz, f, c) { s = clean(s).replace(/\n/g, ' '); if (s) pg.drawText(s, { x: x, y: yy, size: sz, font: f || F, color: c || ink }); };
      var fit = function (s, sz, f, max) { s = clean(s).replace(/\n/g, ' '); while (s.length > 1 && (f || F).widthOfTextAtSize(s, sz) > max) s = s.slice(0, -2) + '.'; return s; };
      var rt = function (s, x, yy, sz, f, c) { s = clean(s).replace(/\n/g, ' '); tx(s, x - (f || F).widthOfTextAtSize(s, sz), yy, sz, f, c); };
      var wrap = function (s, sz, f, max) { var out = []; clean(s).split('\n').forEach(function (para) { var cur = ''; para.split(' ').forEach(function (w) { var t = cur ? cur + ' ' + w : w; if ((f || F).widthOfTextAtSize(t, sz) > max && cur) { out.push(cur); cur = w; } else cur = t; }); out.push(cur); }); return out; };
      // header
      var lx = X, img = m.logo ? await embedImg(doc, m.logo) : null;
      if (img) { var sc = Math.min(40 / img.width, 40 / img.height); pg.drawImage(img, { x: X, y: y - 34, width: img.width * sc, height: img.height * sc }); lx = X + 50; }
      tx(fit(m.co, 15, B, 280), lx, y - 8, 15, B, acc);
      var sl = wrap(m.sub, 8.5, F, 270).slice(0, 3); sl.forEach(function (s, i) { tx(s, lx, y - 22 - i * 11, 8.5, F, mut); });
      var my = y - 8; m.meta.forEach(function (x) { rt(fit((x.k ? x.k + ': ' : '') + x.v, 9, F, 220), R, my, 9, F, mut); my -= 13; });
      y = Math.min(y - 44 - Math.max(0, sl.length - 1) * 11, my - 4);
      pg.drawRectangle({ x: X, y: y - 22, width: R - X, height: 22, color: acc });
      var tw = B.widthOfTextAtSize(clean(m.title).toUpperCase(), 11); tx(clean(m.title).toUpperCase(), (W - tw) / 2, y - 15, 11, B, white); y -= 22;
      if (m.party && (m.party.name || m.party.lines.length)) {
        var pl = []; m.party.lines.forEach(function (l) { pl = pl.concat(wrap(l, 9.5, F, R - X - 24)); });
        var ph = 26 + pl.length * 12; pg.drawRectangle({ x: X, y: y - ph, width: R - X, height: ph, color: soft });
        tx(fit(m.party.name, 12, B, R - X - 24), X + 12, y - 18, 12, B, ink); pl.forEach(function (l, i) { tx(l, X + 12, y - 32 - i * 12, 9.5, F, mut); }); y -= ph;
      }
      // items table
      if (m.cols.length) {
        var n = m.cols.length, cw = n > 1 ? Math.min(90, (R - X) * 0.5 / (n - 1)) : 0, c0 = R - X - cw * (n - 1);
        need(40); y -= 6; pg.drawRectangle({ x: X, y: y - 20, width: R - X, height: 20, color: soft });
        m.cols.forEach(function (c, i) { var s = fit(String(c).toUpperCase(), 8, B, (i ? cw : c0) - 14); if (!i) tx(s, X + 10, y - 13, 8, B, mut); else rt(s, X + c0 + cw * i - 8, y - 13, 8, B, mut); });
        y -= 20;
        m.rows.forEach(function (r) {
          var dl = wrap(r[0], 9.5, F, c0 - 20).slice(0, 4), rh = Math.max(18, dl.length * 12 + 8); need(rh);
          dl.forEach(function (s, i) { tx(s, X + 10, y - 13 - i * 12, 9.5, F, ink); });
          for (var i = 1; i < r.length && i < n; i++) rt(fit(r[i], 9.5, i === n - 1 ? B : F, cw - 10), X + c0 + cw * i - 8, y - 13, 9.5, i === n - 1 ? B : F, ink);
          y -= rh; pg.drawLine({ start: { x: X, y: y }, end: { x: R, y: y }, thickness: 0.5, color: line });
        });
      }
      // totals
      if (m.tots.length) {
        need(18 * m.tots.length + 14); y -= 10; var tx0 = R - 240;
        m.tots.forEach(function (t) {
          if (t.g) { pg.drawLine({ start: { x: tx0, y: y - 2 }, end: { x: R, y: y - 2 }, thickness: 1.5, color: acc }); y -= 6; }
          y -= t.g ? 16 : 14; tx(fit(t.k, t.g ? 11.5 : 9.5, t.g ? B : F, 140), tx0, y, t.g ? 11.5 : 9.5, t.g ? B : F, t.g ? ink : mut);
          rt(t.v, R, y, t.g ? 11.5 : 9.5, t.g ? B : F, t.g ? acc : ink);
        });
      }
      // notes (payment block, terms)
      for (var ni = 0; ni < (m.notes || []).length; ni++) {
        var nt = m.notes[ni], nl = wrap(nt.v, 9, F, R - X - 20), qr = nt.img ? await embedImg(doc, nt.img) : null, qh = qr ? 110 : 0;
        need(30 + Math.min(nl.length, 40) * 11 + qh); y -= 18; tx(String(nt.k).toUpperCase(), X, y, 8, B, acc); y -= 4;
        if (qr) { var qs = Math.min(100 / qr.width, 100 / qr.height); pg.drawImage(qr, { x: X, y: y - 104, width: qr.width * qs, height: qr.height * qs }); y -= qh; }
        nl.slice(0, 60).forEach(function (s) { need(12); y -= 11; tx(s, X, y, 9, F, ink); });
      }
      // signature boxes
      if (m.sigs && m.sigs.length) {
        need(90); y -= 54; var sw = (R - X) / m.sigs.length;
        m.sigs.forEach(function (s, i) {
          var cx = X + sw * i + sw / 2, lw = Math.min(140, sw - 20);
          if (s.at) { var a = clean(s.at); tx(a, cx - F.widthOfTextAtSize(a, 8) / 2, y + 8, 8, F, mut); }
          pg.drawLine({ start: { x: cx - lw / 2, y: y }, end: { x: cx + lw / 2, y: y }, thickness: 1, color: ink });
          var nm = fit(s.name || '', 10, B, sw - 10); tx(nm, cx - B.widthOfTextAtSize(nm, 10) / 2, y - 14, 10, B, ink);
          var lb = fit(String(s.label || '').toUpperCase(), 7.5, B, sw - 10); tx(lb, cx - B.widthOfTextAtSize(lb, 7.5) / 2, y - 26, 7.5, B, mut);
        });
        y -= 34;
      }
      if (m.foot) { var fw = F.widthOfTextAtSize(fit(m.foot, 8, F, R - X), 8); tx(fit(m.foot, 8, F, R - X), (W - fw) / 2, 30, 8, F, mut); }
    }
    return await doc.save();
  }
  function fileOf(bytes, name) { try { return new File([bytes], name, { type: 'application/pdf' }); } catch (e) { var b = new Blob([bytes], { type: 'application/pdf' }); b.name = name; return b; } }
  function fname(m) { return clean(((m.title || 'Document') + ' ' + ((m.meta[0] && m.meta[0].v) || '')).trim()).replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') + '.pdf'; }
  function file(models, name) { var ms = [].concat(models); return pdfOf(ms).then(function (b) { return fileOf(b, name || fname(ms[0])); }); }
  function download(f) { if (!f) return f; var u = URL.createObjectURL(f), a = document.createElement('a'); a.href = u; a.download = f.name || 'document.pdf'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 4000); toast(L('PDF downloaded', 'PDF dimuat turun')); return f; }

  /* ---------- paper: model → .pdoc markup (existing pdoc classes; round-trips through parse) ---------- */
  function paper(m, o) {
    m = m || {}; o = o || {};
    var h = '<div class="pdoc-header"><div class="pdoc-logo-row">' + (m.logo ? '<img src="' + esc(m.logo) + '" alt="" style="max-height:48px;max-width:120px;object-fit:contain">' : '') +
      '<div><div class="pdoc-company-name">' + esc(m.co || '') + '</div>' + (m.sub ? '<div class="pdoc-company-sub">' + esc(m.sub) + '</div>' : '') + '</div></div>' +
      '<div class="pdoc-meta">' + (m.meta || []).map(function (x) { return esc(x.k ? x.k + ': ' : '') + '<strong>' + esc(x.v) + '</strong>'; }).join('<br>') + '</div></div>';
    h += '<div class="pdoc-title-bar">' + esc(m.title || '') + '</div>';
    if (m.party && (m.party.name || (m.party.lines || []).length)) h += '<div class="pdoc-band"><div><div class="pdoc-band-name">' + esc(m.party.name || '') + '</div>' + (m.party.lines || []).map(function (l) { return '<div class="pdoc-band-sub">' + esc(l) + '</div>'; }).join('') + '</div></div>';
    var cols = m.cols || [];
    if (cols.length) h += '<table class="pdoc-table" style="width:100%;border-collapse:collapse"><thead><tr>' + cols.map(function (c, i) { return '<th' + (i ? ' class="r"' : '') + '>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      (m.rows || []).map(function (r) { return '<tr>' + cols.map(function (c, i) { return '<td' + (i ? ' class="r"' : '') + '>' + esc(r[i] == null ? '' : r[i]) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
    if ((m.tots || []).length) h += '<div class="dk-ptot">' + m.tots.map(function (t) { return '<div class="' + (t.g ? 'g' : '') + '" style="display:flex;justify-content:space-between' + (t.g ? ';border-top:2px solid var(--pdoc-accent)' : '') + '"><span>' + esc(t.k) + '</span><span>' + esc(t.v) + '</span></div>'; }).join('') + '</div>';
    (m.notes || []).forEach(function (n) { if (n && n.v) h += '<div class="pdoc-notes" data-dk-note="' + esc(n.k || '') + '"><strong>' + esc(n.k || '') + '</strong>\n<span class="dk-nv">' + esc(n.v) + '</span></div>'; });
    if (m.foot) h += '<div class="pdoc-footer-note">' + esc(m.foot) + '</div>';
    var d = document.createElement('div'); d.className = 'pdoc dk-gen' + (o.cls ? ' ' + o.cls : '');
    d.style.cssText = (m.accent ? '--pdoc-accent:' + m.accent + ';' : '') + 'max-width:820px;margin:0 auto 24px';
    d.innerHTML = h; return d;
  }
  /* print exactly one paper (temporary model paper or an existing .pdoc) */
  function printOne(x, o) {
    o = o || {}; addCss();
    var el = x && x.nodeType ? x : paper(x, { cls: 'dk-tmp' }), tmp = !(x && x.nodeType);
    if (tmp) (document.getElementById('main') || document.body).appendChild(el);
    el.classList.add('dk-one'); document.body.classList.add('dk-print-one');
    var done = function () { document.body.classList.remove('dk-print-one'); el.classList.remove('dk-one'); if (tmp) el.remove(); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    print(el, o); setTimeout(done, 4000);
  }

  window.DKD = { paper: paper, printOne: printOne, parse: parse, view: view, mount: mount, print: print, sigBoxes: sigBoxes, pdf: pdfOf, file: file, download: download, clean: clean, css: addCss };
})();
