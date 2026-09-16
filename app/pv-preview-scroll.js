/* Phone preview: swipe left/right to see full payment voucher */
(function () {
  function apply() {
    var docs = document.querySelectorAll('.pdoc');
    if (!docs.length) return;
    docs.forEach(function (pdoc) {
      var parent = pdoc.parentElement;
      if (!parent) return;
      if (!parent.classList.contains('pdoc-hscroll')) {
        var wrap = document.createElement('div');
        wrap.className = 'pdoc-hscroll';
        wrap.style.cssText = 'overflow-x:auto;-webkit-overflow-scrolling:touch;max-width:100%;margin:0 auto 16px';
        parent.insertBefore(wrap, pdoc);
        wrap.appendChild(pdoc);
      }
      pdoc.style.minWidth = '720px';
      pdoc.style.maxWidth = '720px';
      pdoc.style.margin = '0';
    });
  }
  function boot() {
    apply();
    setTimeout(apply, 250);
    setTimeout(apply, 800);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
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
