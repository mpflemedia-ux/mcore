#!/usr/bin/env python3
"""Add FFM connector script tags to app/index.html (idempotent). Never push full index via API."""
from pathlib import Path
import sys
ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / 'app' / 'index.html'
ANCHOR = '<script src="./booking-notif-set.js?v=1"></script>'
TAGS = ''.join('\n<script src="./%s?v=1"></script>' % f for f in ('ffm-core.js', 'ffm-hub.js', 'ffm-do.js', 'ffm-po.js'))
def main():
    if not INDEX.exists():
        print('ERROR: missing', INDEX, file=sys.stderr); sys.exit(1)
    html = INDEX.read_text(encoding='utf-8')
    if 'ffm-core.js?v=' in html:
        print('already patched'); return
    if html.count(ANCHOR) != 1:
        print('ERROR: anchor not found exactly once', file=sys.stderr); sys.exit(1)
    INDEX.write_text(html.replace(ANCHOR, ANCHOR + TAGS, 1), encoding='utf-8')
    print('added FFM script tags')
if __name__ == '__main__':
    main()
