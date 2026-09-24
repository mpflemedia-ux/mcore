(function () {
  function role() {
    try { return String((APP.user && APP.user.role) || '').toLowerCase().trim(); }
    catch (e) { return ''; }
  }
  function isBoss() {
    var r = role();
    if (r === 'owner' || r === 'admin' || r === 'platform_admin') return true;
    try { if (typeof isTenantAdmin === 'function' && isTenantAdmin()) return true; } catch (e) {}
    return false;
  }
  function mods() {
    var out = [];
    try {
      var ov = APP.user && APP.user.module_override;
      if (Array.isArray(ov)) out = ov.map(String);
    } catch (e) {}
    if (!out.length) {
      try {
        var map = (APP.tenantConfig && APP.tenantConfig.roles) || {};
        var rk = role();
        var configured = map[rk] || map[rk.replace(/\s+/g, '_')];
        if (!Array.isArray(configured)) {
          var found = Object.keys(map).find(function (k) { return String(k).toLowerCase() === rk; });
          if (found) configured = map[found];
        }
        if (Array.isArray(configured)) out = configured.map(String);
      } catch (e2) {}
    }
    return out;
  }
  function staffSelfHr() {
    if (isBoss()) return false;
    var r = role();
    if (r === 'staff' || r === 'employee' || r === '') return true;
    var m = mods();
    return m.some(function (x) { return String(x).indexOf('hr_') === 0 || x === 'hr'; });
  }
  function wrapCanAccess() {
    var orig = window.canAccess;
    if (typeof orig !== 'function' || orig._staffHr) return;
    var w = function (module) {
      if (module === 'hr' || module === 'hr_attendance' || module === 'hr_leave') {
        if (staffSelfHr() || mods().indexOf('hr_attendance') >= 0 || mods().indexOf('hr_leave') >= 0 || mods().indexOf('hr') >= 0) {
          return true;
        }
        if (role() === 'staff') return true;
      }
      return orig.apply(this, arguments);
    };
    w._staffHr = true;
    w._rpBdWrapped = orig._rpBdWrapped;
    w._expPlanFixed = orig._expPlanFixed;
    window.canAccess = w;
  }
  function wrapOpen() {
    var orig = window.openPage;
    if (typeof orig !== 'function' || orig._staffHrOpen) return;
    var w = function (page, params) {
      params = params || {};
      if (page === 'hr' && role() === 'staff' && !isBoss()) {
        var view = params.view || 'attendance';
        if (view === 'advance' || view === 'salary-disbursement' || view === 'payroll-history') {
          params = Object.assign({}, params, { view: 'attendance' });
        }
      }
      return orig.apply(this, arguments);
    };
    w._staffHrOpen = true;
    w._rpBdWrapped = orig._rpBdWrapped;
    w._expOpenFixed = orig._expOpenFixed;
    window.openPage = w;
  }
  function wrapSidebar() {
    var orig = window.buildSidebar;
    if (typeof orig !== 'function' || orig._staffHrNav) return;
    var w = function () {
      var ret = orig.apply(this, arguments);
      try {
        if (role() === 'staff' && typeof canAccess === 'function' && canAccess('hr')) {
          var nav = document.getElementById('sidebar-nav');
          if (nav && !nav.querySelector('[data-page="hr"]')) {
            var ops = null;
            nav.querySelectorAll('.nav-section').forEach(function (s) {
              if (/people|sdm|hr/i.test(s.textContent || '')) ops = s;
            });
            var el = document.createElement('div');
            el.className = 'nav-item';
            el.dataset.page = 'hr';
            el.innerHTML = '<i class="ti ti-id-badge-2 nav-icon"></i><span class="nav-label">' +
              ((APP.language === 'bm') ? 'SDM & Gaji' : 'HR & Payroll') + '</span>';
            el.onclick = function () { openPage('hr', { view: 'attendance' }); };
            if (ops && ops.nextSibling) nav.insertBefore(el, ops.nextSibling);
            else nav.appendChild(el);
          }
        }
      } catch (e) {}
      return ret;
    };
    w._staffHrNav = true;
    window.buildSidebar = w;
  }
  function boot() {
    wrapCanAccess();
    wrapOpen();
    wrapSidebar();
    try { if (typeof buildSidebar === 'function') buildSidebar(); } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setTimeout(boot, 400);
  setTimeout(boot, 1400);
})();
