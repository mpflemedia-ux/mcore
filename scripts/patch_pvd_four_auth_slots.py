#!/usr/bin/env python3
"""Bake PVD 4 auth slots into app/index.html origin trio. Idempotent.

Scope ONLY (replace in place — do NOT load app/pvd-four-roles.js):
  1) _pvdDocHtml — 4 inputs + 4 print slots (Prepared/Checked/First/Second)
  2) _pvdRefreshSigPrint — same 4-slot array
  3) _pvdSaveSigs — persist first_approved_by (+ graceful fallback if column missing)

Does NOT touch: _pdocSigPrintHtml, single PV 3-sig, Salary Disbursement,
global/print CSS, sidebar, openPage, unrelated localStorage keys.
Labels/field ids match orphan reference app/pvd-four-roles.js.
approved_by = Second Approval; first_approved_by = First Approval (id pvd-sig-first).
"""
from pathlib import Path

INDEX = Path("app/index.html")

OLD_SIG = """    <div class=\"pdoc-sig-grid no-print\" style=\"margin:8px 16px 20px\">
      <div class=\"form-group\"><label class=\"form-label\">${isBm?'Disediakan':'Prepared By'}</label>
        <input class=\"form-input\" id=\"pvd-sig-prepared\" value=\"${_aiEscapeHtml(b.prepared_by||APP.user.name||'')}\" onchange=\"_pvdSaveSigs('${b.id}');_pvdRefreshSigPrint()\" onblur=\"_pvdSaveSigs('${b.id}');_pvdRefreshSigPrint()\" style=\"text-align:center;font-weight:600\"></div>
      <div class=\"form-group\"><label class=\"form-label\">${isBm?'Disemak':'Checked By'}</label>
        <input class=\"form-input\" id=\"pvd-sig-checked\" value=\"${_aiEscapeHtml(b.checked_by||'')}\" onchange=\"_pvdSaveSigs('${b.id}');_pvdRefreshSigPrint()\" onblur=\"_pvdSaveSigs('${b.id}');_pvdRefreshSigPrint()\" style=\"text-align:center;font-weight:600\"></div>
      <div class=\"form-group\"><label class=\"form-label\">${isBm?'Diluluskan':'Approved By'}</label>
        <input class=\"form-input\" id=\"pvd-sig-approved\" value=\"${_aiEscapeHtml(b.approved_by||'')}\" onchange=\"_pvdSaveSigs('${b.id}');_pvdRefreshSigPrint()\" onblur=\"_pvdSaveSigs('${b.id}');_pvdRefreshSigPrint()\" style=\"text-align:center;font-weight:600\"></div>
    </div>
    <div id=\"pvd-sig-print\" style=\"padding:0 16px 8px\">${_pdocSigPrintHtml([
      { name: b.prepared_by||APP.user.name||'', role: isBm?'Disediakan':'Prepared By' },
      { name: b.checked_by||'', role: isBm?'Disemak':'Checked By' },
      { name: b.approved_by||'', role: isBm?'Diluluskan':'Approved By' },
    ])}</div>
"""

NEW_SIG = """    <div class=\"pdoc-sig-grid pdoc-sd-sig-inputs no-print\" style=\"margin:8px 16px 20px\">
      <div class=\"form-group\"><label class=\"form-label\">${isBm?'Disediakan Oleh':'Prepared By'}</label>
        <input class=\"form-input\" id=\"pvd-sig-prepared\" value=\"${_aiEscapeHtml(b.prepared_by||APP.user.name||'')}\" onchange=\"_pvdSaveSigs('${b.id}');_pvdRefreshSigPrint()\" onblur=\"_pvdSaveSigs('${b.id}');_pvdRefreshSigPrint()\" style=\"text-align:center;font-weight:600\"></div>
      <div class=\"form-group\"><label class=\"form-label\">${isBm?'Disemak Oleh':'Checked By'}</label>
        <input class=\"form-input\" id=\"pvd-sig-checked\" value=\"${_aiEscapeHtml(b.checked_by||'')}\" onchange=\"_pvdSaveSigs('${b.id}');_pvdRefreshSigPrint()\" onblur=\"_pvdSaveSigs('${b.id}');_pvdRefreshSigPrint()\" style=\"text-align:center;font-weight:600\"></div>
      <div class=\"form-group\"><label class=\"form-label\">${isBm?'Kelulusan Pertama':'First Approval'}</label>
        <input class=\"form-input\" id=\"pvd-sig-first\" value=\"${_aiEscapeHtml(b.first_approved_by||'')}\" onchange=\"_pvdSaveSigs('${b.id}');_pvdRefreshSigPrint()\" onblur=\"_pvdSaveSigs('${b.id}');_pvdRefreshSigPrint()\" style=\"text-align:center;font-weight:600\"></div>
      <div class=\"form-group\"><label class=\"form-label\">${isBm?'Kelulusan Kedua':'Second Approval'}</label>
        <input class=\"form-input\" id=\"pvd-sig-approved\" value=\"${_aiEscapeHtml(b.approved_by||'')}\" onchange=\"_pvdSaveSigs('${b.id}');_pvdRefreshSigPrint()\" onblur=\"_pvdSaveSigs('${b.id}');_pvdRefreshSigPrint()\" style=\"text-align:center;font-weight:600\"></div>
    </div>
    <div id=\"pvd-sig-print\" class=\"pdoc-sd-sig-print\" style=\"padding:0 16px 8px\">${_pdocSigPrintHtml([
      { name: b.prepared_by||APP.user.name||'', role: isBm?'Disediakan Oleh':'Prepared By' },
      { name: b.checked_by||'', role: isBm?'Disemak Oleh':'Checked By' },
      { name: b.first_approved_by||'', role: isBm?'Kelulusan Pertama':'First Approval' },
      { name: b.approved_by||'', role: isBm?'Kelulusan Kedua':'Second Approval' },
    ])}</div>
"""

