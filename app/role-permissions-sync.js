/* Role Permissions extras — Planner + accounting functions. No platform_admin. */
(function () {
  var EXTRAS = [
    { key: 'main', en: 'Main', bm: 'Utama', modules: [
      { id: 'planner', en: 'Planner', bm: 'Perancang' }
    ]},
    { key: 'finance-extra', en: 'Finance functions', bm: 'Fungsi kewangan', modules: [
      { id: 'acc_expense', en: 'Expense Claims', bm: 'Tuntutan Belanja' },
      { id: 'acc_reconcile', en: 'Bank Reconciliation', bm: 'Penyesuaian Bank' },
      { id: 'acc_fixed_assets', en: 'Fixed Assets', bm: 'Aset Tetap' },
      { id: 'acc_petty', en: 'Petty Cash', bm: 'Petty Cash' }
    ]}
  ];
  var ACC_VIEW_MAP = {
    expense: 'acc_expense', 'exp-form': 'acc_expense',
    reconcile: 'acc_reconcile',
    'fixed-assets': 'acc_fixed_assets', 'fa-form': 'acc_fixed_assets', 'fa-detail': 'acc_fixed_assets',
    petty: 'acc_petty', 'petty-detail': 'acc_petty'
  };

  function roleFromCard(card) {
    var cb = card.querySelector('input[onchange*="_rpToggleModule"]');
    if (!cb) return null;
    var m = String(cb.getAttribute('onchange') || '').match(/_rpToggleModule\('([^']+)'/);
    return m ? m[1] : null;
  }

  function injectIntoCard(card) {
    if (card.querySelector('[data-rp-extra]')) return;
    var role = roleFromCard(card);
    if (!role) return;
    var mods = [];
    try { mods = (_rolePermsState && _rolePermsState[role]) || []; } catch (e) {}
    var isBm = APP.language === 'bm';
    var html = EXTRAS.map(function (sec) {
      var boxes = sec.modules.map(function (m) {
        var checked = mods.indexOf(m.id) >= 0 ? 'checked' : '';
        return '<label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;min-width:180px;padding:4px 0">' +
          '<input type="checkbox" ' + checked + ' onchange="_rpToggleModule(\'' + role + '\',\'' + m.id + '\',this.checked)"> ' +
          (isBm ? m.bm : m.en) + '</label>';
      }).join('');
      return '<div data-rp-extra="1" style="margin-bottom:10px">' +
        '<div style="font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px">' +
        (isBm ? sec.bm : sec.en) + '</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:4px 14px">' + boxes + '</div></div>';
    }).join('');
    var system = null;
    card.querySelectorAll('div[style*="text-transform:uppercase"]').forEach(function (el) {
      var t = (el.textContent || '').trim().toLowerCase();
      if (t === 'system' || t === 'sistem') system = el.parentNode;
    });
    var wrap = document.createElement('div');
    wrap.innerHTML = html;
    while (wrap.firstChild) {
      var node = wrap.firstChild;
      if (system) card.insertBefore(node, system);
      else card.appendChild(node);
    }
  }

  function decorate() {
    var root = document.getElementById('role-perms-wrap');
    if (!root) return;
    root.querySelectorAll(':scope > div').forEach(injectIntoCard);
  }

  function wrapList() {
    var orig = window._rpRenderList;
    if (typeof orig !== 'function' || orig._rpSyncWrapped) return;
    var wrapped = function () {
      var r = orig.apply(this, arguments);
      setTimeout(decorate, 0);
      return r;
    };
    wrapped._rpSyncWrapped = true;
    window._rpRenderList = wrapped;
  }

  function wrapCanAccess() {
    var orig = window.canAccess;
    if (typeof orig !== 'function' || orig._rpSyncWrapped) return;
    var wrapped = function (module) {
      if (orig.apply(this, arguments)) return true;
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
      var mods = _rpModulesForCurrentUser();
      if (mods.indexOf('accounting') >= 0) return true;
      return mods.indexOf(need) >= 0;
    } catch (e) { return true; }
  }

  function wrapAcc() {
    var orig = window.renderAccounting;
    if (typeof orig !== 'function' || orig._rpSyncWrapped) return;
    var wr = function (params) {
      params = params || {};
      if (params.view && !canAccView(params.view)) params = {};
      return orig.call(this, params);
    };
    wr._rpSyncWrapped = true;
    window.renderAccounting = wr;
  }

  function boot() {
    wrapList();
    wrapCanAccess();
    wrapAcc();
    decorate();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setTimeout(boot, 400);
  setTimeout(boot, 1200);
})();
