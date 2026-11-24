/* M-Core — funded-batch sold / combo / pace helpers (keep in sync with supabase/functions/_shared/ffm-logic.ts). */
(function () {
  'use strict';
  if (window.FFMS) return;
  var S = window.FFMS = {};
  S.comboMap = function (rows) {
    var m = {};
    (rows || []).forEach(function (r) {
      var p = String(r.parent_barcode || '').trim(), c = String(r.component_barcode || '').trim(), q = Number(r.qty || 0);
      if (!p || !c || !(q > 0)) return;
      (m[p] = m[p] || []).push({ barcode: c, qty: q });
    });
    return m;
  };
  function bcOf(g) { return String((g && (g.barCode || g.barcode || g.goodsCode || g.goods_code || g.sku)) || '').trim(); }
  function qtyOf(g) { var n = Number((g && (g.num != null ? g.num : (g.qty != null ? g.qty : (g.number != null ? g.number : g.quantity)))) || 0); return isFinite(n) && n > 0 ? n : 0; }
  S.expand = function (goods, comboMap, batchBarcodes) {
    var allow = {};
    (batchBarcodes || []).forEach(function (b) { var k = String(b || '').trim(); if (k) allow[k] = 1; });
    var has = Object.keys(allow).length, out = {};
    function add(bc, q) {
      if (!bc || !q) return;
      if (has && !allow[bc]) return;
      out[bc] = (out[bc] || 0) + q;
    }
    (Array.isArray(goods) ? goods : []).forEach(function (g) {
      var bc = bcOf(g), q = qtyOf(g); if (!bc || !q) return;
      var comps = (comboMap || {})[bc] || (comboMap || {})[bc.toUpperCase()];
      if (comps && comps.length) comps.forEach(function (c) { add(c.barcode, q * Number(c.qty || 0)); });
      else add(bc, q);
    });
    return out;
  };
  S.sum = function (counts) { var n = 0; Object.keys(counts || {}).forEach(function (k) { n += Number(counts[k] || 0); }); return n; };
  S.isSold = function (st) { return st === 'shipped' || st === 'delivered'; };
  S.sold = function (ships, comboMap, batchBarcodes) {
    var seen = {}, sold = 0, returned = 0, by = {};
    (ships || []).forEach(function (s) {
      var key = String(s.order_sn || s.id || '');
      if (key) { if (seen[key]) return; seen[key] = 1; }
      var st = String(s.status || '');
      if (st === 'cancelled' || st === 'failed' || st === 'rejected' || st === 'sending') return;
      var part = S.expand(s.goods, comboMap, batchBarcodes), n = S.sum(part);
      if (!n) return;
      if (st === 'returned') { returned += n; return; }
      if (!S.isSold(st)) return;
      sold += n;
      Object.keys(part).forEach(function (k) { by[k] = (by[k] || 0) + part[k]; });
    });
    return { sold: Math.max(0, sold - returned), returned: returned, byBarcode: by };
  };
  S.listedNeeded = function (listed, comboMap, componentBarcode) {
    var want = String(componentBarcode || '').trim(), n = 0;
    if (!want) return 0;
    (listed || []).forEach(function (row) {
      var bc = String(row.barcode || '').trim(), q = Number(row.tiktok_listed_qty != null ? row.tiktok_listed_qty : row.qty || 0);
      if (!bc || !(q > 0)) return;
      if (bc === want) { n += q; return; }
      ((comboMap || {})[bc] || []).forEach(function (c) { if (c.barcode === want) n += q * Number(c.qty || 0); });
    });
    return n;
  };
  S.diffDays = function (from, to) {
    var a = Date.parse(String(from || '').slice(0, 10) + 'T00:00:00Z'), b = Date.parse(String(to || '').slice(0, 10) + 'T00:00:00Z');
    if (!isFinite(a) || !isFinite(b)) return 0;
    return Math.round((b - a) / 86400000);
  };
  S.pace = function (opts) {
    var qty = Number(opts.qty || 0), sold = Number(opts.sold || 0);
    if (!(qty > 0)) return 'ns';
    if (sold >= qty - 1e-9) return 'ach';
    var today = String(opts.today || '').slice(0, 10), due = opts.due ? String(opts.due).slice(0, 10) : '';
    if (due && today > due) return 'overdue';
    var daysLeft = due ? Math.max(0, S.diffDays(today, due)) : null;
    var inbound = opts.inbound ? String(opts.inbound).slice(0, 10) : '';
    var elapsed = inbound && inbound < today ? Math.max(1, S.diffDays(inbound, today)) : 1;
    var rate = sold / elapsed;
    if (daysLeft == null) return qty > 0 && sold / qty >= 0.6 ? 'on' : 'watch';
    var pct = (sold + rate * daysLeft) / qty * 100, watch = opts.watchPct != null ? Number(opts.watchPct) : 85;
    if (pct >= 100 - 1e-9) return 'on';
    if (pct >= watch - 1e-9) return 'watch';
    return 'risk';
  };
  S.isPendingReview = function (ship) {
    var raw = String((ship && (ship.state_text || ship.list_status)) || '').toLowerCase();
    return raw.indexOf('wait_approval') >= 0 || raw.indexOf('wait approval') >= 0 || raw.indexOf('pending review') >= 0 || raw.indexOf('pending approval') >= 0;
  };
  S.mytDay = function (d) {
    d = d ? new Date(d) : new Date();
    return new Date(d.getTime() + 8 * 3600000).toISOString().slice(0, 10);
  };
  S.onDay = function (iso, day) {
    if (!iso || !day) return false;
    try { return new Date(new Date(iso).getTime() + 8 * 3600000).toISOString().slice(0, 10) === day; } catch (e) { return String(iso).slice(0, 10) === day; }
  };
})();
