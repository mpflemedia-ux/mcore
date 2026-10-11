/* Sales Plan — phase 2b. Calculations (pure; Excel parity). Every function takes a context
   c = { plan, periods, weeks, batches, repays, miles, auto } so alerts can evaluate any plan. */
(function () {
  'use strict';
  var SP = window.SP, num = SP.num, d10 = SP.d10, t = SP.t;
  SP.KPI = {
    on: { en: 'On Track', bm: 'Atas Landasan', cls: 'badge-green' },
    watch: { en: 'Watch', bm: 'Perhatian', cls: 'badge-yellow' },
    off: { en: 'Off Track', bm: 'Tersasar', cls: 'badge-red' },
    nu: { en: 'Not updated', bm: 'Belum dikemas kini', cls: 'badge-blue' },
    ns: { en: 'Not started', bm: 'Belum bermula', cls: 'badge-gray' },
    ip: { en: 'In progress', bm: 'Sedang berjalan', cls: 'badge-blue' },
    nt: { en: 'No target', bm: 'Tiada sasaran', cls: 'badge-gray' },
    ach: { en: 'Achieved', bm: 'Dicapai', cls: 'badge-green' },
    risk: { en: 'At Risk', bm: 'Berisiko', cls: 'badge-yellow' },
    overdue: { en: 'Overdue', bm: 'Lewat', cls: 'badge-red' },
    pend: { en: 'Pending', bm: 'Belum', cls: 'badge-blue' },
    self: { en: 'Self-funded', bm: 'Modal sendiri', cls: 'badge-blue' },
    nd: { en: 'Not drawn', bm: 'Belum dikeluarkan', cls: 'badge-gray' },
    paid: { en: 'Paid', bm: 'Dibayar', cls: 'badge-green' }
  };
  SP.kpiLabel = function (k) { var x = SP.KPI[k] || SP.KPI.nu; return t(x.en, x.bm); };
  SP.kpiBadge = function (k) { var x = SP.KPI[k] || SP.KPI.nu; return '<span class="badge ' + x.cls + '">' + SP.esc(t(x.en, x.bm)) + '</span>'; };
  SP.ctx = function () { var s = SP.state; return { plan: s.plan, periods: s.periods || [], weeks: s.weeks || [], batches: s.batches || [], repays: s.repays || [], miles: s.miles || [], auto: s.auto || null }; };
  function val(v) { return v == null || v === '' ? null : num(v); }
  SP.eff = function (c, w, f) {
    if (c.plan.sales_source === 'auto') {
      var a = c.auto && c.auto[String(w.id)];
      return a ? val(a[f]) : val(w[f + '_auto']);
    }
    return val(w[f + '_manual']);
  };
  SP.achKey = function (c, pct) {
    var on = num(c.plan.on_track_pct) || 100, wa = num(c.plan.watch_pct) || 85;
    return pct >= on - 1e-9 ? 'on' : pct >= wa - 1e-9 ? 'watch' : 'off';
  };
  SP.achCls = function (k) { return k === 'on' ? 'sp-ok' : k === 'watch' ? 'sp-wt' : k === 'off' ? 'sp-bad' : ''; };
  SP.weekCalc = function (c, w) {
    var g = SP.eff(c, w, 'gmv'), u = SP.eff(c, w, 'units'), o = SP.eff(c, w, 'orders'), tg = num(w.gmv_target);
    var ach = g != null && tg > 0 ? g / tg * 100 : null;
    return { gmv: g, units: u, orders: o, target: tg, ach: ach, aov: g != null && o > 0 ? g / o : null,
      status: g == null ? 'nu' : tg > 0 ? SP.achKey(c, ach) : 'nt' };
  };
  SP.periodWeeks = function (c, p) {
    var ps = c.periods.map(function (x) { return { id: x.id, kind: x.kind, start_date: d10(x.start_date), end_date: d10(x.end_date) }; });
    return c.weeks.filter(function (w) {
      if (w.period_id) return SP.same(w.period_id, p.id);
      var hit = SP.periodFor({ start_date: d10(w.start_date) }, ps);
      return !!hit && SP.same(hit.id, p.id);
    });
  };
  function sumEff(c, ws, f) { var s = null; ws.forEach(function (w) { var v = SP.eff(c, w, f); if (v != null) s = (s || 0) + v; }); return s; }
  function sumF(rows, f) { return rows.reduce(function (s, r) { return s + num(r[f]); }, 0); }
  SP.periodCalc = function (c, p, today) {
    today = today || SP.todayISO();
    var ws = SP.periodWeeks(c, p), tg = num(p.gmv_target) || sumF(ws, 'gmv_target'), g = sumEff(c, ws, 'gmv');
    var ach = g != null && tg > 0 ? g / tg * 100 : null, st;
    if (today < d10(p.start_date)) st = 'ns';
    else if (today <= d10(p.end_date)) st = 'ip';
    else st = g == null ? 'nu' : tg > 0 ? SP.achKey(c, ach) : 'nt';
    return { target: tg, gmv: g, units: sumEff(c, ws, 'units'), orders: sumEff(c, ws, 'orders'),
      unitsT: num(p.units_target) || sumF(ws, 'units_target'), ordersT: num(p.orders_target) || sumF(ws, 'orders_target'), ach: ach, status: st, weeks: ws };
  };
  SP.planCalc = function (c) {
    var hasP = c.periods.length > 0, src = hasP ? c.periods : c.weeks;
    var r = { target: sumF(src, 'gmv_target'), unitsT: sumF(src, 'units_target'), ordersT: sumF(src, 'orders_target'),
      gmv: sumEff(c, c.weeks, 'gmv'), units: sumEff(c, c.weeks, 'units'), orders: sumEff(c, c.weeks, 'orders'), weeksN: c.weeks.length };
    if (!r.target) r.target = sumF(c.weeks, 'gmv_target');
    if (!r.unitsT) r.unitsT = sumF(c.weeks, 'units_target');
    if (!r.ordersT) r.ordersT = sumF(c.weeks, 'orders_target');
    r.updated = c.weeks.filter(function (w) { return SP.eff(c, w, 'gmv') != null; }).length;
    r.pct = r.target > 0 && r.gmv != null ? r.gmv / r.target * 100 : null;
    r.unitsPct = r.unitsT > 0 && r.units != null ? r.units / r.unitsT * 100 : null;
    r.aov = r.gmv != null && r.orders > 0 ? r.gmv / r.orders : null;
    return r;
  };
  /* ---------- batches / financing ---------- */
  SP.batchRepays = function (c, b) { return c.repays.filter(function (r) { return SP.same(r.batch_id, b.id) && !r.deleted_at; }); };
  SP.batchCalc = function (c, b, today) {
    today = today || SP.todayISO();
    var fin = num(b.financed_pct) > 0, drawn = b.actual_principal != null && b.actual_principal !== '';
    var cost = b.actual_cost != null && b.actual_cost !== '' ? num(b.actual_cost) : num(b.target_cost), feeP = num(b.fee_pct);
    var principal = drawn ? num(b.actual_principal) : (b.target_principal != null ? num(b.target_principal) : SP.r2(num(b.target_cost) * num(b.financed_pct) / 100));
    var due = drawn ? (b.repayment_due != null ? num(b.repayment_due) : SP.r2(principal * (1 + feeP / 100))) : (b.target_repayment != null ? num(b.target_repayment) : SP.r2(principal * (1 + feeP / 100)));
    var rp = SP.batchRepays(c, b), repaid = SP.r2(sumF(rp, 'amount')), paidP = SP.r2(sumF(rp, 'principal_portion')), paidF = SP.r2(sumF(rp, 'fee_portion'));
    var fee = SP.r2(due - principal), out = drawn ? Math.max(0, SP.r2(due - repaid)) : 0;
    var dueDate = d10(b.due_date || b.target_due_date), st;
    if (!fin) st = 'self';
    else if (!drawn) st = 'nd';
    else if (out <= 0.004) st = 'paid';
    else if (dueDate && today > dueDate) st = 'overdue';
    else st = num(b.actual_qty) > 0 && num(b.units_sold) / num(b.actual_qty) >= 0.6 ? 'on' : 'watch';
    return { fin: fin, drawn: drawn, cost: cost, principal: principal, fee: fee, due: due, repaid: repaid, outstanding: out,
      outP: Math.max(0, SP.r2(principal - paidP)), outF: Math.max(0, SP.r2(fee - paidF)), dueDate: dueDate, status: st, repays: rp,
      pctRepaid: due > 0 ? Math.min(100, repaid / due * 100) : 0 };
  };
  SP.finSummary = function (c) {
    var out = 0, next = null;
    c.batches.forEach(function (b) {
      var k = SP.batchCalc(c, b); out += k.outstanding;
      if (k.outstanding > 0 && k.dueDate && (!next || k.dueDate < next.date)) next = { date: k.dueDate, b: b, k: k };
    });
    return { outstanding: SP.r2(out), next: next };
  };
  /* ---------- milestones ---------- */
  SP.mileActual = function (c, m, today) {
    var lt = m.link_type || 'manual', f = m.metric === 'units' ? 'units' : m.metric === 'orders' ? 'orders' : 'gmv';
    var per = m.link_period_id ? c.periods.find(function (p) { return SP.same(p.id, m.link_period_id); }) : null;
    var bat = m.link_batch_id ? c.batches.find(function (b) { return SP.same(b.id, m.link_batch_id); }) : null;
    if (lt === 'period_gmv' || lt === 'period_units' || lt === 'period_orders') {
      if (!per) return null;
      var pc = SP.periodCalc(c, per, today);
      return lt === 'period_gmv' ? pc.gmv : lt === 'period_units' ? pc.units : pc.orders;
    }
    if (lt === 'batch_principal') return bat && bat.actual_principal != null ? num(bat.actual_principal) : null;
    if (lt === 'batch_qty') return bat && bat.actual_qty != null ? num(bat.actual_qty) : null;
    if (lt === 'plan_gmv') return SP.planCalc(c)[f];
    if (lt === 'rolling_30d_gmv') {
      var ref = today || SP.todayISO(); if (d10(m.due_date) && d10(m.due_date) < ref) ref = d10(m.due_date);
      var from = SP.addDays(ref, -30);
      return sumEff(c, c.weeks.filter(function (w) { return d10(w.end_date) > from && d10(w.end_date) <= ref; }), 'gmv');
    }
    return val(m.actual_manual);
  };
  SP.mileCalc = function (c, m, today) {
    today = today || SP.todayISO();
    var a = SP.mileActual(c, m, today), tg = num(m.target), due = d10(m.due_date), days = due ? SP.diffDays(today, due) : null, st;
    var riskDays = c.plan.at_risk_days != null ? num(c.plan.at_risk_days) : 7;
    if (a != null && (tg > 0 ? a >= tg - 1e-9 : a > 0)) st = 'ach';
    else if (days != null && days < 0) st = 'overdue';
    else if (days != null && days <= riskDays) st = 'risk';
    else st = 'pend';
    return { actual: a, target: tg, days: days, status: st, pct: a != null && tg > 0 ? a / tg * 100 : null };
  };
  SP.mileFmt = function (c, m, v) {
    if (v == null) return '—';
    if (m.metric === 'rm' || !m.metric) return SP.money(v, c.plan.currency);
    return SP.fmtNum(v) + (m.metric === 'custom' && m.metric_label ? ' ' + m.metric_label : '');
  };
})();
