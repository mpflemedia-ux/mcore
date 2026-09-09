#!/usr/bin/env python3
from pathlib import Path
p = Path('app/index.html')
html = p.read_text(encoding='utf-8')
changed = False
old = '''  const {data: custPhone} = inv.customer_id
    ? await sb.from('customers').select('phone,email,address,city,state,postcode').eq('id',inv.customer_id).eq('tenant_id',APP.tenant.id).single()
    : {data:null}
  const custAddr = custPhone ? [custPhone.address, [custPhone.postcode,custPhone.city].filter(Boolean).join(' '), custPhone.state].filter(Boolean).join(', ') : ''
'''
new = '''  let custPhone = null
  if(inv.customer_id) {
    const r1 = await sb.from('customers').select('phone,email,address,city,state,postcode,name').eq('id',inv.customer_id).eq('tenant_id',APP.tenant.id).maybeSingle()
    custPhone = r1.data
  }
  if(!custPhone && inv.customer_name) {
    const r2 = await sb.from('customers').select('phone,email,address,city,state,postcode,name').eq('tenant_id',APP.tenant.id).limit(500)
    const n = String(inv.customer_name||'').replace(/\\s+/g,' ').trim().toLowerCase()
    const rows = r2.data||[]
    custPhone = rows.find(x => String(x.name||'').replace(/\\s+/g,' ').trim().toLowerCase()===n)
      || rows.find(x => n.includes(String(x.name||'').toLowerCase()) || String(x.name||'').toLowerCase().includes(n.split(' - ')[0]))
      || null
  }
  const custAddr = custPhone ? [custPhone.address, [custPhone.postcode,custPhone.city].filter(Boolean).join(' '), custPhone.state].filter(Boolean).join(', ') : ''
  const custPe = custPhone ? [custPhone.phone, custPhone.email].filter(Boolean).join(' \u00b7 ') : ''
'''
if old in html:
    html = html.replace(old, new, 1)
    changed = True
    print('patched fetch')
else:
    print('fetch block already patched or missing')
old2 = '''      ${custAddr?`<div class="pdoc-band-sub">${_aiEscapeHtml(custAddr)}</div>`:''}
      ${(custPhone&&custPhone.phone)?`<div class="pdoc-band-sub">${_aiEscapeHtml(custPhone.phone)}${custPhone.email?' \u00b7 '+_aiEscapeHtml(custPhone.email):''}</div>`:''}'''
new2 = '''      ${custAddr?`<div class="pdoc-band-sub">${_aiEscapeHtml(custAddr)}</div>`:''}
      ${custPe?`<div class="pdoc-band-sub">${_aiEscapeHtml(custPe)}</div>`:''}'''
if old2 in html:
    html = html.replace(old2, new2, 1)
    changed = True
    print('patched band')
else:
    print('band already patched or missing')
if 'pdoc-customer-lock.js' not in html:
    html = html.replace('</body>', '<script src="./pdoc-customer-lock.js?v=4"></script>\n</body>', 1)
    changed = True
    print('added script')
if changed:
    p.write_text(html, encoding='utf-8')
    print('wrote index.html', p.stat().st_size)
else:
    print('no change')
