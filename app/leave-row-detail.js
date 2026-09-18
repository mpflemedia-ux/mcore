/* Leave list: tap row to expand details (type, dates, days, half-day, reason) */
(function () {
  function isBm() { return APP.language === 'bm'; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function typeLabel(ty) {
    var m = isBm()
      ? { annual: 'Tahunan', medical: 'Sakit', emergency: 'Kecemasan', unpaid: 'Tanpa Gaji' }
      : { annual: 'Annual', medical: 'Medical', emergency: 'Emergency', unpaid: 'Unpaid' };
    return m[ty] || ty || '-';
  }
  function bind() {
    var wrap = document.getElementById('lv-table-wrap');
    if (!wrap) return;
    var rows = wrap.querySelectorAll('tbody tr');
    rows.forEach(function (tr) {
      if (tr._lvDet) return;
      tr._lvDet = true;
      tr.style.cursor = 'pointer';
      tr.addEventListener('click', function (ev) {
        if (ev.target.closest('button,a,input')) return;
        toggle(tr);
      });
    });
  }
  async function toggle(tr) {
    var next = tr.nextElementSibling;
    if (next && next.classList.contains('lv-detail-row')) {
      next.remove();
      return;
    }
    wrapClear(tr);
    var btn = tr.querySelector('[onclick*="_leaveApprove"], [onclick*="_leaveReject"]');
    var id = null;
    var html = tr.innerHTML;
    var m = html.match(/_leaveApprove\('([0-9a-f-]{36})'/i) || html.match(/_leaveReject\('([0-9a-f-]{36})'/i);
    if (m) id = m[1];
    if (!id && window._leaveRequests) {
      var name = (tr.children[0] && tr.children[0].textContent || '').trim();
      var start = (tr.children[2] && tr.children[2].textContent || '').trim();
      var hit = (_leaveRequests || []).find(function (r) {
        return String((r.employees && r.employees.name) || '').indexOf(name.split('\n')[0]) >= 0;
      });
      if (hit) id = hit.id;
    }
    var detail = document.createElement('tr');
    detail.className = 'lv-detail-row';
    var cell = document.createElement('td');
    cell.colSpan = tr.children.length || 8;
    cell.style.background = 'rgba(15,23,42,.45)';
    cell.style.padding = '12px';
    cell.style.fontSize = '13px';
    cell.textContent = isBm() ? 'Memuatkan...' : 'Loading...';
    detail.appendChild(cell);
    tr.parentNode.insertBefore(detail, tr.nextSibling);
    if (!id || !window.sb) {
      cell.textContent = isBm() ? 'Tidak jumpa rekod.' : 'Record not found.';
      return;
    }
    var q = await sb.from('leave_requests')
      .select('id,leave_type,start_date,end_date,days_count,status,reason,is_half_day,half_session,employee_id')
      .eq('id', id).maybeSingle();
    var l = q.data;
    if (!l) { cell.textContent = (q.error && q.error.message) || 'No data'; return; }
    var nick = '';
    try {
      var e = await sb.from('employees').select('name,nickname').eq('id', l.employee_id).maybeSingle();
      nick = (e.data && (e.data.nickname || e.data.name)) || '';
    } catch (err) {}
    var half = l.is_half_day || Number(l.days_count) === 0.5;
    var sess = l.half_session === 'pm' ? (isBm() ? 'Petang (PM)' : 'Afternoon (PM)') : (isBm() ? 'Pagi (AM)' : 'Morning (AM)');
    cell.innerHTML =
      '<div style="display:grid;gap:6px;max-width:520px">' +
      '<div><b>' + (isBm() ? 'Pekerja' : 'Employee') + '</b>: ' + esc(nick) + '</div>' +
      '<div><b>' + (isBm() ? 'Jenis' : 'Type') + '</b>: ' + esc(typeLabel(l.leave_type)) +
      (half ? ' · ' + (isBm() ? 'Setengah hari' : 'Half-day') + ' ' + sess : '') + '</div>' +
      '<div><b>' + (isBm() ? 'Tarikh' : 'Dates') + '</b>: ' + esc(l.start_date) + ' → ' + esc(l.end_date) + '</div>' +
      '<div><b>' + (isBm() ? 'Hari' : 'Days') + '</b>: ' + esc(l.days_count) + '</div>' +
      '<div><b>Status</b>: ' + esc(l.status || '-') + '</div>' +
      '<div><b>' + (isBm() ? 'Sebab' : 'Reason') + '</b>: ' + esc(l.reason || '-') + '</div>' +
      '</div>';
  }
  function wrapClear(except) {
    var wrap = document.getElementById('lv-table-wrap');
    if (!wrap) return;
    wrap.querySelectorAll('.lv-detail-row').forEach(function (r) {
      if (!except || r.previousElementSibling !== except) r.remove();
    });
  }
  function wrap() {
    var orig = window._leaveLoadTable;
    if (typeof orig !== 'function' || orig._lvDet) return;
    window._leaveLoadTable = async function () {
      var r = await orig.apply(this, arguments);
      setTimeout(bind, 40);
      setTimeout(bind, 300);
      return r;
    };
    window._leaveLoadTable._lvDet = true;
  }
  function boot() { wrap(); bind(); }
  setInterval(boot, 1000);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
