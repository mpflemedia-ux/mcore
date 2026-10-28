#!/usr/bin/env python3
"""Bump notif-live.js cache query on index.html (idempotent). Never push full index via API."""
from pathlib import Path
import sys
ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / 'app' / 'index.html'
OLD = 'notif-live.js?v=4'
NEW = 'notif-live.js?v=5'
def main():
    if not INDEX.exists():
        print('ERROR: missing', INDEX, file=sys.stderr); sys.exit(1)
    html = INDEX.read_text(encoding='utf-8')
    if NEW in html:
        print('already v=5'); return
    if OLD not in html:
        print('ERROR: expected', OLD, 'not found', file=sys.stderr); sys.exit(1)
    INDEX.write_text(html.replace(OLD, NEW, 1), encoding='utf-8')
    print('bumped', OLD, '->', NEW)
if __name__ == '__main__':
    main()
