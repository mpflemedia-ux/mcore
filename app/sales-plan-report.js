/* Sales Plan — phase 2d. Weekly report: print-friendly bilingual view (window.print).
   Print styles are scoped to .sp-rpt (see css5); global print CSS is not changed. */
(function () {
  'use strict';
  var SP = window.SP, st = SP.state, t = SP.t, esc = SP.esc, d10 = SP.d10;
  function pc(v) { return v == null ? '—' : SP.pct1(v); }
  function lab(k) { var x = SP.KPI[k] || SP.KPI.nu; return '<span class="sp-rs sp-rs-' + esc(k) + '">' + esc(t(x.en, x.bm)) + '</span>'; }
  function tbl(head, rows, cls) {
    return '<div class="sp-rpt-tw"><table class="sp-rpt-t' + (cls ? ' ' + cls : '') + '"><thead><tr>' + head.map(function (h, i) { return '<th' + (i ? ' class="r"' : '') + '>' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) { return '<tr>' + r.map(function (c, i) { return '<td' + (i ? ' class="r"' : '') + '>' + c + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
  }
  SP.reportWeek = function (c, code, today) {
    var w = code && c.weeks.find(function (x) { return x.code === code; });
    if (w) return w;
    var past = c.weeks.filter(function (x) { return d10(x.end_date) < today; });
    return past.length ? past[past.length - 1] : (SP.weekOf(c.weeks, today) || c.weeks[0] || null);
  };
  SP.reportHtml = function (params) {
    var c = SP.ctx(), p = c.plan, cur = p.currency, M = function (v) { return v == null ? '—' : SP.money(v, cur); }, N = function (v) { return v == null ? '—' : SP.fmtNum(v); };
    var today = SP.todayISO(), w = SP.reportWeek(c, params.week, today), pl = SP.planCalc(c);
    var upto = w ? c.weeks.filter(function (x) { return d10(x.start_date) <= d10(w.start_date); }) : [];
    var wk = w ? SP.weekCalc(c, w) : null;
    var opts = c.weeks.map(function (x) { return '<option value="' + esc(x.code) + '"' + (w && x.id === w.id ? ' selected' : '') + '>' + esc(x.code + ' · ' + SP.shortRange(x.start_date, x.end_date)) + '</option>'; }).join('');
    var tb = '<div class="sp-rpt-tb no-print"><button type="button" class="btn btn-outline btn-sm" data-act="rpt-back"><i class="ti ti-arrow-left"></i>' + esc(t('Back', 'Kembali')) + '</button>' +
      (opts ? '<label class="sp-rpt-wl"><span>' + esc(t('Week', 'Minggu')) + '</span><select id="sp-rpt-wk" class="form-select" aria-label="' + esc(t('Report week', 'Minggu laporan')) + '">' + opts + '</select></label>' : '') +
      '<button type="button" class="btn btn-primary btn-sm" data-act="rpt-print"><i class="ti ti-printer"></i>' + esc(t('Print / Save PDF', 'Cetak / Simpan PDF')) + '</button></div>';
    var h = '<header class="sp-rpt-h"><div><div class="sp-rpt-k">' + esc(t('Weekly Sales Plan Report', 'Laporan Mingguan Pelan Jualan')) + '</div><h1>' + esc(p.name) + '</h1>' +
      '<div class="sp-rpt-m">' + esc((w ? w.code + ' · ' + SP.fmtRange(w.start_date, w.end_date) : t('No weeks', 'Tiada minggu')) + ' · ' + t('Plan ', 'Pelan ') + SP.fmtRange(p.start_date, p.end_date)) + '</div></div>' +
      '<div class="sp-rpt-m r">' + esc(t('PIC: ', 'PIC: ') + SP.picLabel(p)) + '<br>' + esc(t('Generated ', 'Dijana ') + SP.fmtDate(today)) + '</div></header>';
    var kp = [[t('GMV to date', 'GMV setakat ini'), M(pl.gmv), t('of ', 'daripada ') + M(pl.target) + ' · ' + pc(pl.pct)],
      [t('This week GMV', 'GMV minggu ini'), wk ? M(wk.gmv) : '—', wk ? t('target ', 'sasaran ') + M(wk.target) + ' · ' + pc(wk.ach) : ''],
      [t('Units to date', 'Unit setakat ini'), N(pl.units), pl.unitsT ? t('of ', 'daripada ') + N(pl.unitsT) + ' · ' + pc(pl.unitsPct) : t('No units target', 'Tiada sasaran unit')],
      [t('AOV', 'AOV'), pl.aov == null ? '—' : SP.curSym(cur) + ' ' + SP.fmtNum(pl.aov, 2), N(pl.orders) + ' ' + t('orders', 'pesanan')]];
    var kpis = '<section class="sp-rpt-kp">' + kp.map(function (k) { return '<div><span>' + esc(k[0]) + '</span><b>' + esc(k[1]) + '</b><small>' + esc(k[2]) + '</small></div>'; }).join('') +
      (wk ? '<div class="sp-rpt-st"><span>' + esc(t('Week status', 'Status minggu')) + '</span>' + lab(wk.status) + '</div>' : '') + '</section>';
    var s = function (title, body) { return '<section class="sp-rpt-s"><h2>' + esc(title) + '</h2>' + body + '</section>'; };
    var weeks = s(t('Weekly performance', 'Prestasi mingguan'), upto.length ? tbl([t('Week', 'Minggu'), t('Target', 'Sasaran'), t('Actual', 'Sebenar'), t('Ach.', 'Capai'), t('Units', 'Unit'), t('Orders', 'Pesanan'), t('Status', 'Status')],
      upto.map(function (x) { var k = SP.weekCalc(c, x); return [esc(x.code + ' · ' + SP.shortRange(x.start_date, x.end_date)), esc(M(k.target)), esc(M(k.gmv)), esc(pc(k.ach)), esc(N(k.units)), esc(N(k.orders)), lab(k.status)]; })) : '<p class="sp-rpt-e">' + esc(t('No weeks yet.', 'Tiada minggu lagi.')) + '</p>');
    var months = c.periods.length ? s(t('Monthly KPI', 'KPI bulanan'), tbl([t('Period', 'Tempoh'), t('GMV target', 'Sasaran GMV'), t('GMV actual', 'GMV sebenar'), t('Ach.', 'Capai'), t('Units', 'Unit'), t('Status', 'Status')],
      c.periods.map(function (x) { var k = SP.periodCalc(c, x, today); return [esc(x.label || SP.fmtRange(x.start_date, x.end_date)), esc(M(k.target)), esc(M(k.gmv)), esc(pc(k.ach)), esc(N(k.units) + (k.unitsT ? ' / ' + N(k.unitsT) : '')), lab(k.status)]; }))) : '';
    var miles = c.miles.length ? s(t('Milestones', 'Milestone'), tbl([t('Milestone', 'Milestone'), t('Due', 'Tarikh'), t('Target', 'Sasaran'), t('Actual', 'Sebenar'), t('Status', 'Status')],
      c.miles.map(function (m) { var k = SP.mileCalc(c, m, today); return [esc(m.code + ' · ' + m.title), esc(SP.fmtDate(m.due_date)), esc(SP.mileFmt(c, m, k.target)), esc(SP.mileFmt(c, m, k.actual)), lab(k.status)]; }))) : '';
    var fin = '';
    if (p.financing_enabled && c.batches.length) {
      var fs = SP.finSummary(c);
      fin = s(t('Stock & financing', 'Stok & pembiayaan'), '<p class="sp-rpt-n">' + esc(t('Outstanding ', 'Baki ') + M(fs.outstanding) + (fs.next ? ' · ' + t('next due ', 'tamat seterusnya ') + SP.fmtDate(fs.next.date) : '')) + '</p>' +
        tbl([t('Batch', 'Batch'), t('Sold', 'Terjual'), t('Repayment', 'Bayaran balik'), t('Repaid', 'Dibayar'), t('Due', 'Tarikh'), t('Status', 'Status')],
          c.batches.map(function (b) { var k = SP.batchCalc(c, b, today); return [esc(SP.batchName ? SP.batchName(b) : b.code), esc(N(b.units_sold) + ' / ' + N(b.actual_qty || b.target_qty)), esc(k.fin ? M(k.due) : '—'), esc(k.fin ? M(k.repaid) : '—'), esc(k.fin && k.dueDate ? SP.fmtDate(k.dueDate) : '—'), lab(k.status)]; })));
    }
    var al = SP.computeAlerts(c, today), bm = SP.bm();
    var alerts = s(t('Alerts', 'Amaran'), al.length ? '<ul class="sp-rpt-al">' + al.map(function (a) { return '<li class="sp-rpt-' + esc(a.severity) + '"><b>' + esc(bm ? a.title_bm : a.title_en) + '</b> — ' + esc(bm ? a.body_bm : a.body_en) + '</li>'; }).join('') + '</ul>' : '<p class="sp-rpt-e">' + esc(t('No alerts.', 'Tiada amaran.')) + '</p>');
    var notes = w && (w.pic_notes || w.notes) ? s(t('PIC notes', 'Nota PIC'), '<p class="sp-rpt-n">' + esc(w.pic_notes || w.notes) + '</p>') : '';
    return tb + '<article class="sp-rpt">' + h + kpis + weeks + months + miles + fin + alerts + notes + '<footer class="sp-rpt-f">M-Core · ' + esc(t('Sales Plan', 'Pelan Jualan')) + ' · ' + esc(SP.fmtDate(today)) + '</footer></article>';
  };
  SP.showReport = async function (params, seq) {
    if (SP.loadAuto) { await SP.loadAuto(); if (!SP.alive(seq)) return; }
    st.tab = params.tab || 'overview';
    SP.paint(SP.reportHtml(params));
  };
  SP.actions['rpt-back'] = function () { SP.go({ view: 'detail', id: st.plan.id, tab: st.tab || 'overview' }); };
  SP.actions['rpt-print'] = function () {
    var w = document.getElementById('sp-rpt-wk'), name = ('Sales Plan ' + st.plan.name + (w && w.value ? ' ' + w.value : '')).replace(/[\\/:*?"<>|]+/g, ' ').trim();
    try { if (typeof _pdocSetPrintFilename === 'function') _pdocSetPrintFilename(name); } catch (e) {}
    window.print();
  };
  SP.inputs.push(function (el) {
    if (!el || el.id !== 'sp-rpt-wk') return false;
    if (el.getAttribute('data-go') === el.value) return true; el.setAttribute('data-go', el.value);
    SP.go({ view: 'detail', id: st.plan.id, tab: st.tab || 'overview', report: 1, week: el.value });
    return true;
  });
})();
