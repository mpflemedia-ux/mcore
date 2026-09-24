#!/usr/bin/env python3
"""Bake: child nav Achievements + rebuild sidebar on boot; bump sync ?v=5 → ?v=6."""
from pathlib import Path
import sys

root = Path(__file__).resolve().parents[1]
sync = root / "app" / "role-permissions-sync.js"
idx = root / "app" / "index.html"

text = sync.read_text(encoding="utf-8")

# Idempotent: already baked?
if "ensureAchievementsNav" in text and "ensureChildNavs" in text:
    print("sync.js already has Achievements nav + boot rebuild")
else:
    # Header
    old_h = "/* Role permission breakdown by live workflow. Least-privilege: no child→parent elevation. HR attendance/payslips mapped (v5). */"
    new_h = "/* Role permission breakdown by live workflow. Least-privilege: no child→parent elevation. Child nav: expense+achievements; rebuild sidebar on boot (v6). */"
    if old_h in text:
        text = text.replace(old_h, new_h, 1)
    elif "rebuild sidebar on boot (v6)" not in text:
        print("WARN: unexpected sync header", file=sys.stderr)

    old_ensure = """  /** Child-only Expense Claims nav (parent Accounting stays hidden without accounting key). */
  function ensureExpenseClaimsNav() {
    if (!window.NAV_ITEMS || !Array.isArray(window.NAV_ITEMS)) return;
    if (window.NAV_ITEMS.some(function (n) { return n && n.id === 'expense_claims'; })) return;
    var idx = -1;
    for (var i = 0; i < NAV_ITEMS.length; i++) {
      if (NAV_ITEMS[i] && NAV_ITEMS[i].id === 'accounting') { idx = i; break; }
    }
    var item = {
      id: 'expense_claims',
      icon: 'ti-receipt',
      label_en: 'Expense Claims',
      label_bm: 'Tuntutan Belanja',
      module: 'acc_expense'
    };
    if (idx >= 0) NAV_ITEMS.splice(idx + 1, 0, item);
    else NAV_ITEMS.push(item);
  }"""

    new_ensure = """  function insertNavAfter(afterId, item) {
    if (!window.NAV_ITEMS || !Array.isArray(window.NAV_ITEMS)) return;
    if (window.NAV_ITEMS.some(function (n) { return n && n.id === item.id; })) return;
    var idx = -1;
    for (var i = 0; i < NAV_ITEMS.length; i++) {
      if (NAV_ITEMS[i] && NAV_ITEMS[i].id === afterId) { idx = i; break; }
    }
    if (idx >= 0) NAV_ITEMS.splice(idx + 1, 0, item);
    else NAV_ITEMS.push(item);
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
  }"""

    if old_ensure not in text:
        print("ERROR: ensureExpenseClaimsNav block not found", file=sys.stderr)
        sys.exit(1)
    text = text.replace(old_ensure, new_ensure, 1)

    old_open = """  function wrapOpenPage() {
    var orig = window.openPage;
    if (typeof orig !== 'function' || orig._rpBdWrapped) return;
    var w = function (page, params) {
      params = params || {};
      if (page === 'expense_claims') {
        if (!allow('accounting', 'acc_expense')) {
          if (typeof renderAccessDenied === 'function') renderAccessDenied();
          return;
        }
        /* Drive history/sidebar like a real page, then render expense child. */
        try {
          if (typeof _clearUiOverlays === 'function') _clearUiOverlays();
          try { _closeMobileSidebar(); } catch (e0) {}
          try { closeUserDropdown(); } catch (e1) {}
          if (typeof _sdUnregisterPrintListeners === 'function') _sdUnregisterPrintListeners();
          if (typeof _lsSet === 'function') {
            _lsSet('nexerp_last_page', 'expense_claims');
            _lsSet('nexerp_last_params', JSON.stringify(Object.assign({}, params, { view: 'expense' })));
          }
          if (typeof APP !== 'undefined') APP.currentPage = 'expense_claims';
          if (typeof _navPushHistory === 'function') _navPushHistory('expense_claims', params);
          document.querySelectorAll('.nav-item').forEach(function (el) {
            el.classList.toggle('active', el.dataset.page === 'expense_claims');
          });
          var item = (window.NAV_ITEMS || []).find(function (n) { return n && n.id === 'expense_claims'; });
          var ht = document.getElementById('header-title');
          if (ht && item) ht.textContent = (APP.language === 'bm') ? item.label_bm : item.label_en;
          var main = document.getElementById('main');
          if (main) main.innerHTML = '<div class="page-loading"><div class="spinner dark"></div></div>';
          setTimeout(function () {
            if (typeof renderAccounting === 'function') {
              renderAccounting(Object.assign({}, params, { view: 'expense' }));
            }
          }, 150);
        } catch (err) {
          console.error('expense_claims open', err);
          if (typeof renderAccessDenied === 'function') renderAccessDenied();
        }
        return;
      }
      return orig.apply(this, arguments);
    };
    w._rpBdWrapped = true;
    window.openPage = w;
  }"""

    new_open = """  function openChildPage(pageId, parentModule, childModule, renderFn, viewKey, params) {
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
      var item = (window.NAV_ITEMS || []).find(function (n) { return n && n.id === pageId; });
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
  }"""

    if old_open not in text:
        print("ERROR: wrapOpenPage block not found", file=sys.stderr)
        sys.exit(1)
    text = text.replace(old_open, new_open, 1)

    old_bs = """    var w = function () {
      ensureExpenseClaimsNav();
      return orig.apply(this, arguments);
    };"""
    new_bs = """    var w = function () {
      ensureChildNavs();
      return orig.apply(this, arguments);
    };"""
    if old_bs not in text:
        print("ERROR: wrapBuildSidebar body not found", file=sys.stderr)
        sys.exit(1)
    text = text.replace(old_bs, new_bs, 1)

    old_boot = """  function boot() {
    ensureExpenseClaimsNav();
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
  }"""
    new_boot = """  function boot() {
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
  }"""
    if old_boot not in text:
        print("ERROR: boot block not found", file=sys.stderr)
        sys.exit(1)
    text = text.replace(old_boot, new_boot, 1)

    sync.write_text(text, encoding="utf-8")
    print("patched role-permissions-sync.js")

# Bump index cache bust
itext = idx.read_text(encoding="utf-8")
old = "role-permissions-sync.js?v=5"
new = "role-permissions-sync.js?v=6"
if old in itext:
    idx.write_text(itext.replace(old, new, 1), encoding="utf-8")
    print("bumped index to v6")
elif new in itext:
    print("index already v6")
else:
    print("ERROR: expected", old, "in index.html", file=sys.stderr)
    sys.exit(1)
