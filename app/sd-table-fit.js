(function () {
  var old = document.getElementById('sd-table-fit-css');
  if (old) old.remove();
  var s = document.createElement('style');
  s.id = 'sd-table-fit-css';
  s.textContent =
    '@media screen{' +
    '.pdoc-sd-scroll{overflow-x:auto!important;-webkit-overflow-scrolling:touch;max-width:100%;}' +
    '.pdoc-sd-table{' +
      'table-layout:fixed!important;width:1280px!important;min-width:1280px!important;' +
      'border-collapse:collapse!important;' +
    '}' +
    '.pdoc-sd-table thead{display:table-header-group!important;}' +
    '.pdoc-sd-table tbody,.pdoc-sd-table tfoot,.pdoc-sd-table tr{display:table-row!important;}' +
    '.pdoc-sd-table th,.pdoc-sd-table td{' +
      'display:table-cell!important;box-sizing:border-box;' +
      'white-space:nowrap!important;overflow:hidden;text-overflow:ellipsis;' +
      'vertical-align:top!important;padding:8px 10px!important;' +
    '}' +
    '.pdoc-sd-table th{font-size:10px!important;}' +
    '.pdoc-sd-table tbody td::before{content:none!important;display:none!important;}' +
    '.pdoc-sd-table th:nth-child(1),.pdoc-sd-table td:nth-child(1){width:40px!important;}' +
    '.pdoc-sd-table th:nth-child(2),.pdoc-sd-table td:nth-child(2){width:200px!important;white-space:normal!important;}' +
    '.pdoc-sd-payee{white-space:normal!important;word-break:break-word!important;}' +
    '.pdoc-sd-table th:nth-child(3),.pdoc-sd-table td:nth-child(3){width:130px!important;white-space:normal!important;}' +
    '.pdoc-sd-bank{white-space:normal!important;}' +
    '.pdoc-sd-table th:nth-child(4),.pdoc-sd-table td:nth-child(4){width:140px!important;}' +
    '.pdoc-sd-table th:nth-child(5),.pdoc-sd-table td:nth-child(5){width:110px!important;}' +
    '.pdoc-sd-table th:nth-child(6),.pdoc-sd-table td:nth-child(6){width:200px!important;white-space:normal!important;}' +
    '.pdoc-sd-table th:nth-child(7),.pdoc-sd-table td:nth-child(7){width:200px!important;white-space:normal!important;}' +
    '.pdoc-sd-table th:nth-child(8),.pdoc-sd-table td:nth-child(8){width:160px!important;white-space:normal!important;}' +
    '.pdoc-sd-table th:nth-child(9),.pdoc-sd-table td:nth-child(9){width:100px!important;}' +
    '.pdoc-sd-line{flex-wrap:nowrap!important;}' +
    '.pdoc-sd-line .form-input{width:72px!important;}' +
    '}' +
    '@media print{' +
    '.pdoc-sd-table{width:100%!important;min-width:0!important;}' +
    '.pdoc-sd-table tbody td::before{display:none!important;}' +
    '}';
  document.head.appendChild(s);
})();
