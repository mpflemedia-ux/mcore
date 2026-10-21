import sys
F = sys.argv[1]
s = open(F, encoding='utf-8').read()
R = [
 ("async function _payVoid(invoiceId, allocationId, paymentId, amount) {\n  const isBm = APP.language==='bm'\n",
  "async function _payVoid(invoiceId, allocationId, paymentId, amount) {\n  const isBm = APP.language==='bm'\n  if(window.PAYV&&PAYV.on&&PAYV.on()) return PAYV.inv(invoiceId, allocationId, paymentId, amount)\n"),
 ("async function _billPayVoid(billId, paymentId, amount) {\n  const isBm = APP.language==='bm'\n",
  "async function _billPayVoid(billId, paymentId, amount) {\n  const isBm = APP.language==='bm'\n  if(window.PAYV&&PAYV.on&&PAYV.on()) return PAYV.bill(billId, paymentId, amount)\n"),
 ("    payments = r2.data || []\n  } catch(e) {}\n",
  "    payments = r2.data || []\n"
  "    if (r2.error) { const r2b = await sb.from('payments').select('id,ref_no,payment_date,amount,customer_name,notes').eq('tenant_id', APP.tenant.id).gte('payment_date', fromStr).lte('payment_date', toStr); payments = r2b.data || [] }\n"
  "  } catch(e) {}\n"
  "  if (payments.length) { try { const rb = await sb.from('payments').select('id,bank_ref').eq('tenant_id', APP.tenant.id).in('id', payments.map(p => p.id).slice(0, 500)); const bm = {}; (rb.data||[]).forEach(x => { if (x.bank_ref) bm[x.id] = x.bank_ref }); payments.forEach(p => { if (bm[p.id]) p._bref = bm[p.id] }) } catch(e) {} }\n"),
 ("  ;(payments||[]).forEach(p => candidates.push({ type:'payment', id:p.id, ref:p.ref_no, date:p.payment_date, amount:Number(p.amount||0), desc:p.customer_name||p.notes||'' }))\n",
  "  ;(payments||[]).forEach(p => candidates.push({ type:'payment', id:p.id, ref:p.ref_no, date:p.payment_date, amount:Number(p.amount||0), desc:p.customer_name||p.notes||'', ...(p._bref ? { bank_ref: p._bref } : {}) }))\n"),
 ("      let score = 0.30 - dayDiff * 0.015\n      if (descMatch) score += 0.45\n",
  "      let score = 0.30 - dayDiff * 0.015\n      if (descMatch) score += 0.45\n"
  "      const bRef = c.bank_ref ? String(c.bank_ref).replace(/[^a-z0-9]/gi, '').toLowerCase() : ''\n"
  "      if (bRef.length >= 4 && String(txn.description||'').replace(/[^a-z0-9]/gi, '').toLowerCase().includes(bRef)) score = Math.min(0.99, score + 0.6)\n"),
 ('<script src="./pay-sheet.js?v=1"></script>\n',
  '<script src="./pay-sheet.js?v=2"></script>\n<script src="./pay-void.js?v=1"></script>\n<script src="./pay-vlist.js?v=1"></script>\n'),
]
for a, b in R:
    c = s.count(a)
    assert c == 1, ('count', c, a[:80])
    s = s.replace(a, b)
open(F, 'w', encoding='utf-8').write(s)
print('patched', len(R))
