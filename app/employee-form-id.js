/* Keep employee-form id in hash + reload probation box from live row */
(function () {
  function uuidLike(v) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v || ''));
  }
  function wrapNav() {
    var orig = window._navHistoryUrl;
    if (typeof orig !== 'function' || orig._empIdHash) return;
    window._navHistoryUrl = function (page, params) {
      var u = orig.apply(this, arguments);
      if (params && uuidLike(params.id) && u.indexOf('id=') < 0) u += (u.indexOf('?') >= 0 ? '&' : '?') + 'id=' + params.id;
      return u;
    };
    window._navHistoryUrl._empIdHash = true;
  }
  function idFromHash() {
    var m = String(location.hash || '').match(/[?&]id=([0-9a-f-]{36})/i);
    return m ? m[1] : null;
  }
  async function liveEmp() {
    if (!window.sb || !APP.tenant) return null;
    var id = (window._prbResolveEmpId && window._prbResolveEmpId()) || idFromHash() || window._prbEditingId;
    if (uuidLike(id)) {
      var q = await sb.from('employees').select('*').eq('id', id).eq('tenant_id', APP.tenant.id).maybeSingle();
      if (q.data) return q.data;
    }
    var ic = ((document.getElementById('emp-ic') || {}).value || '').trim();
    var nick = ((document.getElementById('emp-nickname') || {}).value || '').trim();
    if (ic) {
      var q2 = await sb.from('employees').select('*').eq('tenant_id', APP.tenant.id).eq('ic_no', ic).is('deleted_at', null).order('created_at', { ascending: false }).limit(1);
      if (q2.data && q2.data[0]) return q2.data[0];
    }
    if (nick) {
      var q3 = await sb.from('employees').select('*').eq('tenant_id', APP.tenant.id).eq('nickname', nick).is('deleted_at', null).limit(1);
      if (q3.data && q3.data[0]) return q3.data[0];
    }
    return null;
  }
  async function paint() {
    var box = document.getElementById('prb-box');
    if (!box) return;
    var emp = await liveEmp();
    if (!emp) return;
    window._prbEditingId = emp.id;
    box.setAttribute('data-emp-id', emp.id);
    var al = document.getElementById('prb-al');
    var am = document.getElementById('prb-am');
    var ac = document.getElementById('prb-ac');
    var af = document.getElementById('prb-af');
    var mo = document.getElementById('prb-months');
    if (al) al.checked = !!emp.allow_leave_during_probation;
    if (am) am.checked = !!emp.allow_medical_claim_during_probation;
    if (ac) ac.checked = !!emp.allow_sales_commission_during_probation;
    if (af) af.checked = !!emp.allow_full_access_during_probation;
    if (mo && emp.probation_months) mo.value = emp.probation_months;
    var badge = document.getElementById('prb-badge');
    if (badge) {
      var isBm = APP.language === 'bm';
      if (emp.employment_status === 'permanent') {
        badge.textContent = isBm ? 'Tetap' : 'Permanent';
      } else {
        badge.textContent = isBm ? 'Percubaan' : 'Probation';
      }
    }
  }
  function wrapForm() {
    var orig = window.renderEmployeeForm;
    if (typeof orig !== 'function' || orig._empIdHash) return;
    window.renderEmployeeForm = async function (id) {
      if (!id) id = idFromHash();
      if (uuidLike(id)) window._prbEditingId = id;
      var r = await orig.apply(this, arguments);
      setTimeout(paint, 80);
      setTimeout(paint, 400);
      return r;
    };
    window.renderEmployeeForm._empIdHash = true;
  }
  function boot() {
    wrapNav();
    wrapForm();
    paint();
  }
  setInterval(boot, 1000);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
