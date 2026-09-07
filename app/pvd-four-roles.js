/* PV Disbursement — 4 signature roles matching Salary Disbursement.
   Loaded after app/index.html so these replace the 3-role originals. */
async function renderPVDDetail(id) {
  const isBm = APP.language==='bm'
  const t = isBm
    ? { back:'Disbursement', print:'Cetak', convert:'Convert ke Single PV', edit:'Edit', notFound:'Tidak dijumpai' }
    : { back:'Disbursement', print:'Print', convert:'Convert to Single PVs', edit:'Edit', notFound:'Not found' }
  const {data: b} = await sb.from('payment_voucher_batches').select('*').eq('id',id).eq('tenant_id',APP.tenant.id).single()
  if(!b) { document.getElementById('main').innerHTML = `<div class="empty-state" style="padding:60px"><p>${t.notFound}</p></div>`; return }
  const {data: lines} = await sb.from('payment_voucher_batch_lines').select('*').eq('batch_id',id).order('sort_order')
  const tn = await _pdocGetTenant()
  const accent = _pdocAccentGet('pvd')
  _pdocSetPageOrientation('landscape')
  const printFn = `PVDisbursement_${_pdocSlug(b.ref_no)}_${_pdocDateStamp(b.batch_date)}`.replace(/'/g,"\\'")
  document.getElementById('main').innerHTML = `
  <div class="page-header no-print"><div>
    <div class="page-title">${_aiEscapeHtml(b.ref_no||'PVD')}</div>
    <div style="font-size:13px;color:var(--text-3);margin-top:2px;cursor:pointer" onclick="openPage('vouchers',{view:'disbursements'})">← ${t.back}</div>
  </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      ${_pdocColorPickerHtml('pvd', accent)}
      <button class="btn btn-outline" onclick="_pdocSetPageOrientation('landscape', 6);_pdocSetPrintFilename('${printFn}_'+_pdocTimeStamp());window.print()"><i class="ti ti-printer"></i> ${t.print}</button>
      ${b.status!=='converted'?`<button class="btn btn-outline btn-sm" onclick="openPage('vouchers',{view:'pvd-form',id:'${id}'})"><i class="ti ti-edit"></i> ${t.edit}</button>
      <button class="btn btn-primary btn-sm" onclick="_pvdConvert('${id}')"><i class="ti ti-transform"></i> ${t.convert}</button>`:`<span style="font-size:12px;color:var(--success)">Converted</span>`}
    </div>
  </div>
  ${_pvdDocHtml(b, lines||[], tn, isBm, accent)}`
  if(!b.first_approved_by) {
    try {
      const cached = localStorage.getItem('nexerp_pvd_first_'+id)
      const el = document.getElementById('pvd-sig-first')
      if(cached && el && !el.value) { el.value = cached; _pvdRefreshSigPrint() }
    } catch(e) {}
  }
}

function _pvdDocHtml(b, lines, tn, isBm, accent) {
  const addr = _pdocAddressLine(tn)
  const logo = tn.logo_url ? `<img src="${_aiEscapeHtml(tn.logo_url)}" style="height:40px;object-fit:contain">` : ''
  const total = lines.reduce((s,l)=>s+Number(l.amount||0),0)
  return `
  <div class="pdoc" style="--pdoc-accent:${accent};margin:0 auto 24px">
    <div class="pdoc-header">
      <div style="display:flex;gap:12px;align-items:flex-start">
        ${logo}
        <div>
          <div style="font-weight:700;font-size:15px">${_aiEscapeHtml(tn.name||'')}</div>
          ${addr?`<div style="font-size:11px;color:#64748B;max-width:360px;line-height:1.35">${_aiEscapeHtml(addr)}</div>`:''}
        </div>
      </div>
      <div style="text-align:right;font-size:12px;color:#64748B">
        ${isBm?'Tarikh':'Date'}: ${formatDate(b.batch_date)}<br>
        ${isBm?'Ruj.':'Ref'}: <strong style="color:#0F172A">${_aiEscapeHtml(b.ref_no||'-')}</strong>
      </div>
    </div>
    <div class="pdoc-title-bar">${_aiEscapeHtml(b.title||'PAYMENT VOUCHER DISBURSEMENT')}</div>
    <div style="padding:12px 16px;overflow-x:auto">
      <table class="pdoc-sd-table" style="width:100%"><thead><tr>
        <th style="width:36px">No</th>
        <th>${isBm?'Penerima':'Payee'}</th>
        <th>${isBm?'Kaedah':'Method'}</th>
        <th>${isBm?'Bank / Ruj':'Bank / Ref'}</th>
        <th>${isBm?'Tujuan':'Purpose'}</th>
        <th style="text-align:right">${isBm?'Jumlah':'Amount'}</th>
      </tr></thead>
      <tbody>
        ${lines.map((l,i)=>`<tr>
          <td style="color:#94A3B8">${i+1}</td>
          <td style="font-weight:600">${_aiEscapeHtml(l.payee_name||'-')}</td>
          <td>${_aiEscapeHtml(l.payment_method||'-')}</td>
          <td>${_aiEscapeHtml(l.bank_name||'—')}</td>
          <td>${_aiEscapeHtml(l.description||'—')}</td>
          <td style="text-align:right;font-weight:700;font-family:'Space Grotesk',sans-serif">${formatRM(l.amount)}</td>
        </tr>`).join('')}
      </tbody>
      <tfoot><tr>
        <td colspan="5" style="text-align:right;padding:12px;color:#fff">${isBm?'JUMLAH BESAR':'GRAND TOTAL'}</td>
        <td style="text-align:right;padding:12px;color:#fff;font-weight:700">${formatRM(total)}</td>
      </tr></tfoot>
      </table>
    </div>
    <div class="pdoc-sig-grid pdoc-sd-sig-inputs no-print" style="margin:8px 16px 20px">
      <div class="form-group"><label class="form-label">${isBm?'Disediakan Oleh':'Prepared By'}</label>
        <input class="form-input" id="pvd-sig-prepared" value="${_aiEscapeHtml(b.prepared_by||APP.user.name||'')}" onchange="_pvdSaveSigs('${b.id}');_pvdRefreshSigPrint()" onblur="_pvdSaveSigs('${b.id}');_pvdRefreshSigPrint()" style="text-align:center;font-weight:600"></div>
      <div class="form-group"><label class="form-label">${isBm?'Disemak Oleh':'Checked By'}</label>
        <input class="form-input" id="pvd-sig-checked" value="${_aiEscapeHtml(b.checked_by||'')}" onchange="_pvdSaveSigs('${b.id}');_pvdRefreshSigPrint()" onblur="_pvdSaveSigs('${b.id}');_pvdRefreshSigPrint()" style="text-align:center;font-weight:600"></div>
      <div class="form-group"><label class="form-label">${isBm?'Kelulusan Pertama':'First Approval'}</label>
        <input class="form-input" id="pvd-sig-first" value="${_aiEscapeHtml(b.first_approved_by||'')}" onchange="_pvdSaveSigs('${b.id}');_pvdRefreshSigPrint()" onblur="_pvdSaveSigs('${b.id}');_pvdRefreshSigPrint()" style="text-align:center;font-weight:600"></div>
      <div class="form-group"><label class="form-label">${isBm?'Kelulusan Kedua':'Second Approval'}</label>
        <input class="form-input" id="pvd-sig-approved" value="${_aiEscapeHtml(b.approved_by||'')}" onchange="_pvdSaveSigs('${b.id}');_pvdRefreshSigPrint()" onblur="_pvdSaveSigs('${b.id}');_pvdRefreshSigPrint()" style="text-align:center;font-weight:600"></div>
    </div>
    <div id="pvd-sig-print" class="pdoc-sd-sig-print" style="padding:0 16px 8px">${_pdocSigPrintHtml([
      { name: b.prepared_by||APP.user.name||'', role: isBm?'Disediakan Oleh':'Prepared By' },
      { name: b.checked_by||'', role: isBm?'Disemak Oleh':'Checked By' },
      { name: b.first_approved_by||'', role: isBm?'Kelulusan Pertama':'First Approval' },
      { name: b.approved_by||'', role: isBm?'Kelulusan Kedua':'Second Approval' },
    ])}</div>
    <div class="pdoc-footer-note">${isBm?'Baucar bayaran (penyaluran)':'Payment voucher disbursement'}</div>
  </div>`
}

function _pvdRefreshSigPrint() {
  const isBm = APP.language==='bm'
  const box = document.getElementById('pvd-sig-print')
  if(!box) return
  box.innerHTML = _pdocSigPrintHtml([
    { name: document.getElementById('pvd-sig-prepared')?.value||'', role: isBm?'Disediakan Oleh':'Prepared By' },
    { name: document.getElementById('pvd-sig-checked')?.value||'', role: isBm?'Disemak Oleh':'Checked By' },
    { name: document.getElementById('pvd-sig-first')?.value||'', role: isBm?'Kelulusan Pertama':'First Approval' },
    { name: document.getElementById('pvd-sig-approved')?.value||'', role: isBm?'Kelulusan Kedua':'Second Approval' },
  ])
}

async function _pvdSaveSigs(id) {
  if(!id) return
  const payload = {
    prepared_by: document.getElementById('pvd-sig-prepared')?.value.trim() || null,
    checked_by: document.getElementById('pvd-sig-checked')?.value.trim() || null,
    first_approved_by: document.getElementById('pvd-sig-first')?.value.trim() || null,
    approved_by: document.getElementById('pvd-sig-approved')?.value.trim() || null,
    updated_at: new Date().toISOString()
  }
  let { error } = await sb.from('payment_voucher_batches').update(payload).eq('id',id).eq('tenant_id',APP.tenant.id)
  if(error && /first_approved_by/i.test(error.message||'')) {
    const { first_approved_by, ...fallback } = payload
    await sb.from('payment_voucher_batches').update(fallback).eq('id',id).eq('tenant_id',APP.tenant.id)
    try { localStorage.setItem('nexerp_pvd_first_'+id, first_approved_by||'') } catch(e) {}
  }
}
