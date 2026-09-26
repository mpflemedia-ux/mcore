(function () {
  var old = document.getElementById('sd-table-fit-css');
  if (old) old.remove();
  var s = document.createElement('style');
  s.id = 'sd-table-fit-css';
  s.textContent =
    '@media screen{' +
    '.pdoc-sd-scroll{overflow-x:auto!important;-webkit-overflow-scrolling:touch;max-width:100%;}' +
    '.pdoc-sd-table{' +
      'table-layout:auto!important;width:max-content!important;min-width:100%;' +
      'border-collapse:collapse!important;' +
    '}' +
    '.pdoc-sd-table thead{display:table-header-group!important;}' +
    '.pdoc-sd-table tbody,.pdoc-sd-table tfoot,.pdoc-sd-table tr{display:table-row!important;}' +
    '.pdoc-sd-table th,.pdoc-sd-table td{' +
      'display:table-cell!important;width:auto!important;max-width:none!important;' +
      'white-space:nowrap!important;word-break:normal!important;overflow:visible!important;' +
      'vertical-align:middle!important;padding:8px 12px!important;' +
    '}' +
    '.pdoc-sd-table tbody td::before{content:none!important;display:none!important;}' +
    '.pdoc-sd-payee,.pdoc-sd-bank,.pdoc-sd-basic,.pdoc-sd-net{' +
      'white-space:nowrap!important;word-break:normal!important;overflow:visible!important;' +
    '}' +
    '.pdoc-sd-stack{display:flex;flex-direction:column;gap:6px;width:max-content;}' +
    '.pdoc-sd-line{flex-wrap:nowrap!important;width:max-content;align-items:center;}' +
    '.pdoc-sd-line .form-input{width:88px!important;flex:0 0 88px;}' +
    '.pdoc-sd-line .form-select{width:auto!important;min-width:72px;flex:0 0 auto;}' +
    '}' +
    '@media print{' +
    '.pdoc-sd-table{width:100%!important;min-width:0!important;}' +
    '.pdoc-sd-table th,.pdoc-sd-table td{white-space:normal!important;}' +
    '}';
  document.head.appendChild(s);
})();
