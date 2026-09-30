#!/usr/bin/env python3
"""Bump sd-table-fit.js cache-bust to v=10 in app/index.html. Idempotent."""
from pathlib import Path
import re

p = Path('app/index.html')
html = p.read_text(encoding='utf-8')
pat = re.compile(r'(sd-table-fit\.js\?v=)\d+')
if 'sd-table-fit.js?v=10' in html:
    print('already v=10')
    raise SystemExit(0)
if not pat.search(html):
    tag = '<script src="./sd-table-fit.js?v=10"></script>\n'
    if '</body>' not in html:
        raise SystemExit('no sd-table-fit tag and no </body>')
    html = html.replace('</body>', tag + '</body>', 1)
else:
    html = pat.sub(r'\g<1>10', html, count=1)
p.write_text(html, encoding='utf-8')
print('bumped sd-table-fit.js to v=10')
