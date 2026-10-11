/* Sales Plan — phase 2b. Weekly Update: summary cards, grid events, save manual actuals,
   switch sales source (confirm when data exists), auto snapshot sync from sales_plan_auto_actuals(). */
(function () {
  'use strict';
  var SP = window.SP, st = SP.state, t = SP.t, esc = SP.esc, num = SP.num, d10 = SP.d10;
  var F = ['gmv', 'units', 'orders'];
  SP.wkSummaryHtml = function (c) {
    var today = SP.todayISO(), cur = c.plan.currency;
    var done = c.weeks.filter(function (w) { return d10(w.end_date) < today || SP.eff(c, w, 'gmv') != null; });
    var sum = function (rows, fn) { return rows.reduce(function (a, w) { return a + num(fn(w)); }, 0); };
    var g = sum(done, function (w) { return SP.eff(c, w, 'gmv'); }), gt = sum(done, function (w) { return w.gmv_target; });
    var u = sum(done, function (w) { return SP.eff(c, w, 'units'); }), ut = sum(done, function (w) { return w.units_target; });
    var o = sum(done, function (w) { return SP.eff(c, w, 'orders'); }), ot = sum(done, function (w) { return w.orders_target; });
    var rng = done.length ? ' (' + done[0].code + (done.length > 1 ? '–' + done[done.length - 1].code : '') + ')' : '';
    var pc = function (a, b) { return b > 0 ? ' · ' + SP.pct1(a / b * 100) : ''; };
    var cnt = { on: 0, watch: 0, off: 0, nu: 0 };
    c.weeks.forEach(function (w) { var k = SP.weekCalc(c, w).status; if (k === 'nt') k = 'on'; cnt[k] = (cnt[k] || 0) + 1; });
    var box = function (l, v, of) { return '<div class="card sp-wsum"><div class="sp-kpi-l">' + esc(l) + '</div><div class="sp-kpi-v"><b>' + esc(v) + '</b><span> ' + esc(of) + '</span></div></div>'; };
    return '<div class="sp-wsums">' + box(t('GMV to date', 'GMV setakat ini') + rng, SP.money(g, cur), '/ ' + SP.fmtNum(gt) + pc(g, gt)) +
      box(t('Units to date', 'Unit setakat ini'), SP.fmtNum(u), ut > 0 ? '/ ' + SP.fmtNum(ut) + pc(u, ut) : t('· no target', '· tiada sasaran')) + box(t('Orders to date', 'Order setakat ini'), SP.fmtNum(o), ot > 0 ? '/ ' + SP.fmtNum(ot) + pc(o, ot) : t('· no target', '· tiada sasaran')) +
      '<div class="card sp-wsum"><div class="sp-kpi-l">' + esc(t('Weeks status', 'Status minggu')) + '</div><div class="sp-wbadges">' +
      ['on', 'watch', 'off', 'nu'].map(function (k) { return '<span class="badge ' + SP.KPI[k].cls + '">' + esc(SP.kpiLabel(k) + ' ' + cnt[k]) + '</span>'; }).join('') + '</div></div></div>';
  };
  function refreshWeek(id) {
    var c = SP.wkCtx(), w = c.weeks.find(function (x) { return SP.same(x.id, id); }); if (!w) return;
    var k = SP.wkCalcCells(c, w);
    document.querySelectorAll('.sp-root [data-wrow="' + id + '"]').forEach(function (row) {
      ['ach', 'aov', 'st'].forEach(function (f) { row.querySelectorAll('[data-c="' + f + '"]').forEach(function (el) { el.innerHTML = k[f]; }); });
    });
    var sm = document.getElementById('sp-wk-sum'); if (sm) sm.innerHTML = SP.wkSummaryHtml(c);
  }
  SP.inputs.push(function (el) {
    if (!el.classList || !el.classList.contains('sp-win') || !st.wk) return false;
    var id = el.getAttribute('data-wk'), f = el.getAttribute('data-wf'), v = st.wk.vals[id] || (st.wk.vals[id] = {});
    v[f] = el.value;
    document.querySelectorAll('.sp-root .sp-win[data-wk="' + id + '"][data-wf="' + f + '"]').forEach(function (x) { if (x !== el) x.value = el.value; });
    st.wk.dirty = JSON.stringify(st.wk.vals) !== st.wk.orig;
    refreshWeek(id);
    return true;
  });
  function parse(x) { var s = String(x == null ? '' : x).trim().replace(/,/g, ''); if (s === '') return null; var n = Number(s); return isFinite(n) && n >= 0 ? SP.r2(n) : NaN; }
  SP.wkChanges = function () {
    var out = [], bad = null;
    st.weeks.forEach(function (w) {
      var v = st.wk.vals[String(w.id)]; if (!v) return;
      var row = {}, changed = false;
      F.forEach(function (f) {
        var n = parse(v[f]); if (Number.isNaN(n)) { bad = bad || w.code; return; }
        var o = w[f + '_manual'] == null || w[f + '_manual'] === '' ? null : SP.r2(w[f + '_manual']);
        row[f + '_manual'] = n; if (n !== o) changed = true;
      });
      if (changed) out.push({ w: w, row: row });
    });
    return { rows: out, bad: bad };
  };
  SP.wkSave = async function () {
    if (st.busy || !st.wk || !SP.wkEditable()) return;
    var ch = SP.wkChanges();
    if (ch.bad) { SP.toast(t('Check the numbers for ' + ch.bad + ' — use 0 or more.', 'Semak nombor untuk ' + ch.bad + ' — guna 0 atau lebih.'), 'error'); return; }
    if (!ch.rows.length) { SP.toast(t('No changes to save', 'Tiada perubahan untuk disimpan'), 'info'); return; }
    busy(true);
    try {
      for (var i = 0; i < ch.rows.length; i++) {
        var r = ch.rows[i], res = await sb.from('sales_plan_weeks').update(r.row).eq('id', r.w.id).eq('tenant_id', SP.tid()).eq('plan_id', st.plan.id);
        if (res.error) throw res.error;
        Object.assign(r.w, r.row);
      }
      st.wk = null;
      SP.toast(t('Weekly update saved (' + ch.rows.length + ' week' + (ch.rows.length === 1 ? '' : 's') + ')', 'Kemas kini mingguan disimpan (' + ch.rows.length + ' minggu)'), 'success');
      SP.go({ view: 'detail', id: st.plan.id, tab: 'weekly' });
    } catch (err) { busy(false); SP.toast(t('Save failed: ', 'Gagal simpan: ') + SP.errMsg(err), 'error'); }
  };
  function busy(on) { st.busy = on; document.querySelectorAll('.sp-root [data-act^="wk-"]').forEach(function (b) { b.disabled = !!on; }); }
  SP.wkBusy = busy;
  function hasData(src) {
    return st.weeks.some(function (w) { return F.some(function (f) { var v = w[f + (src === 'auto' ? '_auto' : '_manual')]; return v != null && v !== ''; }); });
  }
  var A = SP.actions;
  A['wk-save'] = function () { SP.wkSave(); };
  A['wk-src'] = async function (b) {
    var to = b.getAttribute('data-v'), from = st.plan.sales_source;
    if (to === from || st.busy || !SP.isAdmin()) return;
    if (st.wk && st.wk.dirty && !window.confirm(t('Discard unsaved changes?', 'Buang perubahan yang belum disimpan?'))) return;
    if (hasData(from) && !window.confirm(to === 'auto'
      ? t('Switch to Auto from M-Core sales? Numbers typed manually are kept, but hidden while Auto is on.', 'Tukar ke Auto dari jualan M-Core? Nombor yang ditaip disimpan, tetapi disembunyikan semasa Auto aktif.')
      : t('Switch to Manual entry? Auto numbers are kept; the PIC will type weekly actuals.', 'Tukar ke Taip sendiri? Nombor auto disimpan; PIC akan taip jualan mingguan.'))) return;
    busy(true);
    try {
      var res = await sb.from('sales_plans').update({ sales_source: to }).eq('id', st.plan.id).eq('tenant_id', SP.tid());
      if (res.error) throw res.error;
      st.wk = null;
      SP.toast(to === 'auto' ? t('Sales source: Auto from M-Core', 'Sumber jualan: Auto dari M-Core') : t('Sales source: Manual entry', 'Sumber jualan: Taip sendiri'), 'success');
      SP.go({ view: 'detail', id: st.plan.id, tab: 'weekly' });
    } catch (err) { busy(false); SP.toast(SP.errMsg(err), 'error'); }
  };
  /* auto: persist the RPC snapshot into *_auto so lists/overview/alerts agree */
  SP.wkSyncAuto = async function (manual) {
    if (st.plan.sales_source !== 'auto' || !st.canEdit || st.plan.status === 'archived') return 0;
    if (manual) { await SP.loadAuto(); }
    if (!st.auto) { if (manual) SP.toast(t('Could not read M-Core sales', 'Gagal baca jualan M-Core'), 'error'); return 0; }
    var now = new Date().toISOString(), n = 0;
    for (var i = 0; i < st.weeks.length; i++) {
      var w = st.weeks[i], a = st.auto[String(w.id)]; if (!a) continue;
      var row = { gmv_auto: SP.r2(a.gmv), units_auto: SP.r2(a.units), orders_auto: SP.r2(a.orders) };
      var same = F.every(function (f) { return w[f + '_auto'] != null && SP.r2(w[f + '_auto']) === row[f + '_auto']; });
      if (same && !manual) continue;
      row.auto_synced_at = now;
      var res = await sb.from('sales_plan_weeks').update(row).eq('id', w.id).eq('tenant_id', SP.tid()).eq('plan_id', st.plan.id);
      if (res.error) { if (manual) SP.toast(SP.errMsg(res.error), 'error'); return n; }
      Object.assign(w, row); n++;
    }
    var el = document.getElementById('sp-wk-saved'); if (el && n) el.textContent = t('Synced ', 'Disegerakkan ') + SP.fmtStamp(now);
    return n;
  };
  A['wk-sync'] = async function () {
    if (st.busy) return; busy(true);
    try { await SP.wkSyncAuto(true); if (st.auto) SP.toast(t('Refreshed from M-Core sales', 'Dikemas kini dari jualan M-Core'), 'success'); SP.go({ view: 'detail', id: st.plan.id, tab: 'weekly' }); }
    catch (err) { busy(false); SP.toast(SP.errMsg(err), 'error'); }
  };
  A['wk-import'] = function () { if (SP.importWeekly) SP.importWeekly(); else SP.actions.soon(); };
  SP.afterTab.weekly = function () { SP.wkSyncAuto(false).catch(function () {}); };
})();
