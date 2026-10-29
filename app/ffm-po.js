/* M-Core — FFM inbound (ASN) on PO detail. FFM stock only counts when FFM confirms receipt (status 50). M-Core GRN flow is untouched. */
(function () {
  'use strict';
  function boot() {
    if (!(window.FFM && typeof window.renderPODetail === 'function')) { setTimeout(boot, 200); return; }
    if (window.renderPODetail.__ffm) return;
    var F = window.FFM, t = F.t, esc = F.esc, orig = window.renderPODetail;
    var wrapped = async function (id) {
      var r = await orig.apply(this, arguments);
      try { await mount(id); } catch (e) { console.warn('[ffm-po]', e); }
      return r;
    };
    wrapped.__ffm = true;
    window.renderPODetail = wrapped;

    var AS = { 10: ['Pending FFM approval', 'Menunggu kelulusan FFM', 'yellow'], 20: ['Approved', 'Diluluskan', 'blue'], 30: ['Arrived at warehouse', 'Tiba di gudang', 'blue'], 40: ['Receiving', 'Sedang diterima', 'blue'], 50: ['Received — stock counted', 'Diterima — stok dikira', 'green'] };
    function asBadge(a) { var x = AS[a.status]; return '<span class="badge badge-' + (x ? x[2] : 'gray') + '">' + esc(x ? t(x[0], x[1]) : (a.status_text || t('Draft', 'Draf'))) + '</span>'; }

    async function mount(poId) {
      if (typeof canAccess === 'function' && !(canAccess('purchasing') || canAccess('logistics'))) return;
      if (document.getElementById('ffm-po-card')) return;
      var first = document.querySelector('#main .card.no-print'); if (!first) return;
      var accts = (await F.loadAccounts().catch(function () { return []; })).filter(function (a) { return a.is_active && a.has_api_key; });
      var rs = await sb.from('ffm_asn').select('*').eq('purchase_order_id', poId).eq('tenant_id', F.tid()).is('deleted_at', null).order('created_at', { ascending: false });
      var list = rs.data || [];
      if (!accts.length && !list.length) return;
      if (document.getElementById('ffm-po-card')) return;
      var po = (await sb.from('purchase_orders').select('id,status').eq('id', poId).eq('tenant_id', F.tid()).maybeSingle()).data || {};
      var card = document.createElement('div');
      card.id = 'ffm-po-card'; card.className = 'card no-print ffm-root'; card.style.cssText = 'max-width:900px;margin-top:16px;padding:20px';
      first.parentNode.insertBefore(card, first.nextSibling);
      paint(card, poId, po, accts, list);
    }

    function paint(card, poId, po, accts, list) {
      var canCreate = accts.length && po.status !== 'cancelled' && po.status !== 'draft';
      var names = {}; accts.forEach(function (a) { names[String(a.id)] = a.label; });
      card.innerHTML = '<div class="ffm-actions" style="justify-content:space-between;margin-bottom:12px"><strong><i class="ti ti-truck-loading"></i> ' + esc(t('FFM inbound (ASN)', 'Penerimaan FFM (ASN)')) + '</strong>' +
        (canCreate ? '<button type="button" class="btn btn-primary btn-sm" data-x="new"><i class="ti ti-plus"></i> ' + esc(t('Send arrival notice', 'Hantar notis ketibaan')) + '</button>' : '') + '</div>' +
        (po.status === 'draft' && accts.length ? '<div class="ffm-muted" style="margin-bottom:8px">' + esc(t('Mark the PO as Sent before notifying FFM.', 'Tandakan PO sebagai Dihantar sebelum maklum FFM.')) + '</div>' : '') +
        (list.length ? '<div class="ffm-tbl"><table><thead><tr><th>' + esc(t('Account', 'Akaun')) + '</th><th>' + esc(t('FFM ref', 'Ruj. FFM')) + '</th><th>' + esc(t('Status', 'Status')) + '</th><th>' + esc(t('Received', 'Diterima')) + '</th><th></th></tr></thead><tbody>' +
          list.map(function (a) {
            var rec = (a.received_goods || []).map(function (g) { return esc((g.barCode || g.barcode || '') + ' × ' + (g.inNum != null ? g.inNum : g.num)); }).join('<br>');
            return '<tr><td>' + esc(names[String(a.account_id)] || '-') + '</td><td>' + esc(a.ffm_order_id || a.order_sn) + '<div class="ffm-muted">' + esc(F.dt(a.created_at)) + '</div></td><td>' + asBadge(a) +
              (a.last_error ? '<div class="ffm-err">' + esc(a.last_error) + '</div>' : '') + '</td><td>' + (rec || '<span class="ffm-muted">-</span>') + (a.received_at ? '<div class="ffm-muted">' + esc(F.dt(a.received_at)) + '</div>' : '') + '</td>' +
              '<td>' + (Number(a.status) !== 50 ? '<button type="button" class="btn btn-outline btn-sm" data-r="' + esc(a.id) + '"><i class="ti ti-refresh"></i> ' + esc(t('Refresh', 'Muat semula')) + '</button>' : '') + '</td></tr>';
          }).join('') + '</tbody></table></div>'
          : '<div class="ffm-muted">' + esc(t('Shipping this PO straight to the FFM warehouse? Send an arrival notice so FFM can receive it.', 'Hantar PO ini terus ke gudang FFM? Hantar notis ketibaan supaya FFM boleh terima.')) + '</div>') +
        '<p class="ffm-muted" style="margin:10px 0 0">' + esc(t('FFM stock updates only after FFM confirms receipt. Receive Goods (GRN) in M-Core stays separate.', 'Stok FFM dikemas kini hanya selepas FFM sahkan terima. Terima Barang (GRN) M-Core kekal berasingan.')) + '</p>';
      var reload = async function () { var r = await sb.from('ffm_asn').select('*').eq('purchase_order_id', poId).eq('tenant_id', F.tid()).is('deleted_at', null).order('created_at', { ascending: false }); paint(card, poId, po, accts, r.data || []); };
      var nb = card.querySelector('[data-x="new"]'); if (nb) nb.onclick = function () { newAsn(poId, accts, reload); };
      card.querySelectorAll('[data-r]').forEach(function (b) {
        b.onclick = async function () {
          F.busy(b, true, t('Checking…', 'Menyemak…'));
          try { await F.api('refresh_asn', { asn_id: b.getAttribute('data-r') }); await reload(); } catch (e) { F.busy(b, false); F.err(e); }
        };
      });
    }

    function newAsn(poId, accts, reload) {
      var today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' });
      var html = '<div class="form-group"><label class="form-label" for="fa-acct">' + esc(t('FFM account (warehouse)', 'Akaun FFM (gudang)')) + '</label><select id="fa-acct" class="form-select">' +
        accts.map(function (a) { return '<option value="' + esc(a.id) + '">' + esc(a.label + (a.is_funded ? ' · ' + t('Funded stock', 'Stok dibiayai') : '')) + '</option>'; }).join('') + '</select></div>' +
        '<div class="ffm-row"><div class="form-group"><label class="form-label" for="fa-s">' + esc(t('Arrival from', 'Tiba dari')) + '</label><input id="fa-s" type="date" class="form-input" value="' + today + '" min="' + today + '"></div>' +
        '<div class="form-group"><label class="form-label" for="fa-e">' + esc(t('Arrival until', 'Tiba hingga')) + '</label><input id="fa-e" type="date" class="form-input" min="' + today + '"></div></div>' +
        '<div class="ffm-muted">' + esc(t('All PO items are sent. Each product needs a barcode and must be synced to this account.', 'Semua item PO dihantar. Setiap produk perlu barkod dan disegerak ke akaun ini.')) + '</div>';
      F.modal(t('Send arrival notice to FFM', 'Hantar notis ketibaan ke FFM'), html, t('Send', 'Hantar'), async function (ov, btn) {
        var s = ov.querySelector('#fa-s').value, e = ov.querySelector('#fa-e').value;
        if (s && e && e < s) return F.modalErr(t('End date is before start date.', 'Tarikh akhir sebelum tarikh mula.'));
        F.modalErr(''); F.busy(btn, true, t('Sending…', 'Menghantar…'));
        try {
          var r = await F.api('create_asn', { account_id: ov.querySelector('#fa-acct').value, po_id: poId, arrival_start: s ? s + ' 09:00' : null, arrival_end: e ? e + ' 18:00' : null });
          if (r.ok) { F.closeModal(); showToast(t('Arrival notice sent to FFM', 'Notis ketibaan dihantar ke FFM'), 'success'); if (typeof auditLog === 'function') auditLog('create', 'ffm_asn', r.asn_id); return reload(); }
          F.busy(btn, false);
          F.modalErr(r.problems ? t('Fix these first:', 'Betulkan ini dahulu:') + '\n• ' + r.problems.join('\n• ') : (r.error || t('FFM rejected the notice', 'FFM menolak notis')));
        } catch (err) { F.busy(btn, false); F.modalErr(err.message); }
      }, true);
    }
  }
  boot();
})();
