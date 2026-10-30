/* Payslip card view v1 (+Staff ID v2) — replaces the white paper (.pdoc) on Payslip detail and
   All Payslips with token-based cards (dark/light, 380px..desktop), light A4
   print (one slip per page), pdf-lib PDF, WhatsApp share (WAD) and a
   "Payslip <Mon Year> ready" notification to the employee's login.
   The original .pdoc stays in the DOM (hidden) — later wrappers and editors
   (pay date / partial payment / accum outstanding) anchor on it, and the cards
   are parsed from its FINAL markup so every wrapper's output is reflected. */
(function () {
  'use strict';
  if (window.__PSC_V1) return; window.__PSC_V1 = true;
  var REC = window.__PSC_RECS = window.__PSC_RECS || {};
  var MS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var MS_BM = ['Jan','Feb','Mac','Apr','Mei','Jun','Jul','Ogo','Sep','Okt','Nov','Dis'];
  function bm() { try { return APP.language === 'bm'; } catch (e) { return false; } }
  function L(en, ms) { return bm() ? ms : en; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function txt(el) { return el ? String(el.textContent || '').replace(/\s+/g, ' ').trim() : ''; }
  function toast(m, t) { try { showToast(m, t || 'info'); } catch (e) {} }
  function isHR() { try { return typeof canManageHR === 'function' && !!canManageHR(); } catch (e) { return false; } }
  function mon(rec, lang) { var m = (Number(rec && rec.month) || 1) - 1; return ((lang || (bm() ? 'bm' : 'en')) === 'bm' ? MS_BM : MS)[m] + ' ' + (rec && rec.year || ''); }
  function monLong(rec, lang) { var m = (Number(rec && rec.month) || 1) - 1; try { return ((lang || (bm() ? 'bm' : 'en')) === 'bm' ? MONTH_NAMES_BM : MONTH_NAMES_EN)[m] + ' ' + rec.year; } catch (e) { return mon(rec, lang); } }
  function slug(s) { try { return _pdocSlug(s); } catch (e) { return String(s || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 40); } }
  function fname(rec, m) { return 'Payslip-' + slug((m && m.name) || (rec && rec.employees && rec.employees.name) || 'Staff') + '-' + MS[(Number(rec && rec.month) || 1) - 1] + (rec && rec.year || '') + '.pdf'; }
  function initials(n) { var w = String(n || '').split(/\s+/).filter(function (x) { return x && !/^(bin|binti|bt|bte|b\.|a\/l|a\/p)$/i.test(x); }); return ((w[0] || '?')[0] + (w[1] ? w[1][0] : '')).toUpperCase(); }
  /* Staff ID (employees.staff_code) — not in the payslip selects, so fetched once per employee and cached. */
  var SID = window.__PSC_SID = window.__PSC_SID || {};
  function sidOf(m) { var r = m && m.rec; if (!r) return ''; var e = r.employees || {}; var v = e.staff_code != null ? e.staff_code : SID[r.employee_id]; return String(v == null ? '' : v).trim(); }
  function sidTxt(m) { var s = sidOf(m); return s ? L('Staff ID', 'ID Staf') + ' ' + s : ''; }
  function loadSid(models) {
    var ids = [];
    (models || []).forEach(function (m) { var r = m && m.rec; if (r && r.employee_id && !(r.employee_id in SID) && !(r.employees && r.employees.staff_code != null) && ids.indexOf(r.employee_id) < 0) ids.push(r.employee_id); });
    var cli = null; try { cli = typeof sb !== 'undefined' ? sb : window.sb; } catch (e) { cli = window.sb; }
    if (!ids.length || !cli || !window.APP || !APP.tenant || !APP.tenant.id) return Promise.resolve(false);
    return Promise.resolve(cli.from('employees').select('id,staff_code').in('id', ids).eq('tenant_id', APP.tenant.id)).then(function (res) {
      ids.forEach(function (id) { SID[id] = ''; });
      if (!res || res.error) return false;
      var hit = false; (res.data || []).forEach(function (e) { SID[e.id] = e.staff_code || ''; if (e.staff_code) hit = true; });
      return hit;
    }, function () { ids.forEach(function (id) { SID[id] = ''; }); return false; });
  }
  function mask(v) { var d = String(v || '').replace(/\s+/g, ''); if (!d || d === '—' || d === '-') return ''; return d.length > 4 ? '····' + d.slice(-4) : d; }

  /* ---------- CSS (tokens only; WhatsApp greens are the existing wad-doc values) ---------- */
  var css = document.createElement('style'); css.id = 'psc-css';
  css.textContent =
    '#main .pdoc.psc-src{display:none!important}#main .psc-srcwrap{display:none!important}' +
    '.psc-view{display:flex;flex-direction:column;gap:8px;max-width:640px;margin:0 auto 12px}' +
    '.psc-card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);overflow:hidden}' +
    '.psc-hd{display:flex;align-items:center;gap:10px;padding:10px 12px}' +
    '.psc-logo{width:36px;height:36px;border-radius:8px;background:var(--primary);color:var(--on-primary);display:flex;align-items:center;justify-content:center;font-family:"Space Grotesk",sans-serif;font-weight:700;font-size:15px;flex:0 0 36px;overflow:hidden}' +
    '.psc-logo img{width:100%;height:100%;object-fit:contain;background:var(--bg-card)}.psc-logo.ini{background:var(--primary-light);color:var(--primary)}' +
    '.psc-co{flex:1;min-width:0}.psc-co b{display:block;font-family:"Space Grotesk",sans-serif;font-size:14px;font-weight:700;line-height:1.25;overflow-wrap:anywhere}' +
    '.psc-co span{display:block;font-size:10.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--primary)}' +
    '.psc-chip{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:600;background:var(--primary-light);color:var(--primary);white-space:nowrap}' +
    '.psc-emp{border-top:1px solid var(--border);padding:9px 12px 10px;display:flex;gap:10px;align-items:flex-start}.psc-emp .who{flex:1;min-width:0}' +
    '.psc-name{font-size:14px;font-weight:600;line-height:1.3;overflow-wrap:anywhere}' +
    '.psc-sub{font-size:11.5px;color:var(--text-3);line-height:1.4;display:flex;align-items:center;gap:4px;flex-wrap:wrap}.psc-sub i{font-size:13px}' +
    '.psc-meta{text-align:right;font-size:11px;color:var(--text-3);line-height:1.4;white-space:nowrap}.psc-meta b{display:block;color:var(--text-2);font-weight:600;font-size:12px}' +
    '.psc-cap{display:flex;align-items:center;gap:6px;padding:9px 12px 3px;font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--text-3)}.psc-cap i{font-size:13px}' +
    '.psc-rows{padding:0 12px 4px}.psc-row{display:flex;align-items:center;gap:8px;min-height:32px;border-bottom:1px dashed var(--border)}.psc-row:last-child{border-bottom:none}' +
    '.psc-k{flex:1;min-width:0;font-size:12.5px;color:var(--text-2);overflow-wrap:anywhere;padding:4px 0}.psc-v{font-family:"Space Grotesk",sans-serif;font-size:13px;font-weight:600;white-space:nowrap}' +
    '.psc-note{font-size:11.5px;color:var(--text-3);padding:6px 0}' +
    '.psc-tot{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px;border-top:1px solid var(--border);font-size:12.5px;font-weight:600}.psc-tot .psc-v{font-size:13.5px}' +
    '.psc-tot.warn{color:var(--warning)}.psc-neg{color:var(--danger)}.psc-pos{color:var(--success)}' +
    '.psc-net{background:var(--primary-light);border:1px solid var(--primary);border-radius:var(--radius);padding:12px 14px;display:flex;align-items:center;justify-content:space-between;gap:10px}' +
    '.psc-net .l{font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--primary)}.psc-net .f{font-size:11px;color:var(--text-2);margin-top:2px}' +
    '.psc-net .a{font-family:"Space Grotesk",sans-serif;font-size:22px;font-weight:700;color:var(--primary);white-space:nowrap}' +
    'details.psc-card>summary{list-style:none;cursor:pointer}details.psc-card>summary::-webkit-details-marker{display:none}' +
    '.psc-er{display:flex;align-items:center;gap:8px;padding:10px 12px;min-height:44px}.psc-er .k{flex:1;min-width:0;font-size:12.5px;color:var(--text-2);display:flex;align-items:center;gap:6px;flex-wrap:wrap}' +
    '.psc-er .k small{font-size:10.5px;color:var(--text-3)}.psc-chev{color:var(--text-3);font-size:16px;transition:transform .15s}details[open] .psc-chev{transform:rotate(180deg)}' +
    'details.psc-card .psc-rows{border-top:1px solid var(--border);padding-top:2px}' +
    '.psc-foot{font-size:10.5px;color:var(--text-3);text-align:center;line-height:1.5;padding:2px 8px}' +
    '.psc-bar{display:flex;gap:8px;padding:10px 12px;background:var(--bg-card);border-top:1px solid var(--border);z-index:40}' +
    '.psc-bar .btn,.psc-tbar .btn,.psc-tile .psc-acts .btn{white-space:nowrap;justify-content:center;gap:6px}' +
    '.psc-bar .btn{flex:1;padding:9px 8px;font-size:13px;min-height:40px}.psc-bar .btn:last-child{flex:1.45}' +
    '.btn.psc-wa{background:#25D366;border-color:#25D366;color:#06260f;font-weight:600}.btn.psc-wa:hover{filter:brightness(.95)}' +
    '@media(max-width:900px){.psc-bar{position:fixed;left:0;right:0;bottom:0;padding-bottom:calc(10px + env(safe-area-inset-bottom))}#main.psc-has-bar{padding-bottom:84px!important}}' +
    '@media(min-width:901px){.psc-bar{position:sticky;bottom:0;max-width:640px;margin:8px auto 0;border:1px solid var(--border);border-radius:var(--radius)}}' +
    '.psc-tbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.psc-tbar .btn{min-height:36px}.psc-tile .psc-meta b{font-size:15px;font-weight:800;color:var(--text)}@media(max-width:700px){.psc-tbar{display:grid;grid-template-columns:1fr 1fr;width:100%}.psc-tbar .btn{width:100%}}' +
    '.psc-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}@media(max-width:1100px){.psc-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:700px){.psc-grid{grid-template-columns:1fr}}' +
    '.psc-tile .psc-emp{border-top:0;align-items:center}.psc-tile .psc-acts{display:flex;gap:6px;padding:8px 10px;border-top:1px solid var(--border)}.psc-tile .psc-acts .btn{flex:1;min-height:36px;padding:7px 6px;font-size:12.5px}' +
    '.psc-tile .psc-acts .btn.psc-wa{flex:1.3}' +
    '.psc-q{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(84px + env(safe-area-inset-bottom));z-index:9000;background:var(--bg-card);color:var(--text);border:1px solid var(--border);border-radius:99px;padding:6px 6px 6px 14px;display:flex;align-items:center;gap:10px;font-size:12.5px;box-shadow:0 6px 24px rgba(0,0,0,.25);white-space:nowrap;max-width:calc(100vw - 24px)}' +
    '.psc-q span{overflow:hidden;text-overflow:ellipsis}.psc-q .btn{min-height:30px;padding:4px 10px;font-size:12px;white-space:nowrap}' +
    '#psc-print{display:none}' +
    '@media print{#main:has(#psc-print){background:var(--bg-card)!important;background-image:none!important}' +
    '#main .psc-view:not(.psc-pslip),#main .psc-bar,#main .psc-grid,#main .psc-tbar,.psc-q,#payslip-pay-date-editor,#payslip-partial-editor{display:none!important}' +
    '#psc-print{display:block!important;break-inside:auto!important}' +
    '#psc-print .psc-pslip{break-after:page;page-break-after:always;display:flex;flex-direction:column;gap:7px;max-width:none;margin:0}' +
    '#psc-print .psc-pslip:last-child{break-after:auto;page-break-after:auto}' +
    'html.psc-one #psc-print .psc-pslip:not(.psc-sel){display:none!important}html.psc-one #psc-print .psc-pslip.psc-sel{break-after:auto;page-break-after:auto}' +
    '#psc-print .psc-card,#psc-print .psc-net{break-inside:avoid;box-shadow:none!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
    '#psc-print .psc-net{background:var(--primary-light)!important;border:1px solid var(--primary)!important}' +
    '#psc-print .psc-row{min-height:24px}#psc-print .psc-k{padding:2px 0}' +
    '}';
  document.head.appendChild(css);

  /* ---------- 1. tag every payslip .pdoc with its record id (outermost wrapper) ---------- */
  function hookHtml() {
    var o = window._pdocPayslipHtml;
    if (typeof o !== 'function' || o.__psc || hooked._html) return; hooked._html = true;
    var w = function (rec) {
      var h = o.apply(this, arguments);
      try {
        if (rec && rec.id) {
          REC[rec.id] = rec;
          h = String(h).replace('<div class="pdoc"', '<div class="pdoc psc-src" data-psc-id="' + esc(rec.id) + '"');
        }
      } catch (e) {}
      return h;
    };
    for (var k in o) { try { w[k] = o[k]; } catch (e) {} }
    w.__psc = true;
    window._pdocPayslipHtml = w;
  }

  /* ---------- 2. parse the final .pdoc markup into a model ---------- */
  function parse(pd) {
    var m = { id: pd.getAttribute('data-psc-id'), meta: {} };
    m.rec = REC[m.id] || null;
    m.co = txt(pd.querySelector('.pdoc-company-name'));
    m.sub = txt(pd.querySelector('.pdoc-payslip-subtitle'));
    var img = pd.querySelector('.pdoc-logo-row img'); m.logo = img ? img.getAttribute('src') : '';
    var meta = pd.querySelector('.pdoc-meta');
    if (meta) meta.innerHTML.split(/<br\s*\/?>/i).forEach(function (s) {
      var d = document.createElement('div'); d.innerHTML = s; var t = txt(d), i = t.indexOf(':');
      if (i > 0) m.meta[/pay date|tarikh bayar/i.test(t.slice(0, i)) ? 'pay' : /ref/i.test(t.slice(0, i)) ? 'ref' : t.slice(0, i)] = { k: t.slice(0, i).trim(), v: t.slice(i + 1).trim() };
    });
    m.name = txt(pd.querySelector('.pdoc-band-name'));
    m.pos = txt(pd.querySelector('.pdoc-band-sub'));
    m.band = [];
    pd.querySelectorAll('.pdoc-band-item').forEach(function (it) {
      var b = it.querySelector('b'), v = txt(b), k = '';
      it.childNodes.forEach(function (n) { if (n !== b && n.nodeType === 3) k += n.textContent; });
      k = k.replace(/\s+/g, ' ').trim(); if (!k && b) k = txt(it).replace(v, '').trim();
      var key = /account|akaun/i.test(k) ? 'acc' : /^bank$/i.test(k) ? 'bank' : /epf|kwsp/i.test(k) ? 'epf' : /socso|perkeso/i.test(k) ? 'socso' : /period|tempoh/i.test(k) ? 'period' : 'x';
      m.band.push({ k: k, v: v, key: key });
    });
    var net = pd.querySelector('.pdoc-net-bar');
    m.net = { k: txt(net && net.querySelector('.lbl')) || L('Net Pay', 'Gaji Bersih'), v: txt(net && net.querySelector('.amt')) };
    m.secs = [];
    var before = 0;
    pd.querySelectorAll('.pdoc-section-title').forEach(function (ti) {
      var tb = ti.nextElementSibling; while (tb && tb.tagName !== 'TABLE' && !tb.classList.contains('pdoc-section-title')) tb = tb.nextElementSibling;
      if (!tb || tb.tagName !== 'TABLE') { var tq = ti.parentElement && ti.parentElement.querySelector('table'); tb = tq; }
      var pre = net && (net.compareDocumentPosition(ti) & Node.DOCUMENT_POSITION_PRECEDING);
      var pay = !!(ti.closest('.pdoc-pay-balance') || (tb && tb.classList.contains('pdoc-pay-balance-table')));
      var kind = pay ? 'pay' : pre ? (before++ === 0 ? 'earn' : 'ded') : 'er';
      var s = { title: txt(ti), kind: kind, rows: [] };
      if (tb) tb.querySelectorAll('tr').forEach(function (tr) {
        var td = tr.querySelectorAll('td'); if (!td.length) return;
        if (td.length === 1) { s.rows.push({ note: txt(td[0]) }); return; }
        s.rows.push({ k: txt(td[0]), v: txt(td[td.length - 1]), tot: tr.classList.contains('pdoc-total-row'), acc: tr.classList.contains('pdoc-accum-outstanding') });
      });
      m.secs.push(s);
    });
    m.notes = [];
    pd.querySelectorAll('div').forEach(function (d) {
      if (d.children.length) return; var t = txt(d);
      if (/borne by the company|ditanggung (oleh )?syarikat|not deducted from|tidak dipotong/i.test(t) && !d.closest('.pdoc-section-title')) m.notes.push(t);
    });
    m.foot = txt(pd.querySelector('.pdoc-footer-note'));
    return m;
  }
  function sec(m, k) { for (var i = 0; i < m.secs.length; i++) if (m.secs[i].kind === k) return m.secs[i]; return null; }
  function totOf(s) { if (!s) return null; for (var i = s.rows.length - 1; i >= 0; i--) if (s.rows[i].tot) return s.rows[i]; return null; }
  function bandv(m, key) { for (var i = 0; i < m.band.length; i++) if (m.band[i].key === key) return m.band[i]; return null; }
  function vcls(v) { return /^[−-]/.test(v) ? ' psc-neg' : /^\+/.test(v) ? ' psc-pos' : ''; }

  /* ---------- 3. card HTML ---------- */
  function rowsHtml(rows, plain) {
    var h = '<div class="psc-rows">';
    rows.forEach(function (r) {
      if (r.tot) return;
      if (r.note != null) { h += '<div class="psc-row"><div class="psc-note">' + esc(r.note) + '</div></div>'; return; }
      h += '<div class="psc-row"><div class="psc-k">' + esc(r.k) + '</div><div class="psc-v' + (plain ? '' : vcls(r.v)) + '">' + esc(plain ? String(r.v).replace(/^[−-]\s*/, '') : r.v) + '</div></div>';
    });
    return h + '</div>';
  }
  function totsHtml(rows, neg) {
    var h = '';
    rows.forEach(function (r) { if (r.tot) h += '<div class="psc-tot' + (r.acc ? ' warn' : '') + '"><span>' + esc(r.k) + '</span><span class="psc-v' + (neg ? ' psc-neg' : vcls(r.v)) + '">' + esc(r.v) + '</span></div>'; });
    return h;
  }
  function cardHtml(m, print) {
    var rec = m.rec, h = '';
    var logo = m.logo ? '<div class="psc-logo"><img src="' + esc(m.logo) + '" alt=""></div>' : '<div class="psc-logo">' + esc(initials(m.co)) + '</div>';
    h += '<div class="psc-card"><div class="psc-hd">' + logo + '<div class="psc-co"><b>' + esc(m.co) + '</b><span>' + esc(m.sub) + '</span></div>' +
      (rec && !print ? '<span class="psc-chip"><i class="ti ti-calendar"></i>' + esc(mon(rec)) + '</span>' : '') + '</div>';
    var bank = bandv(m, 'bank'), acc = bandv(m, 'acc'), subs = [];
    var bk = bank && bank.v && bank.v !== '—' ? bank.v : '', av = acc ? (print ? (acc.v !== '—' ? acc.v : '') : mask(acc.v)) : '';
    if (bk || av) subs.push('<i class="ti ti-building-bank"></i>' + esc([bk, av].filter(Boolean).join(' · ')));
    var extra = m.band.filter(function (b) { return (b.key === 'epf' || b.key === 'socso' || b.key === 'x') && b.v && b.v !== '—'; }).map(function (b) { return b.k + ' ' + b.v; });
    if (print) { var per = bandv(m, 'period'); if (per && per.v) extra.push(per.k + ' ' + per.v); }
    var posLine = [sidTxt(m), m.pos].filter(Boolean).join(' · ');
    h += '<div class="psc-emp"><div class="who"><div class="psc-name">' + esc(m.name) + '</div>' +
      (posLine ? '<div class="psc-sub psc-pos-line">' + esc(posLine) + '</div>' : '') +
      (subs.length ? '<div class="psc-sub">' + subs.join('') + '</div>' : '') +
      (extra.length ? '<div class="psc-sub">' + esc(extra.join(' · ')) + '</div>' : '') + '</div>' +
      '<div class="psc-meta">' + (m.meta.pay ? esc(L('Pay date', 'Tarikh bayaran')) + '<b>' + esc(m.meta.pay.v) + '</b>' : '') + (m.meta.ref ? '<span>' + esc(m.meta.ref.v) + '</span>' : '') + '</div></div></div>';
    var earn = sec(m, 'earn'), ded = sec(m, 'ded'), pay = sec(m, 'pay'), er = sec(m, 'er');
    if (earn) h += '<div class="psc-card"><div class="psc-cap"><i class="ti ti-arrow-down-left"></i>' + esc(earn.title) + '</div>' + rowsHtml(earn.rows) + totsHtml(earn.rows) + '</div>';
    if (ded) h += '<div class="psc-card"><div class="psc-cap"><i class="ti ti-arrow-up-right"></i>' + esc(ded.title) + '</div>' + rowsHtml(ded.rows, true) + totsHtml(ded.rows, true) + '</div>';
    var et = totOf(earn), dt = totOf(ded);
    var f = et ? et.v + (dt ? ' − ' + dt.v.replace(/^[−-]\s*/, '') : '') : '';
    h += '<div class="psc-net"><div><div class="l">' + esc(m.net.k) + '</div>' + (f ? '<div class="f">' + esc(f) + '</div>' : '') + '</div><div class="a">' + esc(m.net.v) + '</div></div>';
    if (pay) h += '<div class="psc-card"><div class="psc-cap"><i class="ti ti-wallet"></i>' + esc(pay.title) + '</div>' + rowsHtml(pay.rows) + totsHtml(pay.rows) + '</div>';
    if (er) {
      var t = totOf(er);
      var sum = '<div class="psc-er"><div class="k"><i class="ti ti-building"></i>' + esc(er.title) + (print ? '' : ' <small>' + esc(L('not deducted', 'tidak dipotong')) + '</small>') + '</div>' +
        (t ? '<span class="psc-v">' + esc(t.v) + '</span>' : '') + (print ? '' : '<i class="ti ti-chevron-down psc-chev"></i>') + '</div>';
      h += print ? '<div class="psc-card">' + sum + rowsHtml(er.rows) + '</div>' : '<details class="psc-card"><summary>' + sum + '</summary>' + rowsHtml(er.rows) + '</details>';
    }
    var notes = m.notes.concat(m.foot ? [m.foot] : []);
    if (notes.length) h += '<div class="psc-foot">' + notes.map(esc).join('<br>') + '</div>';
    return h;
  }
  function tileHtml(m, hr) {
    var rec = m.rec, acc = bandv(m, 'acc'), bank = bandv(m, 'bank');
    var bk = bank && bank.v !== '—' ? bank.v : '', av = acc ? mask(acc.v) : '';
    var sub = bk || av ? [bk, av].filter(Boolean).join(' · ') : L('Payslip', 'Slip gaji') + ' · ' + mon(rec);
    return '<div class="psc-card psc-tile" data-id="' + esc(m.id) + '"><div class="psc-emp"><div class="psc-logo ini">' + esc(initials(m.name)) + '</div>' +
      '<div class="who"><div class="psc-name">' + esc(m.name) + '</div>' + (sidOf(m) ? '<div class="psc-sub psc-sid"><i class="ti ti-id"></i>' + esc(sidTxt(m)) + '</div>' : '') + '<div class="psc-sub"><i class="ti ti-building-bank"></i>' + esc(sub) + '</div></div>' +
      '<div class="psc-meta">' + esc(L('Net pay', 'Gaji bersih')) + '<b>' + esc(m.net.v) + '</b></div></div>' +
      '<div class="psc-acts"><button type="button" class="btn btn-outline btn-sm" data-psc="view"><i class="ti ti-eye"></i>' + esc(L('View', 'Lihat')) + '</button>' +
      '<button type="button" class="btn btn-outline btn-sm" data-psc="print"><i class="ti ti-printer"></i>' + esc(L('Print', 'Cetak')) + '</button>' +
      (hr && window.WAD ? '<button type="button" class="btn btn-sm psc-wa" data-psc="share"><i class="ti ti-brand-whatsapp"></i>' + esc(L('Share', 'Kongsi')) + '</button>' : '') + '</div></div>';
  }

  /* ---------- 4. enhance pages ---------- */
  function sources(main) {
    var out = [];
    main.querySelectorAll('.pdoc.psc-src').forEach(function (pd) {
      var hs = pd.closest('.pdoc-hscroll');
      if (hs && hs.parentNode) { hs.parentNode.insertBefore(pd, hs); hs.remove(); }
      out.push(pd);
    });
    return out;
  }
  function buildPrint(main, models) {
    var old = document.getElementById('psc-print'); if (old) old.remove();
    var p = document.createElement('div'); p.id = 'psc-print';
    p.innerHTML = models.map(function (m) { return '<div class="psc-view psc-pslip" data-id="' + esc(m.id) + '">' + cardHtml(m, true) + '</div>'; }).join('');
    main.appendChild(p);
  }
  function hideHeaderBits(main) {
    main.querySelectorAll('.page-header .pdoc-color-picker').forEach(function (x) { x.style.display = 'none'; });
    main.querySelectorAll('.page-header button').forEach(function (b) { if (/window\.print\(\)/.test(b.getAttribute('onclick') || '')) b.style.display = 'none'; });
  }
  function enhanceDetail(id) {
    var main = document.getElementById('main'); if (!main) return;
    var pds = sources(main); if (!pds.length) return;
    try {
      var pd = pds[0], m = parse(pd), hr = isHR();
      var old = main.querySelector('.psc-view:not(.psc-pslip)'); if (old) old.remove();
      var v = document.createElement('div'); v.className = 'psc-view'; v.innerHTML = cardHtml(m, false);
      pd.parentNode.insertBefore(v, pd);
      hideHeaderBits(main);
      var hdr = main.querySelector('.page-header');
      if (hdr && hr && !hdr.querySelector('[data-psc=notify]')) {
        var ab = [].filter.call(hdr.querySelectorAll('button'), function (b) { return !b.closest('.pdoc-color-picker'); }).pop(); var acts = ab ? ab.parentElement : hdr;
        var nb = document.createElement('button'); nb.type = 'button'; nb.className = 'btn btn-outline no-print'; nb.setAttribute('data-psc', 'notify');
        nb.style.whiteSpace = 'nowrap'; nb.innerHTML = '<i class="ti ti-bell"></i> ' + esc(L('Notify', 'Maklum'));
        nb.onclick = function () { notifyOne(m.id, true); };
        acts.appendChild(nb);
      }
      var ob = main.querySelector('.psc-bar'); if (ob) ob.remove();
      var bar = document.createElement('div'); bar.className = 'psc-bar no-print';
      bar.innerHTML = '<button type="button" class="btn btn-outline" data-psc="print"><i class="ti ti-printer"></i>' + esc(L('Print', 'Cetak')) + '</button>' +
        '<button type="button" class="btn btn-outline" data-psc="pdf"><i class="ti ti-file-type-pdf"></i>PDF</button>' +
        (hr && window.WAD ? '<button type="button" class="btn psc-wa" data-psc="share"><i class="ti ti-brand-whatsapp"></i>' + esc(L('Share WhatsApp', 'Kongsi WhatsApp')) + '</button>' : '');
      main.appendChild(bar); main.classList.add('psc-has-bar');
      bar.querySelector('[data-psc=print]').onclick = function () { printNow(null); };
      bar.querySelector('[data-psc=pdf]').onclick = function () { pdfDownload([m.id]); };
      var sb2 = bar.querySelector('[data-psc=share]'); if (sb2) sb2.onclick = function () { shareOne(m.id); };
      buildPrint(main, [m]);
      loadSid([m]).then(function (hit) { if (hit && v.isConnected) { v.innerHTML = cardHtml(m, false); buildPrint(main, [m]); } });
    } catch (e) { console.warn('[payslip-cards] detail', e); fallback(main); }
  }
  function enhanceList(month, year) {
    var main = document.getElementById('main'); if (!main) return;
    var pds = sources(main); if (!pds.length) return;
    try {
      var hr = isHR(), models = pds.map(parse);
      pds.forEach(function (pd) { var w = pd.parentElement; if (w && w !== main && !w.classList.contains('psc-view')) w.classList.add('psc-srcwrap'); });
      var og = main.querySelector('.psc-grid'); if (og) og.remove();
      var g = document.createElement('div'); g.className = 'psc-grid';
      g.innerHTML = models.map(function (m) { return tileHtml(m, hr); }).join('');
      var first = pds[0].closest('.psc-srcwrap') || pds[0];
      first.parentNode.insertBefore(g, first);
      g.addEventListener('click', function (e) {
        var b = e.target.closest('[data-psc]'); if (!b) return; var id = b.closest('.psc-tile').getAttribute('data-id'), a = b.getAttribute('data-psc');
        if (a === 'view') { try { openPage('hr', { view: 'payslip', id: id }); } catch (x) {} }
        if (a === 'print') printNow(id);
        if (a === 'share') shareOne(id);
      });
      hideHeaderBits(main);
      var hdr = main.querySelector('.page-header');
      if (hdr) {
        var t = hdr.querySelector('.page-title'); var r0 = models[0] && models[0].rec;
        if (t && r0) t.textContent = L('All Payslips', 'Semua Slip Gaji') + ' · ' + monLong(r0);
        var ot = hdr.querySelector('.psc-tbar'); if (ot) ot.remove();
        var tb = document.createElement('div'); tb.className = 'psc-tbar no-print';
        tb.innerHTML = (hr && window.WAD ? '<button type="button" class="btn btn-outline btn-sm" data-psc="seq"><i class="ti ti-brand-whatsapp"></i>' + esc(L('Share one by one', 'Kongsi satu-satu')) + '</button>' : '') +
          (hr && window.NT ? '<button type="button" class="btn btn-outline btn-sm" data-psc="notify"><i class="ti ti-bell"></i>' + esc(L('Notify staff', 'Maklum staf')) + '</button>' : '') +
          '<button type="button" class="btn btn-outline btn-sm" data-psc="pdfall"><i class="ti ti-file-type-pdf"></i>' + esc(L('PDF all', 'PDF semua')) + '</button>' +
          '<button type="button" class="btn btn-primary btn-sm" data-psc="printall"><i class="ti ti-printer"></i>' + esc(L('Print all', 'Cetak semua')) + '</button>';
        var anchor = null; hdr.querySelectorAll('button').forEach(function (b) { if (!anchor && /window\.print\(\)/.test(b.getAttribute('onclick') || '')) anchor = b.parentElement; });
        (anchor || hdr).appendChild(tb);
        var ids = models.map(function (m) { return m.id; });
        tb.onclick = function (e) {
          var b = e.target.closest('[data-psc]'); if (!b) return; var a = b.getAttribute('data-psc');
          if (a === 'printall') printNow(null);
          if (a === 'pdfall') pdfDownload(ids, 'Payslips-' + slug(models[0].co) + '-' + MS[(Number(r0 && r0.month) || 1) - 1] + (r0 && r0.year || '') + '.pdf');
          if (a === 'seq') shareSeq(ids);
          if (a === 'notify') notifyAll(ids);
        };
      }
      buildPrint(main, models);
      loadSid(models).then(function (hit) { if (hit && g.isConnected) { g.innerHTML = models.map(function (m) { return tileHtml(m, hr); }).join(''); buildPrint(main, models); } });
    } catch (e) { console.warn('[payslip-cards] list', e); fallback(main); }
  }
  function fallback(main) { main.querySelectorAll('.pdoc.psc-src').forEach(function (p) { p.classList.remove('psc-src'); }); main.querySelectorAll('.psc-srcwrap').forEach(function (w) { w.classList.remove('psc-srcwrap'); }); }

  var hooked = {};
  function hookRender(name, fn) {
    if (hooked[name]) return; var o = window[name]; if (typeof o !== 'function') return; hooked[name] = true;
    var w = async function () {
      var a = arguments, r = await o.apply(this, a);
      try { fn.apply(null, a); } catch (e) { console.warn('[payslip-cards]', e); }
      return r;
    };
    for (var k in o) { try { w[k] = o[k]; } catch (e) {} }
    w.__psc = true; window[name] = w;
  }

  /* ---------- 5. print (light, A4 portrait, one per page) ---------- */
  var printing = false, prevTheme = null, prevDark = false;
  function enterPrint() {
    if (printing) return; printing = true;
    var h = document.documentElement; prevTheme = h.getAttribute('data-theme'); prevDark = document.body.classList.contains('dark');
    if (prevTheme === 'dark') { h.setAttribute('data-theme', 'light'); document.body.classList.remove('dark'); }
  }
  function exitPrint() {
    if (!printing) return; printing = false;
    var h = document.documentElement; h.classList.remove('psc-one');
    document.querySelectorAll('#psc-print .psc-sel').forEach(function (x) { x.classList.remove('psc-sel'); });
    if (prevTheme === 'dark') { h.setAttribute('data-theme', 'dark'); if (prevDark) document.body.classList.add('dark'); }
    prevTheme = null;
  }
  function printNow(id) {
    var p = document.getElementById('psc-print'); if (!p) return window.print();
    var all = p.querySelectorAll('.psc-pslip'), fid = id || (all[0] && all[0].getAttribute('data-id')), rec = REC[fid];
    if (id) { document.documentElement.classList.add('psc-one'); var s = p.querySelector('.psc-pslip[data-id="' + id + '"]'); if (s) s.classList.add('psc-sel'); }
    try { _pdocSetPageOrientation('portrait'); } catch (e) {}
    try {
      var nm = (!id && all.length > 1) ? 'Payslips-' + slug(txt(p.querySelector('.psc-co b'))) + '-' + MS[(Number(rec && rec.month) || 1) - 1] + (rec && rec.year || '') : fname(rec, modelFor(fid)).replace(/\.pdf$/, '');
      _pdocSetPrintFilename(nm);
    } catch (e) {}
    enterPrint();
    setTimeout(function () { window.print(); setTimeout(exitPrint, 600); }, 60);
  }
  function onBefore() { if (document.getElementById('psc-print')) enterPrint(); }
  window.addEventListener('beforeprint', onBefore);
  window.addEventListener('afterprint', function () { setTimeout(exitPrint, 50); });
  try { var mq = window.matchMedia('print'); var cb = function (e) { if (e.matches) onBefore(); else setTimeout(exitPrint, 50); }; mq.addEventListener ? mq.addEventListener('change', cb) : mq.addListener(cb); } catch (e) {}

  /* ---------- 6. PDF (pdf-lib) ---------- */
  function modelFor(id) {
    var pd = document.querySelector('#main .pdoc.psc-src[data-psc-id="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]');
    return pd ? parse(pd) : null;
  }
  function clean(s) {
    return String(s == null ? '' : s).replace(/[−–—]/g, '-').replace(/·/g, '.').replace(/…/g, '...').replace(/[\u00a0\u2007\u202f]/g, ' ')
      .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[^\x20-\x7E]/g, '');
  }
  function fetchLogo(url) {
    if (!url) return Promise.resolve(null);
    return Promise.race([fetch(url).then(function (r) { return r.ok ? r.arrayBuffer() : null; }), new Promise(function (res) { setTimeout(function () { res(null); }, 3000); })]).catch(function () { return null; });
  }
  async function pdfOf(models) {
    var P = window.PDFLib; if (!P) throw new Error('PDF library not loaded');
    var doc = await P.PDFDocument.create();
    var F = await doc.embedFont(P.StandardFonts.Helvetica), B = await doc.embedFont(P.StandardFonts.HelveticaBold);
    var acc = P.rgb(0.055, 0.455, 0.565), ink = P.rgb(0.06, 0.09, 0.16), mut = P.rgb(0.39, 0.45, 0.55), red = P.rgb(0.86, 0.15, 0.15), grn = P.rgb(0.09, 0.64, 0.29), line = P.rgb(0.89, 0.91, 0.94), soft = P.rgb(0.97, 0.98, 0.99), tint = P.rgb(0.91, 0.96, 0.97), white = P.rgb(1, 1, 1);
    var W = 595.28, H = 841.89, X = 42, R = W - 42, logoCache = {};
    for (var mi = 0; mi < models.length; mi++) {
      var m = models[mi], pg = doc.addPage([W, H]), y = H - 44;
      var need = function (h) { if (y - h < 48) { pg = doc.addPage([W, H]); y = H - 44; } };
      var tx = function (s, x, yy, sz, f, c) { s = clean(s); if (s) pg.drawText(s, { x: x, y: yy, size: sz, font: f || F, color: c || ink }); };
      var rt = function (s, x, yy, sz, f, c) { s = clean(s); var fw = (f || F).widthOfTextAtSize(s, sz); tx(s, x - fw, yy, sz, f, c); };
      var fit = function (s, sz, f, max) { s = clean(s); while (s.length > 1 && (f || F).widthOfTextAtSize(s, sz) > max) s = s.slice(0, -2) + '.'; return s; };
      var wrap = function (s, sz, f, max) { var out = [], cur = ''; clean(s).split(' ').forEach(function (w) { var t = cur ? cur + ' ' + w : w; if ((f || F).widthOfTextAtSize(t, sz) > max && cur) { out.push(cur); cur = w; } else cur = t; }); if (cur) out.push(cur); return out; };
      // header
      var lx = X, img = null;
      if (m.logo) {
        if (!(m.logo in logoCache)) {
          var buf = await fetchLogo(m.logo), em = null;
          try { if (buf) { var u = new Uint8Array(buf); em = u[0] === 0x89 ? await doc.embedPng(buf) : (u[0] === 0xFF ? await doc.embedJpg(buf) : null); } } catch (e) { em = null; }
          logoCache[m.logo] = em;
        }
        img = logoCache[m.logo];
      }
      if (img) { var sc = Math.min(40 / img.width, 40 / img.height); pg.drawImage(img, { x: X, y: y - 34, width: img.width * sc, height: img.height * sc }); lx = X + 50; }
      tx(fit(m.co, 15, B, 300), lx, y - 8, 15, B, acc);
      tx(fit(m.sub, 9, B, 300), lx, y - 24, 9, B, mut);
      var my = y - 8; Object.keys(m.meta).forEach(function (k) { rt(m.meta[k].k + ': ' + m.meta[k].v, R, my, 9, F, mut); my -= 13; });
      y -= 52; pg.drawLine({ start: { x: X, y: y }, end: { x: R, y: y }, thickness: 0.8, color: line });
      // employee band
      y -= 20; tx(fit(m.name, 13, B, R - X), X, y, 13, B, ink);
      var pl = [sidTxt(m), m.pos].filter(Boolean).join(' | ');
      if (pl) { y -= 14; tx(fit(pl, 9.5, F, R - X), X, y, 9.5, F, mut); }
      y -= 8;
      var ORD = ['bank', 'acc', 'epf', 'socso', 'period', 'x']; var items = m.band.filter(function (b) { return b.v; }).sort(function (a, b) { return ORD.indexOf(a.key) - ORD.indexOf(b.key); });
      for (var bi = 0; bi < items.length; bi += 2) {
        y -= 24;
        [0, 1].forEach(function (j) { var it = items[bi + j]; if (!it) return; var bx = j ? X + (R - X) / 2 : X; tx(it.k, bx, y + 10, 8, F, mut); tx(fit(it.v, 10, B, (R - X) / 2 - 10), bx, y - 2, 10, B, ink); });
      }
      y -= 14;
      var drawSec = function (s, neg) {
        need(30 + s.rows.length * 17);
        pg.drawRectangle({ x: X, y: y - 16, width: R - X, height: 18, color: soft });
        tx(String(s.title).toUpperCase(), X + 8, y - 11, 8, B, mut); y -= 20;
        s.rows.forEach(function (r) {
          need(18);
          if (r.note != null) { wrap(r.note, 9, F, R - X - 16).forEach(function (ln) { y -= 14; tx(ln, X + 8, y + 3, 9, F, mut); }); return; }
          y -= 17;
          if (r.tot) pg.drawLine({ start: { x: X, y: y + 13 }, end: { x: R, y: y + 13 }, thickness: 0.6, color: line });
          var c = r.acc ? P.rgb(0.85, 0.47, 0.02) : (neg && r.tot) || /^[−-]/.test(r.v) ? red : /^\+/.test(r.v) ? grn : ink;
          tx(fit(r.k, 10, r.tot ? B : F, R - X - 140), X + 8, y, 10, r.tot ? B : F, r.tot ? ink : P.rgb(0.2, 0.25, 0.33));
          rt(r.v, R - 8, y, 10, r.tot ? B : F, c);
        });
        y -= 10;
      };
      var earn = sec(m, 'earn'), ded = sec(m, 'ded'), pay = sec(m, 'pay'), er = sec(m, 'er');
      if (earn) drawSec(earn);
      if (ded) drawSec(ded, true);
      need(50);
      pg.drawRectangle({ x: X, y: y - 40, width: R - X, height: 40, color: tint, borderColor: acc, borderWidth: 1 });
      tx(String(m.net.k).toUpperCase(), X + 12, y - 17, 9, B, acc);
      var et = totOf(earn), dt = totOf(ded);
      if (et) tx(et.v + (dt ? ' - ' + dt.v.replace(/^[−-]\s*/, '') : ''), X + 12, y - 31, 8.5, F, mut);
      rt(m.net.v, R - 12, y - 27, 17, B, acc);
      y -= 54;
      if (pay) drawSec(pay);
      if (er) drawSec(er);
      var notes = m.notes.concat(m.foot ? [m.foot] : []);
      notes.forEach(function (n) { wrap(n, 8, F, R - X).forEach(function (ln) { need(12); y -= 11; var w = F.widthOfTextAtSize(ln, 8); tx(ln, X + (R - X - w) / 2, y, 8, F, mut); }); y -= 3; });
    }
    return await doc.save();
  }
  function fileOf(bytes, name) { try { return new File([bytes], name, { type: 'application/pdf' }); } catch (e) { var b = new Blob([bytes], { type: 'application/pdf' }); b.name = name; return b; } }
  function dl(f) { var u = URL.createObjectURL(f), a = document.createElement('a'); a.href = u; a.download = f.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 4000); }
  function pdfFile(ids, name) {
    var models = ids.map(modelFor).filter(Boolean);
    if (!models.length) return Promise.reject(new Error('no payslip'));
    return loadSid(models).catch(function () {}).then(function () { return pdfOf(models); }).then(function (b) { return fileOf(b, name || fname(models[0].rec, models[0])); });
  }
  function pdfDownload(ids, name) {
    toast(L('Preparing PDF…', 'Menyediakan PDF…'));
    return pdfFile(ids, name).then(function (f) { dl(f); toast(L('PDF downloaded', 'PDF dimuat turun'), 'success'); return f; }, function (e) { toast(L('PDF failed: ', 'PDF gagal: ') + (e && e.message || e), 'error'); });
  }
  window.PSC = { parse: parse, pdfFile: pdfFile, pdfOf: pdfOf, models: function () { return Array.prototype.map.call(document.querySelectorAll('#main .pdoc.psc-src'), parse); } };

  /* ---------- 7. WhatsApp share (WAD) ---------- */
  function addI18n() {
    var S = window.__WAD_S, T = window.__WAD_T;
    var lab = {
      en: { psSend: 'Send payslip', psSendD: 'Net pay and the payslip PDF', psRem: 'Reminder', psRemD: 'Payslip is ready in M-Core' },
      bm: { psSend: 'Hantar slip gaji', psSendD: 'Gaji bersih dan PDF slip gaji', psRem: 'Peringatan', psRemD: 'Slip gaji sedia di M-Core' }
    };
    ['en', 'bm'].forEach(function (l) {
      if (S && S[l]) Object.assign(S[l], lab[l]);
      try { if (LANG[l] && LANG[l].waDoc && LANG[l].waDoc !== (S && S[l])) Object.keys(lab[l]).forEach(function (k) { if (!LANG[l].waDoc[k]) LANG[l].waDoc[k] = lab[l][k]; }); } catch (e) {}
    });
    if (T) {
      T.en = T.en || {}; T.bm = T.bm || {};
      T.en.payslip_send = function (c) { return 'Hi ' + c.name + ', your payslip for ' + c.period + ' is ready.\nNet pay: ' + c.net + '\nThe payslip PDF is attached. You can also view it in M-Core → My Payroll History.\n– HR, ' + c.co; };
      T.en.payslip_remind = function (c) { return 'Hi ' + c.name + ', a reminder that your ' + c.period + ' payslip is ready in M-Core (HR & Payroll → My Payroll History).\nNet pay: ' + c.net + '\n– HR, ' + c.co; };
      T.bm.payslip_send = function (c) { return 'Salam ' + c.name + ', slip gaji anda bagi ' + c.period + ' telah sedia.\nGaji bersih: ' + c.net + '\nPDF slip gaji dilampirkan. Anda juga boleh lihat di M-Core → Sejarah Gaji Saya.\n– HR, ' + c.co; };
      T.bm.payslip_remind = function (c) { return 'Salam ' + c.name + ', peringatan: slip gaji ' + c.period + ' anda telah sedia di M-Core (HR & Gaji → Sejarah Gaji Saya).\nGaji bersih: ' + c.net + '\n– HR, ' + c.co; };
    }
  }
  function canFiles() { try { return !!(navigator.canShare && navigator.canShare({ files: [new File(['x'], 'x.pdf', { type: 'application/pdf' })] })); } catch (e) { return false; } }
  var active = null; // {id, pdf}
  function shareOne(id, onDone) {
    var W = window.WAD; if (!W) return toast(L('WhatsApp share not available', 'Kongsi WhatsApp tiada'), 'error');
    addI18n();
    var m = modelFor(id), rec = REC[id]; if (!m) return;
    var emp = (rec && rec.employees) || {};
    var first = String(m.name || emp.name || '').split(/\s+/)[0] || m.name;
    var pdfP = null; var getPdf = function () { return pdfP || (pdfP = pdfFile([id]).catch(function () { return null; })); };
    var go = function () {
      active = { id: id, pdf: getPdf, done: onDone };
      W.open({
        docType: 'payslip', docId: id, docRef: L('Payslip', 'Slip gaji') + ' · ' + mon(rec), to: m.name, phone: emp.phone || '', recipientKind: 'other',
        tpls: [{ k: 'payslip_send', label: 'psSend', desc: 'psSendD' }, { k: 'payslip_remind', label: 'psRem', desc: 'psRemD' }], k: 'payslip_send',
        file: getPdf,
        build: function (k, lang) { return { text: W.tpl(k, lang, { name: first, period: monLong(rec, lang), net: m.net.v, co: (W.company && W.company()) || m.co }) }; }
      });
    };
    Promise.resolve(W.ready ? W.ready() : true).then(function (ok) {
      if (ok === false) { toast(L('WhatsApp share log is not set up yet (run payslip_share_01.sql).', 'Log kongsi WhatsApp belum disediakan (jalankan payslip_share_01.sql).'), 'warning'); if (onDone) onDone(); return; }
      go();
    }, go);
  }
  // Desktop fallback: no file share -> "Open WhatsApp" sends text; download the PDF so it can be attached.
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest && e.target.closest('.wad-bg [data-a=send]');
    if (!b || !active || b.disabled) return;
    var a = active;
    if (!canFiles()) a.pdf().then(function (f) { if (f) { dl(f); toast(L('PDF downloaded — attach it in WhatsApp', 'PDF dimuat turun — lampirkan dalam WhatsApp'), 'success'); } });
  }, true);
  document.addEventListener('wad:shared', function (e) {
    var d = e.detail || {}; if (d.doc_type !== 'payslip' || !d.doc_id) return;
    notifyOne(d.doc_id, false);
  });
  // sheet closed -> advance "share one by one" queue
  var Q = null;
  setInterval(function () {
    if (!active) return;
    if (!document.querySelector('.wad-bg')) { var a = active; active = null; if (a.done) a.done(); }
  }, 400);
  function qPill() {
    var p = document.querySelector('.psc-q');
    if (!Q) { if (p) p.remove(); return; }
    if (!p) { p = document.createElement('div'); p.className = 'psc-q no-print'; document.body.appendChild(p); }
    var m = modelFor(Q.ids[Q.i]);
    p.innerHTML = '<span>' + esc(L('Sharing', 'Berkongsi') + ' ' + (Q.i + 1) + '/' + Q.ids.length + (m ? ' · ' + m.name : '')) + '</span><button type="button" class="btn btn-outline">' + esc(L('Stop', 'Henti')) + '</button>';
    p.querySelector('button').onclick = function () { Q = null; qPill(); try { WAD.closeSheet(); } catch (e) {} active = null; };
  }
  function shareSeq(ids) {
    if (!ids.length) return;
    Q = { ids: ids, i: 0 };
    var step = function () {
      if (!Q) return;
      if (Q.i >= Q.ids.length) { Q = null; qPill(); toast(L('Done — all payslips shared', 'Selesai — semua slip gaji dikongsi'), 'success'); return; }
      qPill();
      shareOne(Q.ids[Q.i], function () { if (!Q) return; Q.i++; setTimeout(step, 250); });
    };
    step();
  }
  window.addEventListener('hashchange', function () { if (Q) { Q = null; qPill(); } });

  /* ---------- 8. notification "Payslip <Mon Year> ready" (no amounts) ---------- */
  function notifyOne(id, loud) {
    var N = window.NT, rec = REC[id];
    if (!N || !N.notify || !N.userForEmp || !rec || !rec.employee_id) { if (loud) toast(L('Notifications not available', 'Notifikasi tiada'), 'warning'); return Promise.resolve(0); }
    return N.userForEmp(rec.employee_id).then(function (uid) {
      if (!uid) { if (loud) toast(L('No M-Core login linked to this staff', 'Tiada log masuk M-Core untuk staf ini'), 'warning'); return 0; }
      if (N.same && N.uid && N.same(uid, N.uid())) { if (loud) toast(L('That is your own login', 'Itu log masuk anda sendiri'), 'info'); return 0; }
      return N.notify({
        users: [uid], kind: 'for_you', type: 'assigned.payslip',
        title: L('Payslip ' + mon(rec, 'en') + ' ready', 'Slip gaji ' + mon(rec, 'bm') + ' sedia'),
        body: L('Your payslip is ready. Tap to view.', 'Slip gaji anda sedia. Ketik untuk lihat.'),
        link: { page: 'hr', params: { view: 'my-payslips' }, icon: 'ti-receipt' },
        ref_table: 'payroll_records', ref_id: id, group_key: 'payslip:' + id
      }).then(function (n) { if (loud) toast(n ? L('Staff notified', 'Staf dimaklumkan') : L('Already notified just now', 'Baru sahaja dimaklumkan'), n ? 'success' : 'info'); return n || 0; });
    }).catch(function () { return 0; });
  }
  function notifyAll(ids) {
    var r0 = REC[ids[0]];
    if (!confirm(L('Send "Payslip ' + mon(r0, 'en') + ' ready" to ' + ids.length + ' staff? Amounts are not included.', 'Hantar "Slip gaji ' + mon(r0, 'bm') + ' sedia" kepada ' + ids.length + ' staf? Amaun tidak disertakan.'))) return;
    var sent = 0, miss = 0;
    ids.reduce(function (p, id) { return p.then(function () { return notifyOne(id, false).then(function (n) { if (n) sent++; else miss++; }); }); }, Promise.resolve())
      .then(function () { toast(L('Notified ' + sent + ' staff' + (miss ? ' · ' + miss + ' without login' : ''), sent + ' staf dimaklumkan' + (miss ? ' · ' + miss + ' tiada log masuk' : '')), sent ? 'success' : 'warning'); });
  }
  window.PSC.notifyOne = notifyOne; window.PSC.shareOne = shareOne;

  /* ---------- boot ---------- */
  function boot() {
    hookHtml();
    hookRender('renderPayslipDetail', function (id) { enhanceDetail(id); });
    hookRender('renderPayslipsPrint', function (mo, yr) { enhanceList(mo, yr); });
    addI18n();
  }
  boot(); setTimeout(boot, 300); setTimeout(boot, 1200);
})();
