#!/usr/bin/env python3
"""Bake v9: child-page Access Denied fix for Expense Claims + Achievements.

Patches (idempotent):
  A. index renderSalesCommission - allow achievements when canAccess('sc_achievements')
  B. sync openChildPage - call renderExpenseClaims / _scRenderAchievements directly
  C. sync allow() - also true when canAccess(child) (and parent when no child)
  D. index openPage switch - native cases for expense_claims + achievements
  E. index renderAccounting - Free-plan carve-out for expense/exp-form when canAccess('acc_expense')
  F. cache bust role-permissions-sync.js?v=8 -> ?v=9
"""
from pathlib import Path
import sys
import re

root = Path(__file__).resolve().parents[1]
sync_path = root / "app" / "role-permissions-sync.js"
idx_path = root / "app" / "index.html"

sync = sync_path.read_text(encoding="utf-8")
idx = idx_path.read_text(encoding="utf-8")

# Idempotent short-circuit
if (
    "role-permissions-sync.js?v=9" in idx
    and "CHILD_PAGE_DIRECT_RENDER_V9" in sync
    and "sc_achievements" in idx[idx.find("function renderSalesCommission"):idx.find("function renderSalesCommission") + 400]
    and "canAccess('acc_expense')" in idx[idx.find("function renderAccounting"):idx.find("function renderAccounting") + 350]
    and "case 'expense_claims':" in idx
    and "case 'achievements':" in idx
):
    print("already baked v9 child-page access")
    sys.exit(0)

changed_sync = False

# ---------------------------------------------------------------------------
# F + header: bump sync header to v9
# ---------------------------------------------------------------------------
if "CHILD_PAGE_DIRECT_RENDER_V9" not in sync:
    sync2, n_h = re.subn(
        r"/\* Role permission breakdown by live workflow\. Least-privilege: no child.>?parent elevation\. Child nav: expense\+achievements; modsNow mirrors canAccess role-key resolve \(v8\)\. \*/",
        "/* Role permission breakdown by live workflow. Least-privilege: no child->parent elevation. Child nav: expense+achievements; direct child render + canAccess allow (v9). CHILD_PAGE_DIRECT_RENDER_V9 */",
        sync,
        count=1,
    )
    if n_h:
        sync = sync2
        changed_sync = True
        print("bumped sync header to v9")
    else:
        if sync.startswith("/*"):
            end = sync.find("*/")
            if end > 0 and "CHILD_PAGE_DIRECT_RENDER_V9" not in sync[: end + 2]:
                sync = (
                    "/* Role permission breakdown by live workflow. Least-privilege: no child->parent elevation. "
                    "Child nav: expense+achievements; direct child render + canAccess allow (v9). CHILD_PAGE_DIRECT_RENDER_V9 */"
                    + sync[end + 2 :]
                )
                changed_sync = True
                print("replaced sync header with v9 marker")
        else:
            print("WARN: unexpected sync header", file=sys.stderr)

# ---------------------------------------------------------------------------
# C. allow() - also trust canAccess(child) / canAccess(parent)
# Regex so HR comment em-dash / hyphen both match.
# ---------------------------------------------------------------------------
new_allow = """  function allow(parent, child) {
    if (typeof isTenantAdmin === 'function' && isTenantAdmin()) return true;
    if (typeof isPlatformAdmin === 'function' && isPlatformAdmin()) return true;
    /* Belt-and-suspenders: same path as sidebar. canAccess must NOT call allow (wrap uses modsNow only). */
    if (typeof canAccess === 'function') {
      if (child && canAccess(child)) return true;
      if (!child && parent && canAccess(parent)) return true;
    }
    var mods = modsNow();
    if (parent && mods.indexOf(parent) >= 0) return true;
    if (child && mods.indexOf(child) >= 0) return true;
    /* Settings label HR - Attendance & Leave (hr_attendance) also unlocks Leave views. */
    if (child === 'hr_leave' && mods.indexOf('hr_attendance') >= 0) return true;
    /* Leave-only tick must not unlock Attendance / My Payslips (mapped to hr_attendance). */
    return false;
  }
"""

if "Belt-and-suspenders: same path as sidebar" in sync:
    print("allow() already has canAccess belt-and-suspenders")
else:
    allow_re = re.compile(
        r"  function allow\(parent, child\) \{\n"
        r"    if \(typeof isTenantAdmin === 'function' && isTenantAdmin\(\)\) return true;\n"
        r"    if \(typeof isPlatformAdmin === 'function' && isPlatformAdmin\(\)\) return true;\n"
        r"    var mods = modsNow\(\);\n"
        r"    if \(parent && mods\.indexOf\(parent\) >= 0\) return true;\n"
        r"    if \(child && mods\.indexOf\(child\) >= 0\) return true;\n"
        r"    /\* Settings label \"HR . Attendance & Leave\" \(hr_attendance\) also unlocks Leave views\. \*/\n"
        r"    if \(child === 'hr_leave' && mods\.indexOf\('hr_attendance'\) >= 0\) return true;\n"
        r"    /\* Leave-only tick must not unlock Attendance / My Payslips \(mapped to hr_attendance\)\. \*/\n"
        r"    return false;\n"
        r"  \}\n",
        re.M,
    )
    sync2, n_a = allow_re.subn(new_allow, sync, count=1)
    if n_a:
        sync = sync2
        changed_sync = True
        print("patched allow() -> canAccess(child) belt-and-suspenders")
    else:
        print("ERROR: allow() block not found", file=sys.stderr)
        sys.exit(1)

