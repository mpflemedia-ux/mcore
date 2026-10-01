#!/usr/bin/env python3
"""Bake CRM Customers Source filter into app/index.html. Idempotent.

Scope ONLY:
  1) _crmState.source
  2) renderCustomerList toolbar #crm-source-filter (next to Sort)
  3) _crmLoad .eq('source', ...) + optional distinct source options
Does NOT touch: #crm-search, _crmSort options, renderCustomerForm/#cf-source/_crmSave,
crm-scan, table-fit, public form, CSS, print, sidebar, openPage, localStorage, SQL RPCs.
"""
from pathlib import Path

INDEX = Path("app/index.html")

PAIRS = [
    (
        "let _crmState = { search:'', sort:'name', dir:'asc', page:1, perPage:20, total:0, data:[] }",
        "let _crmState = { search:'', sort:'name', dir:'asc', page:1, perPage:20, total:0, data:[], source:'' }",
    ),
    (
        """      <select class=\"form-select\" style=\"width:auto\" onchange=\"_crmSort(this.value)\">
        <option value=\"name\" ${_crmState.sort==='name'?'selected':''}>${APP.language==='bm'?'Isih':' Sort'}: ${t.name}</option>
        <option value=\"created_at\" ${_crmState.sort==='created_at'?'selected':''}>${APP.language==='bm'?'Isih':'Sort'}: ${t.created}</option>
        <option value=\"city\" ${_crmState.sort==='city'?'selected':''}>${APP.language==='bm'?'Isih':'Sort'}: ${t.city}</option>
      </select>
    </div>""",
        """      <select class=\"form-select\" style=\"width:auto\" onchange=\"_crmSort(this.value)\">
        <option value=\"name\" ${_crmState.sort==='name'?'selected':''}>${APP.language==='bm'?'Isih':' Sort'}: ${t.name}</option>
        <option value=\"created_at\" ${_crmState.sort==='created_at'?'selected':''}>${APP.language==='bm'?'Isih':'Sort'}: ${t.created}</option>
        <option value=\"city\" ${_crmState.sort==='city'?'selected':''}>${APP.language==='bm'?'Isih':'Sort'}: ${t.city}</option>
      </select>
      <select id=\"crm-source-filter\" class=\"form-select\" style=\"width:auto;min-width:140px;max-width:200px\" onchange=\"_crmState.source=this.value;_crmState.page=1;_crmLoad()\">
        <option value=\"\">${APP.language==='bm'?'Semua sumber':'All sources'}</option>
      </select>
    </div>""",
    ),
    (
        """  if(_crmState.search) {
    const s = _crmState.search.trim()
    q = q.or(`name.ilike.%${s}%,email.ilike.%${s}%,phone.ilike.%${s}%`)
  }

  const from = (_crmState.page-1)*_crmState.perPage""",
        """  if(_crmState.search) {
    const s = _crmState.search.trim()
    q = q.or(`name.ilike.%${s}%,email.ilike.%${s}%,phone.ilike.%${s}%`)
  }
  if(_crmState.source) q = q.eq('source', _crmState.source)

  // Tenant-specific source filter options (preserve selection; toolbar not re-rendered)
  try {
    const {data: srcRows} = await sb.from('customers').select('source')
      .eq('tenant_id', APP.tenant.id).is('deleted_at', null).not('source', 'is', null).neq('source', '')
    const filt = document.getElementById('crm-source-filter')
    if (filt && srcRows) {
      const keep = _crmState.source || ''
      const uniq = [...new Set(srcRows.map(r => String(r.source||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b))
      const esc = (s) => String(s).replace(/&/g,'&amp;').replace(/\"/g,'&quot;').replace(/</g,'&lt;')
      const allLabel = APP.language==='bm'?'Semua sumber':'All sources'
      filt.innerHTML = `<option value=\"\">${allLabel}</option>` + uniq.map(s => `<option value=\"${esc(s)}\" ${s===keep?'selected':''}>${esc(s)}</option>`).join('')
    }
  } catch (e) {}

  const from = (_crmState.page-1)*_crmState.perPage""",
    ),
    (
        """    wrap.innerHTML = `<div class=\"empty-state\" style=\"padding:60px\"><i class=\"ti ti-users\" style=\"font-size:48px;opacity:.2\"></i><p>${_crmState.search ? t.noResult : t.noData}</p>${!_crmState.search?`<button class=\"btn btn-primary btn-sm\" onclick=\"openPage('crm',{view:'form'})\"><i class=\"ti ti-plus\"></i> ${t.add}</button>`:''}</div>`""",
        """    wrap.innerHTML = `<div class=\"empty-state\" style=\"padding:60px\"><i class=\"ti ti-users\" style=\"font-size:48px;opacity:.2\"></i><p>${(_crmState.search || _crmState.source) ? t.noResult : t.noData}</p>${!(_crmState.search || _crmState.source)?`<button class=\"btn btn-primary btn-sm\" onclick=\"openPage('crm',{view:'form'})\"><i class=\"ti ti-plus\"></i> ${t.add}</button>`:''}</div>`""",
    ),
]


def main():
    html = INDEX.read_text(encoding="utf-8")
    if (
        'id="crm-source-filter"' in html
        and "if(_crmState.source) q = q.eq('source', _crmState.source)" in html
        and "source:''" in html
        and "let _crmState = { search:'', sort:'name', dir:'asc', page:1, perPage:20, total:0, data:[], source:'' }" in html
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
    INDEX.write_text(html2, encoding="utf-8")
    print("patched CRM customer source filter (%d replacements)" % applied)


if __name__ == "__main__":
    main()
