(function () {
  function isBm() { return typeof APP !== 'undefined' && APP.language === 'bm'; }
  function ymd(s) { return s ? String(s).slice(0, 10) : ''; }
  function addDays(iso, n) {
    var d = iso ? new Date(iso + 'T00:00:00') : new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function addMonths(iso, n) {
    var d = iso ? new Date(iso + 'T00:00:00') : new Date();
    d.setMonth(d.getMonth() + n);
    return d.toISOString().slice(0, 10);
  }
  function hint(iso) {
    if (!iso) return '';
    if (typeof _expiryDaysInfo === 'function') {
      var info = _expiryDaysInfo(iso, isBm());
      return info ? ' ' + info.label : '';
    }
    return '';
  }
  function cellHtml(tid, field, val) {
    var v = ymd(val);
    var bm = isBm();
    return '<div class="admin-date-ui" data-tid="' + tid + '" data-field="' + field + '" onclick="event.stopPropagation()" style="display:flex;flex-direction:column;gap:4px;min-width:9.5rem">' +
      '<input type="date" class="form-input admin-date-input" value="' + v + '" style="font-size:12px;padding:4px 6px" ' +
        'onchange="window._adminSetTenantDate && window._adminSetTenantDate(\'' + tid + '\',\'' + field + '\',this.value)">' +
      '<div style="display:flex;gap:4px;flex-wrap:wrap">' +
        '<button type="button" class="btn btn-sm btn-outline" style="padding:2px 6px;font-size:10px" onclick="event.stopPropagation();window._adminBumpTenantDate(\'' + tid + '\',\'' + field + '\',\'w\')">' + (bm ? '+1 mg' : '+1w') + '</button>' +
        '<button type="button" class="btn btn-sm btn-outline" style="padding:2px 6px;font-size:10px" onclick="event.stopPropagation();window._adminBumpTenantDate(\'' + tid + '\',\'' + field + '\',\'m\')">' + (bm ? '+1 bln' : '+1m') + '</button>' +
        '<button type="button" class="btn btn-sm btn-outline" style="padding:2px 6px;font-size:10px" onclick="event.stopPropagation();window._adminBumpTenantDate(\'' + tid + '\',\'' + field + '\',\'y\')">' + (bm ? '+1 thn' : '+1y') + '</button>' +
        '<button type="button" class="btn btn-sm btn-outline" style="padding:2px 6px;font-size:10px" onclick="event.stopPropagation();window._adminSetTenantDate(\'' + tid + '\',\'' + field + '\',\'\')">' + (bm ? 'Padam' : 'Clear') + '</button>' +
      '</div>' +
      '<span class="admin-date-hint" style="font-size:10px;color:var(--text-3)">' + hint(v) + '</span>' +
    '</div>';
  }
  window._adminSetTenantDate = async function (tid, field, value) {
    if (typeof isPlatformAdmin === 'function' && !isPlatformAdmin()) return;
    var patch = {};
    patch[field] = value || null;
    if (field === 'trial_ends_at') patch.is_trial = !!value;
    var r = await sb.from('tenants').update(patch).eq('id', tid);
    if (r.error) {
      showToast(r.error.message, 'error');
      return;
    }
    var row = (_adminClientsData || []).find(function (d) { return d.id === tid; });
    if (row) {
      row[field] = value || null;
      if (field === 'trial_ends_at') row.is_trial = !!value;
    }
    var box = document.querySelector('.admin-date-ui[data-tid="' + tid + '"][data-field="' + field + '"]');
    if (box) {
      var inp = box.querySelector('input.admin-date-input');
      if (inp) inp.value = value || '';
      var h = box.querySelector('.admin-date-hint');
      if (h) h.textContent = hint(value);
    }
    showToast(isBm() ? 'Tarikh dikemaskini' : 'Date updated', 'success');
  };
  window._adminBumpTenantDate = function (tid, field, unit) {
    var row = (_adminClientsData || []).find(function (d) { return d.id === tid; });
    var cur = ymd(row && row[field]);
    var next = cur;
    if (unit === 'w') next = addDays(cur, 7);
    else if (unit === 'm') next = addMonths(cur, 1);
    else if (unit === 'y') next = addMonths(cur, 12);
    return window._adminSetTenantDate(tid, field, next);
  };
  function enhance() {
    var host = document.getElementById('admin-clients-table-host');
    if (!host) return;
    host.querySelectorAll('tbody tr').forEach(function (tr) {
      if (tr.dataset.dateUi) return;
      var chk = tr.querySelector('.admin-tenant-chk');
      if (!chk) return;
      var tid = chk.getAttribute('data-tenant-id');
      var row = (_adminClientsData || []).find(function (d) { return d.id === tid; });
      if (!row) return;
      var tds = tr.querySelectorAll('td');
      if (tds.length < 8) return;
      tds[6].innerHTML = cellHtml(tid, 'trial_ends_at', row.trial_ends_at);
      tds[7].innerHTML = cellHtml(tid, 'plan_expires_at', row.plan_expires_at);
      tr.dataset.dateUi = '1';
    });
  }
  function wrapTable() {
    var orig = window._adminClientsRenderTable;
    if (typeof orig !== 'function' || orig._dateUi) return;
    var w = function () {
      var ret = orig.apply(this, arguments);
      setTimeout(enhance, 0);
      return ret;
    };
    w._dateUi = true;
    window._adminClientsRenderTable = w;
  }
  function boot() {
    wrapTable();
    enhance();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setTimeout(boot, 500);
  setInterval(enhance, 1200);
})();
