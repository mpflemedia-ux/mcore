(function () {
  function wrapBasic() {
    var orig = window._accBasicOnly;
    window._accBasicOnly = function () { return false; };
    if (typeof orig === 'function') window._accBasicOnly._orig = orig;
  }
  function wrapResolve() {
    var orig = window._resolveTenantPlanCode;
    if (typeof orig !== 'function' || orig._accFull) return;
    var w = function () {
      var code = orig.apply(this, arguments);
      if (code === 'free') {
        var ready = !!(window._plansCache && window._plansCache.length);
        if (!ready) {
          try {
            var legacy = String((APP.tenant && (APP.tenant.plan_code || APP.tenant.plan)) || '').toLowerCase();
            if (/unlim|legacy|pro|business|starter/.test(legacy)) return legacy.indexOf('pro') >= 0 ? 'pro' : 'unlimited';
          } catch (e) {}
          return 'unlimited';
        }
      }
      return code;
    };
    w._accFull = true;
    window._resolveTenantPlanCode = w;
  }
  function boot() {
    wrapBasic();
    wrapResolve();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setTimeout(boot, 300);
  setTimeout(boot, 1200);
})();
