#!/usr/bin/env python3
from pathlib import Path
p = Path('app/index.html')
html = p.read_text(encoding='utf-8')
changed = False

def sub(old, new, label):
    global html, changed
    if old not in html:
        print('miss', label)
        return False
    html = html.replace(old, new, 1)
    changed = True
    print('ok', label)
    return True

sub(
    "select('id,name,logo_url,address,address_line2,city,postcode,state,country,phone,sst_gst_no')",
    "select('id,name,logo_url,address,address_line2,city,postcode,state,country,phone,sst_gst_no,bank_name,account_number,account_name,payment_qr_url')",
    'pdoc tenant bank cols'
)

old = """  let invTerms = String((tn && tn.invoice_terms) || ((APP.tenant.config||{}).company_profile||{}).invoice_terms || '').trim()\n  if(!invTerms) {\n    try {\n      const cfgRes = await sb.from('tenants').select('config').eq('id', APP.tenant.id).maybeSingle()\n      let cfg = cfgRes.data && cfgRes.data.config\n      if (typeof cfg === 'string') { try { cfg = JSON.parse(cfg) } catch(e) { cfg = {} } }\n      invTerms = String((cfg && cfg.company_profile && cfg.company_profile.invoice_terms) || '').trim()\n    } catch (e) {}\n  }\n  const companyAddr = _pdocAddressLine(tn)"""
new = """  let invTerms = String((tn && tn.invoice_terms) || ((APP.tenant.config||{}).company_profile||{}).invoice_terms || '').trim()\n  let bankName = String((tn && tn.bank_name) || ((APP.tenant.config||{}).company_profile||{}).bank_name || '').trim()\n  let accName = String((tn && tn.account_name) || ((APP.tenant.config||{}).company_profile||{}).account_name || '').trim()\n  let accNo = String((tn && tn.account_number) || ((APP.tenant.config||{}).company_profile||{}).account_number || '').trim()\n  let payQr = String((tn && tn.payment_qr_url) || ((APP.tenant.config||{}).company_profile||{}).payment_qr_url || '').trim()\n  try {\n    const cfgRes = await sb.from('tenants').select('config').eq('id', APP.tenant.id).maybeSingle()\n    let cfg = cfgRes.data && cfgRes.data.config\n    if (typeof cfg === 'string') { try { cfg = JSON.parse(cfg) } catch(e) { cfg = {} } }\n    const cp = (cfg && cfg.company_profile) || {}\n    if(!invTerms) invTerms = String(cp.invoice_terms || '').trim()\n    if(!bankName) bankName = String(cp.bank_name || '').trim()\n    if(!accName) accName = String(cp.account_name || '').trim()\n    if(!accNo) accNo = String(cp.account_number || '').trim()\n    if(!payQr) payQr = String(cp.payment_qr_url || '').trim()\n  } catch (e) {}\n  const companyAddr = _pdocAddressLine(tn)"""
sub(old, new, 'bank vars always')

needle = '<div style="padding:0 16px 8px">${invTerms?'
bank = '''<div style="padding:0 16px 8px">${(bankName||accNo||payQr)?`<div class="pdoc-pay-block" style="margin:8px 8px 16px;padding:12px;border:1px solid #E2E8F0;border-radius:8px;text-align:center">
        <div style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#0E7490;font-weight:700;margin-bottom:8px">${isBm?'Pembayaran':'Payment'}</div>
        ${payQr?`<img src="${_aiEscapeHtml(payQr)}" alt="QR" style="width:160px;max-width:70vw;height:auto;margin:0 auto 8px;display:block">`:''}
        ${bankName?`<div style="font-weight:700;color:#0F172A">${_aiEscapeHtml(bankName)}</div>`:''}
        ${accName?`<div style="color:#334155;font-size:13px">${_aiEscapeHtml(accName)}</div>`:''}
        ${accNo?`<div style="font-size:16px;font-weight:800;color:#0F172A;margin-top:2px">${_aiEscapeHtml(accNo)}</div>`:''}
      </div>`:''}${invTerms?'''
if needle in html and 'pdoc-pay-block' not in html:
    html = html.replace(needle, bank, 1)
    changed = True
    print('ok pay block')
else:
    print('pay block skip', 'needle', needle in html, 'already', 'pdoc-pay-block' in html)

if changed:
    p.write_text(html, encoding='utf-8')
    print('wrote', p.stat().st_size)
else:
    print('no change')
