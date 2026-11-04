#!/usr/bin/env python3
"""Add the svc-commission.js (part-time service commission payroll) script tag to app/index.html and keep its ?v= current (idempotent). Never push full index via API."""
from pathlib import Path
import re
import sys
ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / 'app' / 'index.html'
VER = '1'  # svc-commission.js: Service Log + payslip lines (Gaji asas / Komisen servis / Komisen produk / Bonus)
TAG = '<script src="./svc-commission.js?v=%s"></script>' % VER
ANCHOR = re.compile(r'<script src="\./hr-import\.js\?v=\d+"></script>')
def main():
    if not INDEX.exists():
        print('ERROR: missing', INDEX, file=sys.stderr); sys.exit(1)
    html = INDEX.read_text(encoding='utf-8')
    if 'svc-commission.js?v=' in html:
        new = re.sub(r'(\./svc-commission\.js)\?v=\d+', r'\g<1>?v=' + VER, html)
        if new == html:
            print('already patched (v=%s)' % VER); return
        INDEX.write_text(new, encoding='utf-8'); print('bumped svc-commission.js to v=%s' % VER); return
    hits = ANCHOR.findall(html)
    if len(hits) == 1:
        new = html.replace(hits[0], hits[0] + '\n' + TAG, 1)
    elif html.count('</body>') == 1:
        new = html.replace('</body>', TAG + '\n</body>', 1)
    else:
        print('ERROR: no unique anchor', file=sys.stderr); sys.exit(1)
    INDEX.write_text(new, encoding='utf-8')
    print('added svc-commission.js?v=%s' % VER)
if __name__ == '__main__':
    main()
