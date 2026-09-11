#!/usr/bin/env python3
from pathlib import Path
import re
p = Path('app/index.html')
html = p.read_text(encoding='utf-8')
changed = False
if 'payslip-statement.js' not in html:
    html = html.replace('</body>', '<script src="./payslip-statement.js?v=3"></script>\n</body>', 1)
    changed = True
else:
    html2 = re.sub(r'payslip-statement\.js\?v=\d+', 'payslip-statement.js?v=3', html)
    if html2 != html:
        html = html2
        changed = True
if changed:
    p.write_text(html, encoding='utf-8')
    print('patched')
else:
    print('already')
