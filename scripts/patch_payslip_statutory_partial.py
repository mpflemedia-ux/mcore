#!/usr/bin/env python3
"""Bake: inject payslip overlay parts a+b+loader + sync v10."""
from pathlib import Path
import sys
root = Path(__file__).resolve().parents[1]
for name, marker in [
  ("payslip-statutory-partial-a.js", None),
  ("payslip-statutory-partial-b.js", None),
  ("payslip-statutory-partial.js", "PAYSLIP_STATUTORY_PARTIAL_V1"),
]:
  p = root / "app" / name
  if not p.is_file():
    print("ERROR: missing", p, file=sys.stderr); sys.exit(1)
  if marker and marker not in p.read_text(encoding="utf-8"):
    print("ERROR: marker missing in", name, file=sys.stderr); sys.exit(1)
idx_p = root / "app" / "index.html"
text = idx_p.read_text(encoding="utf-8")
changed = False
tags = [
  '<script src="./payslip-statutory-partial-a.js?v=1"></script>',
  '<script src="./payslip-statutory-partial-b.js?v=1"></script>',
  '<script src="./payslip-statutory-partial.js?v=1"></script>',
]
anchor = '<script src="./payslip-scroll.js?v=1"></script>'
if anchor not in text:
  anchor = '<script src="./sd-employer-edit.js?v=6"></script>'
if anchor not in text:
  print("ERROR: no inject anchor", file=sys.stderr); sys.exit(1)
block = "\n".join(tags)
if "payslip-statutory-partial-a.js" not in text:
  text = text.replace(anchor, anchor + "\n" + block, 1)
  changed = True
  print("injected a+b+loader")
else:
  print("script tags already present")
if "role-permissions-sync.js?v=10" not in text and "role-permissions-sync.js?v=9" in text:
  text = text.replace("role-permissions-sync.js?v=9", "role-permissions-sync.js?v=10", 1)
  changed = True
  print("bumped sync v10")
if changed:
  idx_p.write_text(text, encoding="utf-8"); print("wrote index.html")
else:
  print("no index.html change")
