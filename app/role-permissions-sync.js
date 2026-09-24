/* Role permission breakdown by live workflow. Least-privilege: no child→parent elevation. Child nav: expense+achievements; lexical NAV_ITEMS via navItemsList (v7). */
(function () {
  var GROUPS = [
    { en: 'Main', bm: 'Utama', modules: [
      { id: 'planner', en: 'Planner', bm: 'Perancang' }
    ]},
    { en: 'Sales breakdown', bm: 'Pecahan jualan', modules: [
      { id: 'sales_quo', en: 'Quotations', bm: 'Sebut harga' },
      { id: 'sales_cn', en: 'Credit Notes', bm: 'Nota kredit' }
    ]},
    { en: 'POS breakdown', bm: 'Pecahan POS', modules: [
      { id: 'pos_history', en: 'POS History', bm: 'Sejarah POS' },
      { id: 'pos_shifts', en: 'POS Shifts', bm: 'Shift POS' }
    ]},
    { en: 'Commission breakdown', bm: 'Pecahan komisyen', modules: [
      { id: 'sc_rules', en: 'Commission Rules', bm: 'Peraturan komisyen' },
      { id: 'sc_ledger', en: 'Commission Ledger', bm: 'Lejar komisyen' },
      { id: 'sc_leaderboard', en: 'Leaderboard', bm: 'Papan pendahulu' },
      { id: 'sc_achievements', en: 'Achievements', bm: 'Pencapaian' }
    ]},
    { en: 'Inventory breakdown', bm: 'Pecahan inventori', modules: [
      { id: 'inv_stock', en: 'Stock Movements', bm: 'Pergerakan stok' }
    ]},
    { en: 'Purchasing breakdown', bm: 'Pecahan perolehan', modules: [
      { id: 'pur_suppliers', en: 'Suppliers', bm: 'Pembekal' },
      { id: 'pur_po', en: 'Purchase Orders', bm: 'Pesanan belian' },
      { id: 'pur_grn', en: 'Goods Received (GRN)', bm: 'GRN' },
      { id: 'pur_bills', en: 'Supplier Bills', bm: 'Bil pembekal' }
    ]},
    { en: 'HR breakdown', bm: 'Pecahan HR', modules: [
      { id: 'hr_leave', en: 'Leave', bm: 'Cuti' },
      { id: 'hr_advance', en: 'Salary Advance', bm: 'Pendahuluan gaji' },
      { id: 'hr_disbursement', en: 'Salary Disbursement', bm: 'Penyaluran gaji' }
    ]},
    { en: 'Finance functions', bm: 'Fungsi kewangan', modules: [
      { id: 'acc_coa', en: 'Chart of Accounts', bm: 'Carta Akaun' },
      { id: 'acc_journal', en: 'Journal Entries', bm: 'Entri jurnal' },
      { id: 'acc_expense', en: 'Expense Claims', bm: 'Tuntutan belanja' },
      { id: 'acc_reconcile', en: 'Bank Reconciliation', bm: 'Penyesuaian bank' },
      { id: 'acc_fixed_assets', en: 'Fixed Assets', bm: 'Aset tetap' },
      { id: 'acc_petty', en: 'Petty Cash', bm: 'Petty cash' },
      { id: 'acc_fiscal', en: 'Fiscal Years', bm: 'Tahun kewangan' },
      { id: 'acc_ob', en: 'Opening Balance', bm: 'Baki pembukaan' }
    ]},
    { en: 'Vouchers breakdown', bm: 'Pecahan baucar', modules: [
      { id: 'voucher_pvd', en: 'PV Disbursements', bm: 'Penyaluran PV' }
    ]},
    { en: 'Reports breakdown', bm: 'Pecahan laporan', modules: [
      { id: 'rpt_bs', en: 'Balance Sheet', bm: 'Kunci kira-kira' },
      { id: 'rpt_tb', en: 'Trial Balance', bm: 'Imbangan duga' },
      { id: 'rpt_sales', en: 'Sales Report', bm: 'Laporan jualan' },
      { id: 'rpt_ar', en: 'AR Aging', bm: 'Penuaan hutang' },
      { id: 'rpt_ap', en: 'AP Aging', bm: 'Penuaan pemiutang' },
      { id: 'rpt_sst', en: 'SST Report', bm: 'Laporan SST' }
    ]}
  ];

  var VIEW = {
    sales: { '': null, quo: 'sales_quo', 'quo-form': 'sales_quo', cn: 'sales_cn', 'credit-notes': 'sales_cn' },
    pos: { history: 'pos_history', shifts: 'pos_shifts' },
    sales_commission: { rules: 'sc_rules', ledger: 'sc_ledger', leaderboard: 'sc_leaderboard', achievements: 'sc_achievements' },
    inventory: { stock: 'inv_stock' },
    purchasing: {
      suppliers: 'pur_suppliers', 'supplier-form': 'pur_suppliers', 'supplier-soa': 'pur_suppliers',
      'po-form': 'pur_po', 'po-detail': 'pur_po',
      'grn-form': 'pur_grn',
      bills: 'pur_bills', 'bill-form': 'pur_bills', 'bill-detail': 'pur_bills'
    },
    hr: {
      '': 'hr_attendance',
      attendance: 'hr_attendance',
      leave: 'hr_leave',
      advance: 'hr_advance',
      'salary-disbursement': 'hr_disbursement',
      'my-payslips': 'hr_attendance',
      'payroll-history': 'hr_attendance',
      payslip: 'hr_attendance'
    },
    accounting: {
      '': 'acc_coa',
      'coa-form': 'acc_coa',
      journal: 'acc_journal', 'journal-form': 'acc_journal',
      expense: 'acc_expense', 'exp-form': 'acc_expense',
      reconcile: 'acc_reconcile',
      'fixed-assets': 'acc_fixed_assets', 'fa-form': 'acc_fixed_assets', 'fa-detail': 'acc_fixed_assets',
      petty: 'acc_petty', 'petty-detail': 'acc_petty',
      fiscal: 'acc_fiscal',
      'opening-balance': 'acc_ob'
    },
    vouchers: { disbursements: 'voucher_pvd', 'pvd-form': 'voucher_pvd', 'pvd-detail': 'voucher_pvd' },
    reports: {
      'balance-sheet': 'rpt_bs', 'trial-balance': 'rpt_tb', sales: 'rpt_sales',
      'ar-aging': 'rpt_ar', aging: 'rpt_ar', 'ap-aging': 'rpt_ap', sst: 'rpt_sst'
    }
  };
  var PARENT = {
    sales_quo: 'sales', sales_cn: 'sales',
    pos_history: 'pos', pos_shifts: 'pos',
    sc_rules: 'sales_commission', sc_ledger: 'sales_commission', sc_leaderboard: 'sales_commission', sc_achievements: 'sales_commission',
    inv_stock: 'inventory',
    pur_suppliers: 'purchasing', pur_po: 'purchasing', pur_grn: 'purchasing', pur_bills: 'purchasing',
    hr_attendance: 'hr', hr_leave: 'hr', hr_advance: 'hr', hr_disbursement: 'hr_payroll',
    acc_coa: 'accounting', acc_journal: 'accounting',
    acc_expense: 'accounting', acc_reconcile: 'accounting', acc_fixed_assets: 'accounting',
    acc_petty: 'accounting', acc_fiscal: 'accounting', acc_ob: 'accounting',
    voucher_pvd: 'vouchers',
    rpt_bs: 'reports', rpt_tb: 'reports', rpt_sales: 'reports', rpt_ar: 'reports', rpt_ap: 'reports', rpt_sst: 'reports',
    planner: 'planner'
  };

  /* Preferred child view order when default is denied */
  var VIEW_ORDER = {
    accounting: ['expense', 'petty', 'reconcile', 'fixed-assets', 'fiscal', 'opening-balance', 'journal', ''],
    sales: ['quo', 'cn', ''],
    purchasing: ['suppliers', 'bills'],
    hr: ['attendance', 'leave', 'my-payslips', 'advance', 'salary-disbursement'],
    reports: ['sales', 'ar-aging', 'ap-aging', 'balance-sheet', 'trial-balance', 'sst'],
    pos: ['history', 'shifts'],
    sales_commission: ['ledger', 'leaderboard', 'achievements', 'rules'],
    inventory: ['stock'],
    vouchers: ['disbursements']
  };

  function modsNow() {
    try { return (typeof _rpModulesForCurrentUser === 'function') ? _rpModulesForCurrentUser() : []; }
    catch (e) { return []; }
  }
  function allow(parent, child) {
    if (typeof isTenantAdmin === 'function' && isTenantAdmin()) return true;
    if (typeof isPlatformAdmin === 'function' && isPlatformAdmin()) return true;
    var mods = modsNow();
    if (parent && mods.indexOf(parent) >= 0) return true;
    if (child && mods.indexOf(child) >= 0) return true;
    /* Settings label "HR — Attendance & Leave" (hr_attendance) also unlocks Leave views. */
    if (child === 'hr_leave' && mods.indexOf('hr_attendance') >= 0) return true;
    /* Leave-only tick must not unlock Attendance / My Payslips (mapped to hr_attendance). */
    return false;
  }
  /** Parent key grants all views; child key grants only its mapped views. Unmapped = parent only. */
  function allowView(page, view) {
    view = (view == null) ? '' : String(view);
    var map = VIEW[page] || {};
    var hasKey = Object.prototype.hasOwnProperty.call(map, view);
    if (!hasKey) {
      /* Unmapped / dangerous default: require explicit parent module — never any-child. */
      return allow(page, null);
    }
    var child = map[view];
    if (child == null) {
      /* Explicit null (e.g. sales invoices default): parent module only */
      return allow(page, null);
    }
    return allow(page, child);
  }
  function firstAllowedView(page) {
    var order = VIEW_ORDER[page] || Object.keys(VIEW[page] || {});
    for (var i = 0; i < order.length; i++) {
      if (allowView(page, order[i])) return order[i];
    }
    return null;
  }
  function canAccessModuleOrChild(parent) {
    if (typeof isTenantAdmin === 'function' && isTenantAdmin()) return true;
    if (typeof canAccess === 'function' && canAccess(parent)) return true;
    var mods = modsNow();
    return Object.keys(PARENT).some(function (c) {
      return PARENT[c] === parent && mods.indexOf(c) >= 0;
    });
  }

  /** Module on = view + create + edit. Delete/void = owner/admin only (Pass 2 MVP). */
  function canMutate(module) {
    if (typeof canAccess === 'function') return !!canAccess(module);
    return allow(module, null);
  }
  function canDelete(module) {
    if (typeof isTenantAdmin === 'function' && isTenantAdmin()) return true;
    if (typeof isPlatformAdmin === 'function' && isPlatformAdmin()) return true;
    return false;
  }

  window._rpAllowView = allowView;
  window._rpFirstAllowedView = firstAllowedView;
  window.canAccessModuleOrChild = canAccessModuleOrChild;
  window.canMutate = canMutate;
  window.canDelete = canDelete;

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
    var html = GROUPS.map(function (sec) {
      var boxes = sec.modules.map(function (m) {
        var checked = mods.indexOf(m.id) >= 0 ? 'checked' : '';
        return '<label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;min-width:200px;padding:3px 0">' +
          '<input type="checkbox" ' + checked + ' onchange="_rpToggleModule(\'' + role + '\',\'' + m.id + '\',this.checked)"> ' +
          (isBm ? m.bm : m.en) + '</label>';
      }).join('');
      return '<div data-rp-extra="1" style="margin:8px 0 4px">' +
        '<div style="font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px">' +
        (isBm ? sec.bm : sec.en) + '</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:2px 14px">' + boxes + '</div></div>';
    }).join('');
    var system = null;
    card.querySelectorAll('div[style*="text-transform:uppercase"]').forEach(function (el) {
      var t = (el.textContent || '').trim().toLowerCase();
      if (t === 'system' || t === 'sistem') system = el.parentNode;
    });
    var tmp = document.createElement('div');
    tmp.innerHTML = html;
    while (tmp.firstChild) {
      if (system) card.insertBefore(tmp.firstChild, system);
      else card.appendChild(tmp.firstChild);
    }
  }
  function decorate() {
    var root = document.getElementById('role-perms-wrap');
    if (!root) return;
    root.querySelectorAll(':scope > div').forEach(injectIntoCard);
  }

  function wrapList() {
    var orig = window._rpRenderList;
    if (typeof orig !== 'function' || orig._rpBdWrapped) return;
    var w = function () { var r = orig.apply(this, arguments); setTimeout(decorate, 0); return r; };
    w._rpBdWrapped = true;
    window._rpRenderList = w;
  }

  /** NO child→parent elevation. Parent nav only if parent key (or owner/admin via base). */
  function wrapCanAccess() {
    var orig = window.canAccess;
    if (typeof orig !== 'function' || orig._rpBdWrapped) return;
    var w = function (module) {
      if (orig.apply(this, arguments)) return true;
      var mods = modsNow();
      if (mods.indexOf(module) >= 0) return true;
      return false;
    };
    w._rpBdWrapped = true;
    window.canAccess = w;
  }

  function denyOrRedirect(page, params) {
    params = params || {};
    var view = params.view || '';
    if (allowView(page, view)) return params;
    var first = firstAllowedView(page);
    if (first != null) return Object.assign({}, params, { view: first });
    if (typeof renderAccessDenied === 'function') {
      try { renderAccessDenied(); } catch (e) {}
      return null;
    }
    try {
      var isBm = (typeof APP !== 'undefined' && APP.language === 'bm');
      if (typeof showToast === 'function') {
        showToast(isBm ? 'Akses ditolak.' : 'Access denied.', 'warning');
      }
    } catch (e2) {}
    return null;
  }

  function wrapFn(name, page) {
    var orig = window[name];
    if (typeof orig !== 'function' || orig._rpBdWrapped) return;
    var w = function (params) {
      params = params || {};
      var next = denyOrRedirect(page, params);
      if (next == null) return;
      return orig.call(this, next);
    };
    w._rpBdWrapped = true;
    window[name] = w;
  }

  function filterTabButtons(html, page) {
    if (!html || typeof html !== 'string') return html;
    if (typeof isTenantAdmin === 'function' && isTenantAdmin()) return html;
    return html.replace(/<button\b[\s\S]*?<\/button>/gi, function (btn) {
      var m = btn.match(/openPage\(\s*'([^']+)'\s*(?:,\s*(\{[^}]*\}))?\s*\)/);
      if (!m) return btn;
      var target = m[1];
      var raw = m[2] || '';
      var view = '';
      var vm = raw.match(/view\s*:\s*'([^']*)'/);
      if (vm) view = vm[1];
      if (target === 'vouchers') {
        return (typeof canAccess === 'function' && canAccess('vouchers')) ? btn : '';
      }
      if (target === page) {
        return allowView(page, view) ? btn : '';
      }
      if (page === 'accounting' && target === 'accounting') {
        return allowView('accounting', view) ? btn : '';
      }
      return btn;
    });
  }

  function wrapTabs(name, page) {
    var orig = window[name];
    if (typeof orig !== 'function' || orig._rpBdWrapped) return;
    var w = function () {
      var html = orig.apply(this, arguments);
      return filterTabButtons(html, page);
    };
    w._rpBdWrapped = true;
    window[name] = w;
  }

  function wrapDelete(name, module) {
    var orig = window[name];
    if (typeof orig !== 'function' || orig._rpBdWrapped) return;
    var w = function () {
      if (!canDelete(module)) {
        try {
          var isBm = (typeof APP !== 'undefined' && APP.language === 'bm');
          if (typeof showToast === 'function') {
            showToast(isBm ? 'Padam hanya untuk Owner/Admin.' : 'Delete requires Owner/Admin.', 'warning');
          }
        } catch (e) {}
        return;
      }
      return orig.apply(this, arguments);
    };
    w._rpBdWrapped = true;
    window[name] = w;
  }

  /** Classic scripts share lexical const NAV_ITEMS; it is NOT on window. Prefer bare NAV_ITEMS. */
  function navItemsList() {
    try {
      if (typeof NAV_ITEMS !== 'undefined' && Array.isArray(NAV_ITEMS)) return NAV_ITEMS;
    } catch (e) {}
    if (window.NAV_ITEMS && Array.isArray(window.NAV_ITEMS)) return window.NAV_ITEMS;
    return null;
  }

  function insertNavAfter(afterId, item) {
    var list = navItemsList();
    if (!list) return;
    if (list.some(function (n) { return n && n.id === item.id; })) return;
    var idx = -1;
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].id === afterId) { idx = i; break; }
    }
    if (idx >= 0) list.splice(idx + 1, 0, item);
    else list.push(item);
  }

  /** Child-only Expense Claims nav (parent Accounting stays hidden without accounting key). */
  function ensureExpenseClaimsNav() {
    insertNavAfter('accounting', {
      id: 'expense_claims',
      icon: 'ti-receipt',
      label_en: 'Expense Claims',
      label_bm: 'Tuntutan Belanja',
      module: 'acc_expense'
    });
  }

  /** Child-only Achievements nav (parent Sales Commission stays hidden without sales_commission key). */
  function ensureAchievementsNav() {
    insertNavAfter('sales_commission', {
      id: 'achievements',
      icon: 'ti-trophy',
      label_en: 'Achievements',
      label_bm: 'Pencapaian',
      module: 'sc_achievements'
    });
  }

  function ensureChildNavs() {
    ensureExpenseClaimsNav();
    ensureAchievementsNav();
  }

  function openChildPage(pageId, parentModule, childModule, renderFn, viewKey, params) {
    params = params || {};
    if (!allow(parentModule, childModule)) {
      if (typeof renderAccessDenied === 'function') renderAccessDenied();
      return;
    }
    /* Drive history/sidebar like a real page, then render child view. */
    try {
      if (typeof _clearUiOverlays === 'function') _clearUiOverlays();
      try { _closeMobileSidebar(); } catch (e0) {}
      try { closeUserDropdown(); } catch (e1) {}
      if (typeof _sdUnregisterPrintListeners === 'function') _sdUnregisterPrintListeners();
      if (typeof _lsSet === 'function') {
        _lsSet('nexerp_last_page', pageId);
        _lsSet('nexerp_last_params', JSON.stringify(Object.assign({}, params, { view: viewKey })));
      }
      if (typeof APP !== 'undefined') APP.currentPage = pageId;
      if (typeof _navPushHistory === 'function') _navPushHistory(pageId, params);
      document.querySelectorAll('.nav-item').forEach(function (el) {
        el.classList.toggle('active', el.dataset.page === pageId);
      });
      var _navList = navItemsList() || [];
      var item = _navList.find(function (n) { return n && n.id === pageId; });
      var ht = document.getElementById('header-title');
      if (ht && item) ht.textContent = (APP.language === 'bm') ? item.label_bm : item.label_en;
      var main = document.getElementById('main');
      if (main) main.innerHTML = '<div class="page-loading"><div class="spinner dark"></div></div>';
      setTimeout(function () {
        if (typeof window[renderFn] === 'function') {
          window[renderFn](Object.assign({}, params, { view: viewKey }));
        }
      }, 150);
    } catch (err) {
      console.error(pageId + ' open', err);
      if (typeof renderAccessDenied === 'function') renderAccessDenied();
    }
  }

  function wrapOpenPage() {
    var orig = window.openPage;
    if (typeof orig !== 'function' || orig._rpBdWrapped) return;
    var w = function (page, params) {
      params = params || {};
      if (page === 'expense_claims') {
        openChildPage('expense_claims', 'accounting', 'acc_expense', 'renderAccounting', 'expense', params);
        return;
      }
      if (page === 'achievements') {
        openChildPage('achievements', 'sales_commission', 'sc_achievements', 'renderSalesCommission', 'achievements', params);
        return;
      }
      return orig.apply(this, arguments);
    };
    w._rpBdWrapped = true;
    window.openPage = w;
  }

  function wrapBuildSidebar() {
    var orig = window.buildSidebar;
    if (typeof orig !== 'function' || orig._rpBdWrapped) return;
    var w = function () {
      ensureChildNavs();
      return orig.apply(this, arguments);
    };
    w._rpBdWrapped = true;
    window.buildSidebar = w;
  }

  function boot() {
    try { if (typeof NAV_ITEMS !== 'undefined') window.NAV_ITEMS = NAV_ITEMS; } catch (eNav) {}
    ensureChildNavs();
    wrapList();
    wrapCanAccess();
    wrapOpenPage();
    wrapBuildSidebar();
    wrapFn('renderSales', 'sales');
    wrapFn('renderPOS', 'pos');
    wrapFn('renderSalesCommission', 'sales_commission');
    wrapFn('renderInventory', 'inventory');
    wrapFn('renderPurchasing', 'purchasing');
    wrapFn('renderHR', 'hr');
    wrapFn('renderAccounting', 'accounting');
    wrapFn('renderPaymentVouchers', 'vouchers');
    wrapFn('renderReports', 'reports');
    wrapTabs('_accTabs', 'accounting');
    wrapTabs('_salesTabs', 'sales');
    wrapDelete('_crmDelete', 'crm');
    wrapDelete('_invoiceDelete', 'sales');
    wrapDelete('_quoDelete', 'sales');
    decorate();
    /* Rebuild after inject — login often already painted sidebar before this script wrapped it. */
    try {
      if (typeof buildSidebar === 'function') buildSidebar();
    } catch (eBoot) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setTimeout(boot, 400);
  setTimeout(boot, 1400);
})();
