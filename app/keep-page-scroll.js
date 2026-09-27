(function () {
  var KEY = 'nexerp_main_scroll';
  var booting = true;
  setTimeout(function () { booting = false; }, 4000);

  function pageId() {
    return (window.APP && APP.currentPage) || localStorage.getItem('nexerp_last_page') || '';
  }
  function save() {
    var main = document.getElementById('main');
    var y = 0;
    if (main && main.scrollTop) y = main.scrollTop;
    else y = window.scrollY || document.documentElement.scrollTop || 0;
    try {
      localStorage.setItem(KEY, JSON.stringify({ page: pageId(), y: y, t: Date.now() }));
    } catch (e) {}
  }
  function restore() {
    var o;
    try { o = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { o = null; }
    if (!o || !o.page || o.page !== pageId()) return;
    if (Date.now() - (o.t || 0) > 2 * 60 * 60 * 1000) return;
    var y = Number(o.y || 0);
    var main = document.getElementById('main');
    if (main) main.scrollTop = y;
    window.scrollTo(0, y);
  }

  window.addEventListener('scroll', save, { passive: true });
  document.addEventListener('scroll', save, { passive: true, capture: true });
  window.addEventListener('beforeunload', save);

  function hook() {
    var orig = window.openPage;
    if (typeof orig !== 'function' || orig._keepScroll) return;
    window.openPage = function (page, params) {
      var r = orig.apply(this, arguments);
      if (booting) {
        setTimeout(restore, 350);
        setTimeout(restore, 900);
        setTimeout(restore, 1800);
      }
      var main = document.getElementById('main');
      if (main && !main._keepScrollBound) {
        main.addEventListener('scroll', save, { passive: true });
        main._keepScrollBound = true;
      }
      return r;
    };
    window.openPage._keepScroll = true;
  }
  hook();
  setTimeout(hook, 400);
  setTimeout(function () { if (booting) restore(); }, 800);
})();
