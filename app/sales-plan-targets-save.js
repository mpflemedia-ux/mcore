/* Sales Plan — File 8/12: month/week generation, targets editor events, save. */
(function () {
  'use strict';
  var SP = window.SP, st = SP.state, t = SP.t, num = SP.num, d10 = SP.d10;
  var ZERO = { gmv_target: '0', units_target: '0', orders_target: '0' };
  function z(o) { return Object.assign(o, ZERO); }

  SP.genMonths = function (start, end) {
    var out = [], y = +start.slice(0, 4), m = +start.slice(5, 7) - 1, guard = 0;
    while (guard++ < 60) {
      var ms = y + '-' + SP.pad(m + 1) + '-01', me = SP.fromUTC(Date.UTC(y, m + 1, 0));
      if (ms > end) break;
      out.push(z({ id: null, kind: 'month', label: SP.mons()[m] + '-' + String(y).slice(2), start_date: ms < start ? start : ms, end_date: me > end ? end : me }));
      m++; if (m > 11) { m = 0; y++; }
    }
    return out;
  };
  SP.genWeeks = function (start, end) {
    var out = [], s = start, i = 0;
    while (s <= end && i < SP.MAX_WEEKS) {
      var e = SP.addDays(s, (7 - SP.dow(s)) % 7);
      if (e > end) e = end;
      i++;
      out.push(z({ id: null, code: 'W' + SP.pad(i), start_date: s, end_date: e, hasActual: false }));
      s = SP.addDays(e, 1);
    }
    return out;
  };
  SP.periodFor = function (w, periods) {
    var d = w.start_date, hit = null;
    periods.forEach(function (p) { if (!hit && p.kind === 'custom' && p.start_date <= d && d <= p.end_date) hit = p; });
    periods.forEach(function (p) { if (!hit && p.kind !== 'custom' && p.start_date <= d && d <= p.end_date) hit = p; });
    return hit;
  };
  SP.sig = function (x) { return JSON.stringify(x, ['kind', 'label', 'code', 'start_date', 'end_date', 'gmv_target', 'units_target', 'orders_target']); };
  function rerender() {
    var host = document.getElementById('sp-teditor');
    if (host) host.innerHTML = SP.targetsEditorHtml(host.getAttribute('data-page') === '1');
  }
  function mark() { st.edit.dirty = true; st.edit.generated = false; }
  var A = SP.actions;
  A['tg-add-period'] = function () {
    var E = st.edit, a = d10(st.plan.start_date), b = d10(st.plan.end_date);
    E.periods.push(z({ id: null, kind: 'custom', label: t('Custom period', 'Tempoh khas') + ' ' + (E.periods.filter(function (p) { return p.kind === 'custom'; }).length + 1), start_date: a, end_date: SP.addDays(a, 13) > b ? b : SP.addDays(a, 13) }));
    mark(); rerender();
    var ins = document.querySelectorAll('.sp-root .sp-ttable-p input[data-tf="label"]'); if (ins.length) ins[ins.length - 1].focus();
  };
  A['tg-del-period'] = function (b) {
    var E = st.edit, i = +b.getAttribute('data-i'), p = E.periods[i]; if (!p) return;
    if (!window.confirm(t('Remove period "' + p.label + '"?', 'Buang tempoh "' + p.label + '"?'))) return;
    if (p.id) E.removedP.push(p.id);
    E.periods.splice(i, 1); mark(); rerender();
  };
  A['tg-regen-months'] = function () {
    var E = st.edit;
    if (E.periods.some(function (p) { return p.kind !== 'custom' && p.id; }) && !window.confirm(t('Replace all month periods (and their targets) with months from the plan dates? Custom periods are kept.', 'Ganti semua tempoh bulan (dan sasarannya) dengan bulan daripada tarikh pelan? Tempoh khas dikekalkan.'))) return;
    var keep = [];
    E.periods.forEach(function (p) { if (p.kind === 'custom') keep.push(p); else if (p.id) E.removedP.push(p.id); });
    E.periods = SP.genMonths(d10(st.plan.start_date), d10(st.plan.end_date)).concat(keep);
    mark(); rerender();
  };
  A['tg-regen-weeks'] = function () {
    var E = st.edit;
    if (E.weeks.some(function (w) { return w.hasActual; })) { SP.toast(t('Weeks already have actual sales — edit week dates instead.', 'Minggu sudah ada jualan sebenar — ubah tarikh minggu sahaja.'), 'error'); return; }
    if (E.weeks.length && !window.confirm(t('Replace all weeks (and their targets) with weeks from the plan dates?', 'Ganti semua minggu (dan sasarannya) dengan minggu daripada tarikh pelan?'))) return;
    E.weeks.forEach(function (w) { if (w.id) E.removedW.push(w.id); });
    E.weeks = SP.genWeeks(d10(st.plan.start_date), d10(st.plan.end_date));
    mark(); rerender();
  };
  A['tg-distribute'] = function () {
    var E = st.edit, done = 0;
    E.periods.forEach(function (p) {
      var ws = E.weeks.filter(function (w) { return SP.periodFor(w, E.periods) === p; });
      if (!ws.length) return;
      var days = ws.map(function (w) { return Math.max(1, SP.diffDays(w.start_date, w.end_date) + 1); }), tot = days.reduce(function (s, d) { return s + d; }, 0);
      ['gmv_target', 'units_target', 'orders_target'].forEach(function (f) {
        var T = num(p[f]), dp = f === 'gmv_target' ? 100 : 1, used = 0;
        ws.forEach(function (w, i) {
          var v = i === ws.length - 1 ? Math.round((T - used) * dp) / dp : Math.round(T * days[i] / tot * dp) / dp;
          used += v; w[f] = String(Math.max(0, v));
        });
      });
      done++;
    });
    if (!done) { SP.toast(t('No weeks fall inside the periods.', 'Tiada minggu dalam tempoh.'), 'error'); return; }
    mark(); rerender();
    SP.toast(t('Period targets split into weeks by days', 'Sasaran tempoh dibahagi ikut hari dalam minggu'), 'success');
  };
  A['tg-back'] = function () {
    if (!SP.leaveOk()) return;
    var id = st.plan.id; SP.discard();
    SP.go({ view: 'setup', id: id, step: 1 });
  };
  A['tg-save'] = function (b) { SP.saveTargets(b.getAttribute('data-activate') === '1'); };
  SP.inputs.push(function (el) {
    if (!el.classList || !el.classList.contains('sp-tin') || !st.edit) return false;
    var rows = el.getAttribute('data-tk') === 'p' ? st.edit.periods : st.edit.weeks, r = rows[+el.getAttribute('data-i')];
    if (!r) return true;
    r[el.getAttribute('data-tf')] = el.value; mark(); SP.refreshTotals();
    return true;
  });

  function validNum(v) { var s = String(v == null ? '' : v).trim(); return s === '' || (isFinite(Number(s)) && Number(s) >= 0); }
  function check(E) {
    var i, r, F = ['gmv_target', 'units_target', 'orders_target'];
    for (i = 0; i < E.periods.length; i++) {
      r = E.periods[i];
      if (!String(r.label || '').trim()) return t('Every period needs a name.', 'Setiap tempoh perlu nama.');
      if (!SP.isoOk(r.start_date) || !SP.isoOk(r.end_date) || r.end_date < r.start_date) return t('Check the dates of period "' + r.label + '".', 'Semak tarikh tempoh "' + r.label + '".');
      if (!F.every(function (f) { return validNum(r[f]); })) return t('Targets must be 0 or more ("' + r.label + '").', 'Sasaran mesti 0 atau lebih ("' + r.label + '").');
    }
    for (i = 0; i < E.weeks.length; i++) {
      r = E.weeks[i];
      if (!SP.isoOk(r.start_date) || !SP.isoOk(r.end_date) || r.end_date < r.start_date) return t('Check the dates of ' + r.code + '.', 'Semak tarikh ' + r.code + '.');
      if (!F.every(function (f) { return validNum(r[f]); })) return t('Targets must be 0 or more (' + r.code + ').', 'Sasaran mesti 0 atau lebih (' + r.code + ').');
    }
    return null;
  }
  function nums(r) { return { gmv_target: SP.r2(r.gmv_target), units_target: SP.r2(r.units_target), orders_target: SP.r2(r.orders_target) }; }
  async function run(q) { var res = await q; if (res && res.error) throw res.error; return res; }
  SP.saveTargets = async function (activate) {
    var E = st.edit; if (!E || st.busy || !SP.isAdmin()) return;
    var bad = check(E); if (bad) { SP.toast(bad, 'error'); return; }
    if (activate && SP.sumOf(E.periods, 'gmv_target') <= 0 && SP.sumOf(E.weeks, 'gmv_target') <= 0 &&
      !window.confirm(t('All GMV targets are zero. Activate anyway?', 'Semua sasaran GMV sifar. Aktifkan juga?'))) return;
    var tid = SP.tid(), pid = st.plan.id, now = new Date().toISOString();
    SP.setBusy(true);
    try {
      if (E.removedW.length) await run(sb.from('sales_plan_weeks').update({ deleted_at: now }).in('id', E.removedW).eq('tenant_id', tid).eq('plan_id', pid));
      var newP = [];
      for (var i = 0; i < E.periods.length; i++) {
        var p = E.periods[i], row = Object.assign({ kind: p.kind, label: String(p.label).trim(), start_date: p.start_date, end_date: p.end_date }, nums(p));
        if (!p.id || p._new) { if (!p.id) { p.id = SP.uuid(); p._new = true; } newP.push(Object.assign(row, { id: p.id, tenant_id: tid, plan_id: pid, sort_order: i })); }
        else if (!p._new && E.orig[p.id] !== SP.sig(p)) await run(sb.from('sales_plan_periods').update(row).eq('id', p.id).eq('tenant_id', tid));
      }
      if (newP.length) await run(sb.from('sales_plan_periods').insert(newP));
      newP.forEach(function (r) { var p = E.periods.find(function (x) { return x.id === r.id; }); if (p) { p._new = false; E.orig[p.id] = SP.sig(p); } });
      var newW = [];
      for (var j = 0; j < E.weeks.length; j++) {
        var w = E.weeks[j], per = SP.periodFor(w, E.periods), perId = per ? per.id : null;
        var wr = Object.assign({ code: w.code, start_date: w.start_date, end_date: w.end_date, period_id: perId }, nums(w));
        if (!w.id) newW.push(Object.assign(wr, { id: SP.uuid(), tenant_id: tid, plan_id: pid, sort_order: j }));
        else if (E.orig[w.id] !== SP.sig(w) || String(E.origPeriod[w.id] || '') !== String(perId || '')) await run(sb.from('sales_plan_weeks').update(wr).eq('id', w.id).eq('tenant_id', tid));
      }
      if (newW.length) await run(sb.from('sales_plan_weeks').insert(newW));
      if (E.removedP.length) await run(sb.from('sales_plan_periods').update({ deleted_at: now }).in('id', E.removedP).eq('tenant_id', tid).eq('plan_id', pid));
      if (activate) await run(sb.from('sales_plans').update({ status: 'active' }).eq('id', pid).eq('tenant_id', tid));
      st.edit = null;
      SP.toast(activate ? t('Plan activated', 'Pelan diaktifkan') : t('Targets saved', 'Sasaran disimpan'), 'success');
      SP.go({ view: 'detail', id: pid, tab: 'targets' });
    } catch (err) {
      SP.setBusy(false);
      SP.toast(t('Save failed: ', 'Gagal simpan: ') + SP.errMsg(err), 'error');
    }
  };
})();
