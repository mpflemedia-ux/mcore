(function () {
  function css() {
    var old = document.getElementById('sd-print-fit-css');
    if (old) old.remove();
    var s = document.createElement('style');
    s.id = 'sd-print-fit-css';
    s.textContent =
      '@media print{' +
      '@page{size:A4 portrait;margin:8mm;}' +
      'html,body{width:auto!important;height:auto!important;overflow:visible!important;background:#fff!important;}' +
      '#support-tenant-banner,.support-banner,#sd-er-save-fab,.no-print,' +
      '.fab-home,.fab-up,.chat-fab{display:none!important;}' +
      '.pdoc,.pdoc-sd-chunk,.pdoc-sd-closing{' +
        'width:194mm!important;max-width:194mm!important;margin:0 auto!important;' +
        'box-shadow:none!important;border:none!important;overflow:visible!important;' +
        'height:auto!important;max-height:none!important;' +
      '}' +
      '.pdoc-sd-table{width:100%!important;max-width:100%!important;' +
        'table-layout:fixed!important;font-size:7.5px!important;border-collapse:collapse!important;}' +
      '.pdoc-sd-table th,.pdoc-sd-table td{' +
        'padding:3px 3px!important;font-size:7.5px!important;line-height:1.25!important;' +
        'white-space:normal!important;word-break:break-word!important;overflow:visible!important;' +
        'vertical-align:top!important;' +
      '}' +
      '.pdoc-sd-table col,.pdoc-sd-table th:nth-child(1),.pdoc-sd-table td:nth-child(1){width:5%!important;}' +
      '.pdoc-sd-payee{font-size:8px!important;white-space:normal!important;}' +
      '.pdoc-sd-bank{font-size:7px!important;}' +
      '.pdoc-sd-basic,.pdoc-sd-net{font-size:8px!important;white-space:nowrap!important;}' +
      '.pdoc-sd-print-line{font-size:7px!important;}' +
      '.pdoc-sd-employer-note{font-size:6.5px!important;}' +
      '.pdoc-sd-summary,.pdoc-sd-meta{padding:4px 6px!important;font-size:8px!important;}' +
      '.pdoc-sd-totals{display:grid!important;grid-template-columns:repeat(4,1fr)!important;' +
        'width:100%!important;max-width:100%!important;gap:0!important;}' +
      '.pdoc-sd-sum-table{width:100%!important;max-width:100%!important;table-layout:fixed!important;font-size:7.5px!important;}' +
      '.pdoc-sd-line .form-select,.pdoc-sd-line .form-input{display:none!important;}' +
      '}';
    document.head.appendChild(s);
  }

  function forcePortrait() {
    if (typeof window._pdocSetPageOrientation === 'function') {
      window._pdocSetPageOrientation('portrait', 8);
    }
    css();
  }

  function wrapPrep() {
    var orig = window._sdPreparePrint;
    if (typeof orig !== 'function' || orig._a4) return;
    window._sdPreparePrint = function () {
      var r = orig.apply(this, arguments);
      forcePortrait();
      return r;
    };
    window._sdPreparePrint._a4 = true;
  }

  function wrapOrient() {
    var orig = window._pdocSetPageOrientation;
    if (typeof orig !== 'function' || orig._sdA4) return;
    window._pdocSetPageOrientation = function (orientation, mm) {
      if (document.querySelector('.pdoc-sd-table')) {
        return orig.call(this, 'portrait', 8);
      }
      return orig.apply(this, arguments);
    };
    window._pdocSetPageOrientation._sdA4 = true;
  }

  css();
  wrapPrep();
  wrapOrient();
  setTimeout(function () { wrapPrep(); wrapOrient(); css(); }, 500);
})();
