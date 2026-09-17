#!/usr/bin/env python3
from pathlib import Path
import re
p = Path('app/index.html')
html = p.read_text(encoding='utf-8')
SCRIPTS = [
    ('employee-nickname.js', '3'),
    ('sales-commission-edit.js', '1'),
    ('sales-achievements-edit.js', '1'),
    ('dashboard-ai-layout.js', '1'),
    ('pv-bank-account.js', '1'),
    ('print-hide-fabs.js', '1'),
    ('role-permissions-sync.js', '3'),
    ('booking.js', '1'),
    ('booking-shortcut.js', '1'),
    ('booking-token-fix.js', '1'),
    ('booking-public-contrast.js', '1'),
    ('pdoc-invoice-terms.js', '4'),
    ('pv-desc-wrap.js', '1'),
    ('pv-preview-scroll.js', '3'),
    ('pdoc-preview-light.js', '1'),
    ('booking-state.js', '1'),
    ('booking-settings-ui.js', '1'),
]
for name, ver in SCRIPTS:
    tag = '<script src="./'+name+'?v='+ver+'"></script>'
    if name not in html:
        html = html.replace('</body>', tag+'\n</body>', 1)
    else:
        html = re.sub(re.escape(name)+r'\?v=\d+', name+'?v='+ver, html)
p.write_text(html, encoding='utf-8')
print('ok')
