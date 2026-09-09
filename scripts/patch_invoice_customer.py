#!/usr/bin/env python3
from pathlib import Path
import re
p = Path('app/index.html')
html = p.read_text(encoding='utf-8')
html2 = re.sub(r'pdoc-customer-lock\.js\?v=\d+', 'pdoc-customer-lock.js?v=7', html)
if html2 != html:
    p.write_text(html2, encoding='utf-8')
    print('bumped lock to v=7')
else:
    print('no bump target')
