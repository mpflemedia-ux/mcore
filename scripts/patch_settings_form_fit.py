#!/usr/bin/env python3
"""Bake settings-form-fit.js cache-bust ?v=3 into app/index.html (Sales-safe scope)."""
from pathlib import Path
import re

INDEX = Path('app/index.html')
html = INDEX.read_text(encoding='utf-8')
pat = re.compile(r'(settings-form-fit\.js\?v=)\d+')
if not pat.search(html):
    raise SystemExit('settings-form-fit.js tag not found in index.html')
new_html, n = pat.subn(r'\g<1>3', html, count=1)
if n != 1:
    raise SystemExit(f'expected 1 replacement, got {n}')
# Keep companion list in patch_invoice_customer if present
pci = Path('scripts/patch_invoice_customer.py')
if pci.exists():
    txt = pci.read_text(encoding='utf-8')
    txt2 = re.sub(
        r"\('settings-form-fit\.js',\s*'[^']*'\)",
        "('settings-form-fit.js', '3')",
        txt,
        count=1,
    )
    if txt2 != txt:
        pci.write_text(txt2, encoding='utf-8')
INDEX.write_text(new_html, encoding='utf-8')
print('baked settings-form-fit.js?v=3')
