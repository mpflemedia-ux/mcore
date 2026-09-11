#!/usr/bin/env python3
from pathlib import Path
p = Path('app/index.html')
html = p.read_text(encoding='utf-8')
changed = False
old_css = '.pdoc-band-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px 24px; margin-top:10px; }'
new_css = '.pdoc-band-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px 24px; margin-top:10px; align-items:start; }\n.pdoc-band-right { text-align:right; }\n.pdoc-band-right .pdoc-band-item b { display:block; }'
if old_css in html and '.pdoc-band-right {' not in html:
    html = html.replace(old_css, new_css, 1)
    changed = True
if 'payslip-band-align.js' not in html:
    html = html.replace('</body>', '<script src="./payslip-band-align.js?v=1"></script>\n</body>', 1)
    changed = True
if changed:
    p.write_text(html, encoding='utf-8')
    print('patched')
else:
    print('already')
