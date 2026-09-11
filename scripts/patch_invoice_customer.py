#!/usr/bin/env python3
from pathlib import Path
import re
p=Path('app/index.html')
html=p.read_text(encoding='utf-8')
changed=False
if 'pdoc-invoice-terms.js' not in html:
    html=html.replace('</body>','<script src="./pdoc-invoice-terms.js?v=8"></script>\n</body>',1)
    changed=True
else:
    html2=re.sub(r'pdoc-invoice-terms\.js\?v=\d+','pdoc-invoice-terms.js?v=8',html)
    if html2!=html:
        html=html2
        changed=True
if 'public-apply-bank.js' not in html:
    html=html.replace('</body>','<script src="./public-apply-bank.js?v=1"></script>\n</body>',1)
    changed=True
if changed:
    p.write_text(html,encoding='utf-8')
    print('patched')
else:
    print('already')
