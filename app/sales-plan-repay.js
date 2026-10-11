/* Sales Plan — phase 2c. Record repayment (bottom sheet on mobile, modal on laptop): full or partial,
   pro-rata principal/fee split with override, journal Dr Loan + Dr Fee / Cr Bank, and
   delete = reversal journal (source sales_plan_repayment_reversal) then soft delete. */
(function () {
  'use strict';
  var SP = window.SP, st = SP.state, t = SP.t, esc = SP.esc, num = SP.num;
  function amtOf(ov, id) { var e = ov.querySelector('#' + id), s = e ? String(e.value).replace(/,/g, '').trim() : ''; if (s === '') return null; var x = Number(s); return isFinite(x) ? SP.r2(x) : NaN; }
  function state(ov, k) {
    var a = amtOf(ov, 'sp-rp-amt'), fx = SP.fxVal(ov, 'sp-rp-fx'), p = amtOf(ov, 'sp-rp-p'), f = amtOf(ov, 'sp-rp-f');
    return { amount: a, principal: p, fee: f, fx: fx, bank: ov.querySelector('#sp-rp-bank').value, date: ov.querySelector('#sp-rp-date').value, note: String(ov.querySelector('#sp-rp-note').value || '').trim() };
  }
  function refresh(ov, k, src) {
    var a = amtOf(ov, 'sp-rp-amt'), pe = ov.querySelector('#sp-rp-p'), fe = ov.querySelector('#sp-rp-f');
    if (src === 'amt' || !src) { if (a > 0) { var s = SP.splitRepay(a, k.outP, k.outF); pe.value = s.principal.toFixed(2); fe.value = s.fee.toFixed(2); } }
    else if (src === 'p' && a > 0) { var pp = amtOf(ov, 'sp-rp-p'); if (pp != null && !Number.isNaN(pp)) fe.value = SP.r2(a - pp).toFixed(2); }
    else if (src === 'f' && a > 0) { var ff = amtOf(ov, 'sp-rp-f'); if (ff != null && !Number.isNaN(ff)) pe.value = SP.r2(a - ff).toFixed(2); }
    var tag = ov.querySelector('#sp-rp-tag'); if (tag) tag.textContent = a > 0 && Math.abs(a - k.outstanding) < 0.005 ? t('Full', 'Penuh') : a > 0 ? t('Partial', 'Separa') : '';
    var x = state(ov, k), el = ov.querySelector('#sp-rp-prev');
    if (el) el.innerHTML = x.amount > 0 && x.principal != null && x.fee != null ? SP.jPreview(SP.repayLines({ amount: x.amount, principal: x.principal, fx: isFinite(x.fx) ? x.fx : 0, bank: x.bank }), SP.isMyr() ? '' : SP.fmtNum(x.amount, 2) + ' ' + st.plan.currency + ' × ' + (isFinite(x.fx) ? x.fx : '?')) : '';
  }
  SP.repayModal = function (b) {
    var c = SP.ctx(), k = SP.batchCalc(c, b), p = st.plan, cur = p.currency;
    var body = '<div class="sp-hint">' + esc(SP.batchName(b) + ' · ' + SP.money(k.principal, cur) + ' + ' + t('fee ', 'fi ') + SP.money(k.fee, cur) + (k.dueDate ? ' · ' + t('due ', 'tamat ') + SP.fmtDate(k.dueDate) : '') + (k.repaid > 0 ? ' · ' + t('outstanding ', 'baki ') + SP.money(k.outstanding, cur) : '')) + '</div>' +
      '<div class="form-group"><label class="form-label" for="sp-rp-amt">' + esc(t('Amount', 'Jumlah') + ' (' + SP.curSym(cur) + ')') + '</label><div class="sp-amtwrap"><input id="sp-rp-amt" class="form-input sp-amt" type="number" inputmode="decimal" min="0" step="0.01" value="' + k.outstanding.toFixed(2) + '"><span class="sp-amttag" id="sp-rp-tag"></span></div></div>' +
      '<div class="form-row"><div class="form-group"><label class="form-label" for="sp-rp-date">' + esc(t('Date', 'Tarikh')) + '</label><input id="sp-rp-date" type="date" class="form-input" value="' + SP.todayISO() + '"></div>' +
      '<div class="form-group"><label class="form-label" for="sp-rp-bank">' + esc(t('Bank account', 'Akaun bank')) + '</label><select id="sp-rp-bank" class="form-select">' + SP.acctOpts(['asset'], p.default_bank_account_id) + '</select></div></div>' +
      (SP.isMyr() ? '' : '<div class="form-group"><label class="form-label" for="sp-rp-fx">' + esc(t('FX rate: 1 ' + cur + ' = ? MYR', 'Kadar FX: 1 ' + cur + ' = ? MYR')) + '</label><input id="sp-rp-fx" class="form-input" type="number" inputmode="decimal" min="0" step="any" value="' + esc(b.fx_rate_to_myr || '') + '"></div>') +
      '<details class="sp-split"><summary>' + esc(t('Principal / fee split (pro-rata — tap to override)', 'Pecahan prinsipal / fi (pro-rata — ketik untuk ubah)')) + '</summary><div class="form-row">' +
      '<div class="form-group"><label class="form-label" for="sp-rp-p">' + esc(t('Principal', 'Prinsipal')) + '</label><input id="sp-rp-p" class="form-input" type="number" inputmode="decimal" min="0" step="0.01"></div>' +
      '<div class="form-group"><label class="form-label" for="sp-rp-f">' + esc(t('Fee', 'Fi')) + '</label><input id="sp-rp-f" class="form-input" type="number" inputmode="decimal" min="0" step="0.01"></div></div></details>' +
      '<div class="form-group"><label class="form-label" for="sp-rp-note">' + esc(t('Note (optional)', 'Nota (pilihan)')) + '</label><input id="sp-rp-note" class="form-input" data-no-titlecase="1" maxlength="200"></div>' +
      '<div id="sp-rp-prev"></div>';
    var ov = SP.openModal(t('Record repayment', 'Rekod bayaran balik'), body, '✓ ' + t('Post repayment', 'Siarkan bayaran'), function (o, btn) { SP.postRepay(o, btn, b); });
    ov.classList.add('sp-sheet');
    ov.addEventListener('input', function (e) { var id = e.target && e.target.id; refresh(ov, k, id === 'sp-rp-amt' ? 'amt' : id === 'sp-rp-p' ? 'p' : id === 'sp-rp-f' ? 'f' : 'x'); });
    refresh(ov, k);
  };
  SP.postRepay = async function (ov, btn, b) {
    if (st.busy) return;
    var p = st.plan, k = SP.batchCalc(SP.ctx(), b), x = state(ov, k), err = null;
    if (!p.loan_account_id) err = t('Set the Financier Loan account in Settings first.', 'Tetapkan akaun Pinjaman Pembiaya dalam Tetapan dahulu.');
    else if (!(x.amount > 0)) err = t('Amount must be more than 0.', 'Jumlah mesti lebih daripada 0.');
    else if (x.amount > k.outstanding + 0.004) err = t('Amount is more than the outstanding ' + SP.money(k.outstanding, p.currency) + '.', 'Jumlah melebihi baki ' + SP.money(k.outstanding, p.currency) + '.');
    else if (x.principal == null || x.fee == null || Number.isNaN(x.principal) || Number.isNaN(x.fee) || x.principal < 0 || x.fee < 0) err = t('Check the principal / fee split.', 'Semak pecahan prinsipal / fi.');
    else if (Math.round((x.principal + x.fee) * 100) !== Math.round(x.amount * 100)) err = t('Principal + fee must equal the amount.', 'Prinsipal + fi mesti sama dengan jumlah.');
    else if (x.principal > k.outP + 0.004 || x.fee > k.outF + 0.004) err = t('Split is more than the outstanding principal ' + SP.fmtNum(k.outP, 2) + ' / fee ' + SP.fmtNum(k.outF, 2) + '.', 'Pecahan melebihi baki prinsipal ' + SP.fmtNum(k.outP, 2) + ' / fi ' + SP.fmtNum(k.outF, 2) + '.');
    else if (x.fee > 0 && !p.fee_account_id) err = t('Set the Financing Fee account in Settings first.', 'Tetapkan akaun Fi Pembiayaan dalam Tetapan dahulu.');
    else if (!SP.isoOk(x.date)) err = t('Enter the repayment date.', 'Masukkan tarikh bayaran.');
    else if (!x.bank) err = t('Choose the bank account.', 'Pilih akaun bank.');
    else if (!isFinite(x.fx)) err = t('Enter the FX rate to MYR.', 'Masukkan kadar FX ke MYR.');
    if (err) { SP.toast(err, 'error'); return; }
    if (SP.lockedOn(x.date)) return;
    st.busy = true; btn.disabled = true;
    var done = function () { st.busy = false; btn.disabled = false; }, id = SP.uuid();
    try {
      if (typeof _journalAlreadyPosted === 'function' && await _journalAlreadyPosted('sales_plan_repayments', id)) { done(); return; }
      var lines = SP.repayLines({ amount: x.amount, principal: x.principal, fx: SP.isMyr() ? 1 : x.fx, bank: x.bank });
      var desc = ('Sales Plan repayment — ' + p.name + ' · ' + SP.batchName(b)).slice(0, 200);
      var res = await SP.postJ({ description: desc, entryDate: x.date, entryType: 'auto', lines: lines, sourceTable: 'sales_plan_repayments', sourceId: id });
      if (!res) { done(); return; }
      var ins = await sb.from('sales_plan_repayments').insert({ id: id, tenant_id: SP.tid(), plan_id: p.id, batch_id: b.id, repaid_on: x.date, amount: x.amount, principal_portion: x.principal, fee_portion: x.fee,
        fx_rate_to_myr: SP.isMyr() ? null : x.fx, bank_account_id: x.bank, journal_entry_id: res.id, note: x.note || null });
      if (ins.error) {
        await SP.postJ({ description: ('Reversal of ' + (res.ref_no || res.id) + ' — ' + desc).slice(0, 200), entryDate: x.date, entryType: 'manual', lines: SP.reverseLines(lines), sourceTable: 'sales_plan_repayment_reversal', sourceId: id, skipLockCheck: true }).catch(function () {});
        throw ins.error;
      }
      st.busy = false; SP.closeModal();
      SP.toast(t('Repayment posted', 'Bayaran balik disiarkan') + ' (' + (res.ref_no || '') + ')', 'success');
      SP.go({ view: 'detail', id: p.id, tab: 'stock' });
    } catch (e) { done(); SP.toast(t('Could not post repayment: ', 'Gagal siarkan bayaran: ') + SP.errMsg(e), 'error'); }
  };
  SP.reverseRepay = async function (r) {
    var today = SP.todayISO(), p = st.plan, now = new Date().toISOString(), revId = r.reversal_journal_id;
    if (r.journal_entry_id && !revId) {
      var ex = await SP.findJournal('sales_plan_repayment_reversal', r.id);
      if (ex) revId = ex.id;
      else {
        if (SP.lockedOn(today)) return false;
        var e = await sb.from('journal_entries').select('id,ref_no,description').eq('id', r.journal_entry_id).eq('tenant_id', SP.tid()).maybeSingle();
        var L = await sb.from('journal_lines').select('account_id,debit_amt,credit_amt,line_no').eq('entry_id', r.journal_entry_id).eq('tenant_id', SP.tid()).order('line_no');
        if (L.error || !L.data || L.data.length < 2) throw new Error(t('Original journal lines not found — reverse it in Accounting.', 'Baris jurnal asal tiada — balikkan dalam Perakaunan.'));
        var lines = L.data.map(function (l) { return { account_id: l.account_id, debit: num(l.credit_amt), credit: num(l.debit_amt) }; }).filter(function (l) { return l.debit > 0 || l.credit > 0; });
        var ref = (e.data && e.data.ref_no) || r.journal_entry_id;
        var res = await SP.postJ({ description: ('Reversal of ' + ref + ' — Sales Plan repayment · ' + p.name).slice(0, 200), entryDate: today, entryType: 'manual', lines: lines, sourceTable: 'sales_plan_repayment_reversal', sourceId: r.id });
        if (!res) return false;
        revId = res.id;
      }
    }
    var up = await sb.from('sales_plan_repayments').update(revId ? { reversal_journal_id: revId, reversed_at: now, reversed_by: (window.APP && APP.user && APP.user.id) || null, deleted_at: now } : { deleted_at: now })
      .eq('id', r.id).eq('tenant_id', SP.tid()).eq('plan_id', p.id);
    if (up.error) throw up.error;
    return true;
  };
  var A = SP.actions;
  A['rp-add'] = function (btn) { var b = st.batches.find(function (x) { return SP.same(x.id, btn.getAttribute('data-id')); }); if (b && st.canEdit) SP.repayModal(b); };
  A['rp-del'] = async function (btn) {
    var r = st.repays.find(function (x) { return SP.same(x.id, btn.getAttribute('data-id')); });
    if (!r || !SP.isAdmin() || st.busy) return;
    if (!window.confirm(t('Delete this repayment of ' + SP.money(r.amount, st.plan.currency) + '? A reversal journal dated today will be posted.', 'Padam bayaran ' + SP.money(r.amount, st.plan.currency) + ' ini? Jurnal pembalikan bertarikh hari ini akan disiarkan.'))) return;
    st.busy = true;
    try {
      var ok = await SP.reverseRepay(r); st.busy = false;
      if (ok) { SP.toast(t('Repayment reversed and removed', 'Bayaran dibalikkan dan dibuang'), 'success'); SP.go({ view: 'detail', id: st.plan.id, tab: 'stock' }); }
    } catch (e) { st.busy = false; SP.toast(t('Could not reverse: ', 'Gagal balikkan: ') + SP.errMsg(e), 'error'); }
  };
})();
