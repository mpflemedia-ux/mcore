#!/usr/bin/env python3
"""Add the svc-commission.js (part-time service commission payroll) script tag to app/index.html and keep its ?v= current (idempotent). Never push full index via API."""
from pathlib import Path
import re
import sys
ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / 'app' / 'index.html'
VER = '6'  # svc-commission.js v6: AI "Import from doc" (Excel/CSV/PDF/photo -> ai-proxy doc_to_svc_logs -> Paste CSV box); v5: Buat PV full part-time pay + Bayar via PV skip SD (svc_commission_04.sql)
DK_VER = 5  # dk-doc.js v5: drawn signature images in sig boxes + PDF (v4: totals labels wrap); only ever bumped up
TAG = '<script src="./svc-commission.js?v=%s"></script>' % VER
ANCHOR = re.compile(r'<script src="\./hr-import\.js\?v=\d+"></script>')
def bump_dk(html):
    def up(mo):
        return mo.group(1) + '?v=' + str(max(int(mo.group(2)), DK_VER))
    return re.sub(r'(\./dk-doc\.js)\?v=(\d+)', up, html)
def main():
    if not INDEX.exists():
        print('ERROR: missing', INDEX, file=sys.stderr); sys.exit(1)
    orig = INDEX.read_text(encoding='utf-8')
    html = bump_dk(orig)
    if html != orig:
        INDEX.write_text(html, encoding='utf-8'); print('bumped dk-doc.js to v=%s' % DK_VER)
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
