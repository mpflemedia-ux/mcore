#!/usr/bin/env python3
from pathlib import Path
p = Path('app/index.html')
html = p.read_text(encoding='utf-8')
changed = False
if 'pdoc-invoice-terms.js' not in html:
    html = html.replace('</body>', '<script src="./pdoc-invoice-terms.js?v=6"></script>\n</body>', 1)
    changed = True
    print('added terms script')
elif 'pdoc-invoice-terms.js?v=6' not in html:
    import re
    html2 = re.sub(r'pdoc-invoice-terms\.js\?v=\d+', 'pdoc-invoice-terms.js?v=6', html)
    if html2 != html:
        html = html2
        changed = True
        print('bumped terms script')
if changed:
    p.write_text(html, encoding='utf-8')
    print('wrote', p.stat().st_size)
else:
    print('no change')
