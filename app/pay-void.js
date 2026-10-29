/* M-Core payment attachments - Phase 2: Void with reason + archive (payment_voids), books-lock check (owner / PA only inside a locked period),
   reversal journal on every void incl. partial (journals are no longer deleted), voided list per invoice / bill. Needs pay_attach_02.sql; until then Void is unchanged. v1 */
(function () {
  var P = window.PAYX; if (!P || window.PAYV) return;
  var V = window.PAYV = {}, E = P.esc, t = P.t, ok = {};
  /* sync gate used by the index.html hook; V.inv / V.bill re-check async and hand back to the original code when SQL 02 has not run */
  V.on = function () { if (V._legacy) { V._legacy = 0; return false; } return ok[P.tid()] !== false; };
  V.probe = function () { var k = P.tid(); if (ok[k] == null) { ok[k] = 0; P.has('payment_voids').then(function (v) { ok[k] = !!v; }); } };
  function today() { try { return typeof _dbTodayYMD === 'function' ? _dbTodayYMD() : new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }); } catch (e) { return new Date().toISOString().slice(0, 10); } }
  /* reason sheet; resolves the reason or null */
  V.ask = function (sub) {
    return new Promise(function (res) {
      var bg = document.createElement('div'); bg.className = 'payx-bg'; bg.id = 'payv-ask';
      bg.innerHTML = '<div class="payx-sh" role="dialog" aria-modal="true" aria-labelledby="payv-t"><div class="payx-grab"></div><div class="payx-ti" id="payv-t">' + E(t('vTi')) + '</div><div class="payx-sub">' + E(sub) + '</div>' +
        '<p style="font-size:13.5px;color:var(--text-2);margin:0 0 12px">' + E(t('vD')) + '</p><label class="form-label" for="payv-r">' + E(t('vR')) + '</label>' +
        '<textarea id="payv-r" class="form-input" rows="3" maxlength="500" data-no-titlecase="1" placeholder="' + E(t('vRph')) + '" style="width:100%;box-sizing:border-box;resize:vertical"></textarea><div data-e class="auth-error" style="display:none;margin-top:8px"></div>' +
        '<div style="display:flex;gap:10px;margin-top:14px"><button type="button" class="btn btn-outline" data-n style="flex:1;min-height:44px">' + E(t('vNo')) + '</button><button type="button" class="btn btn-primary" data-y style="flex:1;min-height:44px;background:var(--danger);border-color:var(--danger);color:#fff">' + E(t('vGo')) + '</button></div></div>';
      document.body.appendChild(bg);
      var ta = bg.querySelector('textarea'); ta.oninput = function () { bg.querySelector('[data-e]').style.display = 'none'; }; var done = function (v) { bg.remove(); res(v); };
      bg.querySelector('[data-n]').onclick = function () { done(null); }; bg.onclick = function (e) { if (e.target === bg) done(null); };
      bg.querySelector('[data-y]').onclick = function () { var v = ta.value.trim(); if (v.length < 3) { var e = bg.querySelector('[data-e]'); e.textContent = t('vNeed'); e.style.display = 'block'; ta.focus(); return; } done(v.slice(0, 500)); };
      setTimeout(function () { ta.focus(); }, 30);
    });
  };
  function canVoid(d) { if (P.lockOk(d)) return true; P.toast(t('vLock', { d: P.date(P.lock()) }), 'error'); return false; }
  function q(x) { return Promise.resolve(x).then(function (r) { return r || {}; }, function () { return {}; }); }
  function archive(row) { row.tenant_id = P.tid(); row.voided_by = P.isPA() ? null : P.uid(); return sb.from('payment_voids').insert(row).select('id').single(); }
  function post(desc, lines, src, id) {
    return _postJournalEntry({ description: desc, entryDate: today(), entryType: 'auto', lines: lines, sourceTable: src, sourceId: id, skipLockCheck: P.role() === 'owner' || P.isPA() });
  }
  /* invoice: Dr Sales Revenue / Cr Cash|Bank (same account choice as _postSaleJournal); + Dr Inventory / Cr COGS when the invoice leaves Paid */
  V.revInv = async function (inv, pay, amt, newStatus) {
    if (typeof _journalAlreadyPosted === 'function' && !(await _journalAlreadyPosted('invoices', inv.id))) return null;
    var key = pay && pay.payment_method && pay.payment_method !== 'cash' ? 'bank' : 'cash', cash = await _getDefaultAccountId(key);
    if (!cash && key === 'bank') cash = await _getDefaultAccountId('cash');
    var rev = await _getDefaultAccountId('sales_revenue'); if (!cash || !rev) { try { _damToastMissing([cash ? '' : 'cash', rev ? '' : 'sales_revenue'], 'void'); } catch (e) {} return null; }
    var lines = [{ account_id: rev, debit: amt, credit: 0 }, { account_id: cash, debit: 0, credit: amt }];
    if (inv.status === 'paid' && newStatus !== 'paid') {
      var cogs = await _getDefaultAccountId('cogs'), stock = await _getDefaultAccountId('inventory');
      if (cogs && stock) {
        var es = (await q(sb.from('journal_entries').select('id').eq('tenant_id', P.tid()).eq('source_table', 'invoices').eq('source_id', inv.id).is('deleted_at', null))).data || [];
        var ls = es.length ? ((await q(sb.from('journal_lines').select('account_id,debit_amt,credit_amt').in('entry_id', es.map(function (e) { return e.id; })))).data || []) : [];
        var net = ls.filter(function (l) { return String(l.account_id) === String(cogs); }).reduce(function (s, l) { return s + Number(l.debit_amt || 0) - Number(l.credit_amt || 0); }, 0);
        net = Math.round(net * 100) / 100;
        if (net > 0.005) lines.push({ account_id: stock, debit: net, credit: 0 }, { account_id: cogs, debit: 0, credit: net });
      }
    }
    return post('Void Invoice Payment ' + inv.ref_no + (pay && pay.ref_no ? ' (' + pay.ref_no + ')' : ''), lines, 'invoices', inv.id);
  };
  /* supplier: mirror of the payment's own journal lines; legacy bill-keyed journal is mirrored only when the last payment goes (same rule as before) */
  function jes(src, id) { return q(sb.from('journal_entries').select('id').eq('tenant_id', P.tid()).eq('source_table', src).eq('source_id', id).is('deleted_at', null)).then(function (r) { return r.data || []; }); }
  V.revBill = async function (bill, payId, last) {
    var es = await jes('supplier_payments', payId), lines = [], m = {};
    if (!es.length && last) es = await jes('supplier_bills', bill.id);
    if (!es.length) return null;
    ((await q(sb.from('journal_lines').select('account_id,debit_amt,credit_amt').in('entry_id', es.map(function (e) { return e.id; })))).data || []).forEach(function (l) { m[l.account_id] = (m[l.account_id] || 0) + Number(l.debit_amt || 0) - Number(l.credit_amt || 0); });
    Object.keys(m).forEach(function (a) { var v = Math.round(m[a] * 100) / 100; if (Math.abs(v) > 0.005) lines.push({ account_id: a, debit: v < 0 ? -v : 0, credit: v > 0 ? v : 0 }); });
    if (!lines.length) return null;
    return post('Void Supplier Bill Payment ' + (bill.bill_no || bill.ref_no || bill.id), lines, 'supplier_payments', payId);
  };
  function finish(archId, je) {
    if (je && je.id && archId) sb.from('payment_voids').update({ reversal_entry_id: je.id }).eq('id', archId).then(function () {}, function () {});
    P.toast(je ? t('vOk') : t('vOk2'));
  }
  /* replaces _payVoid when SQL 02 has run (hook at the top of _payVoid in index.html) */
  V.inv = async function (invoiceId, allocationId, paymentId, amount) {
    try {
      if (!(await P.has('payment_voids'))) { ok[P.tid()] = false; V._legacy = 1; return _payVoid(invoiceId, allocationId, paymentId, amount); }
      var tid = P.tid(), amt = Number(amount || 0);
      var inv = (await q(sb.from('invoices').select('id,total,paid_amt,status,ref_no').eq('id', invoiceId).eq('tenant_id', tid).single())).data;
      if (!inv) return P.toast(P.bm() ? 'Invois tidak dijumpai.' : 'Invoice not found.', 'error');
      var pay = paymentId ? (await q(sb.from('payments').select('*').eq('id', paymentId).eq('tenant_id', tid).maybeSingle())).data : null;
      if (!canVoid(pay && pay.payment_date)) return;
      var why = await V.ask([pay && pay.ref_no, P.money(amt), pay && pay.payment_date ? P.date(pay.payment_date) : ''].filter(Boolean).join(' · ')); if (!why) return;
      var al = allocationId ? (await q(sb.from('payment_allocations').select('*').eq('id', allocationId).eq('tenant_id', tid).maybeSingle())).data : null;
      var a = await archive({ kind: 'payment', payment_id: paymentId || allocationId, invoice_id: invoiceId, ref_no: pay && pay.ref_no, payment_date: pay && pay.payment_date, payment_method: pay && pay.payment_method, amount: amt, reason: why, snapshot: { payment: pay, allocation: al } });
      if (a.error) return P.toast(t('vArch') + a.error.message, 'error');
      if (allocationId) { var e1 = await sb.from('payment_allocations').delete().eq('id', allocationId).eq('tenant_id', tid); if (e1.error) return P.toast(t('err') + e1.error.message, 'error'); }
      if (paymentId) { var o = (await q(sb.from('payment_allocations').select('id').eq('payment_id', paymentId).limit(1))).data; if (!o || !o.length) await sb.from('payments').delete().eq('id', paymentId).eq('tenant_id', tid); }
      var np = Math.max(0, Number(inv.paid_amt || 0) - amt), ns = np >= Number(inv.total || 0) - 0.005 ? 'paid' : np > 0.005 ? 'partial' : 'unpaid';
      await sb.from('invoices').update({ paid_amt: np, status: ns }).eq('id', invoiceId).eq('tenant_id', tid);
      var je = null; try { je = await V.revInv(inv, pay, amt, ns); } catch (e) { console.error('void reversal', e); P.toast(t('err') + (e.message || e), 'error'); }
      P.audit('delete', 'payments', paymentId || allocationId); finish(a.data && a.data.id, je);
      renderInvDetail(invoiceId);
    } catch (e) { P.toast(t('err') + ((e && e.message) || e), 'error'); }
  };
  V.bill = async function (billId, paymentId, amount) {
    try {
      if (!(await P.has('payment_voids'))) { ok[P.tid()] = false; V._legacy = 1; return _billPayVoid(billId, paymentId, amount); }
      var tid = P.tid(), amt = Number(amount || 0);
      var bill = (await q(sb.from('supplier_bills').select('id,total,paid_amt,status,bill_no,supplier_id,suppliers(name)').eq('id', billId).eq('tenant_id', tid).single())).data;
      if (!bill) return P.toast(P.bm() ? 'Bil tidak dijumpai.' : 'Bill not found.', 'error');
      var pay = (await q(sb.from('supplier_payments').select('*').eq('id', paymentId).eq('tenant_id', tid).maybeSingle())).data;
      if (!canVoid(pay && pay.payment_date)) return;
      var why = await V.ask([pay && pay.bank_ref, P.money(amt), pay && pay.payment_date ? P.date(pay.payment_date) : ''].filter(Boolean).join(' · ')); if (!why) return;
      var a = await archive({ kind: 'supplier_payment', payment_id: paymentId, bill_id: billId, ref_no: (pay && pay.bank_ref) || null, payment_date: pay && pay.payment_date, payment_method: pay && pay.method, amount: amt, reason: why, snapshot: { payment: pay } });
      if (a.error) return P.toast(t('vArch') + a.error.message, 'error');
      var d = await sb.from('supplier_payments').delete().eq('id', paymentId).eq('tenant_id', tid); if (d.error) return P.toast(t('err') + d.error.message, 'error');
      var np = Math.max(0, Number(bill.paid_amt || 0) - amt), ns = np < 0.005 ? 'unpaid' : (np >= Number(bill.total) - 0.005 ? 'paid' : 'partial');
      await sb.from('supplier_bills').update({ paid_amt: np, status: ns }).eq('id', billId).eq('tenant_id', tid);
      var rem = (await q(sb.from('supplier_payments').select('id').eq('bill_id', billId).eq('tenant_id', tid).limit(1))).data;
      var je = null; try { je = await V.revBill(bill, paymentId, !rem || !rem.length); } catch (e) { console.error('void reversal', e); P.toast(t('err') + (e.message || e), 'error'); }
      P.audit('delete', 'supplier_payments', paymentId); finish(a.data && a.data.id, je);
      renderSupplierBillDetail(billId);
    } catch (e) { P.toast(t('err') + ((e && e.message) || e), 'error'); }
  };
})();
