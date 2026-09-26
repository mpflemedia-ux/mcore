(function () {
  var old = document.getElementById('sd-table-fit-css');
  if (old) old.remove();
  var s = document.createElement('style');
  s.id = 'sd-table-fit-css';
  s.textContent =
    '@media screen{' +
    '.pdoc-sd-scroll{overflow-x:auto!important;-webkit-overflow-scrolling:touch;max-width:100%;}' +
    '.pdoc-sd-table{display:table!important;table-layout:fixed!important;border-collapse:collapse!important;width:auto!important;}' +
    '.pdoc-sd-table thead{display:table-header-group!important;}' +
    '.pdoc-sd-table tbody{display:table-row-group!important;}' +
    '.pdoc-sd-table tfoot{display:table-footer-group!important;}' +
    '.pdoc-sd-table tr{display:table-row!important;}' +
    '.pdoc-sd-table th,.pdoc-sd-table td{' +
      'display:table-cell!important;vertical-align:top!important;' +
      'white-space:nowrap!important;word-break:normal!important;overflow:visible!important;' +
      'padding:8px 10px!important;box-sizing:border-box;' +
    '}' +
    '.pdoc-sd-table tbody td::before{content:none!important;display:none!important;}' +
    '.pdoc-sd-payee,.pdoc-sd-bank,.pdoc-sd-basic,.pdoc-sd-net{white-space:nowrap!important;word-break:normal!important;}' +
    '.pdoc-sd-stack{display:flex;flex-direction:column;gap:6px;width:max-content;}' +
    '.pdoc-sd-line{' +
      'display:grid!important;grid-template-columns:76px 88px;column-gap:8px;align-items:center;' +
      'width:172px!important;flex-wrap:nowrap!important;' +
    '}' +
    '.pdoc-sd-line label{' +
      'white-space:nowrap!important;overflow:visible!important;word-break:keep-all!important;' +
      'min-width:76px!important;width:76px!important;margin:0!important;line-height:1.2;' +
    '}' +
    '.pdoc-sd-line .form-input{width:88px!important;max-width:88px!important;flex:none!important;}' +
    '.pdoc-sd-line .form-select{width:88px!important;min-width:88px!important;}' +
    '.pdoc-sd-employer-note .pdoc-sd-line{grid-template-columns:76px 88px;}' +
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
      for (i = 0; i < n; i++) widths[i] = 48;
      rows.forEach(function (tr) {
        Array.prototype.forEach.call(tr.children, function (cell, idx) {
          if (idx >= n) return;
          cell.style.width = 'auto';
          cell.style.minWidth = '';
          cell.style.maxWidth = '';
          var w = Math.ceil(cell.scrollWidth + 8);
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
          cell.style.maxWidth = widths[idx] + 'px';
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
  if (typeof origRecalc === 'function' && !origRecalc._sdAlign) {
    window._sdRecalc = function () {
      var out = origRecalc.apply(this, arguments);
      setTimeout(syncCols, 30);
      return out;
    };
    window._sdRecalc._sdAlign = true;
  }

  wrap();
  setTimeout(wrap, 400);
  setTimeout(syncCols, 700);
})();
