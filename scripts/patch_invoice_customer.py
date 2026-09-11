#!/usr/bin/env python3
from pathlib import Path
p = Path('app/index.html')
html = p.read_text(encoding='utf-8')
if 'sd-print-batch.js' not in html:
    html = html.replace('</body>', '<script src="./sd-print-batch.js?v=1"></script>\n</body>', 1)
    p.write_text(html, encoding='utf-8')
    print('injected')
else:
    print('already')
