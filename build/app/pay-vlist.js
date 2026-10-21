/* M-Core payment attachments - Phase 2: "Voided payments (n)" under Payment History (invoice + supplier bill), reason / date / proof files (read-only). Needs pay_attach_02.sql. v1 */
(function () {
  var P = window.PAYX, V = window.PAYV; if (!P || !V || V.list) return;
  var E = P.esc, t = P.t;
  P.add({ en: { vTi: 'Void payment', vD: 'The amount goes back to the balance. The payment is kept in the void archive with your reason, and a reversal journal is posted today.', vR: 'Reason', vRph: 'e.g. Cheque bounced / wrong amount',
      vGo: 'Confirm', vNo: 'Cancel', vNeed: 'Please write a reason (at least 3 characters).', vLock: 'Books are locked through {d}. Only the owner can void this payment.', vOk: 'Payment voided. Reversal journal posted.', vOk2: 'Payment voided.',
      vList: 'Voided payments ({n})', vAt: 'Voided {d}', vWhy: 'Reason: {r}', vNone: 'No voided payments.', vArch: 'Could not archive the payment, nothing was changed: ' },
    bm: { vTi: 'Batal bayaran', vD: 'Jumlah kembali ke baki. Bayaran disimpan dalam arkib batal bersama sebab anda, dan jurnal pembalikan direkod hari ini.', vR: 'Sebab', vRph: 'cth. Cek tak laku / jumlah salah',
      vGo: 'Sahkan', vNo: 'Batal', vNeed: 'Sila tulis sebab (sekurang-kurangnya 3 aksara).', vLock: 'Buku dikunci sehingga {d}. Hanya pemilik boleh membatalkan bayaran ini.', vOk: 'Bayaran dibatalkan. Jurnal pembalikan direkod.', vOk2: 'Bayaran dibatalkan.',
      vList: 'Bayaran dibatalkan ({n})', vAt: 'Dibatalkan {d}', vWhy: 'Sebab: {r}', vNone: 'Tiada bayaran dibatalkan.', vArch: 'Gagal mengarkib bayaran, tiada apa-apa diubah: ' } });
  function card(kind) {
    var h = kind === 'bill' ? ['Payment History', 'Sejarah Bayaran'] : ['Payment History', 'Sejarah Bayaran'];
    return [].slice.call(document.querySelectorAll('#main .card')).find(function (c) { var f = c.firstElementChild; return f && h.indexOf(f.textContent.trim()) >= 0; });
  }
  V.list = function (kind, rows) {
    var old = document.getElementById('payx-sheet'); if (old) old.remove();
    var bg = document.createElement('div'); bg.className = 'payx-bg'; bg.id = 'payx-sheet';
    bg.innerHTML = '<div class="payx-sh" role="dialog" aria-modal="true" aria-labelledby="payv-lt"><div class="payx-grab"></div><div class="payx-hd"><div class="payx-ti" id="payv-lt">' + E(t('vList', { n: rows.length })) + '</div>' +
      '<button type="button" class="btn btn-outline btn-sm" data-x>' + E(t('close')) + '</button></div><div data-l style="margin-top:10px"></div></div>';
    document.body.appendChild(bg);
    var close = function () { bg.remove(); }; bg.onclick = function (e) { if (e.target === bg) close(); }; bg.querySelector('[data-x]').onclick = close;
    var L = bg.querySelector('[data-l]');
    if (!rows.length) { L.innerHTML = '<div class="payx-msg">' + E(t('vNone')) + '</div>'; return; }
    P.list(kind, rows.map(function (r) { return r.payment_id; })).then(function (att) {
      L.innerHTML = rows.map(function (r, i) {
        var n = (att[r.payment_id] || []).length;
        return '<div class="payx-row" style="align-items:flex-start"><i class="ti ti-ban"></i><div class="payx-nm"><b>' + E([r.ref_no, P.money(r.amount)].filter(Boolean).join(' · ')) + '</b>' +
          '<small>' + E((r.payment_date ? P.date(r.payment_date) + ' · ' : '') + t('vAt', { d: P.date(r.voided_at || r.created_at) })) + '</small><small style="white-space:normal;overflow-wrap:anywhere">' + E(t('vWhy', { r: r.reason })) + '</small></div>' +
          (n ? '<button type="button" class="btn btn-outline btn-sm payx-clip payx-has" data-f="' + i + '" aria-label="' + E(t('files')) + '"><i class="ti ti-paperclip"></i><span>' + n + '</span></button>' : '') + '</div>';
      }).join('');
      L.querySelectorAll('[data-f]').forEach(function (b) { b.onclick = function () { var r = rows[+b.dataset.f]; P.sheet(kind, { pay: r.payment_id, doc: r.invoice_id || r.bill_id, ro: true, p: { ref_no: r.ref_no, amount: r.amount, payment_date: r.payment_date } }); }; });
    });
  };
  function scan() {
    var kind = document.getElementById('bill-pay-date') || document.querySelector('#main [onclick^="_billPayVoid("]') ? 'bill' : 'inv';
    var c = card(kind); if (!c || c.dataset.payv) return;
    var doc = P.docId && P.docId(kind); if (!doc) return;
    c.dataset.payv = '1'; V.probe();
    P.has('payment_voids').then(function (ok) {
      if (!ok || !P.can(kind)) return;
      return sb.from('payment_voids').select('id,payment_id,invoice_id,bill_id,ref_no,payment_date,amount,reason,voided_at,created_at').eq('tenant_id', P.tid()).eq(kind === 'bill' ? 'bill_id' : 'invoice_id', doc).is('deleted_at', null).order('voided_at', { ascending: false }).then(function (r) {
        var rows = (r && r.data) || []; if (!rows.length || !c.isConnected) return;
        var d = document.createElement('div'); d.className = 'no-print'; d.style.cssText = 'padding:10px 16px;border-top:1px solid var(--border)';
        d.innerHTML = '<button type="button" class="btn btn-outline btn-sm" style="min-height:36px"><i class="ti ti-archive"></i> ' + E(t('vList', { n: rows.length })) + '</button>';
        d.querySelector('button').onclick = function () { V.list(kind, rows); }; c.appendChild(d);
      });
    }).catch(function () {});
  }
  var tm = 0;
  new MutationObserver(function () { if (!tm) tm = setTimeout(function () { tm = 0; scan(); }, 150); }).observe(document.body, { childList: true, subtree: true });
})();
