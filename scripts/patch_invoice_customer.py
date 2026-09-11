#!/usr/bin/env python3
from pathlib import Path
import re
p = Path('app/index.html')
html = p.read_text(encoding='utf-8')
changed = False
html2 = html.replace(
    "_pdocSetPageOrientation('landscape', 8)\n  const printFilenamePrefix = `Payslip_",
    "_pdocSetPageOrientation('portrait')\n  const printFilenamePrefix = `Payslip_"
)
html2 = html2.replace(
    "_pdocSetPageOrientation('landscape', 8)\n  const printFilenamePrefix = `Payslips_",
    "_pdocSetPageOrientation('portrait')\n  const printFilenamePrefix = `Payslips_"
)
if html2 != html:
    html = html2
    changed = True
html3 = re.sub(r'payslip-statement\.js\?v=\d+', 'payslip-statement.js?v=5', html)
if html3 != html:
    html = html3
    changed = True
html4 = re.sub(r'payslip-print-boot\.js\?v=\d+', 'payslip-print-boot.js?v=3', html)
if html4 != html:
    html = html4
    changed = True
if changed:
    p.write_text(html, encoding='utf-8')
    print('patched')
else:
    print('already')
