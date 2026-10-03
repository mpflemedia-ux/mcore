#!/usr/bin/env python3
"""Bake planner support-mode CRM client dropdown into app/index.html. Idempotent.

When platform admin is in support mode (sessionStorage mcore_support_session,
the key support-tenant.js already writes), #pl-tenant lists that tenant's
customers and save writes customer_id. Otherwise the dropdown still lists
tenants and save writes related_tenant_id. Does not wrap functions.
"""
from pathlib import Path

INDEX = Path("app/index.html")

HELPER = """function _plannerInSupport() {
  // Existing support-tenant.js signal. Do not invent a second flag.
  if (!isPlatformAdmin()) return false
  try { return !!sessionStorage.getItem('mcore_support_session') } catch (e) { return false }
}

"""

OLD_LOAD = """async function _plannerLoadTenantOptions() {
  const sel = document.getElementById('pl-tenant')
  if (!sel) return
  try {
    const { data } = await sb.from('tenants').select('id,name,code').is('deleted_at', null).order('name').limit(200)
    const cur = sel.value
    sel.innerHTML = '<option value="">—</option>' + (data || []).map(x =>
      `<option value="${x.id}">${_aiEscapeHtml(x.name || x.code || x.id)}</option>`).join('')
    if (cur) sel.value = cur
  } catch (e) { console.warn('planner tenants', e) }
}"""

NEW_LOAD = """async function _plannerLoadTenantOptions() {
  const sel = document.getElementById('pl-tenant')
  if (!sel) return
  const support = _plannerInSupport()
  try {
    let data = []
    if (support) {
      const tid = APP.tenant && APP.tenant.id
      if (!tid) return
      const res = await sb.from('customers').select('id,name,code').eq('tenant_id', tid).is('deleted_at', null).order('name').limit(1000)
      if (res.error) throw res.error
      data = res.data || []
    } else {
      const res = await sb.from('tenants').select('id,name,code').is('deleted_at', null).order('name').limit(200)
      if (res.error) throw res.error
      data = res.data || []
    }
    const cur = sel.value
    sel.innerHTML = '<option value="">—</option>' + (data || []).map(x =>
      `<option value="${x.id}">${_aiEscapeHtml(x.name || x.code || x.id)}</option>`).join('')
    if (cur) sel.value = cur
  } catch (e) { console.warn(support ? 'planner customers' : 'planner tenants', e) }
}"""

OLD_SELECT = "let q = sb.from('platform_activities').select('id,title,activity_type,status,starts_at,ends_at,due_at,remind_at,related_tenant_id,notes,owner_user_id')"
NEW_SELECT = """const support = _plannerInSupport()
    let q = sb.from('platform_activities').select('id,title,activity_type,status,starts_at,ends_at,due_at,remind_at,related_tenant_id,notes,owner_user_id' + (support ? ',customer_id' : ''))"""

OLD_MAP = """    // Tenant names without FK embed (related_tenant_id has no schema relationship)
    let tenantMap = {}
    try {
      const ids = []
      rows.forEach(function (r) { if (r.related_tenant_id) ids.push(r.related_tenant_id) })
      const uniq = ids.filter(function (v, i, a) { return a.indexOf(v) === i })
      if (uniq.length) {
        const { data: tns } = await sb.from('tenants').select('id,name,code').in('id', uniq)
        ;(tns || []).forEach(function (x) { tenantMap[x.id] = x.name || x.code || '' })
      }
    } catch (e) {}"""

NEW_MAP = """    // Support mode: CRM customer names. Otherwise tenant names (related_tenant_id has no schema relationship).
    let tenantMap = {}
    let customerMap = {}
    try {
      if (support) {
        const ids = []
        rows.forEach(function (r) { if (r.customer_id) ids.push(r.customer_id) })
        const uniq = ids.filter(function (v, i, a) { return a.indexOf(v) === i })
        if (uniq.length) {
          const { data: custs } = await sb.from('customers').select('id,name,code').in('id', uniq).eq('tenant_id', APP.tenant.id)
          ;(custs || []).forEach(function (x) { customerMap[x.id] = x.name || x.code || '' })
        }
      } else {
        const ids = []
        rows.forEach(function (r) { if (r.related_tenant_id) ids.push(r.related_tenant_id) })
        const uniq = ids.filter(function (v, i, a) { return a.indexOf(v) === i })
        if (uniq.length) {
          const { data: tns } = await sb.from('tenants').select('id,name,code').in('id', uniq)
          ;(tns || []).forEach(function (x) { tenantMap[x.id] = x.name || x.code || '' })
        }
      }
    } catch (e) {}"""

