#!/usr/bin/env python3
from pathlib import Path
p = Path('app/index.html')
html = p.read_text(encoding='utf-8')
changed = False
# Fix bad column name that zeroes the whole customer select
for a,b in [
    ("select('phone,email,address,city,state,postcode,name')", "select('phone,email,address_line1,city,state,postcode,name')"),
    ("select('phone,email,address,city,state,postcode')", "select('phone,email,address_line1,city,state,postcode')"),
    ('custPhone.address', 'custPhone.address_line1'),
    ('c.address,', 'c.address_line1,'),
]:
    if a in html:
        html = html.replace(a, b)
        changed = True
        print('replaced', a)
if 'pdoc-customer-lock.js?v=5' not in html and 'pdoc-customer-lock.js' in html:
    html = html.replace('pdoc-customer-lock.js?v=4', 'pdoc-customer-lock.js?v=5')
    changed = True
if changed:
    p.write_text(html, encoding='utf-8')
    print('wrote', p.stat().st_size)
else:
    print('no change')
