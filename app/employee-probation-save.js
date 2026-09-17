/* Persist probation fields BEFORE _employeeSave re-renders the form */
(function () {
  function empId(arg) {
    if (arg && String(arg).length > 10) return arg;
    try {
      var st = history.state;
      if (st && st.params && st.params.id) return st.params.id;
    } catch (e) {}
    return window._prbEditingId || null;
  }
  function readFlags() {
    return {
      probation_months: Number((document.getElementById('prb-months') || {}).value || 6),
      allow_leave_during_probation: !!(document.getElementById('prb-al') && document.getElementById('prb-al').checked),
      allow_medical_claim_during_probation: !!(document.getElementById('prb-am') && document.getElementById('prb-am').checked),
      allow_sales_commission_during_probation: !!(document.getElementById('prb-ac') && document.getElementById('prb-ac').checked),
      allow_full_access_during_probation: !!(document.getElementById('prb-af') && document.getElementById('prb-af').checked)
    };
  }
  function wrapForm() {
    var orig = window.renderEmployeeForm;
    if (typeof orig !== 'function' || orig._prbSaveId) return;
    window.renderEmployeeForm = async function (id) {
      if (id) window._prbEditingId = id;
      return orig.apply(this, arguments);
    };
    window.renderEmployeeForm._prbSaveId = true;
  }
  function wrapSave() {
    var orig = window._employeeSave;
    if (typeof orig !== 'function' || orig._prbSaveFirst) return;
    window._employeeSave = async function (id) {
      var eid = empId(id);
      var flags = readFlags();
      if (eid && window.sb && document.getElementById('prb-box')) {
        var up = await sb.from('employees').update(flags).eq('id', eid).eq('tenant_id', APP.tenant.id);
        if (up.error) console.warn('probation pre-save', up.error.message);
      }
      return orig.apply(this, arguments);
    };
    window._employeeSave._prbSaveFirst = true;
  }
  function boot() {
    wrapForm();
    wrapSave();
  }
  setInterval(boot, 800);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