OLD_CLIENT = "const client = r.related_tenant_id ? (tenantMap[r.related_tenant_id] || '') : ''"
NEW_CLIENT = "const client = support ? (r.customer_id ? (customerMap[r.customer_id] || '') : '') : (r.related_tenant_id ? (tenantMap[r.related_tenant_id] || '') : '')"

OLD_SET = "document.getElementById('pl-tenant').value = data.related_tenant_id || ''"
NEW_SET = "document.getElementById('pl-tenant').value = (_plannerInSupport() ? (data.customer_id || '') : (data.related_tenant_id || ''))"

def apply():
    html = INDEX.read_text(encoding="utf-8")
    if (
        "function _plannerInSupport()" in html
        and "sb.from('customers').select('id,name,code').eq('tenant_id', tid)" in html
        and "payload.customer_id = clientPick" in html
        and "const client = support ?" in html
    ):
        print("already patched")
        return
    old_payload = """  const payload = {
    owner_user_id: APP.user.id,
    tenant_id: APP.tenant.id,
    title,
    activity_type: document.getElementById('pl-type').value || 'todo',
    related_tenant_id: (isPlatformAdmin() && document.getElementById('pl-tenant')) ? (document.getElementById('pl-tenant').value || null) : null,
    starts_at: _plannerFromLocalInput(document.getElementById('pl-start').value),"""
    new_payload = """  const support = _plannerInSupport()
  const clientPick = (isPlatformAdmin() && document.getElementById('pl-tenant')) ? (document.getElementById('pl-tenant').value || null) : null
  const payload = {
    owner_user_id: APP.user.id,
    tenant_id: APP.tenant.id,
    title,
    activity_type: document.getElementById('pl-type').value || 'todo',
    starts_at: _plannerFromLocalInput(document.getElementById('pl-start').value),"""
    old_after = """    notes: (document.getElementById('pl-notes').value || '').trim() || null,
    updated_at: new Date().toISOString()
  }
  // Default due for todo if only remind set"""
    new_after = """    notes: (document.getElementById('pl-notes').value || '').trim() || null,
    updated_at: new Date().toISOString()
  }
  if (support) {
    // Customer uuid must not go in related_tenant_id (FK -> tenants).
    payload.customer_id = clientPick
  } else if (isPlatformAdmin()) {
    payload.related_tenant_id = clientPick
  } else {
    payload.related_tenant_id = null
  }
  // Default due for todo if only remind set"""

    steps = [
        ("helper", "async function _plannerLoadTenantOptions() {", HELPER + "async function _plannerLoadTenantOptions() {", False),
        ("load", OLD_LOAD, NEW_LOAD, False),
        ("select", OLD_SELECT, NEW_SELECT, False),
        ("map", OLD_MAP, NEW_MAP, False),
        ("client", OLD_CLIENT, NEW_CLIENT, False),
        ("set", OLD_SET, NEW_SET, False),
        ("payload", old_payload, new_payload, False),
        ("after", old_after, new_after, False),
    ]
    html2 = html
    applied = []
    for name, old, new, _ in steps:
        if name == "helper" and "function _plannerInSupport()" in html2:
            continue
        if new in html2 and old not in html2:
            continue
        n = html2.count(old)
        if n != 1:
            raise SystemExit("marker %s count=%s" % (name, n))
        html2 = html2.replace(old, new, 1)
        applied.append(name)
    if html2 == html:
        raise SystemExit("no changes applied")
    # guard: non-support path must not assign customer ids into related_tenant_id inside support branch
    if "payload.customer_id = clientPick" not in html2:
        raise SystemExit("customer_id assign missing")
    if html2.count("function _plannerInSupport()") != 1:
        raise SystemExit("helper count")
    INDEX.write_text(html2, encoding="utf-8")
    print("patched planner support customers:", ",".join(applied))

if __name__ == "__main__":
    apply()
