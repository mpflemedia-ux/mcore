(function () {
  function labelCells() {
    document.querySelectorAll('.pdoc-sd-table').forEach(function (table) {
      var labels = [];
      table.querySelectorAll('thead th').forEach(function (th) {
        labels.push((th.textContent || '').trim());
      });
      table.querySelectorAll('tbody tr').forEach(function (tr) {
        Array.prototype.forEach.call(tr.children, function (td, i) {
          if (labels[i] && !td.getAttribute('data-label')) td.setAttribute('data-label', labels[i]);
        });
      });
    });
  }

  var old = document.getElementById('sd-table-fit-css');
  if (old) old.remove();
  var s = document.createElement('style');
  s.id = 'sd-table-fit-css';
  s.textContent =
    '@media screen and (min-width:901px){' +
    '.pdoc-sd-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;}' +
    '.pdoc-sd-table{table-layout:auto;width:100%;}' +
    '}' +
    '@media screen and (max-width:900px){' +
    '.pdoc-sd-scroll{overflow-x:hidden!important;max-width:100%!important;}' +
    '.pdoc-sd-summary,.pdoc-sd-meta,.pdoc-sd-totals{' +
      'flex-wrap:wrap!important;overflow:visible!important;white-space:normal!important;' +
      'padding:8px 12px!important;gap:8px!important;' +
    '}' +
    '.pdoc-sd-table{min-width:0!important;width:100%!important;table-layout:auto!important;}' +
    '.pdoc-sd-table thead{display:none!important;}' +
    '.pdoc-sd-table tbody,.pdoc-sd-table tfoot{display:block;width:100%;}' +
    '.pdoc-sd-table tbody tr{' +
      'display:block;width:100%;box-sizing:border-box;' +
      'margin:0 0 12px;padding:10px 12px;' +
      'border:1px solid #E2E8F0;border-radius:10px;background:#fff;' +
    '}' +
    '.pdoc-sd-table tbody td{' +
      'display:grid!important;grid-template-columns:92px minmax(0,1fr);gap:8px;align-items:start;' +
      'width:100%!important;box-sizing:border-box;' +
      'padding:7px 0!important;border:none!important;border-bottom:1px solid #F1F5F9!important;' +
      'white-space:normal!important;overflow:visible!important;' +
    '}' +
    '.pdoc-sd-table tbody td:last-child{border-bottom:none!important;}' +
    '.pdoc-sd-table tbody td::before{' +
      'content:attr(data-label);font-size:10px;font-weight:600;color:#64748B;' +
      'text-transform:uppercase;letter-spacing:.03em;padding-top:4px;' +
    '}' +
    '.pdoc-sd-payee{font-weight:700;font-size:14px;}' +
    '.pdoc-sd-line{flex-wrap:wrap!important;width:100%;}' +
    '.pdoc-sd-line .form-input{width:110px!important;max-width:100%;}' +
    '.pdoc-sd-line .form-select{min-width:0!important;flex:1;max-width:100%;}' +
    '.pdoc-sd-basic,.pdoc-sd-net{text-align:left!important;white-space:nowrap!important;}' +
    '.pdoc-sd-closing{padding-bottom:88px!important;}' +
    '}' +
    '@media print{.pdoc-sd-table tbody td::before{display:none!important;}}';
  document.head.appendChild(s);

  function wrap() {
    var orig = window.renderSalaryDisbursement;
    if (typeof orig !== 'function' || orig._sdFit) return;
    window.renderSalaryDisbursement = function () {
      var r = orig.apply(this, arguments);
      var go = function () { labelCells(); };
      if (r && typeof r.then === 'function') r.then(function () { setTimeout(go, 60); });
      else setTimeout(go, 60);
      return r;
    };
    window.renderSalaryDisbursement._sdFit = true;
  }
  wrap();
  setTimeout(wrap, 400);
  setTimeout(labelCells, 700);
})();
