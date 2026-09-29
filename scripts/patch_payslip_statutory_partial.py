#!/usr/bin/env python3
"""Bake payslip statutory exempt + partial payment overlay into app/index.html.
Idempotent. Also bumps expense sync cache bust v9→v10 if still on v9 (PR #789 bake miss).
"""
from pathlib import Path
import sys

root = Path(__file__).resolve().parents[1]
idx_p = root / "app" / "index.html"
js_name = "payslip-statutory-partial.js"
tag = f'<script src="./{js_name}?v=1"></script>'
marker = "PAYSLIP_STATUTORY_PARTIAL_V1"

text = idx_p.read_text(encoding="utf-8")
changed = False

# 1) Inject overlay after payslip-scroll.js (or after sd-employer-edit)
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

# 2) Expense v10 cache bust (secondary — bake missed after #789)
if "role-permissions-sync.js?v=10" in text:
    print("sync already v10")
elif "role-permissions-sync.js?v=9" in text:
    text = text.replace("role-permissions-sync.js?v=9", "role-permissions-sync.js?v=10", 1)
    changed = True
    print("bumped role-permissions-sync.js?v=9 → v=10")
else:
    print("WARN: unexpected sync cache bust tag")

# 3) Ensure overlay file exists
js_p = root / "app" / js_name
if not js_p.is_file():
    print("ERROR: missing", js_p, file=sys.stderr)
    sys.exit(1)
if marker not in js_p.read_text(encoding="utf-8"):
    print("ERROR: overlay missing marker", marker, file=sys.stderr)
    sys.exit(1)

if changed:
    idx_p.write_text(text, encoding="utf-8")
    print("wrote index.html")
else:
    print("no index.html change")
