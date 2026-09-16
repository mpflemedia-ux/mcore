/* Screen: editable Prepared/Checked/Approved only. Print block stays for print. */
(function () {
  var css = [
    '@media screen {',
    '  #pv-sig-print,#pvd-sig-print{display:none!important;}',
    '  .pdoc-sig-grid.no-print{display:flex!important;flex-direction:column!important;visibility:visible!important;height:auto!important;overflow:visible!important;margin:12px 8px 20px!important;}',
    '  .pdoc-sig-grid .form-group{display:block!important;width:100%!important;max-width:100%!important;flex:none!important;}',
    '  .pdoc-sig-grid .form-input{display:block!important;width:100%!important;min-height:40px!important;pointer-events:auto!important;}',
    '  .pdoc-table td:last-child,.pdoc table td:last-child{white-space:normal!important;word-break:break-word!important;}',
    '}',
    '@media print {',
    '  .pdoc-sig-grid.no-print{display:none!important;}',
    '  #pv-sig-print,#pvd-sig-print{display:block!important;}',
    '}'
  ].join('\n');
  function inject() {
    if (document.getElementById('pv-sig-boxes-css')) return;
    var s = document.createElement('style');
    s.id = 'pv-sig-boxes-css';
    s.textContent = css;
    document.head.appendChild(s);
  }
  function boot() { inject(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
