/* Resolve employee id + persist probation flags (snapshot survives form re-render) */
(function () {
  function uuidLike(v) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v || ''));
  }
  function resolveId(arg) {
    if (uuidLike(arg)) return arg;
    if (uuidLike(window._prbEditingId)) return window._prbEditingId;
    try {
      var st = history.state;
      if (st && st.params && uuidLike(st.params.id)) return st.params.id;
    } catch (e) {}
    var box = document.getElementById('prb-box');
    if (box && uuidLike(box.getAttribute('data-emp-id'))) return box.getAttribute('data-emp-id');
    var btn = document.querySelector('[onclick*="_employeeSave("]');
    if (btn) {
      var m = String(btn.getAttribute('onclick') || '').match(/_employeeSave\('([0-9a-f-]{36})'/i);
      if (m) return m[1];
    }
    return null;
  }
  window._prbResolveEmpId = resolveId;

  async function lookupId() {
    var id = resolveId();
    if (id) return id;
    if (!window.sb || !APP.tenant) return null;
    var ic = ((document.getElementById('emp-ic') || {}).value || '').trim();
    var name = ((document.getElementById('emp-name') || {}).value || '').trim();
    var nick = ((document.getElementById('emp-nickname') || {}).value || '').trim();
    if (ic) {
      var q = await sb.from('employees').select('id').eq('tenant_id', APP.tenant.id).eq('ic_no', ic).limit(1);
      if (q.data && q.data[0]) return q.data[0].id;
    }
    if (name) {
      var q2 = await sb.from('employees').select('id').eq('tenant_id', APP.tenant.id).eq('name', name).limit(1);
      if (q2.data && q2.data[0]) return q2.data[0].id;
    }
    if (nick) {
      var q3 = await sb.from('employees').select('id').eq('tenant_id', APP.tenant.id).eq('nickname', nick).limit(1);
      if (q3.data && q3.data[0]) return q3.data[0].id;
    }
    return null;
  }

  function flags() {
    return {
      probation_months: Number((document.getElementById('prb-months') || {}).value || 6),
      allow_leave_during_probation: !!(document.getElementById('prb-al') && document.getElementById('prb-al').checked),
      allow_medical_claim_during_probation: !!(document.getElementById('prb-am') && document.getElementById('prb-am').checked),
      allow_sales_commission_during_probation: !!(document.getElementById('prb-ac') && document.getElementById('prb-ac').checked),
      allow_full_access_during_probation: !!(document.getElementById('prb-af') && document.getElementById('prb-af').checked)
    };
  }

  async function writeFlags(eid, snap) {
    if (!eid || !window.sb) return;
    var up = await sb.from('employees').update(snap).eq('id', eid).eq('tenant_id', APP.tenant.id);
    if (up.error && typeof showToast === 'function') showToast('Probation save: ' + up.error.message, 'error');
    return up;
  }

  function wrapForm() {
    var orig = window.renderEmployeeForm;
    if (typeof orig !== 'function' || orig._prbSaveId) return;
    window.renderEmployeeForm = async function (id) {
      if (uuidLike(id)) window._prbEditingId = id;
      return orig.apply(this, arguments);
    };
    window.renderEmployeeForm._prbSaveId = true;
  }
  function wrapSave() {
    var orig = window._employeeSave;
    if (typeof orig !== 'function' || orig._prbSnap) return;
    window._employeeSave = async function (id) {
      var snap = flags();
      var eid = resolveId(id) || await lookupId();
      if (eid) window._prbEditingId = eid;
      await writeFlags(eid, snap);
      var r = await orig.apply(this, arguments);
      await writeFlags(eid, snap);
      return r;
    };
    window._employeeSave._prbSnap = true;
    window._employeeSave._prb = true;
  }
  function boot() {
    wrapForm();
    wrapSave();
  }
  setInterval(boot, 600);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
