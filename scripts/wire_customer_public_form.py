#!/usr/bin/env python3
"""Insert customer-public-form.js script tag into app/index.html (large-file safe)."""
from pathlib import Path
import re

p = Path('app/index.html')
html = p.read_text(encoding='utf-8')
name = 'customer-public-form.js'
ver = '1'
tag = f'<script src="./{name}?v={ver}"></script>'

if name in html:
    html2 = re.sub(re.escape(name) + r'\?v=\d+', f'{name}?v={ver}', html)
    if html2 == html:
        print('already wired')
    else:
        p.write_text(html2, encoding='utf-8')
        print('bumped version')
else:
    needle = '<script src="./crm-scan.js?v=1"></script>'
    if needle in html:
        html = html.replace(needle, needle + '\n' + tag, 1)
    else:
        html = html.replace('</body>', tag + '\n</body>', 1)
    p.write_text(html, encoding='utf-8')
    print('wired')
