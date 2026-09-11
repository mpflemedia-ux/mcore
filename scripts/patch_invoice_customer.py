#!/usr/bin/env python3
from pathlib import Path
import re
p = Path('app/index.html')
html = p.read_text(encoding='utf-8')
if 'sd-print-batch.js' not in html:
    html = html.replace('</body>', '<script src="./sd-print-batch.js?v=2"></script>\n</body>', 1)
else:
    html = re.sub(r'sd-print-batch\.js\?v=\d+', 'sd-print-batch.js?v=2', html)
p.write_text(html, encoding='utf-8')
print('ok')
