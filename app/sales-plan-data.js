/* Sales Plan — phase 2b. Detail data (weeks/batches/milestones/repayments/alerts), PIC rights,
   auto actuals RPC, computed alerts, unsaved-changes guard for the new tabs. */
(function () {
  'use strict';
  var SP = window.SP, st = SP.state, t = SP.t, num = SP.num, d10 = SP.d10;
  function byCode(a, b) { return (num(a.sort_order) - num(b.sort_order)) || String(a.code || '').localeCompare(String(b.code || '')); }
  SP.byCode = byCode;
  SP.loadExtras = async function (id) {
    var by = function (q) { return q.eq('plan_id', id); }, none = function () { return []; };
    var r = await Promise.all([
      SP.fetchAll('sales_plan_weeks', '*', by),
      SP.fetchAll('sales_plan_batches', '*', by).catch(none),
      SP.fetchAll('sales_plan_milestones', '*', by).catch(none),
      SP.fetchAll('sales_plan_repayments', '*', by).catch(none),
      SP.fetchAll('sales_plan_alerts', 'id,plan_id,kind,ref_id,alert_date,severity,resolved_at,created_at', by).catch(none),
      SP.fetchAll('chart_of_accounts', 'id,code,name_en,account_type,is_active').catch(none)
    ]);
    st.weeks = r[0].sort(SP.sortRows);
    st.batches = r[1].sort(byCode);
    st.miles = r[2].sort(function (a, b) { return String(d10(a.due_date)).localeCompare(String(d10(b.due_date))) || byCode(a, b); });
    st.repays = r[3].sort(function (a, b) { return String(a.repaid_on).localeCompare(String(b.repaid_on)); });
    st.alertLog = r[4];
    st.accounts = r[5].filter(function (a) { return a.is_active !== false; }).sort(function (a, b) { return String(a.code || '').localeCompare(String(b.code || '')); });
    st.counts = { batches: st.batches.length, milestones: st.miles.length };
    st.auto = null; st.autoErr = null;
    st.canEdit = SP.isAdmin() ? true : await SP.checkPic(id);
  };
  SP.checkPic = async function (id) {
    try {
      var r = await sb.rpc('sales_plan_can_edit_actuals', { p_plan_id: id });
      if (!r.error && typeof r.data === 'boolean') return r.data;
    } catch (e) {}
    var u = window.APP && APP.user && APP.user.id;
    return !!(u && st.plan && st.plan.pic_user_id && SP.same(st.plan.pic_user_id, u));
  };
  SP.loadAuto = async function () {
    st.auto = null; st.autoErr = null;
    if (!st.plan || st.plan.sales_source !== 'auto') return;
    try {
      var r = await sb.rpc('sales_plan_auto_actuals', { p_plan_id: st.plan.id });
      if (r.error) throw r.error;
      var m = {};
      (r.data || []).forEach(function (x) { m[String(x.week_id)] = { gmv: num(x.gmv), units: num(x.units), orders: num(x.orders) }; });
      st.auto = m;
    } catch (err) { st.autoErr = err; }
  };
  SP.loadUsers = async function () {
    if (st.users) return st.users;
    try {
      var r = await sb.from('user_profiles').select('id,full_name').eq('tenant_id', SP.tid());
      st.users = r.error ? [] : (r.data || []);
    } catch (e) { st.users = []; }
    return st.users;
  };
  SP.userName = function (id) { var u = (st.users || []).find(function (x) { return SP.same(x.id, id); }); return u ? (u.full_name || '') : ''; };
  SP.acctLabel = function (id) {
    var a = (st.accounts || (st.refs && st.refs.accounts) || []).find(function (x) { return SP.same(x.id, id); });
    return a ? (a.code ? a.code + ' — ' : '') + (a.name_en || '') : '';
  };
  /* ---------- computed alerts (Overview panel, 2d notifications) ---------- */
  function sev(k) { return k === 'week_off_track' || k === 'milestone_overdue' || k === 'repayment_overdue' ? 'danger' : 'warning'; }
  SP.computeAlerts = function (c, today) {
    today = today || SP.todayISO();
    var out = [], cur = c.plan.currency, M = SP.money;
    c.weeks.forEach(function (w) {
      if (d10(w.end_date) >= today) return;
      var k = SP.weekCalc(c, w);
      if (k.status !== 'off' && k.status !== 'watch') return;
      var kind = k.status === 'off' ? 'week_off_track' : 'week_watch', p = Math.round(k.ach);
      out.push({ kind: kind, ref_id: w.id, date: d10(w.end_date),
        title_en: w.code + ' ' + (k.status === 'off' ? 'Off Track' : 'Watch') + ' — ' + p + '%', title_bm: w.code + ' ' + (k.status === 'off' ? 'Tersasar' : 'Perhatian') + ' — ' + p + '%',
        body_en: SP.fmtRangeL(w.start_date, w.end_date, 'en') + ' · ' + M(k.gmv, cur) + ' of ' + M(k.target, cur) + ' target',
        body_bm: SP.fmtRangeL(w.start_date, w.end_date, 'bm') + ' · ' + M(k.gmv, cur) + ' daripada sasaran ' + M(k.target, cur) });
    });
    c.miles.forEach(function (m) {
      var k = SP.mileCalc(c, m, today);
      if (k.status !== 'overdue' && k.status !== 'risk') return;
      var od = k.status === 'overdue', n = Math.abs(k.days);
      out.push({ kind: od ? 'milestone_overdue' : 'milestone_at_risk', ref_id: m.id, date: d10(m.due_date),
        title_en: m.title + ' — due ' + SP.fmtDateL(m.due_date, 'en') + ' · ' + (od ? 'Overdue' : 'At Risk'),
        title_bm: m.title + ' — tarikh ' + SP.fmtDateL(m.due_date, 'bm') + ' · ' + (od ? 'Lewat' : 'Berisiko'),
        body_en: m.code + ' · ' + (od ? n + ' day' + (n === 1 ? '' : 's') + ' overdue' : (n === 0 ? 'due today' : n + ' day' + (n === 1 ? '' : 's') + ' left')) + (k.actual == null ? ', not yet confirmed' : ''),
        body_bm: m.code + ' · ' + (od ? 'lewat ' + n + ' hari' : (n === 0 ? 'tamat hari ini' : 'tinggal ' + n + ' hari')) + (k.actual == null ? ', belum disahkan' : '') });
    });
    c.batches.forEach(function (b) {
      var k = SP.batchCalc(c, b, today);
      if (!k.drawn || k.outstanding <= 0 || !k.dueDate) return;
      var d = SP.diffDays(today, k.dueDate);
      if (d > 7) return;
      var od = d < 0, name = b.label || ('Batch ' + b.code);
      out.push({ kind: od ? 'repayment_overdue' : 'repayment_due', ref_id: b.id, date: k.dueDate,
        title_en: name + ' repayment ' + (od ? 'overdue' : 'due') + ' — ' + SP.fmtDateL(k.dueDate, 'en'),
        title_bm: 'Bayaran balik ' + name + ' ' + (od ? 'lewat' : 'perlu dibayar') + ' — ' + SP.fmtDateL(k.dueDate, 'bm'),
        body_en: M(k.outstanding, cur) + ' outstanding · ' + (od ? -d + ' days overdue' : d === 0 ? 'due today' : 'in ' + d + ' days'),
        body_bm: M(k.outstanding, cur) + ' tertunggak · ' + (od ? 'lewat ' + (-d) + ' hari' : d === 0 ? 'hari ini' : 'dalam ' + d + ' hari') });
    });
    out.forEach(function (a) { a.severity = a.kind === 'week_watch' ? 'info' : sev(a.kind); });
    var rank = { danger: 0, warning: 1, info: 2 };
    return out.sort(function (a, b) { return (rank[a.severity] - rank[b.severity]) || String(b.date).localeCompare(String(a.date)); });
  };
  var MEN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], MBM = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];
  SP.fmtDateL = function (s, lang) { if (!SP.isoOk(s)) return '—'; var p = d10(s).split('-'); return (+p[2]) + ' ' + (lang === 'bm' ? MBM : MEN)[+p[1] - 1] + ' ' + p[0]; };
  SP.fmtRangeL = function (a, b, lang) {
    if (!SP.isoOk(a) || !SP.isoOk(b)) return '—';
    var M = lang === 'bm' ? MBM : MEN, pa = d10(a).split('-'), pb = d10(b).split('-');
    if (pa[0] === pb[0] && pa[1] === pb[1]) return (+pa[2]) + '–' + (+pb[2]) + ' ' + M[+pb[1] - 1];
    return (+pa[2]) + ' ' + M[+pa[1] - 1] + '–' + (+pb[2]) + ' ' + M[+pb[1] - 1];
  };
  SP.shortRange = function (a, b) { return SP.fmtRangeL(a, b, SP.bm() ? 'bm' : 'en'); };
  /* ---------- unsaved-changes guard covers the weekly grid + milestone/batch forms ---------- */
  var baseLeave = SP.leaveOk, baseDiscard = SP.discard;
  SP.leaveOk = function () {
    if (st.wk && st.wk.dirty) return window.confirm(t('Discard unsaved changes?', 'Buang perubahan yang belum disimpan?'));
    return baseLeave();
  };
  SP.discard = function () { st.wk = null; baseDiscard(); };
})();
