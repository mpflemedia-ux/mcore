#!/usr/bin/env python3
"""Add FFM connector script tags to app/index.html and keep their ?v= cache-bust current (idempotent). Never push full index via API."""
from pathlib import Path
import re
import sys
ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / 'app' / 'index.html'
VER = '9'  # FFM: stock refresh skips rejected barcodes (named), honest Synced (goods/list check), stock notes on Products
ANCHOR = '<script src="./booking-notif-set.js?v=1"></script>'
TAGS = ''.join('\n<script src="./%s?v=%s"></script>' % (f, VER) for f in ('ffm-core.js', 'ffm-hub.js', 'ffm-do.js', 'ffm-po.js'))
def main():
    if not INDEX.exists():
        print('ERROR: missing', INDEX, file=sys.stderr); sys.exit(1)
    html = INDEX.read_text(encoding='utf-8')
    if 'ffm-core.js?v=' in html:
        new = re.sub(r'(\./ffm-(?:core|hub|do|po)\.js)\?v=\d+', r'\g<1>?v=' + VER, html)
        if new == html:
            print('already patched (v=%s)' % VER); return
        INDEX.write_text(new, encoding='utf-8'); print('bumped FFM script tags to v=%s' % VER); return
    if html.count(ANCHOR) != 1:
        print('ERROR: anchor not found exactly once', file=sys.stderr); sys.exit(1)
    INDEX.write_text(html.replace(ANCHOR, ANCHOR + TAGS, 1), encoding='utf-8')
    print('added FFM script tags')
if __name__ == '__main__':
    main()
