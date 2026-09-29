#!/usr/bin/env python3
"""Bake: inject payslip-statutory-partial.js + sync v10. JS is self-contained (zlib loader)."""
from pathlib import Path
import sys
root = Path(__file__).resolve().parents[1]
js_name = "payslip-statutory-partial.js"
js_p = root / "app" / js_name
marker = "PAYSLIP_STATUTORY_PARTIAL_V1"
if not js_p.is_file() or marker not in js_p.read_text(encoding="utf-8"):
    print("ERROR: missing overlay", file=sys.stderr); sys.exit(1)
idx_p = root / "app" / "index.html"
tag = f'<script src="./{js_name}?v=1"></script>'
text = idx_p.read_text(encoding="utf-8")
changed = False
if f"./{js_name}?" not in text:
    anchor = '<script src="./payslip-scroll.js?v=1"></script>'
    if anchor not in text:
        anchor = '<script src="./sd-employer-edit.js?v=6"></script>'
    if anchor not in text:
        print("ERROR: no inject anchor", file=sys.stderr); sys.exit(1)
    text = text.replace(anchor, anchor + "\n" + tag, 1)
    changed = True
    print("injected")
else:
    print("script tag already present")
if "role-permissions-sync.js?v=10" not in text and "role-permissions-sync.js?v=9" in text:
    text = text.replace("role-permissions-sync.js?v=9", "role-permissions-sync.js?v=10", 1)
    changed = True
    print("bumped sync v10")
if changed:
    idx_p.write_text(text, encoding="utf-8"); print("wrote index.html")
else:
    print("no index.html change")
