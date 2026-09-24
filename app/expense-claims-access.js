(function () {
  function role() {
    try { return String((APP.user && APP.user.role) || '').toLowerCase().trim(); }
    catch (e) { return ''; }
  }
  function isBoss() {
    var r = role();
    if (r === 'owner' || r === 'admin' || r === 'platform_admin') return true;
    try { if (typeof isTenantAdmin === 'function' && isTenantAdmin()) return true; } catch (e) {}
    try { if (typeof isPlatformAdmin === 'function' && isPlatformAdmin()) return true; } catch (e2) {}
    return false;
  }
  function inMods(id) {
    try {
      var ov = APP.user && APP.user.module_override;
      if (Array.isArray(ov) && ov.map(String).indexOf(id) >= 0) return true;
    } catch (e) {}
    try {
      var rolesMap = (APP.tenantConfig && APP.tenantConfig.roles) || {};
      var rk = role();
      var configured = rolesMap[rk] || rolesMap[rk.replace(/\s+/g, '_')];
      if (!Array.isArray(configured)) {
        var found = Object.keys(rolesMap).find(function (k) {
          return String(k).toLowerCase() === rk;
        });
        if (found) configured = rolesMap[found];
      }
      if (Array.isArray(configured) && configured.map(String).indexOf(id) >= 0) return true;
    } catch (e2) {}
    return false;
  }
  function mayExpense() {
    if (isBoss()) return true;
    if (inMods('acc_expense') || inMods('accounting') || inMods('expense_claims')) return true;
    return false;
  }

  function wrapCanAccess() {
    var orig = window.canAccess;
    if (typeof orig !== 'function' || orig._expPlanFixed) return;
    var w = function (module) {
      if (module === 'expense_claims' || module === 'acc_expense') {
        if (mayExpense()) return true;
      }
      return orig.apply(this, arguments);
    };
    w._expPlanFixed = true;
    w._rpBdWrapped = orig._rpBdWrapped;
    window.canAccess = w;
  }

  function paintClaims(params) {
    params = Object.assign({}, params || {}, { view: (params && params.view) || 'expense' });
    if (typeof window.renderExpenseClaims === 'function') {
      window.renderExpenseClaims(params);
      return true;
    }
    if (typeof window.renderAccounting === 'function') {
      window.renderAccounting(params);
      return true;
    }
    return false;
  }

  function wrapOpen() {
    var orig = window.openPage;
    if (typeof orig !== 'function' || orig._expOpenFixed) return;
    var w = function (page, params) {
      params = params || {};
      if (page === 'expense_claims' || (page === 'accounting' && (params.view === 'expense' || params.view === 'exp-form'))) {
        if (!mayExpense()) {
          if (typeof renderAccessDenied === 'function') renderAccessDenied();
          return;
        }
        try {
          if (typeof _clearUiOverlays === 'function') _clearUiOverlays();
          try { _closeMobileSidebar(); } catch (e0) {}
          if (typeof APP !== 'undefined') APP.currentPage = 'expense_claims';
          document.querySelectorAll('.nav-item').forEach(function (el) {
            el.classList.toggle('active', el.dataset.page === 'expense_claims');
          });
          var ht = document.getElementById('header-title');
          if (ht) ht.textContent = (APP.language === 'bm') ? 'Tuntutan Belanja' : 'Expense Claims';
        } catch (e1) {}
        paintClaims(params);
        return;
      }
      return orig.apply(this, arguments);
    };
    w._expOpenFixed = true;
    w._rpBdWrapped = orig._rpBdWrapped;
    window.openPage = w;
  }

  function boot() {
    wrapCanAccess();
    wrapOpen();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setTimeout(boot, 500);
  setTimeout(boot, 1600);
})();
