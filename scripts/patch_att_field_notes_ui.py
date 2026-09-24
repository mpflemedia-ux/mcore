#!/usr/bin/env python3
"""Bake Log Attendance field-notes UX into app/index.html (idempotent).

Shows work-mode badge + required hint for Field/WFH staff so Save failures
are explainable. Does NOT remove field-notes validation.

GitHub Actions checks out main, runs this, commits, pushes main.
Never push the full ~2MB index.html via API — use this bake only.
"""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / 'app' / 'index.html'

OLD_NOTES = (
    '<div class="form-group" style="grid-column:1/-1">'
    '<label class="form-label">${t.notes}</label>'
    '<textarea id="att-notes" class="form-input" rows="2"></textarea></div>'
)

NEW_NOTES = (
    '<div class="form-group" style="grid-column:1/-1" id="att-notes-wrap">'
    '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px">'
    '<label class="form-label" id="att-notes-label" style="margin:0">${t.notes}</label>'
    '<span id="att-work-mode-badge" style="display:none;font-size:11px;font-weight:600;'
    'padding:2px 8px;border-radius:999px;background:var(--primary-soft,rgba(59,130,246,.12));'
    'color:var(--primary)"></span>'
    '</div>'
    '<textarea id="att-notes" class="form-input" rows="2" placeholder=""></textarea>'
    '<div id="att-notes-hint" style="font-size:11px;color:var(--text-3);margin-top:4px"></div>'
    '</div>'
)

OLD_EMP_SELECT = """  let {data: employees, error: empListErr} = await sb.from('employees').select('id,name,email')
    .eq('tenant_id',APP.tenant.id).is('deleted_at',null).order('name',{ascending:true})
  if(empListErr) console.warn('attendance employees list', empListErr)"""

NEW_EMP_SELECT = """  let {data: employees, error: empListErr} = await sb.from('employees').select('id,name,email,work_base')
    .eq('tenant_id',APP.tenant.id).is('deleted_at',null).order('name',{ascending:true})
  if(empListErr && /work_base/i.test(empListErr.message||'')) {
    ;({data: employees, error: empListErr} = await sb.from('employees').select('id,name,email')
      .eq('tenant_id',APP.tenant.id).is('deleted_at',null).order('name',{ascending:true}))
  }
  if(empListErr) console.warn('attendance employees list', empListErr)"""

# Insert sync call just before _attendanceLoadTable inside renderAttendance
OLD_AFTER_FORM = """  await _attendanceLoadTable(month, year)
  try { await _attLoadOutstationList() } catch(e) { console.warn(e) }
}"""

NEW_AFTER_FORM = """  // Sync notes UI from employee.work_base (staff Field/WFH); HR/admin default office
  try {
    let _attModeUi = 'office'
    if(isStaffOnly) {
      if(selfEmp && selfEmp.work_base === 'field') _attModeUi = 'field'
      else if(selfEmp && selfEmp.id && selfEmp.work_base == null) {
        try {
          const { data: _wbRow, error: _wbErr } = await sb.from('employees').select('work_base')
            .eq('id', selfEmp.id).eq('tenant_id', APP.tenant.id).maybeSingle()
          if(_wbErr && /work_base/i.test(_wbErr.message||'')) { /* column missing — soft-fail */ }
          else if(_wbRow && _wbRow.work_base === 'field') _attModeUi = 'field'
        } catch(_wbE) { console.warn('work_base fetch', _wbE) }
      }
    }
    if(typeof _attSyncNotesUi === 'function') _attSyncNotesUi(_attModeUi)
  } catch(_attUiE) { console.warn('att notes ui', _attUiE) }
  await _attendanceLoadTable(month, year)
  try { await _attLoadOutstationList() } catch(e) { console.warn(e) }
}"""

ATT_SYNC_FN = r'''
function _attSyncNotesUi(workMode) {
  const isBm = APP.language === 'bm'
  const badge = document.getElementById('att-work-mode-badge')
  const label = document.getElementById('att-notes-label')
  const ta = document.getElementById('att-notes')
  const hint = document.getElementById('att-notes-hint')
  if(!label || !ta) return
  const notesWord = isBm ? 'Catatan' : 'Notes'
  if(workMode === 'field') {
    if(badge) {
      badge.style.display = 'inline-block'
      badge.textContent = 'Field / WFH'
    }
    label.innerHTML = notesWord + ' <span style="color:var(--danger,#ef4444)">*</span> <span style="font-weight:500;font-size:11px;color:var(--text-3)">' + (isBm ? '(pelanggan / lokasi / tujuan)' : '(customer / location / purpose)') + '</span>'
    ta.placeholder = isBm ? 'Pelanggan / lokasi / tujuan (wajib)' : 'Customer / location / purpose (required)'
    if(hint) hint.textContent = isBm ? 'Kehadiran Field / WFH memerlukan catatan pelanggan, lokasi atau tujuan (min 3 aksara).' : 'Field / WFH attendance needs customer, location or purpose notes (min 3 characters).'
    ta.style.borderColor = 'var(--warning, #f59e0b)'
  } else {
    if(badge) {
      badge.style.display = 'inline-block'
      badge.textContent = isBm ? 'Pejabat' : 'Office'
    }
    label.textContent = notesWord
    ta.placeholder = ''
    if(hint) hint.textContent = ''
    ta.style.borderColor = ''
  }
}

'''

