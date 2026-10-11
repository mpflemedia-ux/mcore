/* Sales Plan — File 3/12: plans list (stat tiles, filter chips, search, table/cards, templates). */
(function () {
  'use strict';
  var SP = window.SP, st = SP.state, t = SP.t, esc = SP.esc, num = SP.num;
  var STATUS_ORDER = { active: 0, draft: 1, completed: 2, archived: 3 };

  SP.showList = async function (seq) {
    var plans = await SP.fetchAll('sales_plans', 'id,name,start_date,end_date,currency,status,sales_source,pic_name,pic_employee_id,is_template,template_note,financing_enabled,watch_pct,on_track_pct,created_at');
    var rel = [[], [], [], [], []], none = function () { return []; };
    if (plans.length) {
      rel = await Promise.all([
        SP.fetchAll('sales_plan_periods', 'id,plan_id,gmv_target'),
        SP.fetchAll('sales_plan_weeks', 'id,plan_id,code,start_date,end_date,gmv_target,gmv_manual,gmv_auto'),
        SP.fetchAll('sales_plan_batches', 'id,plan_id,actual_principal,repayment_due,repaid_amount').catch(none),
        SP.fetchAll('sales_plan_alerts', 'id,plan_id', function (q) { return q.is('resolved_at', null); }).catch(none),
        SP.fetchAll('sales_plan_milestones', 'id,plan_id').catch(none)
      ]);
    }
    var emps = await SP.loadEmployees();
    if (!SP.alive(seq)) return;
    st.employees = emps;
    st.list = buildList(plans, rel[0], rel[1], rel[2], rel[3], rel[4]);
    SP.paintList();
  };
  function group(rows) { var m = {}; rows.forEach(function (r) { var k = String(r.plan_id); (m[k] = m[k] || []).push(r); }); return m; }
  function buildList(plans, periods, weeks, batches, alerts, miles) {
    var P = group(periods), W = group(weeks), B = group(batches), A = group(alerts), M = group(miles), today = SP.todayISO();
    var rows = plans.map(function (p) {
      var k = String(p.id), ws = (W[k] || []).slice().sort(function (a, b) { return String(a.start_date).localeCompare(String(b.start_date)); });
      var target = (P[k] || []).reduce(function (s, x) { return s + num(x.gmv_target); }, 0);
      if (!target) target = ws.reduce(function (s, x) { return s + num(x.gmv_target); }, 0);
      var actual = null;
      ws.forEach(function (w) { var v = SP.effGmv(w, p.sales_source); if (v != null) actual = (actual || 0) + v; });
      var outstanding = (B[k] || []).reduce(function (s, b) {
        if (b.actual_principal == null || num(b.actual_principal) <= 0) return s;
        return s + Math.max(0, num(b.repayment_due) - num(b.repaid_amount));
      }, 0);
      var cw = SP.weekOf(ws, today);
      return {
        p: p, target: target, actual: actual, pct: target > 0 && actual != null ? actual / target * 100 : null,
        weeksN: ws.length, curWeek: cw ? cw.code : '', alertsN: (A[k] || []).length, outstanding: outstanding,
        batchesN: (B[k] || []).length, milesN: (M[k] || []).length
      };
    });
    return { plans: rows.filter(function (r) { return !r.p.is_template; }), templates: rows.filter(function (r) { return r.p.is_template; }) };
  }
  SP.buildList = buildList;
  function subLine(r) {
    var p = r.p, today = SP.todayISO();
    if (!(r.target > 0)) return t('Targets not set', 'Sasaran belum ditetapkan');
    if (SP.isoOk(p.start_date) && SP.d10(p.start_date) > today && p.status !== 'completed') {
      var dd = SP.diffDays(today, p.start_date);
      return dd === 1 ? t('Starts tomorrow', 'Bermula esok') : t('Starts in ' + dd + ' days', 'Bermula dalam ' + dd + ' hari');
    }
    if (p.status === 'active' && r.curWeek) {
      var s = r.curWeek;
      if (r.alertsN) s += ' · ' + (r.alertsN === 1 ? t('1 alert', '1 amaran') : t(r.alertsN + ' alerts', r.alertsN + ' amaran'));
      return s;
    }
    if (r.pct != null) return t(SP.pct1(r.pct) + ' achieved', SP.pct1(r.pct) + ' dicapai');
    if (SP.isoOk(p.end_date) && SP.d10(p.end_date) < today) return t('Ended ' + SP.fmtDate(p.end_date), 'Tamat ' + SP.fmtDate(p.end_date));
    return t('No sales recorded yet', 'Belum ada jualan direkod');
  }
  SP.subLine = subLine;
  function barColor(r) {
    var p = r.p, on = num(p.on_track_pct) || 100, wa = num(p.watch_pct) || 85;
    if (r.pct >= on) return 'var(--success)';
    if (p.status === 'completed' || p.status === 'archived') return r.pct >= wa ? 'var(--warning)' : 'var(--danger)';
    return 'var(--primary)';
  }
  function progressHtml(r) {
    if (r.pct == null) return '<span class="sp-dash">—</span>';
    var w = Math.max(0, Math.min(100, r.pct));
    return '<div class="sp-prog"><div class="sp-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(w) + '"><i style="width:' + w.toFixed(1) + '%;background:' + barColor(r) + '"></i></div><span class="sp-pct">' + SP.pct1(r.pct) + '</span></div>';
  }
  function filtered() {
    var q = st.q.trim().toLowerCase(), f = st.filter;
    return st.list.plans.filter(function (r) {
      if (f === 'all' ? r.p.status === 'archived' : r.p.status !== f) return false;
      if (q && String(r.p.name || '').toLowerCase().indexOf(q) < 0 && SP.picLabel(r.p).toLowerCase().indexOf(q) < 0) return false;
      return true;
    }).sort(function (a, b) {
      var so = (STATUS_ORDER[a.p.status] || 0) - (STATUS_ORDER[b.p.status] || 0);
      if (so) return so;
      var c = String(a.p.start_date).localeCompare(String(b.p.start_date));
      return (a.p.status === 'completed' || a.p.status === 'archived') ? -c : c;
    });
  }
  SP.filtered = filtered;
  function counts() {
    var c = { all: 0, active: 0, draft: 0, completed: 0, archived: 0 };
    st.list.plans.forEach(function (r) { c[r.p.status] = (c[r.p.status] || 0) + 1; if (r.p.status !== 'archived') c.all++; });
    return c;
  }
  SP.counts = counts;
  SP.progressHtml = progressHtml;
  SP.actions.filter = function (b) { st.filter = b.getAttribute('data-f') || 'all'; SP.refreshResults(); };
  SP.actions.open = function (b) { SP.go({ view: 'detail', id: b.getAttribute('data-id'), tab: 'overview' }); };
  SP.actions['new'] = function () { SP.startNew(); };
  SP.actions['import'] = function () { SP.actions.soon(); };
  SP.startNew = function () { st.form = null; st.formKey = ''; SP.go({ view: 'setup' }); };
  SP.inputs.push(function (el) {
    if (el.id !== 'sp-q') return false;
    st.q = el.value;
    var box = document.getElementById('sp-results'); if (box) box.innerHTML = SP.resultsHtml();
    return true;
  });
})();
