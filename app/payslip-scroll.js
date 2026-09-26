(function () {
  var old = document.getElementById('payslip-scroll-css');
  if (old) old.remove();
  var s = document.createElement('style');
  s.id = 'payslip-scroll-css';
  s.textContent =
    '@media screen{' +
    '.pdoc-hscroll{overflow-x:auto!important;-webkit-overflow-scrolling:touch;max-width:100%;}' +
    '.pdoc-hscroll .pdoc{min-width:640px!important;max-width:none!important;margin:0 auto 28px!important;}' +
    '.pdoc-hscroll .pdoc-table{width:100%!important;min-width:560px!important;table-layout:auto!important;}' +
    '.pdoc-hscroll .pdoc-table td:last-child{white-space:nowrap!important;text-align:right!important;min-width:110px;}' +
    '}' +
    '@media print{.pdoc-hscroll{overflow:visible!important;}.pdoc-hscroll .pdoc{min-width:0!important;width:100%!important;}}';
  document.head.appendChild(s);

  function wrapPdocs() {
    document.querySelectorAll('.pdoc').forEach(function (el) {
      if (el.parentNode && el.parentNode.classList.contains('pdoc-hscroll')) return;
      var wrap = document.createElement('div');
      wrap.className = 'pdoc-hscroll';
      el.parentNode.insertBefore(wrap, el);
      wrap.appendChild(el);
    });
  }

  function hook(name) {
    var orig = window[name];
    if (typeof orig !== 'function' || orig._psScroll) return;
    window[name] = function () {
      var r = orig.apply(this, arguments);
      var go = function () { setTimeout(wrapPdocs, 40); setTimeout(wrapPdocs, 300); };
      if (r && typeof r.then === 'function') r.then(go);
      else go();
      return r;
    };
    window[name]._psScroll = true;
  }

  function boot() {
    hook('renderPayslipDetail');
    hook('renderPayslipsPrint');
    hook('_pdocPayslipHtml');
    wrapPdocs();
  }
  boot();
  setTimeout(boot, 400);
})();
