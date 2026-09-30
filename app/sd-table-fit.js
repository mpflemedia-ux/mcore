(function () {
  var old = document.getElementById('sd-table-fit-css');
  if (old) old.remove();
  var s = document.createElement('style');
  s.id = 'sd-table-fit-css';
  s.textContent =
    '@media screen and (min-width:901px){' +
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
    '}' +
    '@media screen and (max-width:900px){' +
    '.pdoc-sd-scroll{overflow-x:hidden!important;max-width:100%!important;}' +
    '.pdoc-sd-summary,.pdoc-sd-meta,.pdoc-sd-totals{' +
      'flex-wrap:wrap!important;overflow:visible!important;white-space:normal!important;' +
      'padding:8px 12px!important;gap:8px!important;' +
    '}' +
    '.pdoc-sd-table{' +
      'display:block!important;min-width:0!important;width:100%!important;' +
      'table-layout:auto!important;border-collapse:collapse!important;' +
      'height:auto!important;' +
    '}' +
    '.pdoc-sd-table thead{display:none!important;}' +
    '.pdoc-sd-table tbody,.pdoc-sd-table tfoot{display:block!important;width:100%!important;height:auto!important;}' +
    '.pdoc-sd-table tbody tr{' +
      'display:block!important;width:100%!important;box-sizing:border-box;' +
      'height:auto!important;min-height:0!important;max-height:none!important;' +
      'margin:0 0 10px;padding:10px 12px;' +
      'border:1px solid #E2E8F0;border-radius:10px;background:#fff;' +
    '}' +
    '.pdoc-sd-table tbody td{' +
      'display:grid!important;grid-template-columns:88px minmax(0,1fr);gap:6px;align-items:start;' +
      'width:100%!important;max-width:100%!important;min-width:0!important;' +
      'height:auto!important;min-height:0!important;box-sizing:border-box;' +
      'padding:6px 0!important;border:none!important;border-bottom:1px solid #F1F5F9!important;' +
      'white-space:normal!important;overflow:visible!important;vertical-align:top!important;' +
    '}' +
    '.pdoc-sd-table tbody td:last-child{border-bottom:none!important;}' +
    '.pdoc-sd-table tbody td::before{' +
      'content:attr(data-label);font-size:10px;font-weight:600;color:#64748B;' +
      'text-transform:uppercase;letter-spacing:.03em;padding-top:3px;' +
    '}' +
    '.pdoc-sd-payee{font-weight:700;font-size:14px;white-space:normal!important;word-break:break-word!important;}' +
    '.pdoc-sd-stack{display:flex!important;flex-direction:column!important;gap:6px!important;width:100%!important;max-width:100%!important;}' +
    '.pdoc-sd-line{' +
      'display:flex!important;flex-wrap:wrap!important;align-items:center;' +
      'gap:6px!important;width:100%!important;max-width:100%!important;' +
    '}' +
    '.pdoc-sd-line label{' +
      'flex:0 0 auto!important;width:auto!important;min-width:52px;margin:0!important;' +
      'white-space:nowrap!important;' +
    '}' +
    '.pdoc-sd-line .form-select{' +
      'flex:1 1 140px!important;width:auto!important;min-width:0!important;max-width:100%!important;' +
      'height:32px!important;min-height:32px!important;padding:4px 8px!important;font-size:12px!important;' +
    '}' +
    '.pdoc-sd-line .form-input{' +
      'flex:0 1 96px!important;width:96px!important;min-width:72px!important;max-width:100%!important;' +
      'height:32px!important;min-height:32px!important;padding:4px 8px!important;font-size:12px!important;' +
    '}' +
    '.pdoc-sd-basic,.pdoc-sd-net{text-align:left!important;white-space:nowrap!important;}' +
    '.pdoc-sd-closing{padding-bottom:88px!important;}' +
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
  var MOBILE_MQ = '(max-width:900px)';

  function isMobile() {
    try {
      return !!(window.matchMedia && window.matchMedia(MOBILE_MQ).matches);
    } catch (e) {
      return (window.innerWidth || 0) <= 900;
    }
  }

  function labelCells() {
    document.querySelectorAll('.pdoc-sd-table').forEach(function (table) {
      var labels = [];
      table.querySelectorAll('thead th').forEach(function (th) {
        labels.push((th.textContent || '').trim());
      });
      table.querySelectorAll('tbody tr').forEach(function (tr) {
        Array.prototype.forEach.call(tr.children, function (td, i) {
          if (labels[i] && !td.getAttribute('data-label')) {
            td.setAttribute('data-label', labels[i]);
          }
        });
      });
    });
  }

  function clearInlineColStyles() {
    document.querySelectorAll('.pdoc-sd-table').forEach(function (table) {
      table.style.width = '';
      table.querySelectorAll('th,td').forEach(function (cell) {
        cell.style.width = '';
        cell.style.minWidth = '';
        cell.style.maxWidth = '';
      });
    });
  }

  function captureScroll() {
    var main = document.getElementById('main');
    var scrolls = [];
    document.querySelectorAll('.pdoc-sd-scroll').forEach(function (el) {
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
    if (isMobile()) {
      clearInlineColStyles();
      labelCells();
      return;
    }
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
    labelCells();
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
    if (typeof origRecalc !== 'function' || origRecalc._sdGap9) return;
    window._sdRecalc = function () {
      var out = origRecalc.apply(this, arguments);
      syncColsDebounced();
      return out;
    };
    window._sdRecalc._sdGap = true;
    window._sdRecalc._sdGap8 = true;
    window._sdRecalc._sdGap9 = true;
  }

  function onResize() {
    syncColsDebounced();
  }

  wrap();
  wrapRecalc();
  setTimeout(wrap, 400);
  setTimeout(wrapRecalc, 400);
  setTimeout(function () { labelCells(); syncCols(); }, 700);
  try {
    window.addEventListener('resize', onResize, { passive: true });
  } catch (e5) {
    window.addEventListener('resize', onResize);
  }
})();
