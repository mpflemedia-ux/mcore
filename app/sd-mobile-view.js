/* Salary Disbursement — mobile view polish v1 (works with sd-mobile-cards.js).
   When the cards are active (#sd-pdoc.sdc-on) on a <=900px screen:
   - SCREEN: the whole white .pdoc paper is hidden (header, banner, summary bar, totals
     strip, signature rows, wrapper-injected bits). It stays in the DOM so proxied inputs,
     _sdRecalc, save and the desktop print keep working.
   - A compact summary line (employees · Total Salary · Budget Required) sits above the
     cards, read live from the hidden table; a Signatures card mirrors the paper's
     Prepared/Checked/Approval inputs (proxied, fires their change -> _sdSaveSigs).
   - PRINT from mobile: the paper is replaced by #sdm-print — read-only employee cards,
     all expanded, header line + Total Net Pay, page-break-inside:avoid per card. Light
     theme tokens are forced for the print only, then restored.
   Desktop (>900px) screen + print untouched. Tokens only, EN/BM. */
(function () {
  if (window.SD_MOBILE_VIEW_V1) return;
  window.SD_MOBILE_VIEW_V1 = true;

  var SIGS = [['preparedBy', 'Prepared By', 'Disediakan Oleh'], ['checkedBy', 'Checked By', 'Disemak Oleh'],
    ['firstApproval', 'First Approval', 'Kelulusan Pertama'], ['secondApproval', 'Second Approval', 'Kelulusan Kedua']];
  var lastNarrow = null, printing = false, themeWas = null, timer = null;

  function bm() { try { return APP.language === 'bm'; } catch (e) { return false; } }
  function L(en, ms) { return bm() ? ms : en; }
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function rm(n) { try { return formatRM(n); } catch (e) { return 'RM ' + (Number(n) || 0).toFixed(2); } }
  function num(t) { var n = Number(String(t == null ? '' : t).replace(/[^0-9.\-]/g, '')); return isFinite(n) ? n : 0; }
  function setText(el, t) { if (el && el.textContent !== t) el.textContent = t; }
  function setHtml(el, h) { if (el && el.innerHTML !== h) el.innerHTML = h; }
  function mq(q) { try { return !!(window.matchMedia && window.matchMedia(q).matches); } catch (e) { return false; } }

  // Screen width is cached while on screen media, so a print-media query can't fake it.
  function screenNarrow() {
    if (!mq('print')) {
      lastNarrow = window.matchMedia ? mq('screen and (max-width: 900px)') : ((window.innerWidth || 9999) <= 900);
    }
    return !!lastNarrow;
  }
  function cardsOn() { var p = $('sd-pdoc'); return !!(p && p.classList.contains('sdc-on') && $('sdc-wrap')); }
  function mobileCards() { return cardsOn() && screenNarrow(); }

  /* ---------- CSS (tokens only) ---------- */
  function css() {
    if ($('sdm-css')) return;
    var s = document.createElement('style');
    s.id = 'sdm-css';
    s.textContent =
      '.sdm-sum,.sdm-sigs,#sdm-print{display:none}' +
      '@media screen and (max-width:900px){' +
        '#sd-pdoc.sdc-on{display:none!important}' +
        '.sdm-sum.sdm-on{display:flex;flex-wrap:wrap;align-items:center;gap:4px 14px;margin:0 0 8px;padding:8px 12px;' +
          'background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);font-size:12px;color:var(--text-2);line-height:1.35}' +
        '.sdm-sum b{color:var(--text);font-weight:700;white-space:nowrap}' +
        '.sdm-sum span{white-space:nowrap}' +
        '.sdm-sigs.sdm-on{display:block;margin:0 0 12px;padding:4px 12px 10px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);color:var(--text)}' +
        '.sdm-sigs .sdc-row .form-input{flex:1 1 auto;width:auto;min-width:0;text-align:left}' +
        '.sdm-sigs .sdc-row>label{flex:0 0 42%}' +
      '}' +
      '@media print{' +
        '.sdm-sum,.sdm-sigs{display:none!important}' +
        'html.sdm-print #sd-pdoc{display:none!important}' +
        'html.sdm-print #sdm-print{display:block!important;break-inside:auto!important;page-break-inside:auto!important;' +
          'color:var(--text);font-family:var(--font);font-size:11px;line-height:1.35;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
        '#sdm-print .sdm-p-head{border-bottom:2px solid var(--primary);padding:0 0 6px;margin:0 0 10px}' +
        '#sdm-print .sdm-p-co{font-size:14px;font-weight:700;color:var(--text)}' +
        '#sdm-print .sdm-p-title{font-size:12px;font-weight:700;color:var(--primary);text-transform:uppercase;letter-spacing:.03em}' +
        '#sdm-print .sdm-p-meta{font-size:10px;color:var(--text-2)}' +
        '#sdm-print .sdm-p-card{border:1px solid var(--border-2);border-radius:var(--radius-sm);padding:7px 10px;margin:0 0 8px;page-break-inside:avoid;break-inside:avoid}' +
        '#sdm-print .sdm-p-top{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;border-bottom:1px solid var(--border);padding:0 0 5px;margin:0 0 4px}' +
        '#sdm-print .sdm-p-name{font-weight:700;font-size:12px}' +
        '#sdm-print .sdm-p-sub{display:block;font-size:10px;color:var(--text-2)}' +
        '#sdm-print .sdm-p-net{font-weight:700;font-size:12px;white-space:nowrap}' +
        '#sdm-print .sdm-p-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:2px 14px}' +
        '#sdm-print .sdm-p-cap{font-size:9px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text-2);margin:3px 0 1px}' +
        '#sdm-print .sdm-p-row{display:flex;justify-content:space-between;gap:8px}' +
        '#sdm-print .sdm-p-row span:last-child{white-space:nowrap;font-weight:600}' +
        '#sdm-print .sdm-p-total{display:flex;justify-content:space-between;align-items:center;border-top:2px solid var(--primary);margin:10px 0 0;padding:6px 0 0;font-size:13px;font-weight:700;page-break-inside:avoid;break-inside:avoid}' +
        '#sdm-print .sdm-p-sigs{margin:8px 0 0;font-size:10px;color:var(--text-2)}' +
      '}';
    document.head.appendChild(s);
  }

  /* ---------- read the hidden table ---------- */
  function rows() {
    var out = [];
    document.querySelectorAll('#sd-content .pdoc-sd-table tbody > tr').forEach(function (tr) {
      var epf = tr.querySelector('input[id^="sd-epf-"]:not([id*="-er-"])');
      if (!epf) return;
      out.push({ id: String(epf.id).replace('sd-epf-', ''), tr: tr, visible: tr.style.display !== 'none' });
    });
    return out;
  }
  function val(id) { var el = $(id); return el ? (Number(el.value) || 0) : 0; }
  function selText(id) {
    var el = $(id); if (!el || !el.value) return '';
    var o = el.options && el.options[el.selectedIndex];
    return o ? String(o.textContent || '').trim() : el.value;
  }
  function recById(id) {
    var recs = []; try { recs = _sdRecords || []; } catch (e) { recs = window._sdRecords || []; }
    for (var i = 0; i < recs.length; i++) if (String(recs[i].id) === String(id)) return recs[i];
    return null;
  }
  function summary() {
    var rs = rows(), vis = rs.filter(function (r) { return r.visible; });
    var salary = 0;
    vis.forEach(function (r) { salary += num((r.tr.querySelector('.pdoc-sd-basic') || {}).textContent); });
    var budget;
    if (vis.length === rs.length && $('sd-grand-budget')) budget = String($('sd-grand-budget').textContent || '').trim();
    else {
      var b = 0;
      vis.forEach(function (r) {
        b += num(($('sd-net-' + r.id) || {}).textContent);
        ['sd-epf-', 'sd-socso-', 'sd-eis-', 'sd-pcb-', 'sd-zakat-', 'sd-epf-er-', 'sd-socso-er-', 'sd-eis-er-'].forEach(function (p) { b += val(p + r.id); });
      });
      budget = rm(b);
    }
    var net = 0; vis.forEach(function (r) { net += num(($('sd-net-' + r.id) || {}).textContent); });
    return { count: vis.length, salary: rm(salary), budget: budget,
      net: vis.length === rs.length && $('sd-grand-total') ? String($('sd-grand-total').textContent || '').trim() : rm(net) };
  }

  /* ---------- screen: summary line + signatures mirror ---------- */
  function ensureSummary(on) {
    var wrap = $('sdc-wrap'), el = $('sdm-sum');
    if (!wrap) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('div'); el.id = 'sdm-sum'; el.className = 'sdm-sum no-print'; el.setAttribute('role', 'status'); }
    if (!el.isConnected || el.parentNode !== wrap.parentNode || !(el.compareDocumentPosition(wrap) & 4)) wrap.parentNode.insertBefore(el, wrap);
    if (el.classList.contains('sdm-on') !== on) el.classList.toggle('sdm-on', on);
    var s = summary();
    setHtml(el, '<span>' + esc(L('Employees', 'Pekerja')) + ': <b>' + s.count + '</b></span>' +
      '<span>' + esc(L('Total Salary', 'Jumlah Gaji')) + ': <b>' + esc(s.salary) + '</b></span>' +
      '<span>' + esc(L('Budget Required', 'Bajet Diperlukan')) + ': <b>' + esc(s.budget) + '</b></span>');
  }
  function ensureSigs(on) {
    var pdoc = $('sd-pdoc'), el = $('sdm-sigs');
    var have = SIGS.some(function (k) { return !!$('sig-input-' + k[0]); });
    if (!pdoc || !have || !$('sdc-wrap')) { if (el) el.remove(); return; }
    var lang = bm() ? 'bm' : 'en';
    if (!el || el.getAttribute('data-lang') !== lang) {
      if (!el) {
        el = document.createElement('div'); el.id = 'sdm-sigs'; el.className = 'sdm-sigs no-print';
        el.addEventListener('input', function (e) { var t = target(e.target); if (t) t.value = e.target.value; });
        el.addEventListener('change', function (e) {
          var t = target(e.target); if (!t) return;
          t.value = e.target.value;
          t.dispatchEvent(new Event('change', { bubbles: true }));
        });
      }
      el.setAttribute('data-lang', lang);
      el.innerHTML = '<div class="sdc-cap">' + esc(L('Signatures', 'Tandatangan')) + '</div>' + SIGS.map(function (k) {
        if (!$('sig-input-' + k[0])) return '';
        return '<div class="sdc-row"><label for="sdm-sig-' + k[0] + '">' + esc(L(k[1], k[2])) + '</label>' +
          '<input class="form-input" type="text" id="sdm-sig-' + k[0] + '" data-sig="sig-input-' + k[0] + '" autocomplete="off"></div>';
      }).join('');
    }
    if (!el.isConnected || el.previousSibling !== pdoc) pdoc.parentNode.insertBefore(el, pdoc.nextSibling);
    if (el.classList.contains('sdm-on') !== on) el.classList.toggle('sdm-on', on);
    var active = document.activeElement;
    el.querySelectorAll('[data-sig]').forEach(function (inp) {
      var t = $(inp.getAttribute('data-sig'));
      if (t && inp !== active && inp.value !== t.value) inp.value = t.value;
    });
  }
  function target(inp) { var id = inp && inp.getAttribute && inp.getAttribute('data-sig'); return id ? $(id) : null; }

  /* ---------- print: read-only cards ---------- */
  function line(k, v) { return '<div class="sdm-p-row"><span>' + esc(k) + '</span><span>' + esc(v) + '</span></div>'; }
  function amtLine(k, id) { var n = val(id); return n > 0 ? line(k, rm(n)) : ''; }
  function pairLine(typeId, amtId, fallback) { var n = val(amtId); return n > 0 ? line(selText(typeId) || fallback, rm(n)) : ''; }
  function sec(cap, body) { return body ? '<div><div class="sdm-p-cap">' + esc(cap) + '</div>' + body + '</div>' : ''; }
  function printCard(r) {
    var tr = r.tr, tds = tr.children, id = r.id;
    var txt = function (i) { return tds[i] ? String(tds[i].textContent || '').trim() : ''; };
    var name = String((tr.querySelector('.pdoc-sd-payee') || {}).textContent || '-').trim();
    var sub = [txt(2), txt(3)].filter(function (x) { return x && x !== '\u2014' && x !== '-'; }).join(' \u00b7 ');
    var earn = line(L('Basic', 'Gaji Pokok'), String((tr.querySelector('.pdoc-sd-basic') || {}).textContent || '').trim());
    tr.querySelectorAll('.pdoc-sd-line').forEach(function (ln) {
      var lab = ln.querySelector('label'), sp = ln.querySelector(':scope > span');
      if (lab && sp && !ln.querySelector('input,select')) {
        var k = lab.textContent.trim(); if (/^commission$|^komisen$/i.test(k)) k = L('Commission', 'Komisen');
        earn += line(k, sp.textContent.trim());
      }
    });
    for (var i = 1; i <= 3; i++) earn += pairLine('sd-atype' + i + '-' + id, 'sd-a' + i + '-' + id, L('Allowance', 'Elaun') + ' ' + i);
    var stat = amtLine('EPF', 'sd-epf-' + id) + amtLine('SOCSO', 'sd-socso-' + id) + amtLine('EIS', 'sd-eis-' + id) +
      amtLine('PCB', 'sd-pcb-' + id) + amtLine('Zakat', 'sd-zakat-' + id);
    var er = amtLine(L('Er EPF', 'EPF Majikan'), 'sd-epf-er-' + id) + amtLine(L('Er SOCSO', 'SOCSO Majikan'), 'sd-socso-er-' + id) +
      amtLine(L('Er EIS', 'EIS Majikan'), 'sd-eis-er-' + id);
    var ded = amtLine(L('Advance', 'Pendahuluan'), 'sd-adv-' + id) +
      pairLine('sd-dtype1-' + id, 'sd-d1-' + id, L('Deduction', 'Potongan') + ' 1') + pairLine('sd-dtype2-' + id, 'sd-d2-' + id, L('Deduction', 'Potongan') + ' 2');
    return '<div class="sdm-p-card" data-row="' + esc(id) + '"><div class="sdm-p-top"><div><span class="sdm-p-name">' + esc(name) + '</span>' +
      (sub ? '<span class="sdm-p-sub">' + esc(sub) + '</span>' : '') + '</div><span class="sdm-p-net">' + esc(String(($('sd-net-' + id) || {}).textContent || '').trim()) + '</span></div>' +
      '<div class="sdm-p-grid">' + sec(L('Earnings', 'Pendapatan'), earn) +
      sec(L('Statutory', 'Caruman'), stat + er) + sec(L('Deductions', 'Potongan'), ded) + '</div></div>';
  }
  function buildPrint() {
    var pdoc = $('sd-pdoc'); if (!pdoc) return null;
    var el = $('sdm-print');
    if (!el) { el = document.createElement('div'); el.id = 'sdm-print'; el.setAttribute('aria-hidden', 'true'); }
    var anchor = $('sdm-sigs') || pdoc;
    if (el.previousSibling !== anchor) anchor.parentNode.insertBefore(el, anchor.nextSibling);
    var vis = rows().filter(function (r) { return r.visible; }), s = summary();
    var co = String((pdoc.querySelector('.pdoc-company-name') || {}).textContent || ((window.APP && APP.tenant && APP.tenant.name) || '')).trim();
    var title = String((pdoc.querySelector('.pdoc-title-bar') || {}).textContent || L('Salary Disbursement', 'Penyaluran Gaji')).trim();
    var sigs = SIGS.map(function (k) { var t = $('sig-input-' + k[0]); return t && String(t.value || '').trim() ? L(k[1], k[2]) + ': ' + String(t.value).trim() : ''; })
      .filter(Boolean).join(' \u00b7 ');
    var d = new Date(), ymd = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    el.innerHTML = '<div class="sdm-p-head">' + (co ? '<div class="sdm-p-co">' + esc(co) + '</div>' : '') +
      '<div class="sdm-p-title">' + esc(title) + '</div>' +
      '<div class="sdm-p-meta">' + esc(s.count + ' ' + L('employee(s)', 'pekerja') + ' \u00b7 ' + L('Generated', 'Dijana') + ': ' + ymd) + '</div></div>' +
      vis.map(printCard).join('') +
      '<div class="sdm-p-total"><span>' + esc(L('Total Net Pay', 'Jumlah Gaji Bersih')) + '</span><span>' + esc(s.net) + '</span></div>' +
      (sigs ? '<div class="sdm-p-sigs">' + esc(sigs) + '</div>' : '');
    return el;
  }
  function enterPrint() {
    if (!mobileCards()) return false;
    buildPrint();
    document.documentElement.classList.add('sdm-print');
    var pg = $('sdm-page');
    if (!pg) { pg = document.createElement('style'); pg.id = 'sdm-page'; pg.textContent = '@page{size:A4 portrait;margin:10mm}'; }
    document.head.appendChild(pg); // last @page rule wins over pdoc landscape
    if (!printing) {
      themeWas = document.documentElement.getAttribute('data-theme');
      if (themeWas === 'dark') { document.documentElement.setAttribute('data-theme', 'light'); document.body.classList.remove('dark'); }
      printing = true;
      setTimeout(function () { document.addEventListener('pointerdown', exitPrint, { once: true, capture: true }); }, 800);
    }
    return true;
  }
  function exitPrint() {
    document.documentElement.classList.remove('sdm-print');
    var pg = $('sdm-page'); if (pg) pg.remove();
    if (printing && themeWas === 'dark') { document.documentElement.setAttribute('data-theme', 'dark'); document.body.classList.add('dark'); }
    printing = false; themeWas = null;
  }

  /* ---------- hooks (beforeprint also fires for the Print button's window.print();
     _sdPreparePrint is NOT wrapped: index.html add/removeEventListener's it by reference) ---------- */
  function copyFlags(from, to) { try { Object.keys(from).forEach(function (k) { to[k] = from[k]; }); } catch (e) {} }
  function wrapRecalc() {
    var o = window._sdRecalc;
    if (typeof o !== 'function' || o._sdm1) return;
    var w = function () { var out = o.apply(this, arguments); schedule(); return out; };
    copyFlags(o, w); w._sdm1 = true;
    window._sdRecalc = w;
  }
  window.addEventListener('beforeprint', function () { try { enterPrint(); } catch (e) {} });
  window.addEventListener('afterprint', function () { setTimeout(exitPrint, 0); });
  try {
    var pm = window.matchMedia && window.matchMedia('print');
    if (pm) { var f = function (e) { if (!e.matches && printing) exitPrint(); }; pm.addEventListener ? pm.addEventListener('change', f) : pm.addListener(f); }
  } catch (e) {}
  window.addEventListener('resize', function () { screenNarrow(); schedule(); });

  function tick() {
    timer = null;
    wrapRecalc();
    if (!$('sd-pdoc') || !$('sdc-wrap')) { ['sdm-sum', 'sdm-sigs'].forEach(function (i) { var e = $(i); if (e) e.remove(); }); return; }
    var on = mobileCards();
    ensureSummary(on);
    ensureSigs(on);
  }
  function schedule() { if (!timer) timer = setTimeout(tick, 150); }
  function observe() {
    var main = $('main');
    if (!main) { setTimeout(observe, 300); return; }
    new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var n = muts[i].target;
        if (n && n.closest && n.closest('#sdm-sum,#sdm-sigs,#sdm-print')) continue;
        schedule(); return;
      }
    }).observe(main, { childList: true, subtree: true, characterData: true });
    schedule();
  }

  css();
  wrapRecalc();
  setTimeout(wrapRecalc, 900);
  observe();
  window._sdMobileView = { tick: tick, summary: summary, buildPrint: buildPrint, enterPrint: enterPrint, exitPrint: exitPrint, mobileCards: mobileCards };
})();
