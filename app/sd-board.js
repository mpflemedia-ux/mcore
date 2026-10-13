/* M-Core Service Desk - admin 'Service Desk' board: KPI cards, filters, 4 columns, SLA sort, CSV export. */
(function () {
  var SD = window.SD; if (!SD || SD._board) return; SD._board = 1;
  var S = { rows: [], tn: {}, names: {}, f: 'all', svc: '', sort: 'sla', q: '' };
  var COLS = [['new', 'ti-inbox', 'New', 'Baru', ['submitted', 'triaged']], ['prog', 'ti-loader-2', 'In progress', 'Dalam proses', ['in_progress', 'revision']], ['wait', 'ti-player-pause', 'Waiting on client', 'Tunggu klien', ['waiting_client']], ['del', 'ti-package', 'Delivered', 'Dihantar', ['delivered']]];
  function load() {
    return Promise.all([SD.catalog(), sb.from('service_requests').select('*').is('deleted_at', null).in('status', SD.OPEN).order('created_at', { ascending: false }).limit(500),
      sb.from('service_requests').select('created_at,delivered_at,status').is('deleted_at', null).gte('delivered_at', SD.monthIso()).limit(1000), sb.from('tenants').select('id,name')])
      .then(function (r) {
        if (r[1].error) throw r[1].error;
        S.rows = r[1].data || []; S.done = r[2].data || []; S.tn = {}; (r[3].data || []).forEach(function (t) { S.tn[t.id] = t.name; });
        return SD.autoClose(S.rows).then(function () { S.rows = S.rows.filter(function (x) { return SD.OPEN.indexOf(x.status) >= 0; }); return SD.names(S.rows.map(function (x) { return x.assigned_to; })); });
      }).then(function (n) { S.names = n; });
  }
  function kpi(label, v, icon, color) { return '<div class="cob-card cob-kpi" style="padding:16px"><div class="row"><span class="grow cob-sm">' + label + '</span><i class="ti ' + icon + '" style="font-size:18px;color:' + color + '"></i></div><div style="font-size:22px;font-weight:700;color:' + color + ';margin-top:10px">' + v + '</div></div>'; }
  function vis() {
    var q = S.q.toLowerCase(), me = SD.uid();
    var rows = S.rows.filter(function (r) {
      if (S.f === 'mine' && !SD.same(r.assigned_to, me)) return false;
      if (S.f === 'late' && !(SD.left(r) < 0 && ['waiting_client', 'delivered'].indexOf(r.status) < 0)) return false;
      if (S.svc && r.service_code !== S.svc) return false;
      return !q || (r.ref_no + ' ' + r.title + ' ' + (S.tn[r.tenant_id] || '')).toLowerCase().indexOf(q) >= 0;
    });
    rows.sort(S.sort === 'sla' ? function (a, b) { return (SD.left(a) == null ? 1e9 : SD.left(a)) - (SD.left(b) == null ? 1e9 : SD.left(b)); } : function (a, b) { return a.created_at < b.created_at ? 1 : -1; });
    return rows;
  }
  function paint() {
    var m = SD.main(); if (!m) return;
    var act = S.rows.filter(function (r) { return ['waiting_client', 'delivered'].indexOf(r.status) < 0; });
    var late = act.filter(function (r) { return SD.left(r) < 0; }).length, near = act.filter(function (r) { var l = SD.left(r); return l >= 0 && l < 8; }).length;
    var hrs = S.done.map(function (d) { return Math.max(0, SD.bhBetween(d.created_at, d.delivered_at)); }), avg = hrs.length ? Math.round(hrs.reduce(function (a, b) { return a + b; }, 0) / hrs.length) + SD.L('h', 'j') : '—';
    var rows = vis();
    m.innerHTML = '<div class="cob-root">' + SD.head(SD.L('Admin — Service Desk', 'Admin — Service Desk'), SD.L('All client service requests · sorted by SLA', 'Semua permohonan servis klien · disusun ikut SLA'), '<button class="btn btn-outline" id="sd-csv"><i class="ti ti-download"></i> <span class="btn-txt">' + SD.L('Export CSV', 'Eksport CSV') + '</span></button>') + SD.tabs('sd_desk') +
      '<div class="sd-kpis">' + kpi(SD.L('Open requests', 'Permohonan terbuka'), S.rows.length, 'ti-inbox', 'var(--primary)') + kpi(SD.L('SLA breached', 'Melepasi SLA'), late, 'ti-alarm', 'var(--danger)') + kpi(SD.L('Near SLA (<8h)', 'Hampir tamat SLA (<8j)'), near, 'ti-hourglass', 'var(--warning)') +
      kpi(SD.L('Waiting on client', 'Tunggu klien'), S.rows.filter(function (r) { return r.status === 'waiting_client'; }).length, 'ti-player-pause', 'var(--info)') + kpi(SD.L('Avg completion', 'Purata siap'), avg, 'ti-clock-check', 'var(--success)') + '</div>' +
      '<div class="row sd-flt" style="gap:8px;flex-wrap:wrap;margin-bottom:12px"><div class="cob-chips" style="flex:1;min-width:0">' + [['all', 'All clients', 'Semua klien'], ['mine', 'Assigned to me', 'Ditugaskan kepada saya'], ['late', 'SLA breached', 'Melepasi SLA']].map(function (x) { return '<button class="cob-chip' + (S.f === x[0] ? ' on' : '') + '" data-f="' + x[0] + '">' + SD.L(x[1], x[2]) + '</button>'; }).join('') +
      '<select class="form-input" id="sd-svc" style="width:auto!important;flex:0 0 auto;max-width:240px;min-height:34px"><option value="">' + SD.L('Service: All', 'Servis: Semua') + '</option>' + (SD.catalogList || []).map(function (c) { return '<option value="' + c.code + '"' + (S.svc === c.code ? ' selected' : '') + '>' + SD.esc(SD.L(c.name_en, c.name_bm)) + '</option>'; }).join('') + '</select>' +
      '<select class="form-input" id="sd-sort" style="width:auto!important;flex:0 0 auto;max-width:240px;min-height:34px"><option value="sla">' + SD.L('Sort: SLA soonest', 'Susun: SLA terdekat') + '</option><option value="new"' + (S.sort === 'new' ? ' selected' : '') + '>' + SD.L('Sort: Newest', 'Susun: Terbaru') + '</option></select></div>' +
      '<input class="form-input" id="sd-q" style="width:240px;max-width:100%" placeholder="' + SD.L('Search ref / client…', 'Cari rujukan / klien…') + '" value="' + SD.esc(S.q) + '"></div>' +
      '<div class="sd-board">' + COLS.map(function (c) {
        var it = rows.filter(function (r) { return c[4].indexOf(r.status) >= 0; });
        return '<div class="sd-colm"><h4><i class="ti ' + c[1] + '"></i>' + SD.L(c[2], c[3]) + '<span class="n">' + it.length + '</span></h4>' + it.map(function (r) {
          return '<button class="sd-tk" data-id="' + r.id + '"><div class="row" style="gap:6px"><span class="sd-ref grow">' + SD.esc(r.ref_no) + '</span>' + SD.slaChip(r) + '</div><b style="display:block;font-size:13.5px;margin:6px 0 2px">' + SD.esc(r.title) + '</b><div class="cob-xs cob-ell">' + SD.esc(S.tn[r.tenant_id] || '') + '</div>' +
            '<div class="cob-xs" style="margin-top:6px"><i class="ti ti-user"></i> ' + SD.esc(r.assigned_to ? (S.names[r.assigned_to] || '—') : SD.L('Unassigned', 'Belum ditugaskan')) + (r.status === 'revision' ? ' · ' + SD.stLabel('revision') : '') + '</div></button>';
        }).join('') + '</div>';
      }).join('') + '</div><div class="cob-xs" style="margin-top:8px">' + SD.L('SLA counts Mon–Fri hours; public holidays are not excluded yet.', 'SLA dikira jam Isnin–Jumaat; cuti umum belum dikecualikan.') + '</div></div>';
    m.querySelectorAll('[data-f]').forEach(function (b) { b.onclick = function () { S.f = b.dataset.f; paint(); }; });
    m.querySelector('#sd-svc').onchange = function () { S.svc = this.value; paint(); };
    m.querySelector('#sd-sort').onchange = function () { S.sort = this.value; paint(); };
    var q = m.querySelector('#sd-q'); q.oninput = function () { S.q = q.value; var p = q.selectionStart; paint(); var n = document.getElementById('sd-q'); n.focus(); try { n.setSelectionRange(p, p); } catch (e) {} };
    m.querySelectorAll('.sd-tk').forEach(function (b) { b.onclick = function () { SD.go('admin', { view: 'sd_desk', id: b.dataset.id }); }; });
    m.querySelector('#sd-csv').onclick = function () {
      var cell = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
      var lines = [['ref_no', 'client', 'service', 'title', 'status', 'priority', 'created_at', 'sla_due', 'assigned']].concat(vis().map(function (r) { var d = SD.due(r); return [r.ref_no, S.tn[r.tenant_id], SD.svcName(r.service_code), r.title, r.status, r.priority, r.created_at, d ? d.toISOString() : '', S.names[r.assigned_to] || '']; }));
      var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([lines.map(function (l) { return l.map(cell).join(','); }).join('\n')], { type: 'text/csv' }));
      a.download = 'service-desk-' + SD.today() + '.csv'; document.body.appendChild(a); a.click(); a.remove();
    };
  }
  SD.admin.sd_desk = function (p) {
    return SD.catalog().then(function (c) { SD.catalogList = c; if (p.id) return SD.detail(p.id, true); return load().then(paint); });
  };
  SD.onChangeAdmin = function () { if (SD.isPA() && APP.currentPage === 'admin' && document.querySelector('.sd-board')) load().then(paint); };
})();
