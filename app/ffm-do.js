/* M-Core — FFM on DO detail: Send via FFM (account picker), tracking, label, cancel-before-pack, WhatsApp tracking, fee → journal. */
(function () {
  'use strict';
  function boot() {
    if (!(window.FFM && typeof window.renderDODetail === 'function')) { setTimeout(boot, 200); return; }
    if (window.renderDODetail.__ffm) return;
    var F = window.FFM, t = F.t, esc = F.esc, orig = window.renderDODetail;
    var wrapped = async function (id) {
      var r = await orig.apply(this, arguments);
      try { await mount(id); } catch (e) { console.warn('[ffm-do]', e); }
      return r;
    };
    wrapped.__ffm = true;
    window.renderDODetail = wrapped;

    var lastTrack = {};

    async function mount(doId) {
      if (typeof canAccess === 'function' && !canAccess('logistics')) return;
      var sel = document.getElementById('do-status-select'); if (!sel) return;
      var first = sel.closest('.card'); if (!first || document.getElementById('ffm-do-card')) return;
      var card = document.createElement('div');
      card.id = 'ffm-do-card'; card.className = 'card ffm-root'; card.style.cssText = 'max-width:700px;margin-top:16px;padding:20px';
      card.innerHTML = '<span class="ffm-spin"></span> ' + esc(t('Loading FFM…', 'Memuatkan FFM…'));
      first.parentNode.insertBefore(card, first.nextSibling);
      await paint(card, doId);
    }

    async function paint(card, doId) {
      var rs = await Promise.all([
        sb.from('delivery_orders').select('*').eq('id', doId).eq('tenant_id', F.tid()).maybeSingle(),
        sb.from('ffm_shipments').select('*').eq('delivery_order_id', doId).eq('tenant_id', F.tid()).is('deleted_at', null).order('created_at', { ascending: false }),
        F.loadAccounts().catch(function () { return []; })
      ]);
      var dor = rs[0].data, ships = rs[1].data || [], accts = rs[2].filter(function (a) { return a.is_active && a.has_api_key; });
      if (!document.body.contains(card) || !dor) return;
      var live = ships.find(function (s) { return ['failed', 'cancelled'].indexOf(s.status) < 0; }), prev = ships.filter(function (s) { return s !== live; });
      var title = '<div class="ffm-actions" style="justify-content:space-between;margin-bottom:12px"><strong><i class="ti ti-building-warehouse"></i> Flash Fulfillment</strong>' + (live ? F.badge(live.status) : '') + '</div>';
      var html = title;
      if (!live) {
        var closed = ['delivered', 'cancelled'].indexOf(String(dor.status)) >= 0;
        if (!accts.length) html += '<div class="ffm-muted">' + esc(t('No active FFM account. Connect one in Logistics → Flash Fulfillment.', 'Tiada akaun FFM aktif. Sambung di Logistik → Flash Fulfillment.')) + '</div>' +
          '<div class="ffm-actions" style="margin-top:10px"><button type="button" class="btn btn-outline btn-sm" data-x="hub"><i class="ti ti-settings"></i> ' + esc(t('Set up FFM', 'Sediakan FFM')) + '</button></div>';
        else if (!dor.invoice_id) html += '<div class="ffm-muted">' + esc(t('Link this DO to an invoice first — FFM goods come from invoice items.', 'Pautkan DO ini ke invois dahulu — barang FFM diambil dari item invois.')) + '</div>';
        else if (closed) html += '<div class="ffm-muted">' + esc(t('This DO is closed.', 'DO ini sudah ditutup.')) + '</div>';
        else html += '<div class="ffm-muted" style="margin-bottom:10px">' + esc(t('Let the FFM warehouse pick, pack and ship this order.', 'Biar gudang FFM pilih, bungkus dan hantar pesanan ini.')) + '</div>' +
          '<div class="ffm-actions"><button type="button" class="btn btn-primary btn-sm" data-x="send"><i class="ti ti-send"></i> ' + esc(t('Send via FFM', 'Hantar melalui FFM')) + '</button></div>';
      } else {
        var acct = rs[2].find(function (a) { return F.same(a.id, live.account_id); }) || {}, pno = live.pno || live.recent_pno || '';
        html += '<div class="ffm-grid" style="margin-bottom:12px">' + kv(t('Account', 'Akaun'), acct.label || '-') + kv(t('FFM order', 'Pesanan FFM'), live.ffm_order_id || live.order_sn) +
          kv(t('Tracking no.', 'No. jejak'), pno || t('Pending', 'Menunggu')) + kv(t('Latest', 'Terkini'), (live.state_text || F.stLabel(live.status)) + ' · ' + F.dt(live.updated_at)) +
          (live.fee_amount != null ? kv(t('FFM fee', 'Yuran FFM'), F.rm(live.fee_amount)) : '') + '</div>' +
          (live.last_error ? '<div class="ffm-err" style="margin-bottom:10px">' + esc(live.last_error) + '</div>' : '') +
          '<div class="ffm-actions">' +
          '<button type="button" class="btn btn-outline btn-sm" data-x="track"><i class="ti ti-refresh"></i> ' + esc(t('Refresh tracking', 'Muat semula jejak')) + '</button>' +
          '<button type="button" class="btn btn-outline btn-sm" data-x="label"><i class="ti ti-printer"></i> ' + esc(t('Label', 'Label')) + '</button>' +
          (pno ? '<button type="button" class="btn btn-outline btn-sm db-btn wad-btn" data-x="wa"><i class="ti ti-brand-whatsapp"></i> ' + esc(t('WhatsApp tracking', 'Jejak via WhatsApp')) + '</button>' : '') +
          (F.CANCELLABLE.indexOf(live.status) >= 0 ? '<button type="button" class="btn btn-outline btn-sm" data-x="cancel" style="color:var(--danger)"><i class="ti ti-x"></i> ' + esc(t('Cancel FFM order', 'Batal pesanan FFM')) + '</button>' : '') +
          '</div><div id="ffm-track-out" style="margin-top:12px"></div>' + feeBlock(live);
      }
      var reversals = prev.filter(function (s) { return s.status === 'cancelled' && s.fee_amount != null; });
      if (prev.length) html += '<div class="ffm-sec" style="margin-top:14px">' + esc(t('Earlier attempts', 'Cubaan terdahulu')) + '</div><ul class="ffm-steps">' + prev.map(function (s) {
        return '<li>' + F.badge(s.status) + ' <span class="ffm-muted">' + esc(s.order_sn + ' · ' + F.dt(s.created_at)) + '</span>' + (s.last_error ? '<div class="ffm-err">' + esc(s.last_error) + '</div>' : '') + '</li>';
      }).join('') + '</ul>';
      card.innerHTML = html;
      card.querySelectorAll('[data-x]').forEach(function (b) {
        b.onclick = function () {
          var x = b.getAttribute('data-x');
          if (x === 'hub') return openPage('logistics', { view: 'ffm' });
          if (x === 'send') return sendModal(card, dor, accts);
          if (x === 'track') return track(card, dor, live, b);
          if (x === 'label') return getLabel(live, b);
          if (x === 'wa') return waTrack(dor, live, acct);
          if (x === 'cancel') return cancel(card, dor, live);
          if (x === 'fee') return getFee(card, dor, live, acct, b);
          if (x === 'post') return postFee(card, dor, live, b);
        };
      });
      if (live) checkJournal(live);
      reversals.forEach(function (s) { reverseIfNeeded(s, dor, true); });
    }
    function kv(k, v) { return '<div><div class="ffm-k">' + esc(k) + '</div><div class="ffm-v">' + esc(v) + '</div></div>'; }
    function refresh(card, dor) { return paint(card, dor.id); }

    /* ---- Send ---- */
    async function sendModal(card, dor, accts) {
      var cu = {};
      if (dor.customer_id) { var r = await sb.from('customers').select('*').eq('id', dor.customer_id).eq('tenant_id', F.tid()).maybeSingle(); cu = r.data || {}; }
      var addr = [cu.address_line1, cu.address_line2].filter(Boolean).join(', ') || dor.delivery_address || '';
      var def = accts.find(function (a) { return !a.is_funded; }) || accts[0];
      var opt = function (v, l, s) { return '<option value="' + esc(v) + '"' + (s ? ' selected' : '') + '>' + esc(l) + '</option>'; };
      var html = '<div class="form-group"><label class="form-label" for="fs-acct">' + esc(t('Ship from FFM account', 'Hantar dari akaun FFM')) + '</label><select id="fs-acct" class="form-select">' +
        accts.map(function (a) { return opt(a.id, a.label + (a.is_funded ? ' · ' + t('Funded stock', 'Stok dibiayai') : ''), a === def); }).join('') + '</select></div>' +
        '<div class="ffm-sec">' + esc(t('Recipient', 'Penerima')) + '</div>' +
        f('fs-name', t('Name', 'Nama'), cu.name || '') + f('fs-phone', t('Phone', 'Telefon'), cu.phone || '', 'inputmode="tel"') +
        f('fs-addr', t('Address', 'Alamat'), addr) +
        '<div class="ffm-row">' + f('fs-city', t('City', 'Bandar'), cu.city || '') + f('fs-pc', t('Postcode', 'Poskod'), cu.postcode || '', 'inputmode="numeric" maxlength="5"') + '</div>' +
        '<div class="form-group"><label class="form-label" for="fs-state">' + esc(t('State', 'Negeri')) + '</label><select id="fs-state" class="form-select">' + opt('', '—', false) +
        F.MY_STATES.map(function (s) { return opt(s, s, String(cu.state || '').replace(/^W\.?P\.?\s*/i, '').toLowerCase() === s.toLowerCase()); }).join('') + '</select></div>' +
        '<div class="form-group"><label class="form-label" for="fs-pay">' + esc(t('Payment', 'Bayaran')) + '</label><select id="fs-pay" class="form-select">' +
        opt('2', t('Prepaid / bank transfer', 'Prabayar / pindahan bank'), true) + opt('3', t('E-payment', 'E-bayaran'), false) + opt('1', t('COD (collect on delivery)', 'COD (bayar semasa terima)'), false) + '</select></div>' +
        '<div class="ffm-muted">' + esc(t('Goods are taken from the linked invoice. Products must be synced to this FFM account.', 'Barang diambil dari invois berkaitan. Produk mesti disegerak ke akaun FFM ini.')) + '</div>';
      var ov = F.modal(t('Send via FFM', 'Hantar melalui FFM'), html, t('Send to FFM', 'Hantar ke FFM'), async function (ov, btn) {
        var v = function (id) { return ov.querySelector('#' + id).value.trim(); };
        var acct = accts.find(function (a) { return F.same(a.id, v('fs-acct')); }) || {};
        var cons = { name: v('fs-name'), phone: v('fs-phone'), address: v('fs-addr'), city: v('fs-city'), postcode: v('fs-pc'), state: v('fs-state') };
        var bad = localCheck(cons); if (bad.length) return F.modalErr(badMsg(bad));
        F.modalErr(''); F.busy(btn, true, t('Sending…', 'Menghantar…'));
        try {
          var r = await F.api('send_order', { account_id: acct.id, do_id: dor.id, consignee: cons, pay_mode: v('fs-pay') });
          if (r.ok) { F.closeModal(); showToast(t('Sent to FFM', 'Dihantar ke FFM'), 'success'); if (typeof auditLog === 'function') auditLog('create', 'ffm_shipments', r.shipment_id); return refresh(card, dor); }
          F.busy(btn, false);
          if (r.invalid) return F.modalErr(badMsg(r.invalid));
          if (r.problems) return F.modalErr(t('Fix these first:', 'Betulkan ini dahulu:') + '\n• ' + r.problems.join('\n• '));
          F.modalErr(r.error || t('FFM rejected the order', 'FFM menolak pesanan')); refresh(card, dor);
        } catch (e) { F.busy(btn, false); F.modalErr(e.message); }
      }, true);
      var acSel = ov.querySelector('#fs-acct'), paySel = ov.querySelector('#fs-pay');
      var setPay = function () { var a = accts.find(function (x) { return F.same(x.id, acSel.value); }); if (a && a.pay_mode) paySel.value = String(a.pay_mode); };
      acSel.onchange = setPay; setPay();
    }
    function f(id, label, val, extra) { return '<div class="form-group"><label class="form-label" for="' + id + '">' + esc(label) + '</label><input id="' + id + '" class="form-input" value="' + esc(val) + '" ' + (extra || '') + '></div>'; }
    function localCheck(c) {
      var e = [];
      if (!c.name) e.push('name'); if (!c.address) e.push('address'); if (!c.city) e.push('city');
      if (!/^\d{5}$/.test(c.postcode)) e.push('postcode'); if (!c.state) e.push('state');
      var d = c.phone.replace(/\D/g, ''); if (d.length < 8 || d.length > 15) e.push('phone');
      return e;
    }
    function badMsg(keys) {
      var L = { name: t('name', 'nama'), address: t('address', 'alamat'), city: t('city', 'bandar'), postcode: t('5-digit postcode', 'poskod 5 digit'), state: t('state', 'negeri'), phone: t('valid phone', 'telefon sah') };
      return t('Please fill in: ', 'Sila isi: ') + keys.map(function (k) { return L[k] || k; }).join(', ');
    }

    /* ---- Tracking / label / cancel ---- */
    async function track(card, dor, live, btn) {
      F.busy(btn, true, t('Checking…', 'Menyemak…'));
      try {
        var r = await F.api('tracking', { shipment_id: live.id });
        lastTrack[live.id] = r;
        await refresh(card, dor);
        if (r.shipment && r.shipment.status !== live.status) { var sel = document.getElementById('do-status-select'); if (sel) { var d = await sb.from('delivery_orders').select('status').eq('id', dor.id).maybeSingle(); if (d.data) sel.value = d.data.status; } }
        var out = document.getElementById('ffm-track-out'); if (!out) return;
        var steps = (r.steps || []).slice().reverse();
        out.innerHTML = (r.expressCompany ? '<div class="ffm-muted" style="margin-bottom:6px">' + esc(t('Courier: ', 'Kurier: ') + r.expressCompany) + '</div>' : '') +
          (steps.length ? '<ul class="ffm-steps">' + steps.map(function (s) { return '<li><strong>' + esc(s.statusDesc || s.status) + '</strong> <span class="ffm-muted">' + esc(s.operateTime || s.time || s.createTime || '') + '</span></li>'; }).join('') + '</ul>'
            : '<div class="ffm-muted">' + esc(t('No tracking steps yet.', 'Belum ada langkah penjejakan.')) + '</div>');
      } catch (e) { F.busy(btn, false); F.err(e); }
    }
    async function getLabel(live, btn) {
      F.busy(btn, true, t('Fetching…', 'Mengambil…'));
      try { var r = await F.api('label', { shipment_id: live.id }); (r.documents || []).forEach(function (d, i) { F.openDoc(d, 'FFM-' + (d.trackNo || live.order_sn) + (i ? '-' + i : '')); }); }
      catch (e) { F.err(e); } finally { F.busy(btn, false); }
    }
    function cancel(card, dor, live) {
      F.modal(t('Cancel FFM order?', 'Batal pesanan FFM?'), '<p style="margin:0;font-size:14px">' + esc(t('FFM will stop this order. Only possible before packing.', 'FFM akan hentikan pesanan ini. Hanya boleh sebelum dibungkus.')) + '</p>', t('Cancel order', 'Batal pesanan'), async function (ov, b) {
        F.busy(b, true);
        try {
          await F.api('cancel', { shipment_id: live.id });
          F.closeModal(); showToast(t('FFM order cancelled', 'Pesanan FFM dibatalkan'), 'success');
          if (typeof auditLog === 'function') auditLog('update', 'ffm_shipments', live.id);
          var s = await sb.from('ffm_shipments').select('*').eq('id', live.id).maybeSingle();
          if (s.data) await reverseIfNeeded(s.data, dor, false);
          refresh(card, dor);
        } catch (e) { F.busy(b, false); F.modalErr(e.message); }
      });
    }

    /* ---- WhatsApp tracking ---- */
    function waTrack(dor, live, acct) {
      var c = live.consignee || {}, pno = live.pno || live.recent_pno, tr = lastTrack[live.id] || {};
      var ph = window.WAD && WAD.phone ? WAD.phone(c.phone) : (function (x) { return { d: x.charAt(0) === '0' ? '6' + x : x, st: 'ok' }; })(String(c.phone || '').replace(/\D/g, ''));
      var url = acct.tracking_url_template ? String(acct.tracking_url_template).split('{pno}').join(encodeURIComponent(pno)) : '';
      var co = (APP.tenant && (APP.tenant.company_name || APP.tenant.name)) || '';
      var msg = t('Hi ' + (c.name || '') + ', your order ' + (dor.do_no || '') + ' has been shipped' + (tr.expressCompany ? ' via ' + tr.expressCompany : '') + '.\nTracking no: ' + pno + (url ? '\nTrack: ' + url : '') + (co ? '\n\n— ' + co : ''),
        'Hi ' + (c.name || '') + ', pesanan ' + (dor.do_no || '') + ' anda telah dihantar' + (tr.expressCompany ? ' melalui ' + tr.expressCompany : '') + '.\nNo. jejak: ' + pno + (url ? '\nJejak: ' + url : '') + (co ? '\n\n— ' + co : ''));
      var d = ph.st === 'fix' ? ph.sug : ph.d;
      if (!d) { showToast(t('No valid phone for this recipient', 'Tiada telefon sah untuk penerima ini'), 'warning'); return; }
      window.open('https://wa.me/' + d + '?text=' + encodeURIComponent(msg), '_blank', 'noopener');
    }

    /* ---- Fee → Accounting (Dr general_expense / Cr accounts_payable). Idempotent; cancel = reversal entry. ---- */
    function feeBlock(live) {
      if (typeof canAccess === 'function' && !canAccess('accounting')) return '';
      var can = ['shipped', 'delivered', 'returned', 'exception', 'awaiting_pickup', 'packed'].indexOf(live.status) >= 0;
      if (!can && live.fee_amount == null) return '';
      return '<div style="margin-top:14px;border-top:1px solid var(--border);padding-top:12px"><div class="ffm-sec">' + esc(t('FFM fee → Accounting', 'Yuran FFM → Perakaunan')) + '</div>' +
        '<div class="ffm-actions" style="margin-top:8px" id="ffm-fee-row"><button type="button" class="btn btn-outline btn-sm" data-x="fee"><i class="ti ti-receipt"></i> ' + esc(live.fee_amount == null ? t('Get fee', 'Dapatkan yuran') : t('Update fee', 'Kemas kini yuran')) + '</button>' +
        (live.fee_amount != null ? '<button type="button" class="btn btn-primary btn-sm" data-x="post" id="ffm-post-btn" disabled><i class="ti ti-book"></i> ' + esc(t('Post to journal', 'Pos ke jurnal')) + '</button>' : '') +
        '<span class="ffm-muted" id="ffm-jnl-st"></span></div></div>';
    }
    async function checkJournal(live) {
      var b = document.getElementById('ffm-post-btn'), st = document.getElementById('ffm-jnl-st');
      if (!b || typeof _journalAlreadyPosted !== 'function') return;
      var done = await _journalAlreadyPosted('ffm_shipments', live.id);
      if (done) { b.remove(); if (st) st.textContent = t('Posted to journal', 'Sudah dipos ke jurnal'); }
      else b.disabled = !(Number(live.fee_amount) > 0);
    }
    function getFee(card, dor, live, acct, btn) {
      var run = async function (amount, b2) {
        F.busy(b2, true);
        try { var r = await F.api('fee', amount == null ? { shipment_id: live.id } : { shipment_id: live.id, amount: amount }); F.closeModal(); showToast(t('FFM fee: ', 'Yuran FFM: ') + F.rm(r.fee_amount), 'success'); refresh(card, dor); }
        catch (e) { F.busy(b2, false); if (document.getElementById('ffm-modal')) F.modalErr(e.message); else F.err(e); }
      };
      if (acct.fee_source !== 'manual') return run(null, btn);
      F.modal(t('FFM fee', 'Yuran FFM'), f('ff-amt', t('Amount (RM) from FFM invoice', 'Amaun (RM) dari invois FFM'), live.fee_amount != null ? live.fee_amount : '', 'type="number" min="0" step="0.01" inputmode="decimal"'), t('Save', 'Simpan'), function (ov, b) {
        var v = Number(ov.querySelector('#ff-amt').value); if (!(v >= 0)) return F.modalErr(t('Enter a valid amount', 'Masukkan amaun sah')); run(v, b);
      });
    }
    async function postFee(card, dor, live, btn) {
      if (typeof _postJournalEntry !== 'function') return;
      F.busy(btn, true, t('Posting…', 'Mengepos…'));
      try {
        if (await _journalAlreadyPosted('ffm_shipments', live.id)) { showToast(t('Already posted', 'Sudah dipos'), 'info'); return refresh(card, dor); }
        var ex = await _getDefaultAccountId('general_expense'), ap = await _getDefaultAccountId('accounts_payable');
        if (!ex || !ap) { _damToastMissing([ex ? null : 'general_expense', ap ? null : 'accounts_payable'], t('FFM fee', 'Yuran FFM')); F.busy(btn, false); return; }
        var amt = Math.round(Number(live.fee_amount) * 100) / 100;
        var r = await _postJournalEntry({ description: 'FFM fee ' + (live.pno || live.order_sn) + ' (' + (dor.do_no || '') + ')', entryDate: String(live.shipped_at || live.updated_at || '').slice(0, 10) || undefined, entryType: 'auto',
          lines: [{ account_id: ex, debit: amt, credit: 0 }, { account_id: ap, debit: 0, credit: amt }], sourceTable: 'ffm_shipments', sourceId: live.id });
        if (r) showToast(t('Journal posted ', 'Jurnal dipos ') + (r.ref_no || ''), 'success');
        refresh(card, dor);
      } catch (e) { F.busy(btn, false); F.err(e); }
    }
    async function reverseIfNeeded(s, dor, silent) {
      try {
        if (typeof _journalAlreadyPosted !== 'function' || (typeof canAccess === 'function' && !canAccess('accounting'))) return;
        if (!(await _journalAlreadyPosted('ffm_shipments', s.id)) || (await _journalAlreadyPosted('ffm_shipments_reversal', s.id))) return;
        var ex = await _getDefaultAccountId('general_expense'), ap = await _getDefaultAccountId('accounts_payable');
        if (!ex || !ap) { _damToastMissing([ex ? null : 'general_expense', ap ? null : 'accounts_payable'], t('FFM fee reversal', 'Pembalikan yuran FFM')); return; }
        var amt = Math.round(Number(s.fee_amount) * 100) / 100; if (!(amt > 0)) return;
        await _postJournalEntry({ description: 'Reversal: FFM fee ' + (s.pno || s.order_sn) + ' (' + (dor.do_no || '') + ') cancelled', entryType: 'auto',
          lines: [{ account_id: ap, debit: amt, credit: 0 }, { account_id: ex, debit: 0, credit: amt }], sourceTable: 'ffm_shipments_reversal', sourceId: s.id });
        if (!silent) showToast(t('FFM fee journal reversed', 'Jurnal yuran FFM dibalikkan'), 'success');
      } catch (e) { console.warn('[ffm-do] reversal', e); }
    }
  }
  boot();
})();
