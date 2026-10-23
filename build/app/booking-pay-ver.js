/* M-Core booking payment flow - staff rules: pending booking receipts, checks (amount, date, duplicate file, bank ref, pay ref, AI read),
   Verify (normal Record Payment save + customer's original file + official receipt PDF), Reject (reason + grace hold). Owner / admin, never the maker; PA full. v1 */
(function () {
  var P = window.PAYX, A = window.BKPAYA; if (!P || !P.claims || !A || window.BKPAYV) return;
  var V = window.BKPAYV = {}, t = P.t, MYT = { timeZone: 'Asia/Kuala_Lumpur' };
  function uniq(a) { return a.filter(function (x, i) { return x != null && a.indexOf(x) === i; }); }
  function day(v) { return v ? new Date(v).toLocaleDateString('en-CA', MYT) : ''; }
  V.ref = function (inv) { return inv && inv.id ? 'BK' + String(inv.id).replace(/-/g, '').slice(0, 6).toUpperCase() : ''; };
  V.files = function (c) { return Array.isArray(c.files) ? c.files : []; };
  V.set = function () {
    return P.has('pay_settings').then(function (ok) { return ok ? sb.from('pay_settings').select('*').eq('tenant_id', P.tid()).maybeSingle().then(function (r) { return r.data || {}; }) : {}; }).catch(function () { return {}; });
  };
  V.grace = function (s) { var m = Number(s && s.bk_grace_min); return m >= 10 ? m : 120; };
  /* pending receipts with their invoice, booking and service */
  V.load = function () {
    var tid = P.tid();
    return P.has('payment_claims').then(function (ok) {
      if (!ok) return { list: [], off: true };
      return sb.from('payment_claims').select('*').eq('tenant_id', tid).eq('status', 'pending').is('deleted_at', null).order('created_at').then(function (r) {
        if (r.error) throw r.error; var cl = r.data || [], ids = uniq(cl.map(function (c) { return c.invoice_id; }));
        if (!ids.length) return { list: [] };
        return Promise.all([sb.from('invoices').select('*').eq('tenant_id', tid).in('id', ids), sb.from('bookings').select('*').eq('tenant_id', tid).in('invoice_id', ids)]).then(function (a) {
          var inv = a[0].data || [], bk = a[1].data || [], sid = uniq(bk.map(function (b) { return b.service_id; }));
          return (sid.length ? sb.from('booking_services').select('*').eq('tenant_id', tid).in('id', sid) : Promise.resolve({ data: [] })).then(function (s) {
            var sv = s.data || [], f = function (l, k, v) { return l.find(function (x) { return String(x[k]) === String(v); }) || null; };
            return { list: cl.map(function (c) {
              var i = f(inv, 'id', c.invoice_id) || {}, b = f(bk, 'invoice_id', c.invoice_id), s2 = b && f(sv, 'id', b.service_id);
              var x = { c: c, inv: i, bk: b, svc: s2, ai: c.ai_check || null };
              x.n = A.need({ total: i.total, paid_amt: i.paid_amt, deposit_pct: s2 && s2.deposit_pct }); return x;
            }) };
          });
        });
      });
    });
  };
  /* duplicate file (sha256) and reused bank ref */
  V.dups = function (x) {
    var tid = P.tid(), h = (V.files(x.c)[0] || {}).sha256, ref = (x.ai && x.ai.ref) || x.c.bank_ref, jobs = [];
    jobs.push(/^[0-9a-f]{64}$/.test(h || '') ? Promise.all([
      sb.from('payment_claims').select('id').eq('tenant_id', tid).neq('id', x.c.id).is('deleted_at', null).contains('files', [{ sha256: h }]).limit(1),
      sb.from('doc_attachments').select('id').eq('tenant_id', tid).eq('sha256', h).is('deleted_at', null).limit(1)
    ]).then(function (a) { return !!(((a[0].data || []).length) || ((a[1].data || []).length)); }, function () { return false; }) : Promise.resolve(false));
    jobs.push(ref ? Promise.resolve(sb.from('payments').select('id').eq('tenant_id', tid).eq('bank_ref', ref).limit(1)).then(function (r) { return !!(r.data || []).length; }, function () { return false; }) : Promise.resolve(false));
    return Promise.all(jobs).then(function (a) { x.dup = a[0]; x.dupRef = a[1]; return x; });
  };
  /* [level, text]: ok | warn | bad | info */
  V.checks = function (x) {
    var c = x.c, n = x.n, ai = x.ai, amt = Number(c.amount || 0), o = [];
    if (amt < n.due - 0.005) o.push(['warn', t('wAmtLow', { a: P.money(n.due) })]);
    else if (amt > n.bal + 0.005) o.push(['warn', t('wAmtHigh', { a: P.money(n.bal) })]);
    else o.push(['ok', t('wAmtOk')]);
    if (ai && Number(ai.amount) > 0 && Math.abs(Number(ai.amount) - amt) > 0.009) o.push(['bad', t('wAiAmt', { a: P.money(ai.amount), b: P.money(amt) })]);
    var d = ai && /^\d{4}-\d{2}-\d{2}$/.test(ai.date || '') ? ai.date : null, made = day((x.bk && x.bk.created_at) || x.inv.created_at);
    if (d && made && d < made) o.push(['bad', t('wDate', { d: P.date(d) })]); else if (d) o.push(['ok', t('wDateOk')]);
    if (x.dup) o.push(['bad', t('wDup')]);
    var ref = (ai && ai.ref) || c.bank_ref;
    if (ref) o.push(x.dupRef ? ['bad', t('wDupRef', { r: ref })] : ['ok', t('wBankRef', { r: ref })]); else o.push(['info', t('wBankNo')]);
    if (x.bk && ai) { var pr = V.ref(x.inv), txt = String([ai.vendor, ai.description, ai.ref].join(' ')).toUpperCase().replace(/\s+/g, ''); o.push(txt.indexOf(pr) >= 0 ? ['ok', t('wRef', { r: pr })] : ['info', t('wRefNo')]); }
    return o;
  };
  /* AI read (ai-proxy receipt), cached on the claim */
  V.ai = function (x, url) {
    if (x.ai || typeof _invokeAiProxy !== 'function' || typeof _compressImageToBase64 !== 'function') return Promise.resolve(x.ai);
    var f0 = V.files(x.c)[0]; if (!f0 || !/^image\/(jpeg|png|webp)/i.test(f0.mime || '') || !url) return Promise.resolve(null);
    return fetch(url).then(function (r) { return r.blob(); }).then(function (b) { return _compressImageToBase64(new File([b], f0.name || 'slip.jpg', { type: b.type || f0.mime })); })
      .then(function (z) { return _invokeAiProxy({ action: 'receipt', image_base64: z.base64, mime_type: z.mimeType || 'image/jpeg' }, { silent: true }); }).then(function (r) {
        if (!r || r.error || !r.data || !r.data.success) return null; try { _usageCaptureAi(); } catch (e) {}
        var d = r.data.data || {}; x.ai = { amount: Number(d.amount) || null, date: d.date || null, vendor: d.vendor || null, description: d.description || null, ref: null, at: new Date().toISOString() };
        sb.from('payment_claims').update({ ai_check: x.ai }).eq('id', x.c.id).eq('tenant_id', P.tid()).then(function () {}, function () {});
        return x.ai;
      }).catch(function () { return null; });
  };
  V.url = function (f) { return f && f.path ? Promise.resolve(sb.storage.from('doc-files').createSignedUrl(f.path, 600)).then(function (r) { return (r.data && r.data.signedUrl) || null; }, function () { return null; }) : Promise.resolve(null); };
  /* who may verify: owner / admin (PA always), never the invoice / booking maker */
  V.may = function (x) {
    if (P.isPA()) return '';
    var r = P.role(); if (r !== 'owner' && r !== 'admin') return 'qRole';
    var me = String(P.uid()); if (String(x.inv.created_by || '') === me || (x.bk && String(x.bk.created_by || '') === me)) return 'qMaker';
    return '';
  };
  function rv() { return { reviewed_by: P.isPA() ? null : P.uid(), reviewed_at: new Date().toISOString() }; }
  function hold(x, s) {
    var until = new Date(Date.now() + V.grace(s) * 60000);
    if (!x.bk || !/^(hold|pending_payment)$/.test(x.bk.status || '')) return Promise.resolve(until);
    return Promise.resolve(sb.from('bookings').update({ hold_until: until.toISOString(), updated_at: new Date().toISOString() }).eq('id', x.bk.id).eq('tenant_id', P.tid())).then(function () { return until; }, function () { return until; });
  }
  V.reject = function (x, why) {
    return sb.from('payment_claims').update(Object.assign({ status: 'rejected', reject_reason: String(why).slice(0, 500) }, rv())).eq('id', x.c.id).eq('tenant_id', P.tid()).eq('status', 'pending').select('id').then(function (r) {
      if (r.error) throw r.error; if (!(r.data || []).length) throw new Error('not pending');
      P.audit('update', 'payment_claims', x.c.id);
      return V.set().then(function (s) { return hold(x, s); });
    });
  };
  /* Verify: drive _paySave with a hidden Record Payment form; pay-claim.js attaches the original file + approves the claim in PAYX.after */
  var IDS = ['pay-amount', 'pay-date', 'pay-method', 'pay-form-err', 'payx-inv-ref', 'payx-inv-notes'];
  V.verify = function (x, amt) {
    var why = V.may(x); if (why) return Promise.reject(new Error(t(why)));
    return P.ready().then(function (on) {
      if (!on || typeof _paySave !== 'function') throw new Error(t('qNeedSql'));
      var moved = IDS.map(function (id) { var e = document.getElementById(id); if (e) e.id = id + '__bkpay'; return e; });
      var h = document.createElement('div'); h.hidden = true; h.id = 'bkpay-hf';
      h.innerHTML = '<input id="pay-amount"><input id="pay-date"><select id="pay-method"><option value="bank_transfer" selected>bank</option></select><div id="pay-form-err"></div><input id="payx-inv-ref"><input id="payx-inv-notes">';
      document.body.appendChild(h);
      var a = Math.min(A.r2(amt), x.n.bal), ref = (x.ai && x.ai.ref) || x.c.bank_ref || '';
      h.querySelector('#pay-amount').value = a.toFixed(2); h.querySelector('#pay-date').value = x.c.paid_on || A.today();
      h.querySelector('#payx-inv-ref').value = ref; h.querySelector('#payx-inv-notes').value = ('Booking ' + ((x.bk && x.bk.quote_ref) || '') + ' · ref ' + V.ref(x.inv)).slice(0, 500);
      var rid = window.renderInvDetail, got = null; window.renderInvDetail = function () {};
      P.pend.inv = []; P.claims.cur = x.c; V._wait = { id: String(x.inv.id), cb: function (pid) { got = pid; } };
      var done = function () { window.renderInvDetail = rid; V._wait = null; P.claims.cur = null; h.remove(); moved.forEach(function (e, i) { if (e) e.id = IDS[i]; }); };
      return Promise.resolve(_paySave(x.inv.id, x.n.bal)).then(function () {
        var err = h.querySelector('#pay-form-err').textContent; done();
        if (!got) throw new Error(err || t('qFail', { e: '-' }));
        return V.post(x, got);
      }, function (e) { done(); throw e; });
    });
  };
  P.afters.push(function (kind, payId, docId) { var w = V._wait; if (kind === 'inv' && w && w.id === String(docId)) w.cb(payId); });
  /* after the payment: deposit / full -> confirm the booking; part -> grace hold; official receipt PDF -> link for the customer */
  V.post = function (x, payId) {
    var tid = P.tid();
    return Promise.all([sb.from('invoices').select('total,paid_amt,status').eq('id', x.inv.id).eq('tenant_id', tid).maybeSingle(), V.set()]).then(function (a) {
      var i = a[0].data || {}, s = a[1], n = A.need({ total: i.total, paid_amt: i.paid_amt, deposit_pct: x.svc && x.svc.deposit_pct }), res = { payId: payId, part: n.due > 0.005 };
      var bk = x.bk && /^(hold|pending_payment|payment_failed)$/.test(x.bk.status || '') ? x.bk : null;
      var step = !bk ? Promise.resolve() : res.part ? hold(x, s).then(function (u) { res.until = u; })
        : Promise.resolve(sb.from('bookings').update({ status: 'confirmed', payment_channel: bk.payment_channel || 'bank_transfer', updated_at: new Date().toISOString() }).eq('id', bk.id).eq('tenant_id', tid).in('status', ['hold', 'pending_payment', 'payment_failed'])).then(function () { P.audit('update', 'bookings', bk.id); }, function () {});
      return step.then(function () { return V.receipt(x, payId); }).then(function (no) { res.no = no; return res; }, function () { return res; });
    });
  };
  V.receipt = function (x, payId) {
    if (!P.rcpt) return Promise.resolve('');
    return P.rcpt(x.inv.id, payId).then(function (r) {
      var path = P.tid() + '/receipts/' + payId + '.pdf', no = (r.d && r.d.p && r.d.p.ref_no) || '';
      return Promise.resolve(sb.storage.from('doc-files').upload(path, r.file, { contentType: 'application/pdf', upsert: true })).then(function (u) {
        if (u.error) throw u.error; return sb.storage.from('doc-files').createSignedUrl(path, 2592000);
      }).then(function (s) {
        var url = s && s.data && s.data.signedUrl; if (!url) return no;
        return Promise.resolve(sb.from('payment_claims').update({ receipt_url: url, receipt_no: no || null }).eq('id', x.c.id).eq('tenant_id', P.tid())).then(function () { return no; }, function () { return no; });
      });
    });
  };
})();
