/* Role permission breakdown by live workflow. No platform_admin. */
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
    sales: { quo: 'sales_quo', 'quo-form': 'sales_quo', cn: 'sales_cn', 'credit-notes': 'sales_cn' },
    pos: { history: 'pos_history', shifts: 'pos_shifts' },
    sales_commission: { rules: 'sc_rules', ledger: 'sc_ledger', leaderboard: 'sc_leaderboard', achievements: 'sc_achievements' },
    inventory: { stock: 'inv_stock' },
    purchasing: {
      suppliers: 'pur_suppliers', 'supplier-form': 'pur_suppliers', 'supplier-soa': 'pur_suppliers',
      'po-form': 'pur_po', 'po-detail': 'pur_po',
      'grn-form': 'pur_grn',
      bills: 'pur_bills', 'bill-form': 'pur_bills', 'bill-detail': 'pur_bills'
    },
    hr: { leave: 'hr_leave', advance: 'hr_advance', 'salary-disbursement': 'hr_disbursement' },
    accounting: {
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
    hr_leave: 'hr', hr_advance: 'hr', hr_disbursement: 'hr_payroll',
    acc_expense: 'accounting', acc_reconcile: 'accounting', acc_fixed_assets: 'accounting',
    acc_petty: 'accounting', acc_fiscal: 'accounting', acc_ob: 'accounting',
    voucher_pvd: 'vouchers',
    rpt_bs: 'reports', rpt_tb: 'reports', rpt_sales: 'reports', rpt_ar: 'reports', rpt_ap: 'reports', rpt_sst: 'reports',
    planner: 'planner'
  };

  function modsNow() {
    try { return (typeof _rpModulesForCurrentUser === 'function') ? _rpModulesForCurrentUser() : []; }
    catch (e) { return []; }
  }
  function allow(parent, child) {
    if (typeof isTenantAdmin === 'function' && isTenantAdmin()) return true;
    var mods = modsNow();
    if (parent && mods.indexOf(parent) >= 0) return true;
    if (child && mods.indexOf(child) >= 0) return true;
    return false;
  }
  function allowView(page, view) {
    var map = VIEW[page] || {};
    var child = map[view];
    if (!child) return allow(page, null) || Object.keys(PARENT).some(function (c) { return PARENT[c] === page && modsNow().indexOf(c) >= 0; });
    return allow(page, child);
  }

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
  function wrapCanAccess() {
    var orig = window.canAccess;
    if (typeof orig !== 'function' || orig._rpBdWrapped) return;
    var w = function (module) {
      if (orig.apply(this, arguments)) return true;
      var mods = modsNow();
      if (mods.indexOf(module) >= 0) return true;
      return Object.keys(PARENT).some(function (c) { return PARENT[c] === module && mods.indexOf(c) >= 0; });
    };
    w._rpBdWrapped = true;
    window.canAccess = w;
  }
  function wrapFn(name, page) {
    var orig = window[name];
    if (typeof orig !== 'function' || orig._rpBdWrapped) return;
    var w = function (params) {
      params = params || {};
      if (params.view && !allowView(page, params.view)) params = Object.assign({}, params, { view: '' });
      return orig.call(this, params);
    };
    w._rpBdWrapped = true;
    window[name] = w;
  }

  function boot() {
    wrapList();
    wrapCanAccess();
    wrapFn('renderSales', 'sales');
    wrapFn('renderPOS', 'pos');
    wrapFn('renderSalesCommission', 'sales_commission');
    wrapFn('renderInventory', 'inventory');
    wrapFn('renderPurchasing', 'purchasing');
    wrapFn('renderHR', 'hr');
    wrapFn('renderAccounting', 'accounting');
    wrapFn('renderPaymentVouchers', 'vouchers');
    wrapFn('renderReports', 'reports');
    decorate();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setTimeout(boot, 400);
  setTimeout(boot, 1400);
})();
