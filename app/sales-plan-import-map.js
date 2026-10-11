/* Sales Plan — phase 2d. Import mapping (pure): KeraPlus workbook sheets (Weekly Tracker, Monthly KPI,
   Inventory & Funding, Milestones) or the simple CSV template -> list of changes for the open plan.
   Nothing is saved here; sales-plan-import.js previews then saves. */
(function () {
  'use strict';
  var SP = window.SP, st = SP.state, t = SP.t, num = SP.num, d10 = SP.d10;
  var norm = function (s) { return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, ''); };
  SP.impNum = function (v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return isFinite(v) ? SP.r2(v) : null;
    var s = String(v).replace(/rm|myr|,|\s/gi, ''); if (s === '' || s === '-') return null;
    var x = Number(s); return isFinite(x) ? SP.r2(x) : NaN;
  };
  SP.impDate = function (v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number' && v > 20000 && v < 80000) return SP.fromUTC(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
    if (v instanceof Date && !isNaN(v)) return SP.fromUTC(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate()));
    var s = String(v).trim(), m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
    if (m) return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
    m = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/.exec(s);
    return m ? m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2) : NaN;
  };
  var ALIAS = { gmv: 'gmvactual', units: 'unitsactual', orders: 'ordersactual', id: 'code', code: 'code', week: 'week', notes: 'picnotes', note: 'picnotes', title: 'milestone' };
  function header(rows, must) {
    for (var i = 0; i < Math.min(rows.length, 30); i++) {
      var map = {}, r = rows[i] || [];
      r.forEach(function (h, j) { var k = norm(h); if (k && map[k] == null) map[k] = j; if (ALIAS[k] && map[ALIAS[k]] == null) map[ALIAS[k]] = j; });
      if (must.every(function (k) { return map[k] != null; })) return { i: i, map: map };
    }
    return null;
  }
  function body(rows, h) {
    return rows.slice(h.i + 1).map(function (r) { var o = {}; Object.keys(h.map).forEach(function (k) { o[k] = (r || [])[h.map[k]]; }); return o; });
  }
  function find(rows, label) { for (var i = 0; i < Math.min(rows.length, 15); i++) { var r = rows[i] || []; for (var j = 0; j < r.length - 1; j++) if (norm(r[j]) === label) return r[j + 1]; } return null; }
  var same = function (a, b, ty) { if (a == null || a === '') return false; return (ty === 'd' ? d10(a) : ty === 's' ? String(a).trim() : num(a)) === b; };
  function diff(cur, row, fields, out, bad) {
    var ch = {};
    fields.forEach(function (f) {
      var v = row[f[1]]; if (v === undefined) return;
      v = f[2] === 'd' ? SP.impDate(v) : f[2] === 's' ? (v == null || String(v).trim() === '' ? null : String(v).trim()) : SP.impNum(v);
      if (v == null) return;
      if (typeof v === 'number' && (Number.isNaN(v) || v < 0) || (f[2] === 'd' && Number.isNaN(v))) { bad.push(f[0]); return; }
      if (!cur || !same(cur[f[0]], v, f[2])) ch[f[0]] = v;
    });
    if (Object.keys(ch).length) out.push(ch);
    return ch;
  }
  var wcode = function (s) { var m = /^w?\s*0*(\d{1,3})$/i.exec(String(s == null ? '' : s).trim()); return m ? 'W' + ('0' + m[1]).slice(-2) : null; };
  SP.impMap = function (sheets) {
    var R = { items: [], skipped: [], warn: [], found: [] }, admin = SP.isAdmin(), auto = st.plan.sales_source === 'auto';
    var add = function (kind, cur, ch, label, bad) {
      if (bad.length) R.skipped.push(label + ': ' + t('invalid ', 'tidak sah ') + bad.join(', '));
      if (Object.keys(ch).length) R.items.push({ kind: kind, cur: cur || null, row: ch, label: label });
    };
    Object.keys(sheets).forEach(function (name) {
      var rows = sheets[name] || [], h;
      if ((h = header(rows, ['week'])) && (h.map.gmvactual != null || h.map.gmvtarget != null)) {
        R.found.push(name);
        body(rows, h).forEach(function (r) {
          var code = wcode(r.week); if (!code) return;
          var w = st.weeks.find(function (x) { return x.code === code; }) || (r.start != null && st.weeks.find(function (x) { return d10(x.start_date) === SP.impDate(r.start); }));
          if (!w) { if ([r.gmvactual, r.unitsactual, r.ordersactual, r.gmvtarget].some(function (v) { return v != null && v !== ''; })) R.skipped.push(code + ': ' + t('no such week in this plan', 'minggu tiada dalam pelan ini')); return; }
          var f = [], bad = [];
          if (!auto) f.push(['gmv_manual', 'gmvactual'], ['units_manual', 'unitsactual'], ['orders_manual', 'ordersactual']);
          else if (r.gmvactual != null && r.gmvactual !== '' && R.warn.indexOf('auto') < 0) R.warn.push('auto');
          if (admin) f.push(['gmv_target', 'gmvtarget'], ['units_target', 'unitstarget'], ['orders_target', 'orderstarget']);
          if (st.canEdit && r.picnotes !== undefined) f.push(['pic_notes', 'picnotes', 's']);
          add('week', w, diff(w, r, f, [], bad), code, bad);
        });
      } else if (admin && (h = header(rows, ['period', 'gmvtarget', 'start']))) {
        R.found.push(name);
        body(rows, h).forEach(function (r) {
          if (r.period == null || r.period === '') return;
          var p = st.periods.find(function (x) { return norm(x.label) === norm(r.period); }) || (r.start != null && st.periods.find(function (x) { return d10(x.start_date) === SP.impDate(r.start); }));
          if (!p) { R.skipped.push(String(r.period) + ': ' + t('no such period in this plan', 'tempoh tiada dalam pelan ini')); return; }
          var bad = []; add('period', p, diff(p, r, [['gmv_target', 'gmvtarget'], ['units_target', 'unitstarget'], ['orders_target', 'orderstarget']], [], bad), p.label, bad);
        });
      } else if ((h = header(rows, ['batch'])) && (h.map.targetqty != null || h.map.productmix != null)) {
        R.found.push(name);
        var cc = find(rows, 'contractcurrency');
        if (cc && String(cc).trim().toUpperCase() !== String(st.plan.currency || 'MYR').toUpperCase()) R.warn.push('cur:' + String(cc).trim().toUpperCase());
        body(rows, h).forEach(function (r) {
          var code = String(r.batch == null ? '' : r.batch).replace(/^batch\s*/i, '').trim().toUpperCase(); if (!code) return;
          var b = st.batches.find(function (x) { return String(x.code).toUpperCase() === code; }), drawn = b && b.actual_principal != null && b.actual_principal !== '';
          if (!b && !admin) return;
          var f = [['actual_inbound', 'actualinbound', 'd'], ['actual_qty', 'actualqty'], ['actual_cost', 'actualcost']], bad = [];
          if (admin) f.push(['target_inbound', 'targetinbound', 'd'], ['target_qty', 'targetqty'], ['target_cost', 'targetinventorycost'], ['target_due_date', 'targetduedate', 'd']);
          var ch = diff(b, r, f, [], bad);
          if (admin && r.productmix != null && String(r.productmix).trim()) { var mx = SP.parseMix(r.productmix); if (!b || JSON.stringify((b.product_mix || []).map(function (x) { return [x.name, num(x.qty)]; })) !== JSON.stringify(mx.map(function (x) { return [x.name, num(x.qty)]; }))) ch.product_mix = mx; }
          var cost = SP.impNum(r.targetinventorycost), pr = SP.impNum(r.targetprincipal), rp = SP.impNum(r.targetrepayment);
          if (admin && !drawn && cost > 0 && pr != null && !Number.isNaN(pr)) {
            var fp = SP.r2(pr / cost * 100), fe = pr > 0 && rp > 0 ? SP.r2((rp / pr - 1) * 100) : 0;
            if (!b || num(b.financed_pct) !== fp) ch.financed_pct = fp;
            if (!b || num(b.fee_pct) !== fe) ch.fee_pct = fe;
          }
          if (SP.impNum(r.actualprincipal) > 0 && !drawn) R.skipped.push(t('Batch ', 'Batch ') + code + ': ' + t('actual principal ignored — use Draw funding so the journal is posted', 'prinsipal sebenar diabaikan — guna Keluarkan pembiayaan supaya jurnal disiarkan'));
          if (!b) { ch.code = code; if (ch.financed_pct == null) { ch.financed_pct = 0; ch.fee_pct = 0; } ch.tenure_days = num(st.plan.tenure_days) || 30; }
          add('batch', b, ch, t('Batch ', 'Batch ') + code, bad);
        });
      } else if ((h = header(rows, ['code', 'milestone', 'duedate']))) {
        R.found.push(name);
        body(rows, h).forEach(function (r) {
          var code = String(r.code == null ? '' : r.code).trim().toUpperCase(); if (!code || r.milestone == null || r.milestone === '') return;
          var m = st.miles.find(function (x) { return String(x.code).toUpperCase() === code; });
          if (!m && !admin) return;
          var f = [], bad = [];
          if (admin) f.push(['title', 'milestone', 's'], ['due_date', 'duedate', 'd'], ['target', 'target'], ['owner_name', 'owner', 's']);
          if (!m || !m.link_type || m.link_type === 'manual') f.push(['actual_manual', 'actual']);
          f.push(['pic_notes', 'picnotes', 's']);
          var ch = diff(m, r, f, [], bad);
          var mt = norm(r.metric), mm = mt === 'rm' || mt === 'gmv' ? 'rm' : mt === 'units' || mt === 'unit' ? 'units' : mt === 'orders' ? 'orders' : mt ? 'custom' : null;
          if (admin && mm && (!m || m.metric !== mm)) { ch.metric = mm; if (mm === 'custom') ch.metric_label = String(r.metric).trim().slice(0, 40); }
          if (!m) { ch.code = code; ch.link_type = 'manual'; if (!ch.due_date) { bad.push('due_date'); ch = {}; } }
          add('mile', m, ch, code, bad);
        });
      }
    });
    return R;
  };
})();
