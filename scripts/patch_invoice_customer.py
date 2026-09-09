#!/usr/bin/env python3
from pathlib import Path
p=Path('app/index.html')
html=p.read_text(encoding='utf-8')
if 'public-inv-scroll.js' not in html:
    html=html.replace('</head>','<script src="./public-inv-scroll.js?v=4"></script></head>',1)
    p.write_text(html,encoding='utf-8')
    print('injected scroll/redirect')
else:
    print('already')
