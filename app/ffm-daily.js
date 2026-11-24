/* M-Core — FFM Logistics daily list + plain-text WhatsApp share (EN/BM). No internal IDs. */
(function () {
  'use strict';
  function boot() {
    if (!window.FFM || window.FFMDaily) return;
    var F = window.FFM, t = F.t, esc = F.esc;
    var S = window.FFMDaily = {};
    var LIVE = { sending: 1, created: 1, stock_out: 1, withdrawn: 1, verified: 1, received: 1, picked: 1, packed: 1, awaiting_pickup: 1, exception: 1 };

    S.render = async function (body, accts) {
      var day = (S._day && /^\d{4}-\d{2}-\d{2}$/.test(S._day)) ? S._day : (window.FFMS ? FFMS.mytDay() : new Date().toISOString().slice(0, 10));
      S._day = day;
      var flt = S._flt || { status: '', account: '', courier: '', waybill: '', open: '1' };
      S._flt = flt;
      var cols = 'id,account_id,order_sn,ffm_order_id,status,state_text,pno,courier,pickup_at,shipped_at,cancelled_at,goods,total_amount,created_at,updated_at,source';
      var r = await sb.from('ffm_shipments').select(cols).eq('tenant_id', F.tid()).is('deleted_at', null).order('updated_at', { ascending: false }).limit(2000);
      if (r.error && /courier|pickup_at|source/i.test(r.error.message || '')) {
        r = await sb.from('ffm_shipments').select('id,account_id,order_sn,ffm_order_id,status,state_text,pno,shipped_at,cancelled_at,goods,total_amount,created_at,updated_at').eq('tenant_id', F.tid()).is('deleted_at', null).order('updated_at', { ascending: false }).limit(2000);
      }
      if (r.error) { body.innerHTML = '<div class="card" style="padding:16px"><div class="ffm-err">' + esc(r.error.message) + '</div><p class="ffm-muted">' + esc(t('Run the latest FFM SQL in Supabase first, then refresh.', 'Jalankan SQL FFM terkini dalam Supabase dahulu, kemudian muat semula.')) + '</p></div>'; return; }
      var ships = r.data || [];
      var am = {}; (accts || []).forEach(function (a) { am[String(a.id)] = a; });
      function onDay(s) {
        return (window.FFMS && (FFMS.onDay(s.created_at, day) || FFMS.onDay(s.shipped_at, day) || FFMS.onDay(s.pickup_at, day) || FFMS.onDay(s.updated_at, day) || FFMS.onDay(s.cancelled_at, day)));
      }
      var dayRows = ships.filter(function (s) { return onDay(s) || (flt.open !== '0' && LIVE[s.status]); });
      var couriers = [];
      dayRows.forEach(function (s) { var c = String(s.courier || '').trim(); if (c && couriers.indexOf(c) < 0) couriers.push(c); });
      couriers.sort();
      var view = dayRows.filter(function (s) {
        if (flt.status === 'pending_review') { if (!(window.FFMS && FFMS.isPendingReview(s))) return false; }
        else if (flt.status && String(s.status) !== flt.status) return false;
        if (flt.account && !F.same(s.account_id, flt.account)) return false;
        if (flt.courier && String(s.courier || '') !== flt.courier) return false;
        if (flt.waybill === 'yes' && !String(s.pno || '').trim()) return false;
        if (flt.waybill === 'no' && String(s.pno || '').trim()) return false;
        return true;
      });
      var stockRs = await sb.from('ffm_stock').select('account_id,product_id,barcode,available_qty,inventory_qty,total_qty').eq('tenant_id', F.tid()).is('deleted_at', null);
      var stock = stockRs.error ? [] : (stockRs.data || []);
      var pace = await loadPace(accts, ships);
      body.innerHTML = '<div class="card" style="padding:16px"><div class="ffm-actions" style="margin-bottom:12px;flex-wrap:wrap;gap:8px">' +
        '<label class="ffm-muted" style="display:flex;align-items:center;gap:6px">' + esc(t('Date', 'Tarikh')) + ' <input type="date" class="form-input" id="ffm-day" value="' + esc(day) + '" style="max-width:160px;min-height:38px"></label>' +
        acctSel(accts, flt.account) +
        statusSel(flt.status) +
        '<select class="form-select" id="ffm-day-courier" style="max-width:180px"><option value="">' + esc(t('All couriers', 'Semua kurier')) + '</option>' + couriers.map(function (c) { return '<option value="' + esc(c) + '"' + (c === flt.courier ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select>' +
        '<select class="form-select" id="ffm-day-wb" style="max-width:180px"><option value="">' + esc(t('Waybill: all', 'Waybill: semua')) + '</option><option value="yes"' + (flt.waybill === 'yes' ? ' selected' : '') + '>' + esc(t('With waybill', 'Ada waybill')) + '</option><option value="no"' + (flt.waybill === 'no' ? ' selected' : '') + '>' + esc(t('No waybill', 'Tiada waybill')) + '</option></select>' +
        '<label class="ffm-muted" style="display:flex;align-items:center;gap:6px"><input type="checkbox" id="ffm-day-open"' + (flt.open !== '0' ? ' checked' : '') + '> ' + esc(t('Include open outbound', 'Sertakan outbound terbuka')) + '</label>' +
        '<button type="button" class="btn btn-outline btn-sm" id="ffm-day-pull"><i class="ti ti-refresh"></i> ' + esc(t('Refresh from FFM', 'Muat semula dari FFM')) + '</button>' +
        '<button type="button" class="btn btn-primary btn-sm" id="ffm-day-share"><i class="ti ti-brand-whatsapp"></i> ' + esc(t('Share', 'Kongsi')) + '</button>' +
        '</div>' +
        summary(dayRows, stock, accts, pace) +
        (view.length ? '<div class="ffm-tbl" style="overflow-x:auto"><table><thead><tr><th>' + esc(t('Order', 'Pesanan')) + '</th><th>' + esc(t('Status', 'Status')) + '</th><th>' + esc(t('Waybill', 'Waybill')) + '</th><th>' + esc(t('Courier', 'Kurier')) + '</th><th>' + esc(t('Pickup', 'Pengambilan')) + '</th><th>' + esc(t('Account', 'Akaun')) + '</th></tr></thead><tbody>' +
          view.map(function (s) {
            var a = am[String(s.account_id)], name = (a && a.label) || '—';
            var no = s.order_sn || s.ffm_order_id || '—';
            return '<tr><td><strong>' + esc(no) + '</strong>' + (window.FFMS && FFMS.isPendingReview(s) ? ' <span class="badge badge-yellow">' + esc(t('Pending review', 'Menunggu semakan')) + '</span>' : '') + '</td><td>' + F.badge(s.status) + '</td><td>' + (s.pno ? esc(s.pno) : '<span class="ffm-muted">—</span>') + '</td><td>' + esc(s.courier || '—') + '</td><td>' + esc(s.pickup_at ? F.dt(s.pickup_at) : '—') + '</td><td>' + esc(name) + '</td></tr>';
          }).join('') + '</tbody></table></div>'
          : '<div class="empty-state" style="padding:30px"><i class="ti ti-truck-delivery"></i><h3>' + esc(t('No orders for this date', 'Tiada pesanan pada tarikh ini')) + '</h3></div>') +
        '</div>';
      bind(body, accts);
      S._last = { day: day, rows: dayRows, stock: stock, accts: accts, pace: pace };
    };

    function acctSel(accts, cur) {
      return '<select class="form-select" id="ffm-day-acct" style="max-width:200px"><option value="">' + esc(t('All accounts', 'Semua akaun')) + '</option>' +
        (accts || []).map(function (a) { return '<option value="' + esc(a.id) + '"' + (F.same(a.id, cur) ? ' selected' : '') + '>' + esc(a.label) + '</option>'; }).join('') + '</select>';
    }
    function statusSel(cur) {
      var opts = [['', t('All statuses', 'Semua status')], ['created', t('Created', 'Dicipta')], ['pending_review', t('Pending review', 'Menunggu semakan')], ['picked', t('Outbound in progress', 'Outbound berjalan')], ['packed', t('Packed', 'Dibungkus')], ['awaiting_pickup', t('Awaiting courier', 'Menunggu kurier')], ['shipped', t('Shipped', 'Dihantar keluar')], ['delivered', t('Delivered', 'Sampai')], ['cancelled', t('Cancelled', 'Dibatalkan')], ['exception', t('Exception', 'Masalah')]];
      return '<select class="form-select" id="ffm-day-st" style="max-width:200px">' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[0] === cur ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>';
    }
    function summary(rows, stock, accts, pace) {
      var n = rows.length, wb = 0, can = 0, ex = 0, pend = 0;
      rows.forEach(function (s) {
        if (String(s.pno || '').trim()) wb++;
        if (s.status === 'cancelled') can++;
        if (s.status === 'exception') ex++;
        if (window.FFMS && FFMS.isPendingReview(s)) pend++;
      });
      var stockLine = (stock || []).slice(0, 8).map(function (s) {
        var tot = Number(s.total_qty || 0), av = Number(s.available_qty || 0), lock = Math.max(0, tot - av);
        return esc(s.barcode) + ': ' + t('physical', 'fizikal') + ' ' + tot + ' · ' + t('locked', 'dikunci') + ' ' + lock + ' · ' + t('available', 'tersedia') + ' ' + av;
      }).join('<br>');
      var paceLine = (pace || []).map(function (p) { return esc(p.line); }).join('<br>');
      return '<div class="ffm-grid" style="margin-bottom:12px;display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px">' +
        kpi(t('Orders', 'Pesanan'), n) + kpi(t('With waybill', 'Ada waybill'), wb) + kpi(t('Cancelled', 'Dibatalkan'), can) + kpi(t('Exception', 'Masalah'), ex) + kpi(t('Pending review', 'Menunggu semakan'), pend) +
        '</div>' +
        (stockLine ? '<p class="ffm-muted" style="margin:0 0 8px"><strong>' + esc(t('FFM stock', 'Stok FFM')) + '</strong><br>' + stockLine + '</p>' : '') +
        (paceLine ? '<p class="ffm-muted" style="margin:0 0 12px"><strong>' + esc(t('Batch repayment', 'Bayaran balik batch')) + '</strong><br>' + paceLine + '</p>' : '');
    }
    function kpi(l, v) { return '<div class="card" style="padding:10px 12px"><div class="ffm-muted">' + esc(l) + '</div><strong>' + esc(String(v)) + '</strong></div>'; }

    async function loadPace(accts, ships) {
      if (!window.FFMS) return [];
      var out = [];
      try {
        var bc = await sb.from('sales_plan_batch_barcodes').select('batch_id,account_id,barcode').eq('tenant_id', F.tid()).is('deleted_at', null);
        var combo = await sb.from('ffm_combo_components').select('parent_barcode,component_barcode,qty').eq('tenant_id', F.tid()).is('deleted_at', null);
        if (bc.error || combo.error) return [];
        var ids = Array.from(new Set((bc.data || []).map(function (r) { return r.batch_id; })));
        if (!ids.length) return [];
        var batches = await sb.from('sales_plan_batches').select('id,code,label,actual_qty,units_sold,due_date,target_due_date,actual_inbound,ffm_account_id,repayment_due,actual_principal,target_repayment').eq('tenant_id', F.tid()).is('deleted_at', null).in('id', ids);
        var map = FFMS.comboMap(combo.data || []);
        (batches.data || []).forEach(function (b) {
          var bcs = (bc.data || []).filter(function (r) { return F.same(r.batch_id, b.id); }).map(function (r) { return r.barcode; });
          var sh = (ships || []).filter(function (s) { return !b.ffm_account_id || F.same(s.account_id, b.ffm_account_id); });
          var r = FFMS.sold(sh, map, bcs);
          var qty = Number(b.actual_qty || 0), due = (b.due_date || b.target_due_date || '').toString().slice(0, 10);
          var today = FFMS.mytDay(), left = qty ? Math.max(0, qty - r.sold) : 0, days = due ? FFMS.diffDays(today, due) : null;
          var pk = FFMS.pace({ sold: r.sold, qty: qty, today: today, due: due, inbound: b.actual_inbound });
          var lab = F.stLabel ? '' : '';
          var status = ({ on: t('On track', 'Atas landasan'), watch: t('Watch', 'Perhatian'), risk: t('At risk', 'Berisiko'), overdue: t('Overdue', 'Lewat'), ach: t('Achieved', 'Dicapai'), ns: '—' })[pk] || pk;
          var name = b.label || b.code || 'Batch';
          out.push({ batch: b, sold: r.sold, qty: qty, left: left, days: days, status: status, pace: pk,
            line: name + ' — ' + t('sold', 'terjual') + ' ' + r.sold + (qty ? ' / ' + qty : '') + (due ? ' · ' + t('due', 'tamat') + ' ' + due : '') + ' · ' + status + (days != null ? ' · ' + (days >= 0 ? days + ' ' + t('days left', 'hari lagi') : t('overdue', 'lewat')) : '') });
        });
      } catch (e) { return []; }
      return out;
    }

    function bind(body, accts) {
      function read() {
        S._day = (document.getElementById('ffm-day') || {}).value || S._day;
        S._flt = {
          status: (document.getElementById('ffm-day-st') || {}).value || '',
          account: (document.getElementById('ffm-day-acct') || {}).value || '',
          courier: (document.getElementById('ffm-day-courier') || {}).value || '',
          waybill: (document.getElementById('ffm-day-wb') || {}).value || '',
          open: (document.getElementById('ffm-day-open') && document.getElementById('ffm-day-open').checked) ? '1' : '0'
        };
        S.render(body, accts);
      }
      ['ffm-day', 'ffm-day-st', 'ffm-day-acct', 'ffm-day-courier', 'ffm-day-wb', 'ffm-day-open'].forEach(function (id) {
        var el = document.getElementById(id); if (el) el.onchange = read;
      });
      var pull = document.getElementById('ffm-day-pull');
      if (pull) pull.onclick = async function () {
        F.busy(pull, true, t('Refreshing…', 'Memuat semula…'));
        try {
          var r = await F.api('import_orders', {});
          var n = (r.results || []).reduce(function (s, x) { return s + Number((x && x.upserted) || 0); }, 0);
          showToast(t('Updated ' + n + ' order(s) from FFM', 'Dikemas kini ' + n + ' pesanan dari FFM'), 'success');
          S.render(body, accts);
        } catch (e) { F.busy(pull, false); F.err(e); }
      };
      var sh = document.getElementById('ffm-day-share');
      if (sh) sh.onclick = function () { share(); };
    }

    function share() {
      var d = S._last; if (!d) return;
      var bm = APP.language === 'bm';
      var txt = report(d, bm);
      var url = 'https://wa.me/?text=' + encodeURIComponent(txt);
      window.open(url, '_blank', 'noopener');
    }
    function report(d, bm) {
      var day = d.day, rows = d.rows || [], L = function (en, b) { return bm ? b : en; };
      var n = rows.length, wb = 0, can = 0, ex = 0, pend = 0;
      rows.forEach(function (s) {
        if (String(s.pno || '').trim()) wb++;
        if (s.status === 'cancelled') can++;
        if (s.status === 'exception') ex++;
        if (window.FFMS && FFMS.isPendingReview(s)) pend++;
      });
      var co = (APP.tenant && APP.tenant.name) || 'Company';
      var lines = [
        '*' + L('FFM daily', 'FFM harian') + ' — ' + day + ' — ' + co + '*',
        '',
        L('Orders', 'Pesanan') + ': ' + n,
        L('With waybill', 'Ada waybill') + ': ' + wb,
        L('Cancelled', 'Dibatalkan') + ': ' + can,
        L('Exception', 'Masalah') + ': ' + ex,
        L('Pending review', 'Menunggu semakan') + ': ' + pend,
        ''
      ];
      lines.push('*' + L('FFM stock (physical / locked / available)', 'Stok FFM (fizikal / dikunci / tersedia)') + '*');
      (d.stock || []).forEach(function (s) {
        var tot = Number(s.total_qty || 0), av = Number(s.available_qty || 0), lock = Math.max(0, tot - av);
        lines.push(s.barcode + ': ' + tot + ' / ' + lock + ' / ' + av);
      });
      if ((d.pace || []).length) {
        lines.push('');
        lines.push('*' + L('Batch repayment progress', 'Kemajuan bayaran balik batch') + '*');
        d.pace.forEach(function (p) { lines.push(p.line); });
      }
      var withWb = rows.filter(function (s) { return String(s.pno || '').trim(); }).slice(0, 40);
      if (withWb.length) {
        lines.push('');
        lines.push('*' + L('Waybills', 'Waybill') + '*');
        withWb.forEach(function (s) {
          lines.push((s.order_sn || s.ffm_order_id || '') + ' · ' + s.pno + (s.courier ? ' · ' + s.courier : '') + ' · ' + F.stLabel(s.status));
        });
      }
      return lines.join('\n');
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
