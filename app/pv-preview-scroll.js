/* Phone: stack PV/pdoc so signatures + table fit; desktop keep 720 preview */
(function () {
  var css = [
    '@media (max-width:640px){',
    '  .pdoc-hscroll{overflow:visible!important;max-width:100%!important;}',
    '  .pdoc{min-width:0!important;max-width:100%!important;width:100%!important;overflow:visible!important;}',
    '  .pdoc-header{flex-wrap:wrap!important;}',
    '  .pdoc [style*="grid-template-columns:1fr 1fr"]{display:block!important;}',
    '  .pdoc [style*="text-align:right"]{text-align:left!important;}',
    '  .pdoc-table,.pdoc table{width:100%!important;table-layout:fixed!important;}',
    '  .pdoc-table td,.pdoc table td{width:auto!important;word-break:break-word!important;white-space:normal!important;}',
    '  .pdoc-sig-grid{display:flex!important;flex-direction:column!important;align-items:stretch!important;visibility:visible!important;height:auto!important;overflow:visible!important;}',
    '  .pdoc-sig-grid .form-group{max-width:100%!important;flex:1 1 auto!important;width:100%!important;}',
    '  #pv-sig-print,#pvd-sig-print{display:block!important;overflow:visible!important;}',
    '  #pv-sig-print table,#pvd-sig-print table{display:block!important;width:100%!important;}',
    '  #pv-sig-print td,#pvd-sig-print td{display:block!important;width:100%!important;padding:12px 0!important;}',
    '  #dash-home-fab,#ai-chat-fab,#scroll-top-btn{display:none!important;}',
    '}'
  ].join('\n');
  function injectCss() {
    if (document.getElementById('pv-mobile-sig')) return;
    var s = document.createElement('style');
    s.id = 'pv-mobile-sig';
    s.textContent = css;
    document.head.appendChild(s);
  }
  function apply() {
    injectCss();
    var narrow = window.innerWidth <= 640;
    document.querySelectorAll('.pdoc').forEach(function (pdoc) {
      var parent = pdoc.parentElement;
      if (parent && !parent.classList.contains('pdoc-hscroll')) {
        var wrap = document.createElement('div');
        wrap.className = 'pdoc-hscroll';
        parent.insertBefore(wrap, pdoc);
        wrap.appendChild(pdoc);
      }
      if (narrow) {
        pdoc.style.minWidth = '0';
        pdoc.style.maxWidth = '100%';
        pdoc.style.width = '100%';
        pdoc.style.margin = '0';
      } else {
        pdoc.style.minWidth = '720px';
        pdoc.style.maxWidth = '720px';
        pdoc.style.margin = '0';
      }
    });
  }
  function boot() {
    apply();
    setTimeout(apply, 250);
    setTimeout(apply, 800);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  window.addEventListener('resize', apply);
  ['renderPVDetail', 'renderPVDDetail', 'renderInvDetail'].forEach(function (name) {
    var orig = window[name];
    if (typeof orig !== 'function' || orig._hsc) return;
    var w = async function () {
      var r = await orig.apply(this, arguments);
      setTimeout(apply, 0);
      setTimeout(apply, 400);
      return r;
    };
    w._hsc = true;
    window[name] = w;
  });
})();
