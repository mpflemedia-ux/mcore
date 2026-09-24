#!/usr/bin/env python3
"""Bake: resolve NAV_ITEMS via lexical const (not window); bump sync ?v=6 → ?v=7."""
from pathlib import Path
import sys

root = Path(__file__).resolve().parents[1]
sync = root / "app" / "role-permissions-sync.js"
idx = root / "app" / "index.html"

text = sync.read_text(encoding="utf-8")

# Idempotent: already baked?
if "function navItemsList()" in text and "role-permissions-sync.js?v=7" in idx.read_text(encoding="utf-8"):
    print("already has navItemsList + index v7")
    sys.exit(0)

old_h = "/* Role permission breakdown by live workflow. Least-privilege: no child\u2192parent elevation. Child nav: expense+achievements; rebuild sidebar on boot (v6). */"
new_h = "/* Role permission breakdown by live workflow. Least-privilege: no child\u2192parent elevation. Child nav: expense+achievements; lexical NAV_ITEMS via navItemsList (v7). */"
if old_h in text:
    text = text.replace(old_h, new_h, 1)
elif "navItemsList (v7)" not in text and "lexical NAV_ITEMS" not in text:
    print("WARN: unexpected sync header", file=sys.stderr)

old_insert = """  function insertNavAfter(afterId, item) {
    if (!window.NAV_ITEMS || !Array.isArray(window.NAV_ITEMS)) return;
    if (window.NAV_ITEMS.some(function (n) { return n && n.id === item.id; })) return;
    var idx = -1;
    for (var i = 0; i < NAV_ITEMS.length; i++) {
      if (NAV_ITEMS[i] && NAV_ITEMS[i].id === afterId) { idx = i; break; }
    }
    if (idx >= 0) NAV_ITEMS.splice(idx + 1, 0, item);
    else NAV_ITEMS.push(item);
  }
"""

new_insert = """  /** Classic scripts share lexical const NAV_ITEMS; it is NOT on window. Prefer bare NAV_ITEMS. */
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
"""

if "function navItemsList()" in text:
    print("sync.js already has navItemsList")
elif old_insert not in text:
    print("ERROR: insertNavAfter block not found", file=sys.stderr)
    sys.exit(1)
else:
    text = text.replace(old_insert, new_insert, 1)
    print("patched insertNavAfter \u2192 navItemsList")

old_find = "      var item = (window.NAV_ITEMS || []).find(function (n) { return n && n.id === pageId; });"
new_find = "      var _navList = navItemsList() || [];\n      var item = _navList.find(function (n) { return n && n.id === pageId; });"
if old_find in text:
    text = text.replace(old_find, new_find, 1)
    print("patched openChildPage NAV_ITEMS lookup")
elif "navItemsList() || []" in text:
    print("openChildPage already uses navItemsList")
else:
    print("WARN: openChildPage NAV_ITEMS find not found", file=sys.stderr)

old_boot = """  function boot() {
    ensureChildNavs();
"""
new_boot = """  function boot() {
    try { if (typeof NAV_ITEMS !== 'undefined') window.NAV_ITEMS = NAV_ITEMS; } catch (eNav) {}
    ensureChildNavs();
"""
if "window.NAV_ITEMS = NAV_ITEMS" in text:
    print("boot already mirrors NAV_ITEMS to window")
elif old_boot in text:
    text = text.replace(old_boot, new_boot, 1)
    print("patched boot to mirror lexical NAV_ITEMS \u2192 window")
else:
    print("WARN: boot ensureChildNavs start not found", file=sys.stderr)

sync.write_text(text, encoding="utf-8")
print("wrote role-permissions-sync.js")

# Bump index cache bust
itext = idx.read_text(encoding="utf-8")
old = "role-permissions-sync.js?v=6"
new = "role-permissions-sync.js?v=7"
if old in itext:
    idx.write_text(itext.replace(old, new, 1), encoding="utf-8")
    print("bumped index to v7")
elif new in itext:
    print("index already v7")
else:
    print("ERROR: expected", old, "in index.html", file=sys.stderr)
    sys.exit(1)
