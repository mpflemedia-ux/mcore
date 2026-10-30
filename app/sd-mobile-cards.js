/* Salary Disbursement — card editor. v3 (v3: cards are the ONLY SD editing UI at every width;
   the white .pdoc paper is hidden on screen + print by sd-mobile-view.js; desktop >900px gets a
   responsive grid (open card spans the row, sections side by side) and an inline sticky action
   bar; cards built from every payroll row, print-batch only filters them.)
   v2: status-chip slot, per-card 'Recalculate statutory', partial-save dirty handling, sd-tools hooks.
   Cards are a SEPARATE DOM above #sd-pdoc. Card inputs never reuse table ids: each has
   data-target="<table input id>" and proxies its value into the hidden table input, then fires
   'input'/'change' there, so _sdRecalc, sd-employer-edit, print-batch, _sdSaveAll and the
   review popup keep working unchanged. */
(function () {
  if (window.SD_MOBILE_CARDS_V1) return;
  window.SD_MOBILE_CARDS_V1 = true;

  var dirty = {};            // rowId -> true (edited since last successful save)
  var openId = null;         // accordion: one expanded card
  var builtFor = null;       // table element the cards were built from
  var builtSig = '';         // target-id signature, rebuild when wrappers add inputs
  var prevPeriod = { m: null, y: null };
  var refreshTimer = null;

  function bm() { try { return APP.language === 'bm'; } catch (e) { return false; } }
  function L(en, ms) { return bm() ? ms : en; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function $(id) { return document.getElementById(id); }
  function dirtyCount() { return Object.keys(dirty).length; }
  function onSd() { return !!$('sd-month') && !!$('sd-pdoc'); }
  function dirtyActive() { return onSd() && dirtyCount() > 0; }
  function msgLeave() { return L('You have unsaved salary changes. Leave without saving?', 'Ada perubahan gaji belum disimpan. Keluar tanpa simpan?'); }

  /* ---------- CSS (tokens only; all rules mobile-screen scoped) ---------- */
  function css() {
    var old = $('sdc-css');
    if (old) old.remove();
    var s = document.createElement('style');
    s.id = 'sdc-css';
    s.textContent =
      '@media print{.sdc-wrap,.sdc-bar{display:none!important}}' +
      '@media screen{' +
      '.sdc-wrap{display:flex;flex-direction:column;gap:6px;margin:0 0 12px}' +
      '.sdc-card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;color:var(--text)}' +
      '.sdc-card.sdc-open{border-color:var(--primary)}' +
      '.sdc-head{display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;text-align:left;color:var(--text);min-height:48px}' +
      '.sdc-who{flex:1;min-width:0}' +
      '.sdc-name{font-size:13px;font-weight:600;line-height:1.3;overflow-wrap:anywhere}' +
      '.sdc-sub{display:block;font-size:11px;color:var(--text-3);line-height:1.3;overflow-wrap:anywhere}' +
      '.sdc-chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:3px}' +
      '.sdc-chips:empty{display:none}' +
      '.sdc-recalc{justify-content:flex-end;flex-wrap:wrap}' +
      '.sdc-recalc .btn{white-space:nowrap}' +
      '.sdc-net{font-family:"Space Grotesk",sans-serif;font-size:14px;font-weight:700;white-space:nowrap;color:var(--text)}' +
      '.sdc-dot{width:8px;height:8px;border-radius:50%;background:var(--warning);flex:0 0 8px;visibility:hidden}' +
      '.sdc-card.sdc-dirty .sdc-dot{visibility:visible}' +
      '.sdc-chev{color:var(--text-3);font-size:16px;transition:transform var(--transition)}' +
      '.sdc-open .sdc-chev{transform:rotate(180deg)}' +
      '.sdc-body{display:none;padding:2px 12px 10px;border-top:1px solid var(--border)}' +
      '.sdc-open .sdc-body{display:block}' +
      '.sdc-cap{font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--text-3);margin:10px 0 2px}' +
      '.sdc-row{display:flex;align-items:center;gap:8px;min-height:34px}' +
      '.sdc-row>label,.sdc-row>.sdc-k{flex:1;min-width:0;font-size:12px;color:var(--text-2);line-height:1.25}' +
      '.sdc-row .sdc-v{font-size:12px;font-weight:600;white-space:nowrap;color:var(--text)}' +
      '.sdc-row .form-input,.sdc-row .form-select{height:32px;min-height:32px;padding:4px 8px;font-size:12px;border-radius:var(--radius-sm)}' +
      '.sdc-row .form-input{flex:0 0 104px;width:104px;text-align:right}' +
      '.sdc-row .form-select{flex:1;min-width:0;width:auto}' +
      '.sdc-row .form-input.sdc-amended{border-color:var(--warning)}' +
      '.sdc-netrow{display:flex;justify-content:space-between;align-items:center;margin-top:8px;padding-top:8px;border-top:1px solid var(--border);font-size:12px;color:var(--text-2)}' +
      '.sdc-netrow b{font-family:"Space Grotesk",sans-serif;font-size:15px;color:var(--primary);white-space:nowrap}' +
      '.sdc-bar{z-index:50;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px 12px;' +
        'background:var(--bg-card);border-top:1px solid var(--border);padding:10px 14px calc(10px + env(safe-area-inset-bottom));color:var(--text)}' +
      '.sdc-tot{display:flex;flex-direction:column;min-width:0}' +
      '.sdc-tot span{font-size:11px;color:var(--text-3);white-space:nowrap}' +
      '.sdc-tot b{font-family:"Space Grotesk",sans-serif;font-size:16px;white-space:nowrap}' +
      '.sdc-bar .sdc-acts{display:flex;align-items:center;gap:8px;flex-wrap:wrap}' +
      '.sdc-bar .sdc-unsaved{font-size:11px;font-weight:600;color:var(--warning);white-space:nowrap;display:none}' +
      '.sdc-bar.sdc-has-dirty .sdc-unsaved{display:inline}' +
      '.sdc-bar .btn{white-space:nowrap;min-height:40px}' +
      '.sdc-sec>.sdc-cap:first-child{margin-top:10px}' +
      '}' +
      '@media screen and (max-width:900px){' +
      '#main:has(> .sdc-bar){padding-bottom:calc(76px + env(safe-area-inset-bottom))!important}' +
      '.sdc-bar{position:fixed;left:0;right:0;bottom:0}' +
      'body:has(.sdc-bar) #ai-chat-fab{bottom:84px}' +
      'body:has(.sdc-bar) #dash-home-fab{bottom:144px}' +
      'body:has(.sdc-bar) #scroll-top-btn{bottom:204px}' +
      '}' +
      '@media screen and (min-width:901px){' +
      '.sdc-wrap{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:10px;align-items:start}' +
      '.sdc-card.sdc-open{grid-column:1/-1}' +
      '.sdc-open .sdc-body{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:0 28px;padding:4px 16px 12px}' +
      '.sdc-body>.sdc-netrow{grid-column:1/-1}' +
      '.sdc-bar{position:sticky;bottom:0;margin:4px 0 16px;border:1px solid var(--border);border-radius:var(--radius);padding:10px 16px;box-shadow:var(--shadow)}' +
      '}';
    document.head.appendChild(s);
  }

  /* ---------- read the table ---------- */
  function tableEl() { return document.querySelector('#sd-content .pdoc-sd-table'); }
  function sdRecs() {
    var r = null;
    try { r = (typeof _sdRecords !== 'undefined') ? _sdRecords : null; } catch (e) { r = null; }
    return r || window._sdRecords || [];
  }
  function rowsFromTable(table) {
    var out = [], trs = [], seen = {};
    // every payroll_records row (never only print-batch-visible ones), then any extra table rows
    sdRecs().forEach(function (rec) {
      var inp = rec && document.getElementById('sd-epf-' + rec.id);
      var tr = inp && inp.closest('tr');
      if (tr && table.contains(tr) && !seen[rec.id]) { seen[rec.id] = 1; trs.push(tr); }
    });
    table.querySelectorAll('tbody > tr').forEach(function (tr) { if (trs.indexOf(tr) < 0) trs.push(tr); });
    trs.forEach(function (tr) {
      var epf = tr.querySelector('input[id^="sd-epf-"]:not([id*="-er-"])');
      if (!epf) return;
      var id = String(epf.id).replace('sd-epf-', '');
      var tds = tr.children;
      var txt = function (i) { return tds[i] ? String(tds[i].textContent || '').trim() : ''; };
      var extras = [];
      tr.querySelectorAll('.pdoc-sd-line').forEach(function (ln) {
        var lab = ln.querySelector('label'), sp = ln.querySelector(':scope > span');
        if (lab && sp && !ln.querySelector('input,select')) extras.push({ k: lab.textContent.trim(), v: sp.textContent.trim() });
      });
      out.push({
        id: id, tr: tr,
        name: (tr.querySelector('.pdoc-sd-payee') || {}).textContent || '-',
        bank: txt(2), acc: txt(3),
        basic: (tr.querySelector('.pdoc-sd-basic') || {}).textContent || '',
        extras: extras
      });
    });
    return out;
  }
  function signature(table) {
    return Array.prototype.map.call(table.querySelectorAll('input[id^="sd-"],select[id^="sd-"]'), function (el) { return el.id; }).join('|');
  }

  /* ---------- build ---------- */
  function inputRow(label, targetId) {
    var t = $(targetId);
    if (!t) return '';
    return '<div class="sdc-row"><label for="sdc-' + esc(targetId) + '">' + esc(label) + '</label>' +
      '<input class="form-input" type="number" step="0.01" min="0" inputmode="decimal" id="sdc-' + esc(targetId) + '" data-target="' + esc(targetId) + '" value="' + esc(t.value) + '"></div>';
  }
  function pairRow(typeId, amtId) {
    var ts = $(typeId), ta = $(amtId);
    if (!ts || !ta) return '';
    return '<div class="sdc-row"><select class="form-select" aria-label="' + esc(L('Type', 'Jenis')) + '" data-target="' + esc(typeId) + '">' + ts.innerHTML + '</select>' +
      '<input class="form-input" type="number" step="0.01" min="0" inputmode="decimal" aria-label="RM" data-target="' + esc(amtId) + '" value="' + esc(ta.value) + '"></div>';
  }
  function selectRow(label, targetId) {
    var t = $(targetId);
    if (!t) return '';
    return '<div class="sdc-row"><select class="form-select" aria-label="' + esc(label) + '" data-target="' + esc(targetId) + '">' + t.innerHTML + '</select></div>';
  }
  function textRow(k, v) {
    return '<div class="sdc-row"><span class="sdc-k">' + esc(k) + '</span><span class="sdc-v">' + esc(v) + '</span></div>';
  }
  function cardHtml(r) {
    var id = r.id;
    var sub = [r.bank, r.acc].filter(function (x) { return x && x !== '\u2014'; }).join(' \u00b7 ');
    var earn = textRow(L('Basic', 'Gaji Pokok'), r.basic);
    r.extras.forEach(function (e) {
      var k = /^commission$|^komisen$/i.test(e.k) ? L('Commission', 'Komisen') : e.k;
      earn += textRow(k, e.v);
    });
    var er = inputRow(L('Er EPF', 'EPF Majikan'), 'sd-epf-er-' + id) +
      inputRow(L('Er SOCSO', 'SOCSO Majikan'), 'sd-socso-er-' + id) +
      inputRow(L('Er EIS', 'EIS Majikan'), 'sd-eis-er-' + id);
    return '<div class="sdc-card' + (dirty[id] ? ' sdc-dirty' : '') + (openId === id ? ' sdc-open' : '') + '" data-row="' + esc(id) + '">' +
      '<button type="button" class="sdc-head" aria-expanded="' + (openId === id) + '">' +
        '<span class="sdc-dot" title="' + esc(L('Unsaved', 'Belum disimpan')) + '"></span>' +
        '<span class="sdc-who"><span class="sdc-name">' + esc(r.name.trim()) + '</span>' + (sub ? '<span class="sdc-sub">' + esc(sub) + '</span>' : '') + '<span class="sdc-chips" data-chips="' + esc(id) + '"></span></span>' +
        '<span class="sdc-net" data-net="' + esc(id) + '"></span>' +
        '<i class="ti ti-chevron-down sdc-chev"></i>' +
      '</button>' +
      '<div class="sdc-body">' +
        '<div class="sdc-sec"><div class="sdc-cap">' + esc(L('Earnings', 'Pendapatan')) + '</div>' + earn +
        '<div class="sdc-cap">' + esc(L('Allowances', 'Elaun')) + '</div>' +
          pairRow('sd-atype1-' + id, 'sd-a1-' + id) + pairRow('sd-atype2-' + id, 'sd-a2-' + id) + pairRow('sd-atype3-' + id, 'sd-a3-' + id) + '</div>' +
        '<div class="sdc-sec"><div class="sdc-cap">' + esc(L('Statutory \u2014 Employee', 'Caruman \u2014 Pekerja')) + '</div>' +
          inputRow('EPF', 'sd-epf-' + id) + inputRow('SOCSO', 'sd-socso-' + id) + inputRow('EIS', 'sd-eis-' + id) +
          inputRow('PCB', 'sd-pcb-' + id) + inputRow('Zakat', 'sd-zakat-' + id) + '</div>' +
        '<div class="sdc-sec">' + (er ? '<div class="sdc-cap">' + esc(L('Statutory \u2014 Employer', 'Caruman \u2014 Majikan')) + '</div>' + er : '') +
        '<div class="sdc-row sdc-recalc"><button type="button" class="btn btn-outline btn-sm" data-act="recalc" data-row="' + esc(id) + '"><i class="ti ti-calculator"></i> ' + esc(L('Recalculate statutory', 'Kira semula caruman')) + '</button></div></div>' +
        '<div class="sdc-sec"><div class="sdc-cap">' + esc(L('Deductions', 'Potongan')) + '</div>' +
          inputRow(L('Advance', 'Pendahuluan'), 'sd-adv-' + id) +
          selectRow(L('Deduct advance', 'Potong panjar'), 'sd-advsel-' + id) +
          pairRow('sd-dtype1-' + id, 'sd-d1-' + id) + pairRow('sd-dtype2-' + id, 'sd-d2-' + id) + '</div>' +
        '<div class="sdc-netrow"><span>' + esc(L('Net Pay', 'Gaji Bersih')) + '</span><b data-net="' + esc(id) + '"></b></div>' +
      '</div></div>';
  }

  function build() {
    var table = tableEl(), pdoc = $('sd-pdoc');
    if (!table || !pdoc) return;
    var newTable = table !== builtFor;
    if (newTable) {
      dirty = {};
      openId = null;
      prevPeriod = { m: ($('sd-month') || {}).value, y: ($('sd-year') || {}).value };
    }
    var wrap = $('sdc-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'sdc-wrap';
      wrap.className = 'sdc-wrap no-print';
      wrap.addEventListener('click', onClick);
      wrap.addEventListener('input', onEdit);
      wrap.addEventListener('change', onEdit);
    }
    // cards sit before the (hidden) paper; signatures/print/bar may sit between them
    if (wrap.parentNode !== pdoc.parentNode || !(wrap.compareDocumentPosition(pdoc) & 4)) pdoc.parentNode.insertBefore(wrap, pdoc);
    var rows = rowsFromTable(table), html = '';
    rows.forEach(function (r) { try { html += cardHtml(r); } catch (e) { console.warn('SD card build', r && r.id, e); } });
    wrap.innerHTML = html;
    // selects: copy current selected value (innerHTML clone keeps 'selected' attr only)
    wrap.querySelectorAll('select[data-target]').forEach(function (s) {
      var t = $(s.getAttribute('data-target'));
      if (t) s.value = t.value;
    });
    builtFor = table;
    builtSig = signature(table);
    pdoc.classList.add('sdc-on');
    ensureBar();
    refresh();
  }

  // inline action bar = last SD block before the hidden paper (whose Generate Payslip card stays visible):
  // cards -> signatures -> print block -> bar -> #sd-pdoc
  function placeBar(bar) {
    bar = bar || $('sdc-bar'); if (!bar) return;
    var pdoc = $('sd-pdoc');
    if (pdoc && pdoc.parentNode) { if (!bar.isConnected || bar.nextSibling !== pdoc) pdoc.parentNode.insertBefore(bar, pdoc); }
    else if (!bar.isConnected) ($('main') || document.body).appendChild(bar);
  }
  function ensureBar() {
    var bar = $('sdc-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'sdc-bar';
      bar.className = 'sdc-bar no-print';
    }
    placeBar(bar);
    bar.innerHTML =
      '<div class="sdc-tot"><span>' + esc(L('Total Net Pay', 'Jumlah Gaji Bersih')) + '</span><b id="sdc-total"></b></div>' +
      '<div class="sdc-acts"><span class="sdc-unsaved">' + esc(L('Unsaved changes', 'Belum disimpan')) + '</span>' +
      '<button type="button" class="btn btn-primary btn-sm" id="sdc-save"><i class="ti ti-device-floppy"></i> ' + esc(L('Save', 'Simpan')) + '</button></div>';
    $('sdc-save').onclick = function () { if (typeof window._sdSaveAll === 'function') window._sdSaveAll(); };
  }

  function teardown() {
    var w = $('sdc-wrap'); if (w) w.remove();
    var b = $('sdc-bar'); if (b) b.remove();
    builtFor = null; builtSig = ''; dirty = {}; openId = null;
  }

  /* ---------- sync table -> cards ---------- */
  function refresh() {
    var wrap = $('sdc-wrap');
    if (!wrap) return;
    var active = document.activeElement;
    wrap.querySelectorAll('[data-target]').forEach(function (el) {
      var t = $(el.getAttribute('data-target'));
      if (!t) return;
      if (el !== active && el.value !== t.value) el.value = t.value;
      if (el.tagName === 'INPUT') el.classList.toggle('sdc-amended', !!(t.style && t.style.borderColor));
    });
    wrap.querySelectorAll('[data-net]').forEach(function (el) {
      var n = $('sd-net-' + el.getAttribute('data-net'));
      el.textContent = n ? n.textContent : '';
    });
    wrap.querySelectorAll('.sdc-card').forEach(function (c) {
      var id = c.getAttribute('data-row');
      var epf = $('sd-epf-' + id), tr = epf && epf.closest('tr');
      c.style.display = (tr && tr.style.display === 'none') ? 'none' : '';
      c.classList.toggle('sdc-dirty', !!dirty[id]);
    });
    var tot = $('sdc-total'), g = $('sd-grand-total');
    if (tot) tot.textContent = g ? g.textContent : '';
    var bar = $('sdc-bar');
    if (bar) bar.classList.toggle('sdc-has-dirty', dirtyCount() > 0);
    try { if (window._sdTools && typeof window._sdTools.decorate === 'function') window._sdTools.decorate(); } catch (e) {}
  }

  /* ---------- events ---------- */
  function onClick(e) {
    var act = e.target.closest && e.target.closest('[data-act="recalc"]');
    if (act) {
      e.preventDefault();
      if (window._sdTools && typeof window._sdTools.recalcRows === 'function') window._sdTools.recalcRows([act.getAttribute('data-row')]);
      return;
    }
    var head = e.target.closest && e.target.closest('.sdc-head');
    if (!head) return;
    var card = head.parentNode, id = card.getAttribute('data-row');
    openId = (openId === id) ? null : id;
    $('sdc-wrap').querySelectorAll('.sdc-card').forEach(function (c) {
      var on = c.getAttribute('data-row') === openId;
      c.classList.toggle('sdc-open', on);
      var h = c.querySelector('.sdc-head'); if (h) h.setAttribute('aria-expanded', String(on));
    });
  }
  function onEdit(e) {
    var el = e.target, tid = el && el.getAttribute && el.getAttribute('data-target');
    if (!tid) return;
    var isSel = el.tagName === 'SELECT';
    if (isSel && e.type === 'input') return; // selects proxy on 'change' only
    if (!isSel && e.type === 'change') return;
    var t = $(tid);
    if (!t) return;
    t.value = el.value;
    var card = el.closest('.sdc-card');
    if (card) dirty[card.getAttribute('data-row')] = true;
    t.dispatchEvent(new Event(isSel ? 'change' : 'input', { bubbles: true }));
    refresh();
  }

  /* ---------- wrappers (copy flags so older wrappers don't re-wrap) ---------- */
  function copyFlags(from, to) { try { Object.keys(from).forEach(function (k) { to[k] = from[k]; }); } catch (e) {} }
  function wrapRecalc() {
    var o = window._sdRecalc;
    if (typeof o !== 'function' || o._sdc1) return;
    var w = function () { var out = o.apply(this, arguments); try { refresh(); } catch (e) {} return out; };
    copyFlags(o, w); w._sdc1 = true;
    window._sdRecalc = w;
  }
  function wrapSave() {
    var o = window._sdSaveAll;
    if (typeof o !== 'function' || o._sdc1) return;
    var w = async function () {
      var res = $('sd-save-result');
      if (res) res.innerHTML = '';
      window._sdLastSave = null;
      var out = await o.apply(this, arguments);
      var ls = window._sdLastSave;
      if (ls && Array.isArray(ls.ok)) {
        // partial save: only rows that saved lose their unsaved dot; failed rows stay dirty
        if (!ls.blocked) ls.ok.forEach(function (id) { delete dirty[String(id)]; });
      } else {
        var html = res ? res.innerHTML : '';
        if (html && html.indexOf('var(--danger)') === -1) dirty = {};
      }
      refresh();
      return out;
    };
    copyFlags(o, w); w._sdc1 = true;
    window._sdSaveAll = w;
  }
  function wrapOpenPage() {
    var o = window.openPage;
    if (typeof o !== 'function' || o._sdc1) return;
    var w = function () {
      if (dirtyActive()) {
        if (!window.confirm(msgLeave())) return;
        dirty = {};
      }
      return o.apply(this, arguments);
    };
    copyFlags(o, w); w._sdc1 = true;
    window.openPage = w;
  }

  // Month/Year change: capture phase runs before the inline onchange reload.
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (!t || (t.id !== 'sd-month' && t.id !== 'sd-year')) return;
    if (dirtyActive() && !window.confirm(msgLeave())) {
      t.value = t.id === 'sd-month' ? prevPeriod.m : prevPeriod.y;
      e.stopImmediatePropagation();
      e.preventDefault();
      return;
    }
    dirty = {};
  }, true);

  window.addEventListener('beforeunload', function (e) {
    if (!dirtyActive()) return;
    e.preventDefault();
    e.returnValue = '';
    return '';
  });

  /* ---------- watch #main for (re)renders ---------- */
  function tick() {
    refreshTimer = null;
    wrapRecalc(); wrapSave(); wrapOpenPage();
    var table = tableEl();
    if (!table || !onSd()) { if (builtFor || $('sdc-wrap')) teardown(); return; }
    if (table !== builtFor || signature(table) !== builtSig || !$('sdc-wrap') || !$('sdc-wrap').isConnected) {
      // wait until employer-edit inject (80ms after render) has settled
      var focusIn = document.activeElement && document.activeElement.closest && document.activeElement.closest('#sdc-wrap');
      if (table === builtFor && focusIn) { refresh(); return; }
      build();
      return;
    }
    placeBar();
    refresh();
  }
  function schedule() {
    if (refreshTimer) return;
    refreshTimer = setTimeout(tick, 120);
  }
  function observe() {
    var main = $('main');
    if (!main) { setTimeout(observe, 300); return; }
    new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var n = muts[i].target;
        if (n && n.closest && n.closest('#sdc-wrap,#sdc-bar')) continue;
        schedule(); return;
      }
    }).observe(main, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
    schedule();
  }

  css();
  wrapRecalc(); wrapSave(); wrapOpenPage();
  setTimeout(function () { wrapRecalc(); wrapSave(); wrapOpenPage(); }, 700);
  observe();

  window._sdMobileCards = {
    build: build, refresh: refresh,
    isDirty: function () { return dirtyCount() > 0; },
    _dirty: function () { return dirty; },
    markDirty: function (ids) { (ids || []).forEach(function (id) { dirty[String(id)] = true; }); refresh(); },
    clearDirty: function (ids) { (ids || []).forEach(function (id) { delete dirty[String(id)]; }); refresh(); }
  };
})();
