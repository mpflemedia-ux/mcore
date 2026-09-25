(function () {
  var old = document.getElementById('jnl-print-css');
  if (old) old.remove();
  var s = document.createElement('style');
  s.id = 'jnl-print-css';
  s.textContent =
    '@media print{' +
    '@page{size:A4 portrait;margin:10mm;}' +
    '#jnl-table-wrap,#jnl-table-wrap .card{' +
      'break-inside:auto!important;page-break-inside:auto!important;' +
      'max-height:none!important;height:auto!important;overflow:visible!important;' +
    '}' +
    '#jnl-sort-bar,.no-print{display:none!important;}' +
    '#jnl-table-wrap table{width:100%!important;max-width:100%!important;' +
      'table-layout:fixed!important;font-size:8.5px!important;border-collapse:collapse!important;}' +
    '#jnl-table-wrap th,#jnl-table-wrap td{white-space:normal!important;word-break:break-word!important;' +
      'padding:3px 4px!important;vertical-align:top!important;max-width:none!important;}' +
    '#jnl-table-wrap th:nth-child(1),#jnl-table-wrap td:nth-child(1){width:20%;}' +
    '#jnl-table-wrap th:nth-child(2),#jnl-table-wrap td:nth-child(2){width:12%;white-space:nowrap!important;}' +
    '#jnl-table-wrap th:nth-child(3),#jnl-table-wrap td:nth-child(3){width:30%;}' +
    '#jnl-table-wrap th:nth-child(4),#jnl-table-wrap td:nth-child(4){width:12%;}' +
    '#jnl-table-wrap th:nth-child(5),#jnl-table-wrap td:nth-child(5){width:13%;white-space:nowrap!important;text-align:right;}' +
    '#jnl-table-wrap th:nth-child(6),#jnl-table-wrap td:nth-child(6){width:13%;white-space:nowrap!important;text-align:right;}' +
    '}';
  document.head.appendChild(s);
})();
