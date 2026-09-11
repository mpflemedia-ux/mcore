#!/usr/bin/env python3
from pathlib import Path
import re
p=Path('app/index.html')
html=p.read_text(encoding='utf-8')
changed=False
if 'payslip-print-boot.js' not in html:
    html=html.replace('</body>','<script src="./payslip-print-boot.js?v=2"></script>\n</body>',1)
    changed=True
else:
    html2=re.sub(r'payslip-print-boot\.js\?v=\d+','payslip-print-boot.js?v=2',html)
    if html2!=html:
        html=html2
        changed=True
if changed:
    p.write_text(html,encoding='utf-8')
    print('patched')
else:
    print('already')
