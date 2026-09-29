#!/usr/bin/env python3
"""Bake payslip statutory/partial: inject overlay script tag + sync v10 bust. Idempotent."""
from pathlib import Path
import sys

root = Path(__file__).resolve().parents[1]
js_name = "payslip-statutory-partial.js"
js_p = root / "app" / js_name
marker = "PAYSLIP_STATUTORY_PARTIAL_V1"

if not js_p.is_file():
    print("ERROR: missing", js_p, file=sys.stderr)
    sys.exit(1)
if marker not in js_p.read_text(encoding="utf-8"):
    print("ERROR: overlay missing marker", marker, file=sys.stderr)
    sys.exit(1)

idx_p = root / "app" / "index.html"
tag = f'<script src="./{js_name}?v=1"></script>'
text = idx_p.read_text(encoding="utf-8")
changed = False

if tag in text or f"./{js_name}?" in text:
    print("script tag already present")
else:
    anchor = '<script src="./payslip-scroll.js?v=1"></script>'
    if anchor not in text:
        anchor = '<script src="./sd-employer-edit.js?v=6"></script>'
    if anchor not in text:
        print("ERROR: no inject anchor", file=sys.stderr)
        sys.exit(1)
    text = text.replace(anchor, anchor + "\n" + tag, 1)
    changed = True
    print("injected", js_name)

if "role-permissions-sync.js?v=10" in text:
    print("sync already v10")
elif "role-permissions-sync.js?v=9" in text:
    text = text.replace("role-permissions-sync.js?v=9", "role-permissions-sync.js?v=10", 1)
    changed = True
    print("bumped role-permissions-sync.js?v=9 → v=10")
else:
    print("WARN: unexpected sync cache bust tag")

if changed:
    idx_p.write_text(text, encoding="utf-8")
    print("wrote index.html")
else:
    print("no index.html change")
