#!/usr/bin/env python3
import re
from pathlib import Path
p = Path('app/index.html')
html = p.read_text(encoding='utf-8')
if 'title-case-inputs.js' not in html:
    html = html.replace('</body>', '<script src="./title-case-inputs.js?v=2"></script>\n</body>', 1)
elif 'title-case-inputs.js?v=2' not in html:
    html = re.sub(r'title-case-inputs\.js\?v=\d+', 'title-case-inputs.js?v=2', html)
else:
    print('v2 already')
    raise SystemExit
p.write_text(html, encoding='utf-8')
print('title-case script v2')
