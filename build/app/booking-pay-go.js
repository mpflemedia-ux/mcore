/* M-Core booking payment flow - a tap on a booking receipt alert (bell, phone push, OS alert) opens "Payments to review" with THAT receipt
   selected. A receipt that was already verified or rejected opens read-only with its status. Reads ref_id of the alert row, no SQL. v1 */
(function () {
  var V = window.BKPAYV, P = window.PAYX, A = window.BKPAYA; if (!V || !P || !A || V.one) return;
  function claimOf(n) { return n && n.ref_table === 'payment_claims' && /^[0-9a-f-]{36}$/i.test(String(n.ref_id || '')) ? String(n.ref_id) : null; }
  function isQ(l) { return l && l.page === 'sales' && l.params && l.params.bkpq; }
  /* bell / push item: keep {page:'sales', params:{bkpq:1}} and add the receipt id */
  function wrapNT() {
    var NT = window.NT; if (!NT || typeof NT.fromRow !== 'function') return false; if (NT.fromRow.__bkgo) return true;
    var fr = NT.fromRow; NT.fromRow = function (n) { var it = fr.apply(this, arguments), c = claimOf(n);
      if (c && it && it.go) {
        /* Inbox spine: open Dashboard booking with proof tab; claim id kept for highlight */
        var bk = n && n.link && n.link.params && n.link.params.bkid;
        if (bk) it.go = ['dashboard', { bkid: String(bk), bktab: 'proof', claim: c }];
        else if (isQ({ page: it.go[0], params: it.go[1] }) || (it.go[0] === 'dashboard')) it.go = ['dashboard', Object.assign({}, (it.go[1] || {}), { bktab: 'proof', claim: c })];
        else if (isQ({ page: it.go[0], params: it.go[1] })) it.go = ['sales', Object.assign({}, it.go[1], { claim: c })];
      }
      return it; };
    NT.fromRow.__bkgo = 1; return true;
  }
  var tries = 0; (function go() { if (!wrapNT() && ++tries < 40) setTimeout(go, 250); })();
  /* one receipt by id (any status) for the read-only view */
  V.one = function (id) {
    var tid = P.tid(); if (!tid || !id) return Promise.resolve(null);
    return sb.from('payment_claims').select('*').eq('tenant_id', tid).eq('id', id).is('deleted_at', null).maybeSingle().then(function (r) {
      var c = r && r.data; if (!c || String(c.tenant_id) !== String(tid)) return null;
      return Promise.all([sb.from('invoices').select('*').eq('tenant_id', tid).eq('id', c.invoice_id).maybeSingle(), sb.from('bookings').select('*').eq('tenant_id', tid).eq('invoice_id', c.invoice_id).limit(1)]).then(function (a) {
        var i = (a[0] && a[0].data) || {}, b = ((a[1] && a[1].data) || [])[0] || null;
        return (b && b.service_id ? sb.from('booking_services').select('*').eq('tenant_id', tid).eq('id', b.service_id).maybeSingle() : Promise.resolve({})).then(function (s) {
          var s2 = (s && s.data) || null, x = { c: c, inv: i, bk: b, svc: s2, ai: c.ai_check || null, ro: String(c.status) !== 'pending' };
          x.n = A.need({ total: i.total, paid_amt: i.paid_amt, deposit_pct: s2 && s2.deposit_pct }); return x;
        });
      });
    }, function () { return null; });
  };
  /* status line shown instead of Verify / Reject */
  V.roTxt = function (x) {
    var c = x.c || {}, bm = P.bm(), w = c.reviewed_at ? A.time(c.reviewed_at, bm) + ' (MYT)' : '-';
    if (c.status === 'approved') return P.t('qRoOk', { t: w });
    if (c.status === 'rejected') return P.t('qRoRej', { t: w, w: c.reject_reason || '-' });
    return P.t('qRoSt', { s: c.status || '-' });
  };
})();
