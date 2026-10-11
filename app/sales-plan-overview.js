/* Sales Plan — phase 2b. Overview tab (mockup 1): KPI cards, SVG Target vs Actual chart,
   monthly KPI table, milestones card, alerts card (computed from data). */
(function () {
  'use strict';
  var SP = window.SP, st = SP.state, t = SP.t, esc = SP.esc, num = SP.num;
  function fmtK(v) {
    v = num(v); var a = Math.abs(v);
    if (a >= 1e6) return (Math.round(v / 1e5) / 10) + 'M';
    if (a >= 1e3) return (Math.round(v / 100) / 10) + 'k';
    return String(Math.round(v));
  }
  SP.fmtK = fmtK;
  function bar(pct, color) {
    var w = pct == null ? 0 : Math.max(0, Math.min(100, pct));
    return '<div class="sp-bar sp-kbar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(w) + '"><i style="width:' + w.toFixed(1) + '%;background:' + (color || 'var(--success)') + '"></i></div>';
  }
  function card(label, icon, color, value, of, pct, sub, barColor) {
    return '<div class="card sp-kpi"><div class="sp-kpi-h"><span class="sp-kpi-l">' + esc(label) + '</span><span class="sp-ic sp-ic-' + color + '"><i class="ti ' + icon + '" aria-hidden="true"></i></span></div>' +
      '<div class="sp-kpi-v"><b>' + esc(value) + '</b>' + (of ? '<span> ' + esc(of) + '</span>' : '') + '</div>' + (pct === false ? '' : bar(pct, barColor)) + '<div class="sp-kpi-s">' + sub + '</div></div>';
  }
  function kpisHtml(c) {
    var p = c.plan, k = SP.planCalc(c), cur = p.currency, out = [];
    out.push(card(t('GMV Actual vs Target', 'GMV Sebenar vs Sasaran'), 'ti-chart-bar', 'blue', SP.money(k.gmv || 0, cur), '/ ' + SP.money(k.target, cur), k.pct,
      '<b>' + esc(k.pct == null ? '0.0%' : SP.pct1(k.pct)) + '</b> ' + esc(t('of plan · ' + k.updated + ' of ' + k.weeksN + ' weeks updated', 'daripada pelan · ' + k.updated + ' daripada ' + k.weeksN + ' minggu dikemas kini'))));
    out.push(card(t('Units sold', 'Unit terjual'), 'ti-box', 'green', SP.fmtNum(k.units || 0), k.unitsT > 0 ? '/ ' + SP.fmtNum(k.unitsT) + ' ' + t('units', 'unit') : t('units', 'unit'), k.unitsT > 0 ? k.unitsPct : null,
      (k.unitsT > 0 ? '<b>' + esc(k.unitsPct == null ? '0.0%' : SP.pct1(k.unitsPct)) + '</b>' : esc(t('No units target', 'Tiada sasaran unit'))) + ' · ' + esc(t(SP.fmtNum(k.orders || 0) + ' orders', SP.fmtNum(k.orders || 0) + ' order')) + (k.aov != null ? ' · ' + esc('AOV ' + SP.curSym(cur) + ' ' + SP.fmtNum(k.aov, 2)) : '')));
    if (p.financing_enabled) {
      var f = SP.finSummary(c), nx = f.next;
      out.push(card(t('Funding balance', 'Baki pembiayaan'), 'ti-building-bank', 'orange', SP.money(f.outstanding, cur), t('outstanding', 'tertunggak'), false,
        nx ? esc((nx.b.label || 'Batch ' + nx.b.code) + ' · ' + t('due ', 'tamat ') + SP.fmtDate(nx.date)) + ' ' + SP.kpiBadge(nx.k.status) : esc(t('No funding outstanding', 'Tiada pembiayaan tertunggak'))));
    } else {
      var op = k.ordersT > 0 && k.orders != null ? k.orders / k.ordersT * 100 : null;
      out.push(card(t('Orders', 'Order'), 'ti-receipt', 'orange', SP.fmtNum(k.orders || 0), '/ ' + SP.fmtNum(k.ordersT), op, esc(op == null ? t('No orders yet', 'Belum ada order') : SP.pct1(op) + ' ' + t('of target', 'daripada sasaran'))));
    }
    var ms = c.miles.map(function (m) { return SP.mileCalc(c, m).status; }), n = function (s) { return ms.filter(function (x) { return x === s; }).length; };
    var badges = [['ach', n('ach')], ['risk', n('risk')], ['overdue', n('overdue')], ['pend', n('pend')]].filter(function (x, i) { return x[1] > 0 || i === 0 || i === 3; })
      .map(function (x) { return '<span class="sp-mbadge">' + SP.kpiBadge(x[0]) + '<b>' + x[1] + '</b></span>'; }).join('');
    out.push(card(t('Milestones', 'Milestone'), 'ti-flag', 'red', String(n('ach')), t('of ' + ms.length + ' achieved', 'daripada ' + ms.length + ' dicapai'), ms.length ? n('ach') / ms.length * 100 : 0,
      ms.length ? '<span class="sp-mbadges">' + badges + '</span>' : esc(t('No milestones yet', 'Belum ada milestone'))));
    return '<div class="sp-kpis">' + out.join('') + '</div>';
  }
  function chartHtml(c) {
    var rows = c.periods.map(function (p) { var k = SP.periodCalc(c, p); return { l: p.label, tg: k.target, a: k.gmv }; });
    if (!rows.length) return '<div class="sp-chart-empty sp-t2">' + esc(t('Add periods in the Targets tab to see the chart.', 'Tambah tempoh dalam tab Sasaran untuk lihat carta.')) + '</div>';
    var max = 0; rows.forEach(function (r) { max = Math.max(max, r.tg, r.a || 0); });
    var step = Math.pow(10, Math.floor(Math.log10(Math.max(max, 1)))), nice = [1, 2, 2.5, 5, 10].map(function (m) { return m * step; }).find(function (s) { return s * 4 >= max; }) || step * 10;
    var top = nice * 4 || 4, W = Math.max(520, rows.length * 92 + 60), H = 230, L = 46, B = 196, T = 22, ch = B - T, gw = (W - L - 10) / rows.length, bw = Math.min(26, gw / 3.2);
    var y = function (v) { return B - (num(v) / top) * ch; }, s = '';
    for (var i = 0; i <= 4; i++) { var v = nice * i, yy = y(v); s += '<line class="sp-grid-l" x1="' + L + '" x2="' + (W - 6) + '" y1="' + yy + '" y2="' + yy + '"/><text class="sp-ax" x="' + (L - 8) + '" y="' + (yy + 4) + '" text-anchor="end">' + fmtK(v) + '</text>'; }
    rows.forEach(function (r, j) {
      var cx = L + gw * j + gw / 2, x1 = cx - bw - 2, x2 = cx + 2, h1 = Math.max(1, B - y(r.tg));
      s += '<rect class="sp-bt" x="' + x1 + '" y="' + (B - h1) + '" width="' + bw + '" height="' + h1 + '" rx="3"><title>' + esc(r.l + ' · ' + t('Target', 'Sasaran') + ' ' + SP.fmtNum(r.tg)) + '</title></rect>';
      if (r.tg > 0) s += '<text class="sp-vl" x="' + (x1 + bw / 2) + '" y="' + (B - h1 - 5) + '" text-anchor="middle">' + fmtK(r.tg) + '</text>';
      if (r.a != null) {
        var h2 = Math.max(1, B - y(r.a));
        s += '<rect class="sp-ba" x="' + x2 + '" y="' + (B - h2) + '" width="' + bw + '" height="' + h2 + '" rx="3"><title>' + esc(r.l + ' · ' + t('Actual', 'Sebenar') + ' ' + SP.fmtNum(r.a)) + '</title></rect>' +
          '<text class="sp-vl sp-vla" x="' + (x2 + bw / 2) + '" y="' + (B - h2 - 5 - (Math.abs(h2 - h1) < 14 ? 11 : 0)) + '" text-anchor="middle">' + fmtK(r.a) + '</text>';
      }
      s += '<text class="sp-ax" x="' + cx + '" y="' + (B + 18) + '" text-anchor="middle">' + esc(r.l) + '</text>';
    });
    return '<div class="sp-chart-wrap"><svg class="sp-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(t('Monthly GMV target vs actual', 'GMV bulanan sasaran vs sebenar')) + '">' + s + '</svg></div>';
  }
  function monthTable(c) {
    var cur = c.plan.currency, tot = { tg: 0, a: null };
    var rows = c.periods.map(function (p) {
      var k = SP.periodCalc(c, p); tot.tg += k.target; if (k.gmv != null) tot.a = (tot.a || 0) + k.gmv;
      return '<tr><td>' + esc(p.label) + '</td><td class="sp-num">' + SP.fmtNum(k.target) + '</td><td class="sp-num">' + (k.gmv == null ? '<span class="sp-dash">—</span>' : SP.fmtNum(k.gmv)) + '</td>' +
        '<td class="sp-num ' + (k.ach == null ? '' : SP.achCls(SP.achKey(c, k.ach))) + '">' + (k.ach == null ? '<span class="sp-dash">—</span>' : SP.pct1(k.ach)) + '</td><td>' + SP.kpiBadge(k.status) + '</td></tr>';
    }).join('');
    var tp = tot.a != null && tot.tg > 0 ? tot.a / tot.tg * 100 : null;
    return '<div class="sp-tscroll"><table class="sp-table sp-mtable"><thead><tr><th>' + esc(t('Month', 'Bulan')) + '</th><th class="sp-num">' + esc(t('Target', 'Sasaran')) + '</th><th class="sp-num">' + esc(t('Actual', 'Sebenar')) + '</th><th class="sp-num">' + esc(t('Ach %', 'Capai %')) + '</th><th>' + esc(t('Status', 'Status')) + '</th></tr></thead>' +
      '<tbody>' + (rows || '<tr><td colspan="5" class="sp-t2">' + esc(t('No periods yet.', 'Belum ada tempoh.')) + '</td></tr>') + '</tbody>' +
      (rows ? '<tfoot><tr><td><b>' + esc(t('Total', 'Jumlah')) + '</b></td><td class="sp-num"><b>' + SP.fmtNum(tot.tg) + '</b></td><td class="sp-num"><b>' + (tot.a == null ? '—' : SP.fmtNum(tot.a)) + '</b></td><td class="sp-num"><b>' + (tp == null ? '—' : SP.pct1(tp)) + '</b></td><td></td></tr></tfoot>' : '') + '</table></div>';
  }
  function milesCard(c) {
    var ms = c.miles.slice(0, 5);
    var body = ms.map(function (m) { var k = SP.mileCalc(c, m); return '<div class="sp-mrow"><span class="sp-mcode">' + esc(m.code) + '</span><span class="sp-mtitle">' + esc(m.title) + '</span><span class="sp-mdate">' + esc(SP.fmtDate(m.due_date)) + '</span>' + SP.kpiBadge(k.status) + '</div>'; }).join('');
    return '<div class="card sp-ocard"><div class="sp-ocard-h"><div class="card-title sp-sec-title"><i class="ti ti-flag"></i>' + esc(t('Milestones', 'Milestone')) + '</div><span class="sp-hint">' + esc(SP.picLabel(c.plan) + ' · ' + t(c.miles.length + ' total', c.miles.length + ' jumlah')) + '</span></div>' +
      (body || '<div class="sp-t2 sp-pad">' + esc(t('No milestones yet.', 'Belum ada milestone.')) + '</div>') +
      (c.miles.length > 5 ? '<button type="button" class="sp-link" data-act="tab" data-tab="milestones">' + esc(t('View all milestones', 'Lihat semua milestone')) + ' <i class="ti ti-chevron-right"></i></button>' : '') + '</div>';
  }
  var AIC = { week_off_track: ['ti-trending-down', 'red'], week_watch: ['ti-eye', 'orange'], milestone_at_risk: ['ti-alert-triangle', 'orange'], milestone_overdue: ['ti-alert-octagon', 'red'], repayment_due: ['ti-calendar-due', 'orange'], repayment_overdue: ['ti-cash-off', 'red'] };
  SP.alertRow = function (a) {
    var ic = AIC[a.kind] || ['ti-bell', 'blue'];
    return '<div class="sp-arow"><span class="sp-ic sp-ic-' + ic[1] + '"><i class="ti ' + ic[0] + '" aria-hidden="true"></i></span><div><div class="sp-atitle">' + esc(t(a.title_en, a.title_bm)) + '</div><div class="sp-hint">' + esc(t(a.body_en, a.body_bm)) + '</div></div></div>';
  };
  function alertsCard(c) {
    var al = SP.computeAlerts(c), shown = al.slice(0, 3);
    return '<div class="card sp-ocard"><div class="sp-ocard-h"><div class="card-title sp-sec-title"><i class="ti ti-bell-ringing"></i>' + esc(t('Alerts', 'Amaran')) + '</div><span class="sp-hint">' + esc(SP.runAlerts ? t('Sent to bell + Telegram', 'Dihantar ke loceng + Telegram') : t(al.length + ' active', al.length + ' aktif')) + '</span></div>' +
      (shown.map(SP.alertRow).join('') || '<div class="sp-t2 sp-pad"><i class="ti ti-circle-check sp-okic"></i> ' + esc(t('No alerts — everything is on track.', 'Tiada amaran — semua berjalan lancar.')) + '</div>') + '</div>';
  }
  SP.tabs.overview = function () {
    var c = SP.ctx();
    var warn = st.autoErr ? '<div class="sp-warn sp-warn-top"><i class="ti ti-alert-triangle"></i><span>' + esc(t('Could not read M-Core sales (auto mode). Showing the last saved numbers.', 'Gagal baca jualan M-Core (mod auto). Memaparkan angka terakhir disimpan.')) + '</span></div>' : '';
    return warn + kpisHtml(c) +
      '<div class="sp-orow"><div class="card sp-ocard"><div class="sp-ocard-h"><div class="card-title sp-sec-title"><i class="ti ti-chart-bar"></i>' + esc(t('Monthly GMV — Target vs Actual', 'GMV Bulanan — Sasaran vs Sebenar')) + '</div>' +
      '<span class="sp-legend"><span><i class="sp-lg-t"></i>' + esc(t('Target', 'Sasaran')) + '</span><span><i class="sp-lg-a"></i>' + esc(t('Actual', 'Sebenar')) + '</span></span></div>' + chartHtml(c) + '</div>' +
      '<div class="card sp-ocard"><div class="sp-ocard-h"><div class="card-title sp-sec-title"><i class="ti ti-table"></i>' + esc(t('Monthly KPI', 'KPI Bulanan') + ' (' + SP.curSym(c.plan.currency) + ')') + '</div><span class="sp-hint">' + esc(t('Reporting date: ', 'Tarikh laporan: ') + SP.fmtDate(SP.todayISO())) + '</span></div>' + monthTable(c) + '</div></div>' +
      '<div class="sp-orow">' + milesCard(c) + alertsCard(c) + '</div>';
  };
})();
