/* Booking Inbox docs/actions + WA claim + cash-close. v1 */
(function () {
  var B = window.BKINB, V = window.BKPAYV, P = window.PAYX; if (!B || B.docsHtml) return;
  var t = B._t, esc = B._esc, tid = B._tid, money = B._money, toast = B._toast;
  B.docsHtml = function (d) {
    function row(lab, href, copyTxt) {
      var right = !href && !copyTxt ? '<span class="bkinb-meta">' + esc(t('docNone')) + '</span>' :
        ((href ? '<a class="db-btn" href="' + esc(href) + '" target="_blank" rel="noopener">' + esc(t('open')) + '</a>' : '') +
          (copyTxt ? '<button type="button" class="db-btn" data-bkinb="copy" data-v="' + esc(copyTxt) + '">' + esc(t('copy')) + '</button>' : ''));
      return '<div class="bkinb-doc"><span>' + esc(lab) + '</span><span style="display:flex;gap:6px">' + right + '</span></div>';
    }
    var slip = null, rcpt = null;
    (d.claims || []).forEach(function (c) { if (!slip && c.files && c.files[0] && c.files[0].path) slip = c; if (!rcpt && c.receipt_url) rcpt = c.receipt_url; });
    var pay = d.inv && d.inv.public_token ? (location.origin + '/app/?public_inv=' + encodeURIComponent(d.inv.public_token)) : '';
    var h = row(t('docInv'), null, d.inv ? d.inv.ref_no : '') + row(t('docSlip'), null, slip ? (slip.files[0].name || 'slip') : '') + row(t('docRcpt'), rcpt, null) + row(t('docPay'), pay || null, pay);
    if (slip) h += '<div class="bkinb-meta" data-slip="' + esc(slip.files[0].path) + '"></div>';
    return h;
  };
  B.actHtml = function (d) {
    var pending = /^(hold|pending_payment|payment_failed)$/.test(d.bk.status || '');
    var h = '<p class="bkinb-hint">' + esc(t('actCashHint')) + '</p><div class="bkinb-act">';
    if (pending) {
      h += '<button type="button" class="db-btn" data-bk-act="cash" data-id="' + esc(d.bk.id) + '">' + esc(t('actCash')) + '</button>';
      h += '<button type="button" class="db-btn" data-bk-act="release" data-id="' + esc(d.bk.id) + '">' + esc(t('actRel')) + '</button>';
    }
    h += '<button type="button" class="db-btn" data-bk-act="amend" data-id="' + esc(d.bk.id) + '">' + esc(t('actAmend')) + '</button>';
    h += '<button type="button" class="db-btn" data-bk-act="delete" data-id="' + esc(d.bk.id) + '">' + esc(t('actDel')) + '</button></div>';
    return h;
  };
  function due(inv, svc) {
    if (!inv) return 0;
    var pct = svc && Number(svc.deposit_pct), total = Number(inv.total) || 0, paid = Number(inv.paid_amt) || 0;
    if (pct > 0 && pct < 100) return Math.max(0, Math.round(total * pct) / 100 - paid);
    return Math.max(0, total - paid);
  }
  function waClaim(d) {
    var amt = due(d.inv, d.svc); if (!(amt > 0)) amt = Number(d.inv && d.inv.total) || 0;
    if (!(amt > 0)) return Promise.reject(new Error('amount'));
    return sb.from('payment_claims').insert({
      tenant_id: tid(), invoice_id: d.inv.id, amount: Math.round(amt * 100) / 100,
      note: 'Received via WhatsApp (staff)', files: [], source: 'wa_staff',
      paid_on: new Date().toISOString().slice(0, 10), payer_name: d.bk.customer_name || null
    }).select('id').then(function (r) {
      if (r.error) throw r.error;
      return Promise.resolve(sb.from('bookings').update({ hold_until: null, updated_at: new Date().toISOString() }).eq('id', d.bk.id).eq('tenant_id', tid())).then(function () { return r.data[0].id; }, function () { return r.data[0].id; });
    });
  }
  B.closeClaimsFor = function (bookingId) {
    return B._load(bookingId).then(function (d) {
      if (!d || !d.inv) return;
      return sb.from('payment_claims').update({
        status: 'rejected', reject_reason: 'Confirmed cash / paid outside', source: 'cash_close',
        reviewed_at: new Date().toISOString(), reviewed_by: (P && P.isPA && P.isPA()) ? null : (P && P.uid && P.uid())
      }).eq('tenant_id', tid()).eq('invoice_id', d.inv.id).eq('status', 'pending').is('deleted_at', null);
    });
  };
  B.bindExtra = function (root, d, buildX) {
    root.querySelectorAll('[data-bkinb="copy"]').forEach(function (b) {
      b.onclick = function () {
        var v = b.getAttribute('data-v') || '';
        if (navigator.clipboard) navigator.clipboard.writeText(v).then(function () { toast(APP.language === 'bm' ? 'Disalin' : 'Copied'); });
        else prompt('Copy', v);
      };
    });
    var wa = root.querySelector('[data-bkinb="wa"]');
    if (wa) wa.onclick = function () {
      wa.disabled = true; wa.textContent = t('waBusy');
      waClaim(d).then(function () { toast(t('waRecvOk')); B.mount(root.parentNode, d.bk.id, 'proof'); }, function (e) {
        wa.disabled = false; wa.textContent = t('waRecv'); toast(t('fail', { e: (e && e.message) || e }), 'error');
      });
    };
    root.querySelectorAll('[data-bkinb="ok"]').forEach(function (b) {
      b.onclick = function () {
        var x = buildX(d, b.getAttribute('data-cid')); if (!x || !V) return toast(t('needSql'), 'error');
        b.disabled = true;
        V.verify(x, Number(x.c.amount)).then(function (r) {
          toast(r.part ? t('confBal') : t('confFull')); B.mount(root.parentNode, d.bk.id, 'proof');
          if (typeof window.__bkCardPaint === 'function') window.__bkCardPaint();
        }, function (e) { b.disabled = false; toast(t('fail', { e: (e && e.message) || e }), 'error'); });
      };
    });
    root.querySelectorAll('[data-bkinb="rj"]').forEach(function (b) {
      b.onclick = function () {
        var why = prompt(t('reject')); if (!why || why.length < 3) return;
        var x = buildX(d, b.getAttribute('data-cid')); if (!x || !V) return;
        V.reject(x, why).then(function () { toast(t('rejected')); B.mount(root.parentNode, d.bk.id, 'proof'); }, function (e) { toast(t('fail', { e: (e && e.message) || e }), 'error'); });
      };
    });
    var slip = root.querySelector('[data-slip]');
    if (slip && V && V.url) V.url({ path: slip.getAttribute('data-slip') }).then(function (u) {
      if (u) { var a = document.createElement('a'); a.className = 'db-btn'; a.target = '_blank'; a.rel = 'noopener'; a.href = u; a.textContent = t('open'); slip.appendChild(a); }
    });
  };
})();
