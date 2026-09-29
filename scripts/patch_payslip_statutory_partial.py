#!/usr/bin/env python3
"""Bake payslip statutory/partial: assemble JS from b64v2, inject script, sync v10."""
from pathlib import Path
import base64, sys

root = Path(__file__).resolve().parents[1]
js_name = "payslip-statutory-partial.js"
js_p = root / "app" / js_name
marker = "PAYSLIP_STATUTORY_PARTIAL_V1"
b64_dir = Path(__file__).resolve().parent / "_payslip_partial_b64v2"

if not b64_dir.is_dir():
    print("ERROR: missing", b64_dir, file=sys.stderr)
    sys.exit(1)
b64 = "".join(p.read_text() for p in sorted(b64_dir.glob("*.b64")))
code = base64.b64decode(b64).decode("utf-8")
if marker not in code:
    print("ERROR: assembled overlay missing marker", file=sys.stderr)
    sys.exit(1)
js_p.write_text(code, encoding="utf-8")
print("wrote", js_name, len(code), "bytes")

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
    print("bumped sync v10")
if changed:
    idx_p.write_text(text, encoding="utf-8")
    print("wrote index.html")
else:
    print("no index.html change")
