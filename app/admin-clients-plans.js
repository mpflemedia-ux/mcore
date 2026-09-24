(function () {
  function wrap() {
    var orig = window.renderAdminClients;
    if (typeof orig !== 'function' || orig._plansWait) return;
    var w = async function () {
      try {
        if (typeof _loadPlansCache === 'function') await _loadPlansCache();
      } catch (e) {}
      var ret = orig.apply(this, arguments);
      if (ret && typeof ret.then === 'function') {
        return ret.then(function (v) {
          try { if (typeof _adminClientsRenderTable === 'function') _adminClientsRenderTable(); } catch (e2) {}
          return v;
        });
      }
      try { if (typeof _adminClientsRenderTable === 'function') _adminClientsRenderTable(); } catch (e3) {}
      return ret;
    };
    w._plansWait = true;
    window.renderAdminClients = w;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wrap);
  else wrap();
  setTimeout(wrap, 500);
  setTimeout(wrap, 1500);
})();
