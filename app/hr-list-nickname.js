/* HR employee list NAME column = nickname || name */
(function () {
  async function apply() {
    var wrap = document.getElementById('emp-list-wrap');
    if (!wrap || !window.sb || !APP.tenant) return;
    var rows = wrap.querySelectorAll('tbody tr');
    if (!rows.length) return;
    var q = await sb.from('employees').select('id,name,nickname,deleted_at').eq('tenant_id', APP.tenant.id);
    var map = {};
    (q.data || []).forEach(function (e) { map[e.id] = e; });
    rows.forEach(function (tr) {
      var cb = tr.querySelector('.hr-emp-check');
      if (!cb) return;
      var e = map[cb.value];
      if (!e) return;
      var td = tr.children[1];
      if (!td) return;
      td.textContent = e.nickname || e.name || td.textContent;
    });
  }
  function wrap() {
    var orig = window.renderEmployeeList;
    if (typeof orig !== 'function' || orig._nickList) return;
    window.renderEmployeeList = async function () {
      var r = await orig.apply(this, arguments);
      setTimeout(apply, 30);
      setTimeout(apply, 300);
      return r;
    };
    window.renderEmployeeList._nickList = true;
  }
  function boot() { wrap(); apply(); }
  setInterval(wrap, 1000);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