# ---------------------------------------------------------------------------
# B. openChildPage - direct child renderers after ACL gate
# ---------------------------------------------------------------------------
old_timeout = """      setTimeout(function () {
        if (typeof window[renderFn] === 'function') {
          window[renderFn](Object.assign({}, params, { view: viewKey }));
        }
      }, 150);
"""

new_timeout = """      setTimeout(function () {
        /* CHILD_PAGE_DIRECT_RENDER_V9: bypass parent wrapFn / Free _accBasicOnly / parent hard-gates. */
        if (pageId === 'expense_claims' || childModule === 'acc_expense') {
          if (typeof window.renderExpenseClaims === 'function') {
            window.renderExpenseClaims(Object.assign({}, params, { view: viewKey || 'expense' }));
            return;
          }
        }
        if (pageId === 'achievements' || childModule === 'sc_achievements') {
          if (typeof window._scRenderAchievements === 'function') {
            window._scRenderAchievements();
            return;
          }
          if (typeof window.renderSalesCommission === 'function') {
            window.renderSalesCommission(Object.assign({}, params, { view: 'achievements' }));
            return;
          }
        }
        if (typeof window[renderFn] === 'function') {
          window[renderFn](Object.assign({}, params, { view: viewKey }));
        }
      }, 150);
"""

if "CHILD_PAGE_DIRECT_RENDER_V9: bypass parent" in sync:
    print("openChildPage already has direct child render")
elif old_timeout in sync:
    sync = sync.replace(old_timeout, new_timeout, 1)
    changed_sync = True
    print("patched openChildPage -> direct renderExpenseClaims / _scRenderAchievements")
else:
    print("ERROR: openChildPage setTimeout block not found", file=sys.stderr)
    sys.exit(1)

sync_path.write_text(sync, encoding="utf-8")
print("wrote role-permissions-sync.js")

# ---------------------------------------------------------------------------
# A. renderSalesCommission - achievements carve-out
# ---------------------------------------------------------------------------
old_rsc = """function renderSalesCommission(params={}) {
  if(!canAccess('sales_commission')) { renderAccessDenied(); return }
  const view = params.view || 'rules'
"""

new_rsc = """function renderSalesCommission(params={}) {
  var view = (params && params.view) || 'rules'
  if(!(canAccess('sales_commission') || (view === 'achievements' && canAccess('sc_achievements')))) {
    renderAccessDenied(); return
  }
"""

if "view === 'achievements' && canAccess('sc_achievements')" in idx:
    print("renderSalesCommission already allows sc_achievements achievements view")
elif old_rsc in idx:
    idx = idx.replace(old_rsc, new_rsc, 1)
    print("patched renderSalesCommission achievements canAccess carve-out")
else:
    print("ERROR: renderSalesCommission gate not found", file=sys.stderr)
    sys.exit(1)

# ---------------------------------------------------------------------------
# E. Free plan expense carve-out
# ---------------------------------------------------------------------------
old_acc = """function renderAccounting(params={}) {
  if(_accBasicOnly() && params.view && _ACC_BASIC_VIEWS.indexOf(params.view) < 0) params = {}
"""

new_acc = """function renderAccounting(params={}) {
  if(_accBasicOnly() && params.view && _ACC_BASIC_VIEWS.indexOf(params.view) < 0) {
    var _keepExp = (params.view === 'expense' || params.view === 'exp-form') && typeof canAccess === 'function' && canAccess('acc_expense')
    if(!_keepExp) params = {}
  }
"""

acc_slice = idx[idx.find("function renderAccounting"):idx.find("function renderAccounting") + 400] if "function renderAccounting" in idx else ""
if "_keepExp" in idx and "canAccess('acc_expense')" in acc_slice:
    print("renderAccounting already has Free expense carve-out")
elif old_acc in idx:
    idx = idx.replace(old_acc, new_acc, 1)
    print("patched renderAccounting Free-plan expense carve-out")
else:
    print("ERROR: renderAccounting Free strip not found", file=sys.stderr)
    sys.exit(1)

# ---------------------------------------------------------------------------
# D. openPage switch cases
# ---------------------------------------------------------------------------
old_case = """      case 'accounting': _safeRender(() => renderAccounting(params)); break
"""

new_case = """      case 'accounting': _safeRender(() => renderAccounting(params)); break
      case 'expense_claims':
        if(!canAccess('acc_expense')) { renderAccessDenied(); break }
        _safeRender(() => renderExpenseClaims(params && params.view ? params : Object.assign({}, params, {view:'expense'}))); break
      case 'achievements':
        if(!canAccess('sc_achievements')) { renderAccessDenied(); break }
        _safeRender(() => (typeof _scRenderAchievements === 'function' ? _scRenderAchievements() : renderSalesCommission(Object.assign({}, params, {view:'achievements'})))); break
"""

if "case 'expense_claims':" in idx and "case 'achievements':" in idx:
    print("openPage already has expense_claims + achievements cases")
elif old_case in idx:
    idx = idx.replace(old_case, new_case, 1)
    print("patched openPage switch -> expense_claims + achievements cases")
else:
    print("ERROR: openPage accounting case not found", file=sys.stderr)
    sys.exit(1)

# ---------------------------------------------------------------------------
# F. cache bust v8 -> v9
# ---------------------------------------------------------------------------
if "role-permissions-sync.js?v=9" in idx:
    print("index already v9")
elif "role-permissions-sync.js?v=8" in idx:
    idx = idx.replace("role-permissions-sync.js?v=8", "role-permissions-sync.js?v=9", 1)
    print("bumped index to v9")
else:
    print("ERROR: expected role-permissions-sync.js?v=8 in index.html", file=sys.stderr)
    sys.exit(1)

idx_path.write_text(idx, encoding="utf-8")
print("wrote index.html")
print("DONE v9 bake")
