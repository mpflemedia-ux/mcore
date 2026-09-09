#!/usr/bin/env python3
from pathlib import Path
p = Path('app/index.html')
html = p.read_text(encoding='utf-8')
if 'title-case-inputs.js' not in html:
    html = html.replace('</body>', '<script src="./title-case-inputs.js?v=1"></script>\n</body>', 1)
    p.write_text(html, encoding='utf-8')
    print('added title-case script')
else:
    print('already present')
