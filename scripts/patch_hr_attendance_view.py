#!/usr/bin/env python3
"""Bump role-permissions-sync cache after HR attendance VIEW map fix."""
from pathlib import Path
import sys
root = Path(__file__).resolve().parents[1]
idx = root / "app" / "index.html"
text = idx.read_text(encoding="utf-8")
old = "role-permissions-sync.js?v=4"
new = "role-permissions-sync.js?v=5"
if old not in text:
    if new in text:
        print("already v5")
        sys.exit(0)
    print("ERROR: expected", old, file=sys.stderr)
    sys.exit(1)
idx.write_text(text.replace(old, new, 1), encoding="utf-8")
print("bumped to v5")
