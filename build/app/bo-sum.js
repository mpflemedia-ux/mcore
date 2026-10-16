/* M-Core back-office support - monthly PA support summary per tenant (doc_shares by PA users + platform_admin_audit) with CSV. Shown only on the PA dashboard. v1 */
(function () {
  if (!window.BO || BO.sum) return;
  var B = BO, E = B.esc, t = B.t, SES = { enter_support_tenant: 1 }, SKIP = { exit_support_tenant: 1, support_view_only_on: 1, support_view_only_off: 1, support_idle_exit: 1, support_switch_tenant: 1 };
  B.add({ en: { cDocs: 'Documents' }, bm: { cDocs: 'Dokumen' } });
  function months() { var out = [], d = new Date(B.day() + 'T00:00:00+08:00'); d.setDate(1); for (var i = 0; i < 6; i++) { out.push(d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }).slice(0, 7)); d.setMonth(d.getMonth() - 1); } return out; }
  function range(m) { var a = new Date(m + '-01T00:00:00+08:00'), b = new Date(a); b.setMonth(b.getMonth() + 1); return [a.toISOString(), b.toISOString()]; }
  function label(m) { return new Date(m + '-15T00:00:00+08:00').toLocaleDateString(B.bm() ? 'ms-MY' : 'en-GB', { month: 'long', year: 'numeric' }); }
  function d(p) { return Promise.resolve(p).then(function (r) { return (r && !r.error && r.data) || []; }, function () { return []; }); }
  /* PA user ids: every actor in the PA audit log + me (no cross-tenant user_profiles read needed) */
  function paIds() { return d(sb.from('platform_admin_audit').select('actor_user_id').order('created_at', { ascending: false }).limit(2000)).then(function (a) { var s = {}; a.forEach(function (x) { if (x.actor_user_id) s[x.actor_user_id] = 1; }); if (B.uid()) s[B.uid()] = 1; return Object.keys(s); }); }
  B.sumData = function (m) {
    var r = range(m);
    return paIds().then(function (ids) {
      return Promise.all([
        d(sb.from('doc_shares').select('tenant_id,doc_id,template,created_by').gte('created_at', r[0]).lt('created_at', r[1]).in('created_by', ids).is('deleted_at', null).limit(5000)),
        d(sb.from('platform_admin_audit').select('action,target_tenant_id,actor_user_id').gte('created_at', r[0]).lt('created_at', r[1]).in('actor_user_id', ids).limit(5000))
      ]).then(function (a) {
        var by = {}, row = function (tid) { return by[tid] = by[tid] || { tid: tid, sh: 0, rem: 0, docs: {}, act: 0, ses: 0 }; };
        a[0].forEach(function (s) { var x = row(s.tenant_id); if (/^reminder/.test(s.template || '')) x.rem++; else x.sh++; if (s.doc_id) x.docs[s.doc_id] = 1; });
        a[1].forEach(function (s) { if (!s.target_tenant_id) return; var x = row(s.target_tenant_id); if (SES[s.action]) x.ses++; else if (!SKIP[s.action]) x.act++; });
        return Object.keys(by).map(function (k) { var x = by[k]; x.doc = Object.keys(x.docs).length; return x; });
      });
    });
  };
  function csv(m, rows, tens) {
    var cell = function (v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var L = [['month', 'tenant', 'shares', 'reminders', 'documents', 'support_actions', 'sessions']].concat(rows.map(function (x) { return [m, tens[x.tid] || x.tid, x.sh, x.rem, x.doc, x.act, x.ses]; }));
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + L.map(function (l) { return l.map(cell).join(','); }).join('\n')], { type: 'text/csv' }));
    a.download = 'mcore-support-summary-' + m + '.csv'; document.body.appendChild(a); a.click(); a.remove();
  }
  B.sum = function (host) {
    if (!host || !B.isPA()) return;
    var ms = months(), cur = ms[0];
    host.innerHTML = '<div class="card" style="margin-top:18px"><div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between"><div><div style="font-weight:700;font-size:16px">' + E(t('sum')) + '</div>' +
      '<div class="bo-note">' + E(t('sumD')) + '</div></div><div style="display:flex;gap:8px;flex-wrap:wrap"><select class="form-input form-select" id="bo-sm" aria-label="' + E(t('month')) + '" style="min-height:38px">' +
      ms.map(function (m) { return '<option value="' + m + '">' + E(label(m)) + '</option>'; }).join('') + '</select><button class="btn btn-outline btn-sm" id="bo-csv"><i class="ti ti-download"></i> ' + E(t('csv')) + '</button></div></div><div id="bo-st" style="margin-top:10px;overflow-x:auto"></div></div>';
    var rowsNow = [], tens = {};
    function run() {
      var el = host.querySelector('#bo-st'); el.innerHTML = '<div class="bo-note">' + E(t('load')) + '</div>';
      Promise.all([B.sumData(cur), d(sb.from('tenants').select('id,name').limit(1000))]).then(function (a) {
        tens = {}; a[1].forEach(function (x) { tens[x.id] = x.name; });
        rowsNow = a[0].sort(function (x, y) { return (y.sh + y.rem + y.act) - (x.sh + x.rem + x.act); });
        if (!rowsNow.length) { el.innerHTML = '<div class="bo-empty">' + E(t('noSum')) + '</div>'; return; }
        var tot = { sh: 0, rem: 0, doc: 0, act: 0, ses: 0 }; rowsNow.forEach(function (x) { Object.keys(tot).forEach(function (k) { tot[k] += x[k]; }); });
        var th = function (k, al) { return '<th style="text-align:' + (al || 'right') + ';padding:8px;font-size:12px;color:var(--text-2);white-space:nowrap">' + E(t(k)) + '</th>'; };
        var td = function (v, b) { return '<td style="text-align:right;padding:8px;font-variant-numeric:tabular-nums' + (b ? ';font-weight:700' : '') + '">' + E(v) + '</td>'; };
        el.innerHTML = '<table style="width:100%;border-collapse:collapse;font-size:13.5px"><thead><tr style="border-bottom:1px solid var(--border)">' + th('tenant', 'left') + th('cShares') + th('cRem') + th('cDocs') + th('cAct') + th('cSes') + '</tr></thead><tbody>' +
          rowsNow.map(function (x) { return '<tr style="border-bottom:1px solid var(--border)"><td style="padding:8px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + E(tens[x.tid] || '-') + '</td>' + td(x.sh) + td(x.rem) + td(x.doc) + td(x.act) + td(x.ses) + '</tr>'; }).join('') +
          '<tr><td style="padding:8px;font-weight:700">' + E(t('total')) + '</td>' + td(tot.sh, 1) + td(tot.rem, 1) + td(tot.doc, 1) + td(tot.act, 1) + td(tot.ses, 1) + '</tr></tbody></table>';
      });
    }
    host.querySelector('#bo-sm').onchange = function () { cur = this.value; run(); };
    host.querySelector('#bo-csv').onclick = function () { csv(cur, rowsNow, tens); };
    run();
  };
})();
