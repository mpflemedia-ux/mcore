#!/usr/bin/env python3
"""Bake payslip-accum-outstanding.js script tag into app/index.html (cache-bust v=1)."""
from pathlib import Path
import sys

root = Path(__file__).resolve().parents[1]
ov = root / "app" / "payslip-accum-outstanding.js"
if not ov.is_file() or "PAYSLIP_ACCUM_OUTSTANDING_V1" not in ov.read_text(encoding="utf-8"):
    print("ERROR: missing app/payslip-accum-outstanding.js", file=sys.stderr)
    sys.exit(1)

idx_p = root / "app" / "index.html"
text = idx_p.read_text(encoding="utf-8")
tag = '<script src="./payslip-accum-outstanding.js?v=1"></script>'
changed = False

if "payslip-accum-outstanding.js" not in text:
    anchors = [
        '<script src="./payslip-pay-date.js?v=1"></script>',
        '<script src="./payslip-statutory-partial.js?v=2"></script>',
        '<script src="./payslip-statutory-partial.js?v=1"></script>',
        '<script src="./payslip-scroll.js?v=1"></script>',
    ]
    injected = False
    for a in anchors:
        if a in text:
            text = text.replace(a, a + "\n" + tag, 1)
            injected = True
            changed = True
            print("injected after", a)
            break
    if not injected:
        print("ERROR: no inject anchor", file=sys.stderr)
        sys.exit(1)
else:
    print("script tag already present")

if changed:
    idx_p.write_text(text, encoding="utf-8")
    print("wrote index.html")
else:
    print("no index.html change")
