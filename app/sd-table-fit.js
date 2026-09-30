(function () {
  var old = document.getElementById('sd-table-fit-css');
  if (old) old.remove();
  var s = document.createElement('style');
  s.id = 'sd-table-fit-css';
  // v10: Mike rejected v9 mobile cards. Keep wide LTR table + horizontal
  // scroll on ALL screen sizes (inside .pdoc-sd-scroll). Compact mobile
  // stack/padding to shrink tall-row voids without stacking fields.
  // Preserve #859 debounce + preventScroll + scroll capture/restore.
  // Deduplicate screen PREPARED/CHECKED: hide #sd-sig-row preview lines
  // (form .pdoc-sig-grid stays for edit; #sd-sig-print stays for print).
  // Totals strip (Net/EPF/SOCSO/EIS/PCB) scrolls LTR on narrow screens.
  s.textContent =
    '@media screen{' +
    '.pdoc-sd-scroll{overflow-x:auto!important;-webkit-overflow-scrolling:touch;max-width:100%;}' +
    '.pdoc-sd-table{display:table!important;table-layout:auto!important;border-collapse:collapse!important;width:max-content!important;}' +
    '.pdoc-sd-table thead{display:table-header-group!important;}' +
    '.pdoc-sd-table tbody{display:table-row-group!important;}' +
    '.pdoc-sd-table tfoot{display:table-footer-group!important;}' +
    '.pdoc-sd-table tr{display:table-row!important;height:auto!important;}' +
    '.pdoc-sd-table th,.pdoc-sd-table td{' +
      'display:table-cell!important;vertical-align:top!important;height:auto!important;' +
      'white-space:nowrap!important;word-break:normal!important;overflow:visible!important;' +
      'padding:8px 12px!important;box-sizing:border-box;' +
    '}' +
    '.pdoc-sd-table tbody td::before{content:none!important;display:none!important;}' +
    '.pdoc-sd-payee,.pdoc-sd-bank,.pdoc-sd-basic,.pdoc-sd-net{white-space:nowrap!important;word-break:normal!important;}' +
    '.pdoc-sd-stack{display:flex;flex-direction:column;gap:8px;width:max-content;}' +
    '.pdoc-sd-line{' +
      'display:flex!important;flex-wrap:nowrap!important;align-items:center;' +
      'gap:12px!important;width:max-content!important;' +
    '}' +
    '.pdoc-sd-line label{' +
      'flex:0 0 78px!important;width:78px!important;' +
      'white-space:nowrap!important;overflow:visible!important;margin:0!important;' +
    '}' +
    '.pdoc-sd-line .form-select{' +
      'flex:0 0 160px!important;width:160px!important;min-width:160px!important;max-width:160px!important;' +
    '}' +
    '.pdoc-sd-line .form-input{' +
      'flex:0 0 88px!important;width:88px!important;min-width:88px!important;max-width:88px!important;' +
    '}' +
    /* Screen: one signature UI only - editable form cards.
       Hide the plain-line preview row that duplicated PREPARED/CHECKED. */
    '.pdoc-sd-sum-table tr.sd-sig-row,#sd-sig-row{display:none!important;}' +
    '}' +
    '@media screen and (max-width:900px){' +
    /* Keep real table (LTR columns) + force horizontal scroll - NOT cards */
    '.pdoc-sd-scroll{overflow-x:auto!important;-webkit-overflow-scrolling:touch;max-width:100%!important;}' +
    '.pdoc-sd-table{display:table!important;table-layout:auto!important;width:max-content!important;min-width:0!important;}' +
    '.pdoc-sd-table thead{display:table-header-group!important;}' +
    '.pdoc-sd-table tbody,.pdoc-sd-table tfoot{display:table-row-group!important;}' +
    '.pdoc-sd-table tr{display:table-row!important;height:auto!important;min-height:0!important;}' +
    '.pdoc-sd-table th,.pdoc-sd-table td{' +
      'display:table-cell!important;vertical-align:top!important;height:auto!important;' +
      'white-space:nowrap!important;padding:4px 8px!important;' +
    '}' +
    '.pdoc-sd-table tbody td::before{content:none!important;display:none!important;}' +
    /* Compact stacks so sibling NO/PAYEE cells are not sky-tall */
    '.pdoc-sd-stack{display:flex!important;flex-direction:column!important;gap:3px!important;width:max-content!important;}' +
    '.pdoc-sd-line{' +
      'display:flex!important;flex-wrap:nowrap!important;align-items:center;' +
      'gap:6px!important;width:max-content!important;' +
    '}' +
    '.pdoc-sd-line label{' +
      'flex:0 0 52px!important;width:52px!important;font-size:10px!important;' +
      'white-space:nowrap!important;margin:0!important;' +
    '}' +
    '.pdoc-sd-line .form-select{' +
      'flex:0 0 132px!important;width:132px!important;min-width:132px!important;max-width:132px!important;' +
      'height:28px!important;min-height:28px!important;padding:2px 6px!important;font-size:11px!important;' +
    '}' +
    '.pdoc-sd-line .form-input{' +
      'flex:0 0 72px!important;width:72px!important;min-width:72px!important;max-width:72px!important;' +
      'height:28px!important;min-height:28px!important;padding:2px 6px!important;font-size:11px!important;' +
    '}' +
    '.pdoc-sd-employer-note{font-size:9px!important;line-height:1.25!important;margin-top:2px!important;padding-top:2px!important;}' +
    '.pdoc-sd-payee{font-size:12px!important;}' +
    '.pdoc-sd-basic,.pdoc-sd-net{font-size:12px!important;}' +
    /* NET PAY / EPF / SOCSO / EIS / PCB strip: LTR + horizontal scroll, no overlap */
    '.pdoc-sd-closing{' +
      'overflow-x:auto!important;-webkit-overflow-scrolling:touch;max-width:100%!important;' +
      'padding-bottom:8px!important;' +
    '}' +
    '.pdoc-sd-sum-table{' +
      'width:max-content!important;min-width:560px!important;table-layout:auto!important;' +
    '}' +
    '.pdoc-sd-sum-table th,.pdoc-sd-sum-table td{' +
      'white-space:nowrap!important;padding:8px 12px!important;' +
    '}' +
    '.pdoc-sd-summary{' +
      'flex-wrap:nowrap!important;overflow-x:auto!important;-webkit-overflow-scrolling:touch;' +
      'white-space:nowrap!important;gap:12px!important;padding:10px 12px!important;' +
    '}' +
    '}' +
    '@media print{' +
    '.pdoc-sd-table{width:100%!important;table-layout:auto!important;display:table!important;}' +
    '.pdoc-sd-table thead{display:table-header-group!important;}' +
    '.pdoc-sd-table tbody{display:table-row-group!important;}' +
    '.pdoc-sd-table tr{display:table-row!important;}' +
    '.pdoc-sd-table th,.pdoc-sd-table td{display:table-cell!important;}' +
    '.pdoc-sd-table tbody td::before{content:none!important;display:none!important;}' +
    '}';
  document.head.appendChild(s);

  var syncTimer = null;
  var DEBOUNCE_MS = 200;

  function captureScroll() {
    var main = document.getElementById('main');
    var scrolls = [];
    document.querySelectorAll('.pdoc-sd-scroll,.pdoc-sd-closing').forEach(function (el) {
      scrolls.push({ el: el, left: el.scrollLeft, top: el.scrollTop });
    });
    return {
      winY: window.scrollY || document.documentElement.scrollTop || 0,
      mainY: main ? (main.scrollTop || 0) : 0,
      scrolls: scrolls,
      active: document.activeElement
    };
  }

  function restoreScroll(snap) {
    if (!snap) return;
    var main = document.getElementById('main');
    try { window.scrollTo(0, snap.winY); } catch (e) {}
    if (main) main.scrollTop = snap.mainY;
    (snap.scrolls || []).forEach(function (s) {
      if (s.el && s.el.isConnected) {
        s.el.scrollLeft = s.left;
        s.el.scrollTop = s.top;
      }
    });
    var ae = snap.active;
    if (ae && ae.isConnected && ae.focus) {
      try { ae.focus({ preventScroll: true }); } catch (e2) {
        try { ae.focus(); } catch (e3) {}
      }
      try {
        var host = ae.closest && ae.closest('.pdoc-sd-scroll');
        if (host && ae.getBoundingClientRect && host.getBoundingClientRect) {
          var ar = ae.getBoundingClientRect();
          var hr = host.getBoundingClientRect();
          if (ar.left < hr.left) host.scrollLeft -= (hr.left - ar.left + 8);
          else if (ar.right > hr.right) host.scrollLeft += (ar.right - hr.right + 8);
        }
      } catch (e4) {}
    }
  }

  function syncCols() {
    var snap = captureScroll();
    document.querySelectorAll('.pdoc-sd-table').forEach(function (table) {
      var rows = table.querySelectorAll('tr');
      if (!rows.length) return;
      var n = rows[0].children.length;
      var widths = [];
      var i;
      for (i = 0; i < n; i++) widths[i] = 72;
      rows.forEach(function (tr) {
        Array.prototype.forEach.call(tr.children, function (cell, idx) {
          if (idx >= n) return;
          cell.style.width = 'auto';
          cell.style.minWidth = '';
          cell.style.maxWidth = 'none';
          var w = Math.ceil(cell.scrollWidth + 16);
          if (w > widths[idx]) widths[idx] = w;
        });
      });
      var total = 0;
      for (i = 0; i < n; i++) total += widths[i];
      table.style.width = total + 'px';
      rows.forEach(function (tr) {
        Array.prototype.forEach.call(tr.children, function (cell, idx) {
          if (idx >= n) return;
          cell.style.width = widths[idx] + 'px';
          cell.style.minWidth = widths[idx] + 'px';
          cell.style.maxWidth = 'none';
        });
      });
    });
    restoreScroll(snap);
    requestAnimationFrame(function () { restoreScroll(snap); });
  }

  function syncColsDebounced() {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(function () {
      syncTimer = null;
      syncCols();
    }, DEBOUNCE_MS);
  }

  function afterRender() {
    setTimeout(syncCols, 80);
    setTimeout(syncCols, 400);
  }

  function wrap() {
    var orig = window.renderSalaryDisbursement;
    if (typeof orig !== 'function' || orig._sdAlign) return;
    window.renderSalaryDisbursement = function () {
      var r = orig.apply(this, arguments);
      var go = afterRender;
      if (r && typeof r.then === 'function') r.then(go);
      else go();
      return r;
    };
    window.renderSalaryDisbursement._sdAlign = true;
  }

  function wrapRecalc() {
    var origRecalc = window._sdRecalc;
    if (typeof origRecalc !== 'function' || origRecalc._sdGap10) return;
    window._sdRecalc = function () {
      var out = origRecalc.apply(this, arguments);
      syncColsDebounced();
      return out;
    };
    window._sdRecalc._sdGap = true;
    window._sdRecalc._sdGap8 = true;
    window._sdRecalc._sdGap9 = true;
    window._sdRecalc._sdGap10 = true;
  }

  function onResize() {
    syncColsDebounced();
  }

  wrap();
  wrapRecalc();
  setTimeout(wrap, 400);
  setTimeout(wrapRecalc, 400);
  setTimeout(syncCols, 700);
  try {
    window.addEventListener('resize', onResize, { passive: true });
  } catch (e5) {
    window.addEventListener('resize', onResize);
  }
})();
