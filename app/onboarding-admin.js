/* M-Core Onboarding Checklist - platform admin all-tenant dashboard (mockup ob4) + cob_admin routing. Data in onboarding-admin-data.js. */
(function () {
  var C = window.COB; if (!C || C._admin) return; C._admin = 1;
  var E = C.esc, L = C.L;
  var UI = { f: 'all', s: '' };
  function kpi(lab, val, sub, ic, col, act) {
    return '<' + (act ? 'button data-go="review" title="' + L('Open review queue', 'Buka barisan semakan') + '"' : 'div') + ' class="cob-card cob-kpi" style="text-align:left;font-family:inherit;color:inherit' + (act ? ';cursor:pointer' : '') + '"><div class="t"><span>' + lab + '</span><span class="ic" style="background:color-mix(in srgb,' + col + ' 14%,transparent);color:' + col + '"><i class="ti ' + ic + '"></i></span></div><div class="v">' + val + '</div><div class="s">' + sub + '</div></' + (act ? 'button' : 'div') + '>';
  }
  function dash() {
    return C.loadAll().then(function (d) {
      var R = C.rows(d), m = document.getElementById('main'); if (APP.currentPage !== 'cob_admin') return;
      var act = R.filter(function (r) { return !r.done; }), stuck = R.filter(function (r) { return r.stuck; }), done = R.filter(function (r) { return r.done; });
      var avg = R.length ? Math.round(R.reduce(function (s, r) { return s + r.st.pct; }, 0) / R.length) : 0, avgU = R.length ? Math.round(R.reduce(function (s, r) { return s + r.st.corePct; }, 0) / R.length) : 0;
      var pend = R.reduce(function (s, r) { return s + r.pend; }, 0), urg = R.reduce(function (s, r) { return s + r.urg; }, 0), old = R.reduce(function (m, r) { return r.oldest && (!m || r.oldest < m) ? r.oldest : m; }, null);
      var exAll = [].concat.apply([], R.map(function (r) { return r.ex; })), exBy = {};
      exAll.forEach(function (i) { exBy[i.code] = (exBy[i.code] || 0) + 1; });
      var remN = R.filter(function (r) { return r.remindable; }).length;
      C.pending = pend; C.paintCount();
      var h = '<div class="cob-root"><div class="cob-head"><div><div class="cob-h1">' + L('Client Onboarding', 'Onboarding Klien') + '</div><div class="cob-sm">' + L('All tenants · updated ', 'Semua tenant · dikemas kini ') + C.date(new Date()) + ', ' + C.time(new Date()) + '</div></div>' +
        '<div class="row cob-noprint" style="gap:8px;flex-wrap:wrap"><button class="btn btn-outline btn-sm" data-go="tpl"><i class="ti ti-file-spreadsheet"></i><span class="btn-txt">' + L('CSV templates', 'Templat CSV') + '</span></button>' +
        '<button class="btn btn-outline btn-sm" data-go="remind"' + (remN ? '' : ' disabled') + '><i class="ti ti-bell-ringing"></i><span class="btn-txt">' + L('Send reminders', 'Hantar peringatan') + '</span> (' + remN + ')</button><button class="btn btn-primary btn-sm" data-go="pdf"><i class="ti ti-file-type-pdf"></i><span class="btn-txt">' + L('Export PDF', 'Eksport PDF') + '</span></button></div></div>';
      h += '<div class="cob-kpis">' + kpi(L('Onboarding now', 'Sedang onboarding'), act.length, '<span>+' + R.filter(function (r) { return r.newm; }).length + L(' this month', ' bulan ini') + '</span>', 'ti-building-community', 'var(--primary)') +
        kpi(L('Average done', 'Purata siap'), avg + '%', '<span>' + L('MAIN average ', 'UTAMA purata ') + avgU + '%</span>', 'ti-progress-check', 'var(--cob-full)') +
        kpi(L('Awaiting review', 'Menunggu semakan'), pend, (urg ? '<span class="badge badge-red" style="font-size:10.5px">' + urg + L(' urgent', ' segera') + '</span>' : '') + (old ? '<span>' + L('oldest ', 'tertua ') + C.age(old) + '</span>' : '<span>—</span>'), 'ti-inbox', 'var(--danger)', 1) +
        kpi(L('Documents expiring ≤ 30 days', 'Dokumen tamat ≤ 30 hari'), exAll.length, '<span>' + (Object.keys(exBy).map(function (k) { return exBy[k] + ' ' + E(k); }).join(' · ') || '—') + '</span>', 'ti-calendar-due', 'var(--cob-stuck)') +
        kpi(L('Completion badges', 'Lencana siap'), done.length, '<span>' + L('100% approved · ', '100% lulus · ') + R.filter(function (r) { return r.donem; }).length + L(' this month', ' bulan ini') + '</span>', 'ti-award', 'var(--cob-ai)') + '</div>';
      var vis = R.filter(function (r) { return (UI.f === 'all' || (UI.f === 'act' && !r.done) || (UI.f === 'stuck' && r.stuck) || (UI.f === 'done' && r.done)) && (!UI.s || r.name.toLowerCase().indexOf(UI.s.toLowerCase()) >= 0); });
      var ch = function (k, l) { return '<button class="cob-chip' + (UI.f === k ? ' on' : '') + '" data-f="' + k + '" style="font-size:12px;padding:5px 10px">' + l + '</button>'; };
      h += '<div class="cob-card" style="padding:0;overflow:hidden"><div class="row cob-noprint" style="padding:12px 14px;justify-content:space-between;border-bottom:1px solid var(--border);flex-wrap:wrap"><div class="cob-chips">' + ch('all', L('All ', 'Semua ') + R.length) + ch('act', L('In progress ', 'Sedang ') + act.length) + ch('stuck', L('Stuck (>7 days) ', 'Tersekat (>7 hari) ') + stuck.length) + ch('done', L('Done ', 'Siap ') + done.length) + '</div>' +
        '<input class="cob-in" id="cob-q" type="search" placeholder="' + L('Search tenant…', 'Cari tenant…') + '" value="' + E(UI.s) + '" style="width:240px;max-width:100%;min-height:34px;font-size:13px" aria-label="' + L('Search tenant', 'Cari tenant') + '"></div><div class="cob-scroll"><table class="cob-tbl"><thead><tr><th>Tenant</th><th>' + L('M-Core PIC', 'PIC M-Core') + '</th><th style="width:200px">' + L('Done', 'Siap') + '</th><th>' + L('MAIN', 'UTAMA') + '</th><th>' + L('Waiting', 'Menunggu') + '</th><th>' + L('Oldest', 'Tertua') + '</th><th>' + L('Rejected', 'Ditolak') + '</th><th>' + L('Doc. expiry', 'Dok. tamat') + '</th><th>' + L('Last reminder', 'Peringatan terakhir') + '</th><th>Status</th></tr></thead><tbody>';
      vis.forEach(function (r) {
        var col = r.done ? 'var(--cob-full)' : (r.stuck ? 'var(--cob-stuck)' : 'var(--primary)'), e0 = r.ex[0], pl = r.t.plan || r.t.plan_code || '';
        var bd = r.done ? '<span class="badge badge-green"><i class="ti ti-award"></i>' + L('Completion badge', 'Lencana Siap') + '</span>' : (r.stuck ? '<span class="badge badge-yellow">' + L('Stuck ', 'Tersekat ') + r.idle + L(' days', ' hari') + '</span>' : '<span class="badge badge-blue">' + L('In progress', 'Sedang') + '</span>');
        h += '<tr class="cob-click" data-t="' + E(r.cl.tenant_id) + '" tabindex="0"><td><div style="font-weight:600">' + E(r.name) + '</div><div class="cob-xs">' + (pl ? E(L('Plan ', 'Pelan ') + String(pl).charAt(0).toUpperCase() + String(pl).slice(1)) + ' · ' : '') + L('started ', 'mula ') + C.date(r.cl.started_at, false) + '</div></td>' +
          '<td>' + (r.cl.pic_name ? '<div class="row" style="gap:6px"><div class="user-avatar" style="width:24px;height:24px;font-size:10px">' + E(r.cl.pic_name.charAt(0).toUpperCase()) + '</div>' + E(r.cl.pic_name) + '</div>' : '—') + '</td>' +
          '<td><div class="row" style="gap:8px"><div class="cob-bar grow"><i style="width:' + r.st.pct + '%;background:' + col + '"></i></div><b style="width:40px;text-align:right">' + r.st.pct + '%</b></div></td><td class="num">' + r.st.corePct + '%</td><td class="num">' + (r.pend || '—') + '</td>' +
          '<td style="white-space:nowrap">' + (r.oldest ? C.age(r.oldest) : '—') + '</td><td class="num" style="color:' + (r.rej ? 'var(--cob-bad)' : 'inherit') + '">' + (r.rej || '—') + '</td>' +
          '<td style="white-space:nowrap;color:' + (e0 ? 'var(--cob-warn)' : 'inherit') + '">' + (e0 ? E(e0.code) + ' · ' + C.daysTo(e0.expiry_date) + L(' days', ' hari') : '—') + '</td><td class="cob-sm" style="white-space:nowrap">' + (r.cl.last_reminder_at ? C.dt(r.cl.last_reminder_at) : '—') + '</td><td>' + bd + '</td></tr>';
      });
      if (!vis.length) h += '<tr><td colspan="10" class="cob-sm" style="text-align:center;padding:28px">' + (R.length ? L('No tenants match', 'Tiada tenant sepadan') : L('No tenant has started onboarding yet', 'Belum ada tenant memulakan onboarding')) + '</td></tr>';
      h += '</tbody></table></div><div class="row cob-xs" style="padding:10px 14px;justify-content:space-between;flex-wrap:wrap"><span>' + L('Showing ', 'Menunjukkan ') + vis.length + L(' of ', ' daripada ') + R.length + ' tenant</span><span><i class="ti ti-clock"></i> ' + L('Auto reminders: when tenant admins open M-Core (once a day) + manual send', 'Peringatan auto: apabila admin tenant buka M-Core (sekali sehari) + hantar manual') + '</span></div></div></div>';
      m.innerHTML = h;
      bind(m.firstChild, R);
    });
  }
  function bind(root, R) {
    root.onclick = function (ev) {
      var b = ev.target.closest('[data-f],[data-go],[data-t]'); if (!b) return;
      if (b.dataset.f) { UI.f = b.dataset.f; dash(); }
      else if (b.dataset.t) C.go('cob_admin', { view: 'tenant', tenant: b.dataset.t });
      else if (b.dataset.go === 'review') C.go('cob_admin', { view: 'review' });
      else if (b.dataset.go === 'pdf') C.print();
      else if (b.dataset.go === 'tpl') C.tpl();
      else if (b.dataset.go === 'remind') C.remind(R.filter(function (r) { return r.remindable; }).map(function (r) { return r.cl.tenant_id; }));
    };
    root.onkeydown = function (ev) { var t = ev.target.closest && ev.target.closest('[data-t]'); if (ev.key === 'Enter' && t) C.go('cob_admin', { view: 'tenant', tenant: t.dataset.t }); };
    var qi = root.querySelector('#cob-q'), tm;
    if (qi) qi.oninput = function () { clearTimeout(tm); var v = qi.value; tm = setTimeout(function () { UI.s = v; dash().then(function () { var n = document.getElementById('cob-q'); if (n) { n.focus(); n.setSelectionRange(v.length, v.length); } }); }, 250); };
  }
  C.view.cob_admin = function (p) {
    p = p || {}; APP.currentParams = p;
    if (p.view === 'review' && C.reviewView) return C.reviewView(p);
    if (p.view === 'item' && p.id) return C.itemView(p.id, 'cob_admin', { view: 'tenant', tenant: p.tenant });
    if (p.view === 'tenant' && p.tenant && C.paTenant) return C.paTenant(p.tenant);
    return dash();
  };
})();
