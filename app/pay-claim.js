/* M-Core payment attachments - Phase 3, staff side: customer payment slips (payment_claims) on the invoice - review card, Approve (opens Record Payment
   prefilled; on Save the slip files move to the new payment), Reject (reason), bell for owners / admins; AI "Read slip" on Record Payment. Needs pay_attach_03.sql. v1 */
(function () {
  var P = window.PAYX; if (!P || P.claims) return;
  var E = P.esc, t = P.t, C = P.claims = { cur: null };
  P.add({ en: { cTi: 'Customer sent a payment slip', cFrom: 'via public invoice link · {d}', cAmt: 'Amount', cDate: 'Paid on', cRef: 'Bank ref.', cBy: 'Name', cNote: 'Note', cOk: 'Approve', cNo: 'Reject', cFiles: 'Slip files ({n})',
      cFill: 'Record Payment is filled in from the slip. Check it, then Save. The slip files will be attached to the payment.', cWill: '{n} customer file(s) will be attached on Save', cDone: 'Slip approved and attached to the payment.',
      cRej: 'Reject slip', cRejD: 'The customer is not told automatically. Write why, for your team.', cRejOk: 'Slip rejected.', cPaid: 'This invoice is already fully paid.', cBell: 'Payment slip for {r}', cBellB: '{c} sent a payment slip of {a}.',
      aiBtn: 'Read slip with AI', aiWait: 'Reading slip…', aiOk: 'Filled from slip: please check.', aiNone: 'Add a photo of the slip first (JPG / PNG).', aiErr: 'Could not read the slip: ' },
    bm: { cTi: 'Pelanggan menghantar slip bayaran', cFrom: 'melalui link awam invois · {d}', cAmt: 'Jumlah', cDate: 'Dibayar pada', cRef: 'Ruj. bank', cBy: 'Nama', cNote: 'Nota', cOk: 'Luluskan', cNo: 'Tolak', cFiles: 'Fail slip ({n})',
      cFill: 'Rekod Bayaran telah diisi daripada slip. Semak, kemudian Simpan. Fail slip akan dilampirkan pada bayaran.', cWill: '{n} fail pelanggan akan dilampirkan semasa Simpan', cDone: 'Slip diluluskan dan dilampirkan pada bayaran.',
      cRej: 'Tolak slip', cRejD: 'Pelanggan tidak dimaklumkan secara automatik. Tulis sebab untuk pasukan anda.', cRejOk: 'Slip ditolak.', cPaid: 'Invois ini sudah dibayar penuh.', cBell: 'Slip bayaran untuk {r}', cBellB: '{c} menghantar slip bayaran {a}.',
      aiBtn: 'Baca slip dengan AI', aiWait: 'Membaca slip…', aiOk: 'Diisi daripada slip: sila semak.', aiNone: 'Tambah gambar slip dahulu (JPG / PNG).', aiErr: 'Gagal membaca slip: ' } });
  function on() { return P.has('payment_claims'); }
  function set(id, v) { var e = document.getElementById(id); if (e && v != null && v !== '') { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); } }
  function files(c) { return Array.isArray(c.files) ? c.files : []; }
  function view(c) { /* read-only list of the slip files (signed URLs, 5 min) */
    P.sheet('claim', { pay: c.id, doc: c.invoice_id, ro: true, rows: files(c).map(function (f, i) { return { id: c.id + '-' + i, storage_path: f.path, file_name: f.name, mime_type: f.mime, size_bytes: f.size, source: 'customer' }; }), p: { ref_no: t('cTi'), amount: c.amount, payment_date: c.paid_on } });
  }
  function ask(sub) {
    return new Promise(function (res) {
      var bg = document.createElement('div'); bg.className = 'payx-bg';
      bg.innerHTML = '<div class="payx-sh" role="dialog" aria-modal="true"><div class="payx-grab"></div><div class="payx-ti">' + E(t('cRej')) + '</div><div class="payx-sub">' + E(sub) + '</div><p style="font-size:13.5px;color:var(--text-2);margin:0 0 12px">' + E(t('cRejD')) + '</p>' +
        '<textarea class="form-input" rows="3" maxlength="500" data-no-titlecase="1" style="width:100%;box-sizing:border-box" aria-label="' + E(t('cRej')) + '"></textarea><div class="auth-error" data-e style="display:none;margin-top:8px">' + E(t('vNeed')) + '</div>' +
        '<div style="display:flex;gap:10px;margin-top:14px"><button type="button" class="btn btn-outline" data-n style="flex:1;min-height:44px">' + E(t('vNo')) + '</button><button type="button" class="btn btn-primary" data-y style="flex:1;min-height:44px">' + E(t('cNo')) + '</button></div></div>';
      document.body.appendChild(bg);
      var ta = bg.querySelector('textarea'), done = function (v) { bg.remove(); res(v); };
      bg.querySelector('[data-n]').onclick = function () { done(null); }; bg.onclick = function (e) { if (e.target === bg) done(null); };
      bg.querySelector('[data-y]').onclick = function () { var v = ta.value.trim(); if (v.length < 3) { bg.querySelector('[data-e]').style.display = 'block'; return; } done(v.slice(0, 500)); };
      setTimeout(function () { ta.focus(); }, 30);
    });
  }
  function review(c) { return { reviewed_by: P.isPA() ? null : P.uid(), reviewed_at: new Date().toISOString() }; }
  function approve(c) {
    var sec = document.getElementById('inv-pay-section'); if (!sec || !document.getElementById('pay-amount')) return P.toast(t('cPaid'), 'warning');
    var amt = document.getElementById('pay-amount'), bal = Number(amt.value || 0);
    set('pay-amount', Math.min(Number(c.amount), bal > 0 ? bal : Number(c.amount)).toFixed(2)); set('pay-date', c.paid_on);
    var m = document.getElementById('pay-method'); if (m && m.querySelector('option[value="bank_transfer"]')) { m.value = 'bank_transfer'; m.dispatchEvent(new Event('change')); }
    set('payx-inv-ref', c.bank_ref); set('payx-inv-notes', [c.payer_name, c.note].filter(Boolean).join(' · ').slice(0, 500));
    C.cur = c; var w = sec.querySelector('.payx-claimnote'); if (!w) { w = document.createElement('div'); w.className = 'payx-claimnote payx-hint'; w.setAttribute('role', 'status'); var a = sec.querySelector('.payx-att'); (a || sec).appendChild(w); }
    w.textContent = t('cWill', { n: files(c).length });
    sec.scrollIntoView({ behavior: 'smooth', block: 'start' }); P.toast(t('cFill'));
  }
  P.afters.push(function (kind, payId, docId) {
    var c = C.cur; if (kind !== 'inv' || !c || String(c.invoice_id) !== String(docId)) return; C.cur = null;
    var rows = files(c).map(function (f) { return { tenant_id: P.tid(), entity_type: 'payment', entity_id: payId, invoice_id: docId, storage_path: f.path, file_name: String(f.name || 'slip').slice(0, 200), mime_type: f.mime || null, size_bytes: f.size || null, sha256: /^[0-9a-f]{64}$/.test(f.sha256 || '') ? f.sha256 : null, source: 'customer', uploaded_by: P.isPA() ? null : P.uid() }; });
    return (rows.length ? sb.from('doc_attachments').insert(rows) : Promise.resolve({})).then(function (r) {
      if (r.error) throw r.error;
      return sb.from('payment_claims').update(Object.assign({ status: 'approved', payment_id: payId }, review(c))).eq('id', c.id).eq('tenant_id', P.tid());
    }).then(function () { P.audit('update', 'payment_claims', c.id); P.toast(t('cDone')); }, function (e) { P.toast(t('err') + ((e && e.message) || e), 'error'); });
  });
  function reject(c, card) {
    ask(P.money(c.amount) + (c.paid_on ? ' · ' + P.date(c.paid_on) : '')).then(function (why) {
      if (!why) return;
      sb.from('payment_claims').update(Object.assign({ status: 'rejected', reject_reason: why }, review(c))).eq('id', c.id).eq('tenant_id', P.tid()).then(function (r) {
        if (r.error) return P.toast(t('err') + r.error.message, 'error');
        P.audit('update', 'payment_claims', c.id); P.toast(t('cRejOk')); card.remove();
      });
    });
  }
  function card(list, anchor) {
    var d = document.createElement('div'); d.className = 'card no-print payx-claims'; d.style.cssText = 'padding:16px;margin-bottom:16px;border-left:4px solid var(--primary)';
    d.innerHTML = list.map(function (c, i) {
      var kv = function (k, v) { return v ? '<div><div class="payx-sm" style="color:var(--text-2)">' + E(t(k)) + '</div><div style="font-weight:600;overflow-wrap:anywhere">' + E(v) + '</div></div>' : ''; };
      return '<div data-c="' + i + '"' + (i ? ' style="margin-top:14px;padding-top:14px;border-top:1px solid var(--border)"' : '') + '><div style="font-weight:700;font-size:15px"><i class="ti ti-receipt-2"></i> ' + E(t('cTi')) + '</div>' +
        '<div class="payx-sm" style="color:var(--text-2);margin:2px 0 10px">' + E(t('cFrom', { d: P.date(c.created_at) })) + '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;font-size:14px">' + kv('cAmt', P.money(c.amount)) + kv('cDate', c.paid_on && P.date(c.paid_on)) + kv('cRef', c.bank_ref) + kv('cBy', c.payer_name) + kv('cNote', c.note) + '</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px"><button type="button" class="btn btn-outline btn-sm" data-v style="min-height:40px"><i class="ti ti-paperclip"></i> ' + E(t('cFiles', { n: files(c).length })) + '</button>' +
        (P.viewOnly() ? '' : '<button type="button" class="btn btn-outline btn-sm" data-r style="min-height:40px">' + E(t('cNo')) + '</button><button type="button" class="btn btn-primary btn-sm" data-a style="min-height:40px"><i class="ti ti-check"></i> ' + E(t('cOk')) + '</button>') + '</div></div>';
    }).join('');
    list.forEach(function (c, i) { var w = d.querySelector('[data-c="' + i + '"]');
      w.querySelector('[data-v]').onclick = function () { view(c); };
      if (w.querySelector('[data-a]')) { w.querySelector('[data-a]').onclick = function () { if (window.BKPAYQ && typeof BKPAYQ.open === 'function') BKPAYQ.open(c.id); else approve(c); }; w.querySelector('[data-r]').onclick = function () { reject(c, list.length > 1 ? w : d); }; } });
    anchor.parentNode.insertBefore(d, anchor);
  }
  function scan() {
    var id = P.docId && P.docId('inv'), sec = document.getElementById('inv-pay-section'), anchor = sec || [].slice.call(document.querySelectorAll('#main .card')).find(function (c) { return /Payment History|Sejarah Bayaran/.test((c.firstElementChild || {}).textContent || ''); });
    if (!id || !anchor || anchor.dataset.payc === String(id)) return; anchor.dataset.payc = String(id);
    on().then(function (ok) {
      if (!ok || !P.can('inv')) return;
      return sb.from('payment_claims').select('id,invoice_id,amount,paid_on,bank_ref,payer_name,note,files,created_at').eq('tenant_id', P.tid()).eq('invoice_id', id).eq('status', 'pending').is('deleted_at', null).order('created_at').then(function (r) {
        var l = (r && r.data) || []; if (l.length && anchor.isConnected && !document.querySelector('.payx-claims')) card(l, anchor);
      });
    }).catch(function () {});
  }
  /* bell: the first staff session to see a new slip claims it once (notified_at) and tells owners / admins */
  function poll() {
    if (document.hidden || !P.tid() || P.isPA() || !P.can('inv')) return;
    on().then(function (ok) {
      if (!ok) return;
      sb.from('payment_claims').select('id,invoice_id,amount,payer_name,created_at').eq('tenant_id', P.tid()).is('notified_at', null).is('deleted_at', null).limit(10).then(function (r) {
        (r.data || []).forEach(function (v) {
          /* Booking claims owned by booking-realtime / cron. */
          sb.from('bookings').select('id').eq('tenant_id', P.tid()).eq('invoice_id', v.invoice_id).limit(1).then(function (bk) {
            if (bk.data && bk.data[0]) return;
            sb.from('payment_claims').update({ notified_at: new Date().toISOString() }).eq('id', v.id).is('notified_at', null).select('id').then(function (c) {
              if (!c.data || !c.data.length) return;
              Promise.all([sb.from('invoices').select('ref_no,customer_name').eq('id', v.invoice_id).eq('tenant_id', P.tid()).maybeSingle(), sb.from('user_profiles').select('id,role').eq('tenant_id', P.tid())]).then(function (a) {
                var d = a[0].data || {}, rows = (a[1].data || []).filter(function (u) { return /^(owner|admin)$/i.test(u.role || ''); }).map(function (u) {
                  return { tenant_id: P.tid(), user_id: u.id, actor_id: null, title: t('cBell', { r: d.ref_no || '' }).slice(0, 200), body: t('cBellB', { c: v.payer_name || d.customer_name || '-', a: P.money(v.amount) }),
                    category: 'sales', kind: 'for_you', type: 'sales.payment_slip', priority: 1, link: { page: 'sales', params: { view: 'inv-detail', id: v.invoice_id } }, ref_table: 'invoices', ref_id: String(v.invoice_id) }; });
                if (rows.length) sb.from('notifications').insert(rows).then(function () {}, function () {});
              });
            });
          }, function () {});
        });
      }, function () {});
    });
  }
  setInterval(poll, 60000); setTimeout(poll, 9000);
  var tm = 0; new MutationObserver(function () { if (!tm) tm = setTimeout(function () { tm = 0; scan(); }, 150); }).observe(document.body, { childList: true, subtree: true });
})();
