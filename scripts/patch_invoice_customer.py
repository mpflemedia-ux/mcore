#!/usr/bin/env python3
from pathlib import Path
p = Path('app/index.html')
html = p.read_text(encoding='utf-8')
changed = False
old = "employees(name,position,bank_name,bank_account_no,epf_no,socso_no)"
new = "employees(name,position,bank_name,bank_account_no,epf_no,socso_no,ic_no)"
if old in html:
    html = html.replace(old, new)
    changed = True
if 'payslip-statement.js' not in html:
    html = html.replace('</body>', '<script src="./payslip-statement.js?v=1"></script>\n</body>', 1)
    changed = True
if changed:
    p.write_text(html, encoding='utf-8')
    print('patched')
else:
    print('already')
