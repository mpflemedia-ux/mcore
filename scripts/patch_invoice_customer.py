#!/usr/bin/env python3
from pathlib import Path
import re
p = Path('app/index.html')
html = p.read_text(encoding='utf-8')
if 'employee-nickname.js' not in html:
    html = html.replace('</body>', '<script src="./employee-nickname.js?v=3"></script>\n</body>', 1)
else:
    html = re.sub(r'employee-nickname\.js\?v=\d+', 'employee-nickname.js?v=3', html)
if 'sales-commission-edit.js' not in html:
    html = html.replace('</body>', '<script src="./sales-commission-edit.js?v=1"></script>\n</body>', 1)
else:
    html = re.sub(r'sales-commission-edit\.js\?v=\d+', 'sales-commission-edit.js?v=1', html)
if 'sales-achievements-edit.js' not in html:
    html = html.replace('</body>', '<script src="./sales-achievements-edit.js?v=1"></script>\n</body>', 1)
else:
    html = re.sub(r'sales-achievements-edit\.js\?v=\d+', 'sales-achievements-edit.js?v=1', html)
if 'dashboard-ai-layout.js' not in html:
    html = html.replace('</body>', '<script src="./dashboard-ai-layout.js?v=1"></script>\n</body>', 1)
else:
    html = re.sub(r'dashboard-ai-layout\.js\?v=\d+', 'dashboard-ai-layout.js?v=1', html)
if 'pv-bank-account.js' not in html:
    html = html.replace('</body>', '<script src="./pv-bank-account.js?v=1"></script>\n</body>', 1)
else:
    html = re.sub(r'pv-bank-account\.js\?v=\d+', 'pv-bank-account.js?v=1', html)
if 'print-hide-fabs.js' not in html:
    html = html.replace('</body>', '<script src="./print-hide-fabs.js?v=1"></script>\n</body>', 1)
else:
    html = re.sub(r'print-hide-fabs\.js\?v=\d+', 'print-hide-fabs.js?v=1', html)
p.write_text(html, encoding='utf-8')
print('ok')
