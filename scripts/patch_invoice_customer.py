#!/usr/bin/env python3
from pathlib import Path
import re
p = Path('app/index.html')
html = p.read_text(encoding='utf-8')
changed = False
for old, new in [
    ("_pdocSetPageOrientation('portrait')\n  const printFilenamePrefix = `Payslip_",
     "_pdocSetPageOrientation('landscape', 8)\n  const printFilenamePrefix = `Payslip_"),
    ("_pdocSetPageOrientation('portrait')\n  const printFilenamePrefix = `Payslips_",
     "_pdocSetPageOrientation('landscape', 8)\n  const printFilenamePrefix = `Payslips_"),
]:
    if old in html:
        html = html.replace(old, new)
        changed = True
if 'payslip-statement.js' not in html:
    html = html.replace('</body>', '<script src="./payslip-statement.js?v=4"></script>\n</body>', 1)
    changed = True
else:
    html2 = re.sub(r'payslip-statement\.js\?v=\d+', 'payslip-statement.js?v=4', html)
    if html2 != html:
        html = html2
        changed = True
if 'payslip-print-boot.js' not in html:
    html = html.replace('</body>', '<script src="./payslip-print-boot.js?v=1"></script>\n</body>', 1)
    changed = True
if changed:
    p.write_text(html, encoding='utf-8')
    print('wrote')
else:
    print('already')
