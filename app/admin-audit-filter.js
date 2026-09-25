(function () {
  var S = { q: '', action: 'all', tenant: 'all', sort: 'created_at', dir: 'desc', rows: [] };
  function bm() { return typeof APP !== 'undefined' && APP.language === 'bm'; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function detailsText(d) {
    if (d == null) return '—';
    if (typeof d === 'string') return d;
    if (typeof d === 'object') {
      return Object.keys(d).map(function (k) { return k + ': ' + (d[k] == null ? '—' : d[k]); }).join(', ');
    }
    return String(d);
  }
  function actionLabel(a) {
    var map = bm()
      ? { suspend_tenant: 'Gantung', reactivate_tenant: 'Aktifkan Semula', set_tenant_plan: 'Tukar Pelan', create_announcement: 'Pengumuman', record_tenant_payment: 'Rekod Bayaran', soft_delete_tenant: 'Padam (lembut)', enter_support_tenant: 'Masuk workspace', exit_support_tenant: 'Keluar workspace' }
      : { suspend_tenant: 'Suspend', reactivate_tenant: 'Reactivate', set_tenant_plan: 'Plan Change', create_announcement: 'Announcement', record_tenant_payment: 'Payment Recorded', soft_delete_tenant: 'Soft-delete', enter_support_tenant: 'Enter workspace', exit_support_tenant: 'Exit workspace' };
    return map[a] || a || '—';
  }
  function filtered() {
    var q = S.q.toLowerCase();
    var rows = S.rows.filter(function (r) {
      if (S.action !== 'all' && r.action !== S.action) return false;
      if (S.tenant !== 'all' && String(r.target_tenant_name || '') !== S.tenant) return false;
      if (!q) return true;
      var blob = [r.actor_email, r.action, actionLabel(r.action), r.target_tenant_name, detailsText(r.details)].join(' ').toLowerCase();
      return blob.indexOf(q) >= 0;
    });
    rows.sort(function (a, b) {
      var av, bv;
      if (S.sort === 'actor_email') { av = a.actor_email || ''; bv = b.actor_email || ''; }
      else if (S.sort === 'action') { av = actionLabel(a.action); bv = actionLabel(b.action); }
      else if (S.sort === 'target_tenant_name') { av = a.target_tenant_name || ''; bv = b.target_tenant_name || ''; }
      else { av = a.created_at || ''; bv = b.created_at || ''; }
      if (av < bv) return S.dir === 'asc' ? -1 : 1;
      if (av > bv) return S.dir === 'asc' ? 1 : -1;
      return 0;
    });
    return rows;
  }
  function paint() {
    var wrap = document.getElementById('admin-audit-wrap');
    if (!wrap) return;
    var isBm = bm();
    var rows = filtered();
    var actions = [];
    var tenants = [];
    S.rows.forEach(function (r) {
      if (r.action && actions.indexOf(r.action) < 0) actions.push(r.action);
      if (r.target_tenant_name && tenants.indexOf(r.target_tenant_name) < 0) tenants.push(r.target_tenant_name);
    });
    actions.sort();
    tenants.sort();
    var arrow = function (col) { return S.sort === col ? (S.dir === 'asc' ? ' ▲' : ' ▼') : ''; };
    wrap.innerHTML =
      '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;margin-bottom:10px">' +
        '<div class="form-group" style="margin:0;flex:1;min-width:160px">' +
          '<label class="form-label">' + (isBm ? 'Cari' : 'Search') + '</label>' +
          '<input id="adm-audit-q" class="form-input" value="' + esc(S.q) + '" placeholder="email / action / tenant">' +
        '</div>' +
        '<div class="form-group" style="margin:0">' +
          '<label class="form-label">' + (isBm ? 'Tindakan' : 'Action') + '</label>' +
          '<select id="adm-audit-action" class="form-select">' +
            '<option value="all">' + (isBm ? 'Semua' : 'All') + '</option>' +
            actions.map(function (a) {
              return '<option value="' + esc(a) + '"' + (S.action === a ? ' selected' : '') + '>' + esc(actionLabel(a)) + '</option>';
            }).join('') +
          '</select></div>' +
        '<div class="form-group" style="margin:0">' +
          '<label class="form-label">Tenant</label>' +
          '<select id="adm-audit-tenant" class="form-select">' +
            '<option value="all">' + (isBm ? 'Semua' : 'All') + '</option>' +
            tenants.map(function (n) {
              return '<option value="' + esc(n) + '"' + (S.tenant === n ? ' selected' : '') + '>' + esc(n) + '</option>';
            }).join('') +
          '</select></div>' +
        '<div style="font-size:12px;color:var(--text-3);padding-bottom:6px">' + rows.length + ' / ' + S.rows.length + '</div>' +
      '</div>' +
      '<div style="max-height:420px;overflow:auto;-webkit-overflow-scrolling:touch">' +
      '<table style="width:max-content;min-width:100%;border-collapse:separate;border-spacing:0">' +
      '<thead><tr>' +
        '<th style="cursor:pointer;white-space:nowrap" data-sort="actor_email">' + (isBm ? 'Pelaku' : 'Actor') + arrow('actor_email') + '</th>' +
        '<th style="cursor:pointer;white-space:nowrap" data-sort="action">' + (isBm ? 'Tindakan' : 'Action') + arrow('action') + '</th>' +
        '<th style="cursor:pointer;white-space:nowrap" data-sort="target_tenant_name">Tenant' + arrow('target_tenant_name') + '</th>' +
        '<th style="white-space:nowrap">' + (isBm ? 'Butiran' : 'Details') + '</th>' +
        '<th style="cursor:pointer;white-space:nowrap" data-sort="created_at">' + (isBm ? 'Bila' : 'When') + arrow('created_at') + '</th>' +
      '</tr></thead><tbody>' +
      (rows.length ? rows.map(function (r) {
        return '<tr>' +
          '<td style="white-space:nowrap">' + esc(r.actor_email || '-') + '</td>' +
          '<td style="white-space:nowrap">' + esc(actionLabel(r.action)) + '</td>' +
          '<td style="white-space:nowrap">' + esc(r.target_tenant_name || '-') + '</td>' +
          '<td style="font-size:12px;color:var(--text-2);max-width:280px;white-space:normal">' + esc(detailsText(r.details)) + '</td>' +
          '<td style="white-space:nowrap;font-size:12px;color:var(--text-3)">' +
            (r.created_at ? new Date(r.created_at).toLocaleString(isBm ? 'ms-MY' : 'en-MY') : '—') +
          '</td></tr>';
      }).join('') : '<tr><td colspan="5" style="padding:24px;color:var(--text-3)">' + (isBm ? 'Tiada padanan.' : 'No matches.') + '</td></tr>') +
      '</tbody></table></div>';
    var qEl = document.getElementById('adm-audit-q');
    if (qEl) qEl.oninput = function () { S.q = this.value || ''; paint(); };
    var aEl = document.getElementById('adm-audit-action');
    if (aEl) aEl.onchange = function () { S.action = this.value; paint(); };
    var tEl = document.getElementById('adm-audit-tenant');
    if (tEl) tEl.onchange = function () { S.tenant = this.value; paint(); };
    wrap.querySelectorAll('th[data-sort]').forEach(function (th) {
      th.onclick = function () {
        var col = th.getAttribute('data-sort');
        if (S.sort === col) S.dir = S.dir === 'asc' ? 'desc' : 'asc';
        else { S.sort = col; S.dir = col === 'created_at' ? 'desc' : 'asc'; }
        paint();
      };
    });
  }
  function wrapFn() {
    var orig = window.renderAdminAuditLog;
    if (typeof orig !== 'function' || orig._auditUi) return;
    window.renderAdminAuditLog = async function () {
      var r = orig.apply(this, arguments);
      var after = async function () {
        try {
          var q = await sb.from('platform_admin_audit')
            .select('id,actor_email,action,target_tenant_name,details,created_at')
            .order('created_at', { ascending: false })
            .limit(200);
          S.rows = q.data || [];
        } catch (e) { S.rows = S.rows || []; }
        paint();
      };
      if (r && r.then) r.then(after);
      else after();
      return r;
    };
    window.renderAdminAuditLog._auditUi = true;
  }
  wrapFn();
  setTimeout(wrapFn, 400);
})();
