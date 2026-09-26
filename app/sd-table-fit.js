(function () {
  var old = document.getElementById('sd-table-fit-css');
  if (old) old.remove();
  var s = document.createElement('style');
  s.id = 'sd-table-fit-css';
  s.textContent =
    '@media screen{' +
    '.pdoc-sd-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;max-width:100%;}' +
    '.pdoc-sd-table{table-layout:auto!important;width:max-content!important;min-width:980px!important;border-collapse:separate;border-spacing:0;}' +
    '.pdoc-sd-table th{white-space:nowrap!important;overflow:visible!important;padding:8px 10px!important;font-size:10px!important;}' +
    '.pdoc-sd-table td{overflow:visible!important;padding:8px 10px!important;vertical-align:top!important;}' +
    '.pdoc-sd-table th:nth-child(1),.pdoc-sd-table td:nth-child(1){width:36px!important;white-space:nowrap!important;}' +
    '.pdoc-sd-table th:nth-child(2),.pdoc-sd-table td:nth-child(2){min-width:160px!important;}' +
    '.pdoc-sd-payee{white-space:normal!important;word-break:break-word!important;}' +
    '.pdoc-sd-bank{white-space:normal!important;}' +
    '.pdoc-sd-table th:nth-child(3),.pdoc-sd-table td:nth-child(3){min-width:110px!important;white-space:nowrap!important;}' +
    '.pdoc-sd-table th:nth-child(4),.pdoc-sd-table td:nth-child(4){min-width:120px!important;white-space:nowrap!important;}' +
    '.pdoc-sd-basic,.pdoc-sd-net{white-space:nowrap!important;}' +
    '.pdoc-sd-table th:nth-child(5),.pdoc-sd-table td:nth-child(5){min-width:90px!important;}' +
    '.pdoc-sd-table th:nth-child(6),.pdoc-sd-table td:nth-child(6){min-width:150px!important;}' +
    '.pdoc-sd-table th:nth-child(7),.pdoc-sd-table td:nth-child(7){min-width:150px!important;}' +
    '.pdoc-sd-table th:nth-child(8),.pdoc-sd-table td:nth-child(8){min-width:130px!important;}' +
    '.pdoc-sd-table th:nth-child(9),.pdoc-sd-table td:nth-child(9){min-width:100px!important;white-space:nowrap!important;}' +
    '}' +
    '@media screen and (max-width:900px){' +
    '.pdoc-sd-table{font-size:11px!important;}' +
    '.pdoc-sd-table th{font-size:9px!important;padding:6px 8px!important;}' +
    '.pdoc-sd-table td{padding:6px 8px!important;}' +
    '}';
  document.head.appendChild(s);
})();
