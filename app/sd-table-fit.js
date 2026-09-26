(function () {
  var old = document.getElementById('sd-table-fit-css');
  if (old) old.remove();
  var s = document.createElement('style');
  s.id = 'sd-table-fit-css';
  s.textContent =
    '@media screen{' +
    '.pdoc-sd-scroll{overflow-x:auto!important;-webkit-overflow-scrolling:touch;max-width:100%;}' +
    '.pdoc-sd-table{display:table!important;table-layout:auto!important;border-collapse:collapse!important;width:max-content!important;}' +
    '.pdoc-sd-table thead{display:table-header-group!important;}' +
    '.pdoc-sd-table tbody{display:table-row-group!important;}' +
    '.pdoc-sd-table tfoot{display:table-footer-group!important;}' +
    '.pdoc-sd-table tr{display:table-row!important;}' +
    '.pdoc-sd-table th,.pdoc-sd-table td{' +
      'display:table-cell!important;vertical-align:top!important;' +
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
    '@media print{.pdoc-sd-table{width:100%!important;table-layout:auto!important;}}';
  document.head.appendChild(s);

  function syncCols() {
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
  }

  function wrap() {
    var orig = window.renderSalaryDisbursement;
    if (typeof orig !== 'function' || orig._sdAlign) return;
    window.renderSalaryDisbursement = function () {
      var r = orig.apply(this, arguments);
      var go = function () { setTimeout(syncCols, 80); setTimeout(syncCols, 400); };
      if (r && typeof r.then === 'function') r.then(go);
      else go();
      return r;
    };
    window.renderSalaryDisbursement._sdAlign = true;
  }

  var origRecalc = window._sdRecalc;
  if (typeof origRecalc === 'function' && !origRecalc._sdGap) {
    window._sdRecalc = function () {
      var out = origRecalc.apply(this, arguments);
      setTimeout(syncCols, 30);
      return out;
    };
    window._sdRecalc._sdGap = true;
  }

  wrap();
  setTimeout(wrap, 400);
  setTimeout(syncCols, 700);
})();
