/* Role Permissions — add modules that exist in the product but were missing from Settings.
   Does not add platform_admin. Owner/admin stay full-access via canAccess(). */
(function () {
  var EXTRA_MAIN = [
    { id: 'planner', en: 'Planner', bm: 'Perancang' }
  ];
  var EXTRA_FINANCE = [
    { id: 'acc_expense', en: 'Expense Claims', bm: 'Tuntutan Belanja' },
    { id: 'acc_reconcile', en: 'Bank Reconciliation', bm: 'Penyesuaian Bank' },
    { id: 'acc_fixed_assets', en: 'Fixed Assets', bm: 'Aset Tetap' },
    { id: 'acc_petty', en: 'Petty Cash', bm: 'Petty Cash' }
  ];
  var ACC_VIEW_MAP = {
    expense: 'acc_expense', 'exp-form': 'acc_expense',
    reconcile: 'acc_reconcile',
    'fixed-assets': 'acc_fixed_assets', 'fa-form': 'acc_fixed_assets', 'fa-detail': 'acc_fixed_assets',
    petty: 'acc_petty', 'petty-detail': 'acc_petty'
  };

  function hasId(sec, id) {
    return (sec.modules || []).some(function (m) { return m.id === id; });
  }

  function patchSections() {
    if (!Array.isArray(window.RP_SECTIONS)) return;
    var secs = window.RP_SECTIONS;
    if (!secs.some(function (s) { return s.key === 'main'; })) {
      secs.unshift({ key: 'main', en: 'Main', bm: 'Utama', modules: EXTRA_MAIN.slice() });
    } else {
      var main = secs.find(function (s) { return s.key === 'main'; });
      EXTRA_MAIN.forEach(function (m) { if (!hasId(main, m.id)) main.modules.push(m); });
    }
    var fin = secs.find(function (s) { return s.key === 'finance'; });
    if (fin) {
      EXTRA_FINANCE.forEach(function (m) { if (!hasId(fin, m.id)) fin.modules.push(m); });
    }
    if (Array.isArray(window.RP_MODULES)) {
      window.RP_MODULES = secs.reduce(function (a, s) { return a.concat(s.modules); }, []);
    }
    ['manager', 'admin'].forEach(function (role) {
      [window.RP_ROLE_DEFAULTS, window._DEFAULT_ROLE_MODULES].forEach(function (map) {
        if (!map || !Array.isArray(map[role])) return;
        if (map[role].indexOf('planner') < 0) map[role] = map[role].concat(['planner']);
      });
    });
  }

  function wrapCanAccess() {
    var orig = window.canAccess;
    if (typeof orig !== 'function' || orig._rpSyncWrapped) return;
    var wrapped = function (module) {
      var ok = orig.apply(this, arguments);
      if (ok) return true;
      try {
        var mods = typeof _rpModulesForCurrentUser === 'function' ? _rpModulesForCurrentUser() : [];
        if (module === 'accounting') {
          return mods.some(function (m) { return String(m).indexOf('acc_') === 0; });
        }
        if (module === 'planner') return mods.indexOf('planner') >= 0;
      } catch (e) {}
      return false;
    };
    wrapped._rpSyncWrapped = true;
    window.canAccess = wrapped;
  }

  function canAccView(view) {
    if (typeof isTenantAdmin === 'function' && isTenantAdmin()) return true;
    var need = ACC_VIEW_MAP[view];
    if (!need) return true;
    try {
      var mods = typeof _rpModulesForCurrentUser === 'function' ? _rpModulesForCurrentUser() : [];
      if (mods.indexOf('accounting') >= 0) return true;
      return mods.indexOf(need) >= 0;
    } catch (e) { return true; }
  }

  function wrapAcc() {
    var origTabs = window._accTabs;
    if (typeof origTabs === 'function' && !origTabs._rpSyncWrapped) {
      var wt = function (active) {
        var html = origTabs.apply(this, arguments);
        if (typeof isTenantAdmin === 'function' && isTenantAdmin()) return html;
        try {
          var mods = _rpModulesForCurrentUser();
          if (mods.indexOf('accounting') >= 0) return html;
          var hide = [];
          if (mods.indexOf('acc_expense') < 0) hide.push('expense');
          if (mods.indexOf('acc_reconcile') < 0) hide.push('reconcile');
          if (mods.indexOf('acc_fixed_assets') < 0) hide.push('fixed-assets');
          if (mods.indexOf('acc_petty') < 0) hide.push('petty');
          hide.forEach(function (v) {
            html = html.replace(new RegExp('<button[^>]*openPage\(\'accounting\',\{view:\'' + v + '\'\)[^<]*<\\/button>', 'g'), '');
          });
        } catch (e) {}
        return html;
      };
      wt._rpSyncWrapped = true;
      window._accTabs = wt;
    }
    var orig = window.renderAccounting;
    if (typeof orig === 'function' && !orig._rpSyncWrapped) {
      var wr = function (params) {
        params = params || {};
        if (params.view && !canAccView(params.view)) {
          params = {};
        }
        return orig.call(this, params);
      };
      wr._rpSyncWrapped = true;
      window.renderAccounting = wr;
    }
  }

  function boot() {
    patchSections();
    wrapCanAccess();
    wrapAcc();
    if (typeof _rpRenderList === 'function' && document.getElementById('role-perms-wrap')) {
      try { _rpRenderList(); } catch (e) {}
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setTimeout(boot, 600);
})();
