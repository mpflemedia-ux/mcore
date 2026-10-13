/* M-Core Service Desk - additive contract status chip in Admin › All Clients table (name cell). No other change. */
(function () {
  var SD = window.SD; if (!SD || SD._ext) return; SD._ext = 1;
  var cache = null, at = 0;
  function contracts() {
    if (cache && Date.now() - at < 60000) return Promise.resolve(cache);
    return Promise.resolve(sb.from('service_contracts').select('tenant_id,status,start_date,end_date,payment_status').is('deleted_at', null)).then(function (r) {
      if (r.error) return {};
      var m = {}; (r.data || []).forEach(function (c) {
        var p = m[c.tenant_id], rank = { active: 3, draft: 2, expired: 1, cancelled: 0 };
        if (!p || rank[SD.cStatus(c)] > rank[SD.cStatus(p)]) m[c.tenant_id] = c;
      });
      cache = m; at = Date.now(); return m;
    }, function () { return {}; });
  }
  function paint() {
    if (!SD.isPA() || !SD.has.contracts || !SD.cChip) return;
    contracts().then(function (m) {
      document.querySelectorAll('#admin-clients-table-host tbody tr').forEach(function (tr) {
        var chk = tr.querySelector('.admin-tenant-chk'); if (!chk || tr.querySelector('.sd-chip')) return;
        var c = m[chk.getAttribute('data-tenant-id')]; if (!c) return;
        var td = chk.closest('td') ? chk.closest('td').nextElementSibling : null; td = td || tr.children[1]; if (!td) return;
        var s = document.createElement('span'); s.className = 'sd-chip'; s.title = SD.L('Service contract', 'Kontrak servis') + (c.payment_status !== 'paid' ? ' · ' + SD.L('Unpaid', 'Belum dibayar') : '');
        s.innerHTML = SD.cChip(c).replace('</span>', (c.payment_status !== 'paid' && SD.cStatus(c) !== 'cancelled' ? ' <i class="ti ti-lock"></i>' : '') + '</span>');
        (td.querySelector('b,strong,a,div') || td).appendChild(s);
      });
    });
  }
  function wrap() {
    var o = window._adminClientsRenderTable;
    if (typeof o !== 'function' || o._sdChip) return false;
    var w = function () { var r = o.apply(this, arguments); setTimeout(paint, 30); return r; };
    w._sdChip = 1; window._adminClientsRenderTable = w; return true;
  }
  var n = 0; (function tick() { wrap(); if (++n < 40) setTimeout(tick, 500); })();
  SD.contractChips = paint;
})();
