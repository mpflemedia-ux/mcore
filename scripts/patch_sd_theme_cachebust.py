#!/usr/bin/env python3
"""Bump wa-doc-core.js cache query in app/index.html after theme share ship."""
from pathlib import Path
p = Path('app/index.html')
t = p.read_text(encoding='utf-8')
old, new = 'wa-doc-core.js?v=3', 'wa-doc-core.js?v=4'
if old not in t:
    if new in t:
        print('already v=4')
    else:
        raise SystemExit('wa-doc-core.js?v=3 not found')
else:
    p.write_text(t.replace(old, new, 1), encoding='utf-8')
    print('bumped to v=4')
