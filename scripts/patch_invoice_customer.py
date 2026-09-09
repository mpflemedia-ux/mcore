#!/usr/bin/env python3
from pathlib import Path
p = Path('app/index.html')
html = p.read_text(encoding='utf-8')
changed = False

def sub(old, new, label):
    global html, changed
    if old in html:
        html = html.replace(old, new, 1)
        changed = True
        print('ok', label)
    else:
        print('miss', label)

sub('const APP = {', 'const APP = window.APP = {', 'window.APP')
sub('const sb = createClient', 'const sb = window.sb = createClient', 'window.sb')

old = '''  const tn = await _pdocGetTenant()
  const companyAddr = _pdocAddressLine(tn)
  const isBm = APP.language===\'bm\''''
# file uses quotes not escaped
old = """  const tn = await _pdocGetTenant()\n  const companyAddr = _pdocAddressLine(tn)\n  const isBm = APP.language==='bm'"""
new = """  const tn = await _pdocGetTenant()\n  let invTerms = String((tn && tn.invoice_terms) || ((APP.tenant.config||{}).company_profile||{}).invoice_terms || '').trim()\n  if(!invTerms) {\n    try {\n      const cfgRes = await sb.from('tenants').select('config').eq('id', APP.tenant.id).maybeSingle()\n      let cfg = cfgRes.data && cfgRes.data.config\n      if (typeof cfg === 'string') { try { cfg = JSON.parse(cfg) } catch(e) { cfg = {} } }\n      invTerms = String((cfg && cfg.company_profile && cfg.company_profile.invoice_terms) || '').trim()\n    } catch (e) {}\n  }\n  const companyAddr = _pdocAddressLine(tn)\n  const isBm = APP.language==='bm'"""
sub(old, new, 'fetch terms')

old2 = '${_pdocNoSigNote(isBm)}</div>'
new2 = '${invTerms?`<div class="pdoc-inv-terms" style="padding:8px 8px 12px;font-size:12px;line-height:1.55;color:#334155;white-space:pre-wrap">${_aiEscapeHtml(invTerms)}</div>`:""}${_pdocNoSigNote(isBm)}</div>'
# only first invoice occurrence
if old2 in html and 'pdoc-inv-terms' not in html[html.find(old2)-80:html.find(old2)+200]:
    html = html.replace(old2, new2, 1)
    changed = True
    print('ok note wrap')
else:
    print('note wrap skip or already')

if changed:
    p.write_text(html, encoding='utf-8')
    print('wrote', p.stat().st_size)
else:
    print('no change')
