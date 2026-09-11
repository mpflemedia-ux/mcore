#!/usr/bin/env python3
from pathlib import Path
import re
p=Path('app/index.html')
html=p.read_text(encoding='utf-8')
html=re.sub(r'sd-print-batch\.js\?v=\d+','sd-print-batch.js?v=3',html)
p.write_text(html,encoding='utf-8')
print('ok')
