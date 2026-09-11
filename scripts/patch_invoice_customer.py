#!/usr/bin/env python3
from pathlib import Path
p = Path('app/index.html')
html = p.read_text(encoding='utf-8')
changed = False
if 'public-apply-scroll.js' not in html:
    html = html.replace('</head>', '<script src="./public-apply-scroll.js?v=1"></script></head>', 1)
    changed = True
if 'public-apply.js' not in html:
    html = html.replace('</body>', '<script src="./public-apply.js?v=2"></script>\n</body>', 1)
    changed = True
elif 'public-apply.js?v=' in html and 'public-apply.js?v=2' not in html:
    import re
    html = re.sub(r'public-apply\.js\?v=\d+', 'public-apply.js?v=2', html)
    changed = True
if changed:
    p.write_text(html, encoding='utf-8')
    print('patched index')
else:
    print('no change')