OLD_REFRESH = """function _pvdRefreshSigPrint() {
  const isBm = APP.language==='bm'
  const box = document.getElementById('pvd-sig-print')
  if(!box) return
  box.innerHTML = _pdocSigPrintHtml([
    { name: document.getElementById('pvd-sig-prepared')?.value||'', role: isBm?'Disediakan':'Prepared By' },
    { name: document.getElementById('pvd-sig-checked')?.value||'', role: isBm?'Disemak':'Checked By' },
    { name: document.getElementById('pvd-sig-approved')?.value||'', role: isBm?'Diluluskan':'Approved By' },
  ])
}"""

NEW_REFRESH = """function _pvdRefreshSigPrint() {
  const isBm = APP.language==='bm'
  const box = document.getElementById('pvd-sig-print')
  if(!box) return
  box.innerHTML = _pdocSigPrintHtml([
    { name: document.getElementById('pvd-sig-prepared')?.value||'', role: isBm?'Disediakan Oleh':'Prepared By' },
    { name: document.getElementById('pvd-sig-checked')?.value||'', role: isBm?'Disemak Oleh':'Checked By' },
    { name: document.getElementById('pvd-sig-first')?.value||'', role: isBm?'Kelulusan Pertama':'First Approval' },
    { name: document.getElementById('pvd-sig-approved')?.value||'', role: isBm?'Kelulusan Kedua':'Second Approval' },
  ])
}"""

OLD_SAVE = """async function _pvdSaveSigs(id) {
  if(!id) return
  await sb.from('payment_voucher_batches').update({
    prepared_by: document.getElementById('pvd-sig-prepared')?.value.trim() || null,
    checked_by: document.getElementById('pvd-sig-checked')?.value.trim() || null,
    approved_by: document.getElementById('pvd-sig-approved')?.value.trim() || null,
    updated_at: new Date().toISOString()
  }).eq('id',id).eq('tenant_id',APP.tenant.id)
}"""

NEW_SAVE = """async function _pvdSaveSigs(id) {
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
}"""

PAIRS = [
    (OLD_SIG, NEW_SIG),
    (OLD_REFRESH, NEW_REFRESH),
    (OLD_SAVE, NEW_SAVE),
]


def main():
    html = INDEX.read_text(encoding="utf-8")
    if (
        'id="pvd-sig-first"' in html
        and "first_approved_by: document.getElementById('pvd-sig-first')" in html
        and "Kelulusan Pertama':'First Approval'" in html
        and "Kelulusan Kedua':'Second Approval'" in html
    ):
        print("already patched")
        return
    html2 = html
    applied = 0
    for old, new in PAIRS:
        if new in html2 and old not in html2:
            continue
        if old not in html2:
            raise SystemExit("marker not found: " + old[:160].replace("\n", "\\n"))
        html2 = html2.replace(old, new, 1)
        applied += 1
    if html2 == html:
        raise SystemExit("no changes applied")
    # Guard: never introduce orphan wrap load
    if "pvd-four-roles.js" in html2 and "pvd-four-roles.js" not in html:
        raise SystemExit("refused: would introduce pvd-four-roles.js load")
    INDEX.write_text(html2, encoding="utf-8")
    print("patched PVD 4 auth slots (%d replacements)" % applied)


if __name__ == "__main__":
    main()
