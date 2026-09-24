#!/usr/bin/env python3
"""Bake: align modsNow with canAccess role-key resolution; bump sync ?v=7 → ?v=8."""
from pathlib import Path
import sys

root = Path(__file__).resolve().parents[1]
sync = root / "app" / "role-permissions-sync.js"
idx = root / "app" / "index.html"

text = sync.read_text(encoding="utf-8")
itext = idx.read_text(encoding="utf-8")

# Idempotent: already baked?
if "Same effective module list canAccess uses" in text and "role-permissions-sync.js?v=8" in itext:
    print("already has modsNow canAccess alignment + index v8")
    sys.exit(0)

old_h = "/* Role permission breakdown by live workflow. Least-privilege: no child\u2192parent elevation. Child nav: expense+achievements; lexical NAV_ITEMS via navItemsList (v7). */"
new_h = "/* Role permission breakdown by live workflow. Least-privilege: no child\u2192parent elevation. Child nav: expense+achievements; modsNow mirrors canAccess role-key resolve (v8). */"
if old_h in text:
    text = text.replace(old_h, new_h, 1)
elif "modsNow mirrors canAccess" not in text:
    print("WARN: unexpected sync header", file=sys.stderr)

old_mods = """  function modsNow() {
    try { return (typeof _rpModulesForCurrentUser === 'function') ? _rpModulesForCurrentUser() : []; }
    catch (e) { return []; }
  }
"""

new_mods = """  /**
   * Same effective module list canAccess uses for the current user.
   * Mirrors: module_override \u2192 rolesMap[role]|rolesMap[roleKey] \u2192 case-insensitive
   * key find \u2192 hasCustom empty vs defaults. Do NOT use exact-only _rpModulesForCurrentUser
   * (that falls back to _DEFAULT_ROLE_MODULES.staff and drops Settings ticks under
   * differently-cased / underscored role keys). No child\u2192parent elevation here.
   */
  function modsNow() {
    try {
      var role = '';
      try {
        role = (typeof APP !== 'undefined' && APP.user && APP.user.role)
          ? String(APP.user.role).toLowerCase().trim() : '';
      } catch (e0) {}
      if (role === 'owner' || role === 'admin' || role === 'platform_admin') {
        try {
          if (typeof RP_MODULES !== 'undefined' && Array.isArray(RP_MODULES)) {
            return RP_MODULES.map(function (m) { return (m && m.id) ? String(m.id) : String(m); });
          }
        } catch (eOwn) {}
        return [];
      }
      var ov = null;
      try { ov = (typeof APP !== 'undefined' && APP.user) ? APP.user.module_override : null; } catch (e1) {}
      if (Array.isArray(ov)) return ov.map(String);
      var rolesMap = {};
      try {
        rolesMap = (typeof APP !== 'undefined' && APP.tenantConfig && APP.tenantConfig.roles) || {};
      } catch (e2) {}
      var roleKey = role.replace(/\\s+/g, '_');
      var hasCustom = Object.keys(rolesMap).length > 0;
      var configured = rolesMap[role] || rolesMap[roleKey];
      if (!Array.isArray(configured)) {
        var found = Object.keys(rolesMap).find(function (k) {
          return String(k).toLowerCase() === role || String(k).toLowerCase() === roleKey;
        });
        if (found) configured = rolesMap[found];
      }
      if (Array.isArray(configured)) return configured.map(String);
      if (hasCustom) return [];
      var fallback = [];
      try {
        if (typeof _DEFAULT_ROLE_MODULES !== 'undefined') {
          fallback = _DEFAULT_ROLE_MODULES[roleKey] || _DEFAULT_ROLE_MODULES[role] || [];
        }
        if ((!fallback || !fallback.length) && typeof RP_ROLE_DEFAULTS !== 'undefined') {
          fallback = RP_ROLE_DEFAULTS[roleKey] || RP_ROLE_DEFAULTS[role] || [];
        }
      } catch (e3) {}
      return Array.isArray(fallback) ? fallback.map(String) : [];
    } catch (e) { return []; }
  }
"""

if "Same effective module list canAccess uses" in text:
    print("sync.js already has aligned modsNow")
elif old_mods not in text:
    print("ERROR: old modsNow block not found", file=sys.stderr)
    sys.exit(1)
else:
    text = text.replace(old_mods, new_mods, 1)
    print("patched modsNow \u2192 canAccess role-key alignment")

old_gate = """  function openChildPage(pageId, parentModule, childModule, renderFn, viewKey, params) {
    params = params || {};
    if (!allow(parentModule, childModule)) {
      if (typeof renderAccessDenied === 'function') renderAccessDenied();
      return;
    }
"""

new_gate = """  function openChildPage(pageId, parentModule, childModule, renderFn, viewKey, params) {
    params = params || {};
    /* Prefer canAccess(child) (same path as sidebar) OR allow() after modsNow alignment. */
    if (!(
      (typeof canAccess === 'function' && childModule && canAccess(childModule)) ||
      allow(parentModule, childModule)
    )) {
      if (typeof renderAccessDenied === 'function') renderAccessDenied();
      return;
    }
"""

if "(typeof canAccess === 'function' && childModule && canAccess(childModule))" in text:
    print("openChildPage already hardened with canAccess OR allow")
elif old_gate in text:
    text = text.replace(old_gate, new_gate, 1)
    print("patched openChildPage gate \u2192 canAccess OR allow")
else:
    print("WARN: openChildPage gate not found", file=sys.stderr)

sync.write_text(text, encoding="utf-8")
print("wrote role-permissions-sync.js")

old = "role-permissions-sync.js?v=7"
new = "role-permissions-sync.js?v=8"
if old in itext:
    idx.write_text(itext.replace(old, new, 1), encoding="utf-8")
    print("bumped index to v8")
elif new in itext:
    print("index already v8")
else:
    print("ERROR: expected", old, "in index.html", file=sys.stderr)
    sys.exit(1)