OLD_FIELD_TOAST_BLOCK = """  if(workMode === 'field' && policy.require_field_notes !== false && notes.length < 3) {
    showToast(isBm?'Field: catatan pelanggan/lokasi/tujuan wajib':'Field: customer/location/purpose notes required', 'error')
    return
  }"""

NEW_FIELD_TOAST_BLOCK = """  if(workMode === 'field' && policy.require_field_notes !== false && notes.length < 3) {
    if(typeof _attSyncNotesUi === 'function') _attSyncNotesUi('field')
    try { document.getElementById('att-notes')?.focus() } catch(_fnE) {}
    showToast(isBm?'Field / WFH: isi catatan pelanggan, lokasi atau tujuan (min 3 aksara)':'Field / WFH: enter customer, location or purpose notes (min 3 characters)', 'error')
    return
  }"""

# Soft-fail work_base lookup inside _attendanceSave (already try/catch; harden select error)
OLD_WB_LOOKUP = """  if(!canManageHR() && employeeId) {
    try {
      const { data: empRow } = await sb.from('employees').select('work_base')
        .eq('id', employeeId).eq('tenant_id', APP.tenant.id).maybeSingle()
      if(empRow && empRow.work_base === 'field') workMode = 'field'
      else workMode = 'office'
    } catch(e) { console.warn('work_base lookup', e) }
  }"""

NEW_WB_LOOKUP = """  if(!canManageHR() && employeeId) {
    try {
      const { data: empRow, error: empWbErr } = await sb.from('employees').select('work_base')
        .eq('id', employeeId).eq('tenant_id', APP.tenant.id).maybeSingle()
      if(empWbErr && /work_base/i.test(empWbErr.message||'')) { /* column missing */ }
      else if(empRow && empRow.work_base === 'field') workMode = 'field'
      else workMode = 'office'
    } catch(e) { console.warn('work_base lookup', e) }
  }"""


def main():
    if not INDEX.exists():
        print('ERROR: missing', INDEX, file=sys.stderr)
        sys.exit(1)
    html = INDEX.read_text(encoding='utf-8')
    changed = False
    notes = []

    if 'id="att-notes-wrap"' in html and 'att-notes-hint' in html:
        notes.append('notes form already patched')
    elif OLD_NOTES in html:
        html = html.replace(OLD_NOTES, NEW_NOTES, 1)
        changed = True
        notes.append('patched notes form-group UX')
    else:
        print('ERROR: notes form-group needle not found', file=sys.stderr)
        sys.exit(1)

    if "select('id,name,email,work_base')" in html and 'attendance employees list' in html:
        # may already be soft-fail version
        if 'empListErr && /work_base/i.test' in html:
            notes.append('employees work_base select already soft-fail')
        elif OLD_EMP_SELECT in html:
            html = html.replace(OLD_EMP_SELECT, NEW_EMP_SELECT, 1)
            changed = True
            notes.append('employees select + work_base soft-fail')
        else:
            notes.append('WARN: work_base select present but soft-fail pattern unclear')
    elif OLD_EMP_SELECT in html:
        html = html.replace(OLD_EMP_SELECT, NEW_EMP_SELECT, 1)
        changed = True
        notes.append('employees select + work_base soft-fail')
    else:
        print('ERROR: employees select needle not found', file=sys.stderr)
        sys.exit(1)

    if '_attSyncNotesUi(_attModeUi)' in html or 'Sync notes UI from employee.work_base' in html:
        notes.append('renderAttendance sync call already present')
    elif OLD_AFTER_FORM in html:
        html = html.replace(OLD_AFTER_FORM, NEW_AFTER_FORM, 1)
        changed = True
        notes.append('renderAttendance calls _attSyncNotesUi')
    else:
        print('ERROR: renderAttendance after-form needle not found', file=sys.stderr)
        sys.exit(1)

    if 'function _attSyncNotesUi(workMode)' in html:
        notes.append('_attSyncNotesUi already present')
    else:
        anchor = 'async function _attendanceSave()'
        idx = html.find(anchor)
        if idx < 0:
            print('ERROR: _attendanceSave not found', file=sys.stderr)
            sys.exit(1)
        html = html[:idx] + ATT_SYNC_FN + html[idx:]
        changed = True
        notes.append('inserted _attSyncNotesUi before _attendanceSave')

    if "Field / WFH: enter customer, location or purpose notes (min 3 characters)" in html:
        notes.append('field notes toast already clarified')
    elif OLD_FIELD_TOAST_BLOCK in html:
        html = html.replace(OLD_FIELD_TOAST_BLOCK, NEW_FIELD_TOAST_BLOCK, 1)
        changed = True
        notes.append('clarified field-notes toast + focus')
    else:
        print('ERROR: field notes toast needle not found', file=sys.stderr)
        sys.exit(1)

    if 'empWbErr && /work_base/i.test' in html:
        notes.append('save work_base soft-fail already present')
    elif OLD_WB_LOOKUP in html:
        html = html.replace(OLD_WB_LOOKUP, NEW_WB_LOOKUP, 1)
        changed = True
        notes.append('hardened save work_base soft-fail')
    else:
        notes.append('WARN: save work_base lookup needle miss (non-fatal)')

    # Sanity: validation still present
    if 'require_field_notes' not in html or 'notes.length < 3' not in html:
        print('ERROR: field-notes validation missing after patch — refuse', file=sys.stderr)
        sys.exit(1)

    if changed:
        INDEX.write_text(html, encoding='utf-8')
        print('patched', INDEX)
    else:
        print('already patched')
    for n in notes:
        print('-', n)


if __name__ == '__main__':
    main()
