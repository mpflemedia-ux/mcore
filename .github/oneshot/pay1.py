import sys
F = sys.argv[1]
s = open(F, encoding='utf-8').read()
R = [
 ("  const {data: refData} = await sb.rpc('next_ref_no', {doc_type:'RCP'}).then(r=>r, ()=>({data:null}))\n  const {data: payment, error} = await sb.from('payments').insert({",
  "  if(window.PAYX&&PAYX.before&&!(await PAYX.before('inv'))) return\n  const {data: refData} = await sb.rpc('next_ref_no', {doc_type:'RCP'}).then(r=>r, ()=>({data:null}))\n  const {data: payment, error} = await sb.from('payments').insert({"),
 ("    amount, status: 'completed', notes: 'Invoice '+inv.ref_no, created_by: APP.user.id\n  }).select('id').single()",
  "    amount, status: 'completed', notes: 'Invoice '+inv.ref_no, created_by: APP.user.id, ...(window.PAYX&&PAYX.extra?PAYX.extra('inv'):{})\n  }).select('id').single()"),
 ("  showToast(APP.language==='bm'?'Bayaran direkod!':'Payment recorded!', 'success')\n",
  "  try { if(window.PAYX&&PAYX.after) await PAYX.after('inv', payment.id, invoiceId) } catch(e) { console.warn('PAYX.after', e) }\n  showToast(APP.language==='bm'?'Bayaran direkod!':'Payment recorded!', 'success')\n"),
 ("  if(!bill) { errEl.textContent='Bill not found.'; errEl.style.display='block'; return }\n",
  "  if(!bill) { errEl.textContent='Bill not found.'; errEl.style.display='block'; return }\n  if(window.PAYX&&PAYX.before&&!(await PAYX.before('bill'))) return\n"),
 ("    amount, method,\n  }).select('id').single()",
  "    amount, method, ...(window.PAYX&&PAYX.extra?PAYX.extra('bill'):{}),\n  }).select('id').single()"),
 ("  auditLog('create','supplier_payments', payRow?.id || billId)\n",
  "  try { if(window.PAYX&&PAYX.after) await PAYX.after('bill', payRow?.id, billId) } catch(e) { console.warn('PAYX.after', e) }\n  auditLog('create','supplier_payments', payRow?.id || billId)\n"),
 ('<script src="./tenant-badge-id.js?v=1"></script>\n',
  '<script src="./tenant-badge-id.js?v=1"></script>\n<script src="./pay-i18n.js?v=1"></script>\n<script src="./pay-core.js?v=1"></script>\n<script src="./pay-ui.js?v=1"></script>\n<script src="./pay-sheet.js?v=1"></script>\n'),
]
for a, b in R:
    c = s.count(a)
    assert c == 1, ('count', c, a[:80])
    s = s.replace(a, b)
open(F, 'w', encoding='utf-8').write(s)
print('patched', len(R))
