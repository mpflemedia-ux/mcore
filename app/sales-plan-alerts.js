/* Sales Plan — phase 2d. Alerts on module open: week Off Track, milestone at-risk/overdue, repayment due in 7 days/overdue.
   Deduped through sales_plan_alerts (one open row per plan/kind/ref), sent once via _tgActivity (bell + Telegram),
   cleared alerts get resolved_at. Owner/Admin only, at most once per 30 min per session. Silent if the table is missing. */
(function () {
  'use strict';
  var SP = window.SP, t = SP.t, d10 = SP.d10;
  var SEND = { week_off_track: 1, milestone_at_risk: 1, milestone_overdue: 1, repayment_due: 1, repayment_overdue: 1 };
  var KEY = 'sp_alerts_run_';
  SP.alertKey = function (a) { return a.plan_id + '|' + a.kind + '|' + a.ref_id; };
  SP.alertText = function (rows, plans, bm) {
    var name = function (id) { var p = plans.find(function (x) { return SP.same(x.id, id); }); return p ? p.name : ''; };
    if (rows.length === 1) { var a = rows[0]; return (bm ? 'Pelan Jualan: ' + a.title_bm : 'Sales Plan: ' + a.title_en) + '\n' + name(a.plan_id) + ' · ' + (bm ? a.body_bm : a.body_en); }
    var head = bm ? 'Pelan Jualan: ' + rows.length + ' amaran baharu' : 'Sales Plan: ' + rows.length + ' new alerts';
    var lines = rows.slice(0, 8).map(function (a) { return '• ' + name(a.plan_id) + ' — ' + (bm ? a.title_bm : a.title_en); });
    if (rows.length > 8) lines.push(bm ? '… dan ' + (rows.length - 8) + ' lagi' : '… and ' + (rows.length - 8) + ' more');
    return head + '\n' + lines.join('\n');
  };
  SP.runAlerts = async function (force) {
    try {
      if (!SP.isAdmin() || !SP.tid() || SP.alertsBusy) return null;
      var k = KEY + SP.tid(), now = Date.now();
      try { if (!force && now - Number(sessionStorage.getItem(k) || 0) < 30 * 60000) return null; sessionStorage.setItem(k, String(now)); } catch (e) {}
      SP.alertsBusy = true;
      var plans = await SP.fetchAll('sales_plans', '*', function (q) { return q.eq('status', 'active').eq('is_template', false); });
      if (!plans.length) return { sent: 0, resolved: 0 };
      var ids = plans.map(function (p) { return p.id; }), by = function (q) { return q.in('plan_id', ids); };
      var r = await Promise.all(['sales_plan_periods', 'sales_plan_weeks', 'sales_plan_batches', 'sales_plan_milestones', 'sales_plan_repayments'].map(function (tb) { return SP.fetchAll(tb, '*', by).catch(function () { return []; }); }));
      var log = await SP.fetchAll('sales_plan_alerts', 'id,plan_id,kind,ref_id,resolved_at', function (q) { return q.in('plan_id', ids).is('resolved_at', null); });
      var today = SP.todayISO(), open = {}, live = {}, fresh = [];
      log.forEach(function (a) { open[SP.alertKey(a)] = a; });
      plans.forEach(function (p) {
        var of = function (x) { return SP.same(x.plan_id, p.id); };
        var c = { plan: p, periods: r[0].filter(of).sort(SP.sortRows), weeks: r[1].filter(of).sort(SP.sortRows), batches: r[2].filter(of), miles: r[3].filter(of), repays: r[4].filter(of), auto: null };
        SP.computeAlerts(c, today).forEach(function (a) {
          if (!SEND[a.kind]) return;
          var row = { plan_id: p.id, kind: a.kind, ref_id: a.ref_id, severity: a.severity, title_en: a.title_en, title_bm: a.title_bm, body_en: a.body_en, body_bm: a.body_bm };
          live[SP.alertKey(row)] = 1;
          if (!open[SP.alertKey(row)]) fresh.push(row);
        });
      });
      var sent = [];
      for (var i = 0; i < fresh.length; i++) {
        var row = Object.assign({ id: SP.uuid(), tenant_id: SP.tid(), alert_date: today, sent_bell: true, sent_telegram: true }, fresh[i]);
        var ins = await sb.from('sales_plan_alerts').insert(row);
        if (!ins.error) sent.push(row);
        else if (SP.isMissing(ins.error)) break;
      }
      var gone = log.filter(function (a) { return !live[SP.alertKey(a)]; }).map(function (a) { return a.id; });
      if (gone.length) await sb.from('sales_plan_alerts').update({ resolved_at: new Date().toISOString() }).in('id', gone).eq('tenant_id', SP.tid());
      if (sent.length && typeof _tgActivity === 'function') await _tgActivity('sales_plan', SP.alertText(sent, plans, SP.bm()), { daily: true });
      return { sent: sent.length, resolved: gone.length };
    } catch (e) { try { console.warn('sales plan alerts', e); } catch (x) {} return null; }
    finally { SP.alertsBusy = false; }
  };
  var orig = window.renderSalesPlan;
  if (typeof orig === 'function' && !orig.__spAlerts) {
    var wrapped = async function (params) { var res = await orig.apply(this, arguments); setTimeout(function () { SP.runAlerts(); }, 1500); return res; };
    wrapped.__spAlerts = true;
    window.renderSalesPlan = wrapped;
  }
})();
