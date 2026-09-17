/* Join date on Employment Status box */
(function () {
  function isBm() { return APP.language === 'bm'; }
  function inject() {
    var box = document.getElementById('prb-box');
    if (!box || document.getElementById('prb-join')) return;
    var months = document.getElementById('prb-months');
    var wrap = document.createElement('div');
    wrap.style.margin = '8px 0';
    wrap.innerHTML =
      '<label class="form-label">' + (isBm() ? 'Tarikh mula kerja' : 'Join date') + '</label>' +
      '<input id="prb-join" class="form-input" type="date" style="max-width:200px">';
    if (months && months.parentNode) months.parentNode.insertBefore(wrap, months);
    else box.appendChild(wrap);
    wrap.querySelector('#prb-join').addEventListener('change', function () {
      box.setAttribute('data-dirty', '1');
    });
    load();
  }
  async function load() {
    var el = document.getElementById('prb-join');
    if (!el || !window.sb || !APP.tenant) return;
    var id = window._prbEditingId || (document.getElementById('prb-box') && document.getElementById('prb-box').getAttribute('data-emp-id'));
    if (!id) return;
    var q = await sb.from('employees').select('join_date,probation_start_date,created_at').eq('id', id).maybeSingle();
    var e = q.data;
    if (!e) return;
    var d = e.join_date || e.probation_start_date || (e.created_at && String(e.created_at).slice(0, 10));
    if (d) el.value = String(d).slice(0, 10);
  }
  function wrapSave() {
    var orig = window._employeeSave;
    if (typeof orig !== 'function' || orig._prbJoin) return;
    window._employeeSave = async function () {
      var join = ((document.getElementById('prb-join') || {}).value || '').trim() || null;
      var eid = window._prbEditingId || (window._prbResolveEmpId && window._prbResolveEmpId.apply(this, arguments));
      if (eid && join && window.sb) {
        await sb.from('employees').update({ join_date: join, probation_start_date: join }).eq('id', eid).eq('tenant_id', APP.tenant.id);
      }
      var r = await orig.apply(this, arguments);
      if (eid && join && window.sb) {
        await sb.from('employees').update({ join_date: join, probation_start_date: join }).eq('id', eid).eq('tenant_id', APP.tenant.id);
      }
      return r;
    };
    window._employeeSave._prbJoin = true;
  }
  function boot() { inject(); wrapSave(); }
  setInterval(boot, 900);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
