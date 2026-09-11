#!/usr/bin/env python3
from pathlib import Path
p=Path('app/index.html')
html=p.read_text(encoding='utf-8')
if 'public-apply-bank.js' not in html:
    needle='public-apply.js'
    if needle in html:
        html=html.replace('</body>','<script src="./public-apply-bank.js?v=1"></script>\n</body>',1)
    else:
        html=html.replace('</body>','<script src="./public-apply.js?v=2"></script>\n<script src="./public-apply-bank.js?v=1"></script>\n</body>',1)
    p.write_text(html,encoding='utf-8')
    print('injected bank script')
else:
    print('already')
