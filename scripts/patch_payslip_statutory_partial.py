#!/usr/bin/env python3
"""Bake: assemble payslip overlay a/b from chunks, inject a+b+loader, sync v10."""
from pathlib import Path
import sys

root = Path(__file__).resolve().parents[1]
scripts = Path(__file__).resolve().parent

def assemble(chunk_dir_name, out_name):
    d = scripts / chunk_dir_name
    if not d.is_dir():
        print("ERROR: missing", d, file=sys.stderr); sys.exit(1)
    text = "".join(p.read_text() for p in sorted(d.glob("*.txt")))
    (root / "app" / out_name).write_text(text, encoding="utf-8")
    print("assembled", out_name, len(text))

assemble("_psp_a_chunks", "payslip-statutory-partial-a.js")
assemble("_psp_b_chunks", "payslip-statutory-partial-b.js")

loader = root / "app" / "payslip-statutory-partial.js"
_loader_txt = loader.read_text(encoding="utf-8") if loader.is_file() else ""
if not loader.is_file() or ("PAYSLIP_STATUTORY_PARTIAL_V2" not in _loader_txt and "PAYSLIP_STATUTORY_PARTIAL_V1" not in _loader_txt):
    print("ERROR: missing loader", file=sys.stderr); sys.exit(1)

idx_p = root / "app" / "index.html"
text = idx_p.read_text(encoding="utf-8")
changed = False
tags = [
  '<script src="./payslip-statutory-partial-a.js?v=2"></script>',
  '<script src="./payslip-statutory-partial-b.js?v=2"></script>',
  '<script src="./payslip-statutory-partial.js?v=2"></script>',
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

# Cache-bust overlay to v2 (dedupe Payment/Balance fix)
for name in ("payslip-statutory-partial-a.js", "payslip-statutory-partial-b.js", "payslip-statutory-partial.js"):
  old_tag = f'<script src="./{name}?v=1"></script>'
  new_tag = f'<script src="./{name}?v=2"></script>'
  if old_tag in text:
    text = text.replace(old_tag, new_tag, 1)
    changed = True
    print("bumped", name, "v1->v2")

if changed:
  idx_p.write_text(text, encoding="utf-8"); print("wrote index.html")
else:
  print("no index.html change")
