#!/usr/bin/env python3
"""Bake pdoc-customer-lock.js ?v=8 into index.html + harden inv/quo bill-to via _pdocCustBillTo."""
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
LOCK = ROOT / 'app' / 'pdoc-customer-lock.js'
INDEX = ROOT / 'app' / 'index.html'
PCI = ROOT / 'scripts' / 'patch_invoice_customer.py'
VER = '8'

if not LOCK.is_file() or 'PDOC_CUSTOMER_LOCK_V8' not in LOCK.read_text(encoding='utf-8'):
    print('ERROR: missing PDOC_CUSTOMER_LOCK_V8 marker in app/pdoc-customer-lock.js', file=sys.stderr)
    sys.exit(1)

html = INDEX.read_text(encoding='utf-8')

# 1) Cache-bust script tag
pat = re.compile(r'(pdoc-customer-lock\.js\?v=)\d+')
if not pat.search(html):
    tag = f'<script src="./pdoc-customer-lock.js?v={VER}"></script>'
    if 'pdoc-customer-lock.js' not in html:
        if '</body>' not in html:
            print('ERROR: no pdoc-customer-lock.js and no </body>', file=sys.stderr)
            sys.exit(1)
        html = html.replace('</body>', tag + '\n</body>', 1)
        print('injected pdoc-customer-lock.js before </body>')
    else:
        print('ERROR: pdoc-customer-lock.js present but ?v= pattern not matched', file=sys.stderr)
        sys.exit(1)
else:
    html, n = pat.subn(rf'\g<1>{VER}', html, count=1)
    if n != 1:
        print(f'ERROR: expected 1 cache-bust replace, got {n}', file=sys.stderr)
        sys.exit(1)
    print(f'baked pdoc-customer-lock.js?v={VER}')

# 2) Harden invoice + quotation custAddr/custPe to use window._pdocCustBillTo (dedupe)
OLD = (
    "const custAddr = custPhone ? [custPhone.address_line1, [custPhone.postcode,custPhone.city].filter(Boolean).join(' '), custPhone.state].filter(Boolean).join(', ') : ''\n"
)
OLD_INV = OLD + (
    "  const custPe = custPhone ? [custPhone.phone, custPhone.email].filter(Boolean).join(' · ') : ''\n"
)
NEW_INV = (
    "const _bt = (typeof _pdocCustBillTo==='function' && custPhone) ? _pdocCustBillTo(custPhone) : {addr:'',pe:''}\n"
    "  const custAddr = _bt.addr || (custPhone ? [custPhone.address_line1, [custPhone.postcode,custPhone.city].filter(Boolean).join(' '), custPhone.state].filter(Boolean).join(', ') : '')\n"
    "  const custPe = _bt.pe || (custPhone ? [custPhone.phone, custPhone.email].filter(Boolean).join(' · ') : '')\n"
)

count_inv = html.count(OLD_INV)
if count_inv:
    html = html.replace(OLD_INV, NEW_INV)
    print(f'hardened inv bill-to via _pdocCustBillTo ({count_inv} site(s))')
else:
    if 'typeof _pdocCustBillTo' in html:
        print('inv bill-to already hardened')
    else:
        print('WARN: invoice custAddr+custPe block not found for harden', file=sys.stderr)

NEW_QUO = (
    "const _btQ = (typeof _pdocCustBillTo==='function' && custPhone) ? _pdocCustBillTo(custPhone) : {addr:'',pe:''}\n"
    "  const custAddr = _btQ.addr || (custPhone ? [custPhone.address_line1, [custPhone.postcode,custPhone.city].filter(Boolean).join(' '), custPhone.state].filter(Boolean).join(', ') : '')\n"
)
quo_n = 0
while OLD in html:
    html = html.replace(OLD, NEW_QUO, 1)
    quo_n += 1
if quo_n:
    print(f'hardened quo/other custAddr via _pdocCustBillTo ({quo_n} site(s))')
elif 'typeof _pdocCustBillTo' in html:
    print('quo custAddr harden skipped or already done')

INDEX.write_text(html, encoding='utf-8')
print('wrote index.html')

if PCI.exists():
    txt = PCI.read_text(encoding='utf-8')
    if "pdoc-customer-lock.js" in txt:
        txt2 = re.sub(
            r"\('pdoc-customer-lock\.js',\s*'[^']*'\)",
            f"('pdoc-customer-lock.js', '{VER}')",
            txt,
            count=1,
        )
    else:
        insert = f"    ('pdoc-customer-lock.js', '{VER}'),\n"
        if "('pdoc-invoice-terms.js'" in txt:
            txt2 = txt.replace(
                "('pdoc-invoice-terms.js', '4'),\n",
                "('pdoc-invoice-terms.js', '4'),\n" + insert,
                1,
            )
        else:
            txt2 = txt.replace(
                "('print-hide-fabs.js', '1'),\n",
                "('print-hide-fabs.js', '1'),\n" + insert,
                1,
            )
    if txt2 != txt:
        PCI.write_text(txt2, encoding='utf-8')
        print(f'updated patch_invoice_customer.py → pdoc-customer-lock.js v={VER}')
    else:
        print('patch_invoice_customer.py unchanged')
