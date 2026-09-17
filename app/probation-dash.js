/* Dashboard: Staff on Probation card */
(function () {
  function isBm() { return APP.language === 'bm'; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function daysLeft(end) {
    if (!end) return null;
    var t = new Date(String(end).slice(0, 10) + 'T00:00:00');
    var n = new Date(); n.setHours(0, 0, 0, 0);
    return Math.round((t - n) / 86400000);
  }
  function place(card) {
    card.style.margin = '0 0 14px';
    card.style.width = '100%';
    card.style.gridColumn = '1 / -1';
    var row = document.querySelector('.db-people-row-2');
    if (row && row.parentNode) {
      if (card.parentNode !== row.parentNode || card.previousElementSibling !== row) {
        row.parentNode.insertBefore(card, row.nextSibling);
      }
      return;
    }
    var tracker = document.getElementById('db-att-tracker');
    var host = tracker && tracker.closest('.db-card');
    if (host && host.parentNode) {
      host.parentNode.insertBefore(card, host.nextSibling);
      return;
    }
    var dash = document.getElementById('dashboard-wrap');
    if (dash && !card.parentNode) dash.appendChild(card);
  }
  async function render() {
    if (!document.getElementById('dashboard-wrap')) return;
    if (!window.sb || !APP.tenant) return;
    var existing = document.getElementById('db-sec-probation');
    if (existing) { place(existing); return; }
    var q = await sb.from('employees')
      .select('id,name,nickname,employment_status,probation_end_date,probation_months,confirmed_at')
      .eq('tenant_id', APP.tenant.id)
      .eq('employment_status', 'probation')
      .order('probation_end_date');
    if (q.error) return;
    var rows = q.data || [];
    var card = document.createElement('div');
    card.className = 'db-card';
    card.id = 'db-sec-probation';
    var body;
    if (!rows.length) {
      body = '<div style="font-size:13px;color:var(--db-text3)">' + (isBm() ? 'Tiada staf dalam percubaan.' : 'No staff on probation.') + '</div>';
    } else {
      body = rows.map(function (r) {
        var d = daysLeft(r.probation_end_date);
        var warn = d != null && d <= 3;
        var label = d == null ? '-' : (d < 0 ? (isBm() ? 'Lewat ' + Math.abs(d) + ' hari' : 'Overdue ' + Math.abs(d) + 'd') : (isBm() ? d + ' hari lagi' : d + ' days left'));
        return '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);' +
          (warn ? 'color:#b91c1c;font-weight:600' : '') + '">' +
          '<span>' + esc(r.nickname || r.name) + '</span>' +
          '<span style="font-size:12px;white-space:nowrap">' + esc(label) +
          ' · <a href="#" onclick="openPage(\'hr\',{view:\'employee-form\',id:\'' + r.id + '\'});return false">' +
          (isBm() ? 'Edit' : 'Edit') + '</a></span></div>';
      }).join('');
    }
    card.innerHTML = '<div class="db-card-title"><i class="ti ti-hourglass"></i> ' +
      (isBm() ? 'Staf Percubaan' : 'Staff on Probation') + '</div>' +
      '<div style="font-size:12px;color:var(--db-text3);margin:0 0 8px">' +
      (isBm() ? 'Tamat terdekat dahulu' : 'Soonest end date first') + '</div>' + body;
    place(card);
  }
  async function reminders() {
    if (!window.sb || window._prbReminded) return;
    window._prbReminded = true;
    try { await sb.rpc('check_probation_reminders'); } catch (e) {}
    try {
      var q = await sb.from('employees').select('name,probation_end_date').eq('tenant_id', APP.tenant.id).eq('employment_status', 'probation');
      (q.data || []).forEach(function (r) {
        var d = daysLeft(r.probation_end_date);
        if (d == null) return;
        if ([14, 7, 3, 1].indexOf(d) >= 0 || d <= 0) {
          var msg = d <= 0
            ? ('OVERDUE — ' + r.name + "'s probation ended without action — risk of automatic confirmation by conduct under Employment Act.")
            : (r.name + ' — probation ends in ' + d + ' day(s)');
          if (typeof _notifPushBell === 'function') _notifPushBell(msg, r.probation_end_date);
          if (typeof showToast === 'function' && d <= 3) showToast(msg, d <= 0 ? 'error' : 'warning');
        }
      });
    } catch (e) {}
  }
  function boot() {
    if (!document.getElementById('dashboard-wrap')) return;
    render();
    reminders();
  }
  ['renderDashboard', 'loadDashboardData'].forEach(function (name) {
    var orig = window[name];
    if (typeof orig !== 'function' || orig._prbDash) return;
    var w = async function () {
      var r = await orig.apply(this, arguments);
      setTimeout(boot, 200);
      return r;
    };
    w._prbDash = true; window[name] = w;
  });
  setInterval(function () {
    if (!document.getElementById('dashboard-wrap')) return;
    boot();
  }, 2000);
})();
