/* Sales Plan — phase 2c. Financing journals: shared helpers + funding draw.
   Draw posts Dr Inventory/Bank, Cr Financier Loan via _postJournalEntry (source sales_plan_batches),
   guarded by _journalAlreadyPosted; if the batch update fails the journal is reversed. */
(function () {
  'use strict';
  var SP = window.SP, st = SP.state, t = SP.t, esc = SP.esc, num = SP.num, d10 = SP.d10;
  SP.isMyr = function () { return (st.plan.currency || 'MYR') === 'MYR'; };
  SP.lockedOn = function (date) {
    var lock = typeof getBooksLockDate === 'function' ? getBooksLockDate() : null;
    if (!lock || !date || String(date).slice(0, 10) > lock) return false;
    SP.toast(t('Books are locked through ' + SP.fmtDate(lock) + '. Choose a date after it, or ask the owner to unlock the period.', 'Buku dikunci sehingga ' + SP.fmtDate(lock) + '. Pilih tarikh selepasnya, atau minta pemilik buka kunci tempoh.'), 'error');
    return true;
  };
  SP.acctOpts = function (types, sel) {
    var rows = (st.accounts || []).filter(function (a) { return !types || types.indexOf(a.account_type) >= 0; });
    return '<option value="">' + esc(t('— Select account —', '— Pilih akaun —')) + '</option>' + rows.map(function (a) { return '<option value="' + esc(a.id) + '"' + (SP.same(a.id, sel) ? ' selected' : '') + '>' + esc((a.code ? a.code + ' — ' : '') + (a.name_en || '')) + '</option>'; }).join('');
  };
  SP.jPreview = function (lines, note) {
    return '<div class="sp-jprev"><div class="sp-jprev-h"><i class="ti ti-notebook" aria-hidden="true"></i>' + esc(t('Journal entry (auto)', 'Entri jurnal (auto)')) + (SP.isMyr() ? '' : ' · MYR') + '</div>' +
      lines.filter(function (l) { return num(l.debit) > 0 || num(l.credit) > 0; }).map(function (l) {
        var dr = num(l.debit) > 0;
        return '<div class="sp-jrow' + (dr ? '' : ' sp-jcr') + '"><span class="sp-jdc">' + (dr ? 'Dr' : 'Cr') + '</span><span class="sp-jac">' + esc(SP.acctLabel(l.account_id) || t('(account not set)', '(akaun belum ditetapkan)')) + '</span><b>' + SP.fmtNum(dr ? l.debit : l.credit, 2) + '</b></div>';
      }).join('') + (note ? '<div class="sp-hint">' + esc(note) + '</div>' : '') + '</div>';
  };
  SP.findJournal = async function (table, id) {
    var r = await sb.from('journal_entries').select('id,ref_no').eq('tenant_id', SP.tid()).eq('source_table', table).eq('source_id', id).limit(1);
    return r.data && r.data[0] ? r.data[0] : null;
  };
  SP.postJ = async function (o) {
    if (typeof _postJournalEntry !== 'function') throw new Error(t('Accounting module is not available', 'Modul perakaunan tiada'));
    return _postJournalEntry(o);
  };
  /* post the mirror entry of `lines` (debit<->credit) */
  SP.reverseLines = function (lines) { return lines.map(function (l) { return { account_id: l.account_id, debit: num(l.credit), credit: num(l.debit) }; }).filter(function (l) { return l.debit > 0 || l.credit > 0; }); };
  SP.fxVal = function (ov, id) { if (SP.isMyr()) return 1; var e = ov.querySelector('#' + id), x = e ? Number(String(e.value).replace(/,/g, '')) : NaN; return isFinite(x) && x > 0 ? x : NaN; };
  /* pro-rata split of a repayment against outstanding principal / fee */
  SP.splitRepay = function (amount, outP, outF) {
    amount = SP.r2(amount); outP = SP.r2(outP); outF = SP.r2(outF);
    if (amount >= SP.r2(outP + outF) - 0.004) return { principal: outP, fee: SP.r2(amount - outP) };
    var tot = outP + outF, p = tot > 0 ? SP.r2(amount * outP / tot) : amount;
    return { principal: p, fee: SP.r2(amount - p) };
  };
  /* MYR journal lines; fee takes the rounding remainder so Dr = Cr exactly */
  SP.repayLines = function (o) {
    var fx = o.fx || 1, tM = SP.r2(o.amount * fx), pM = SP.r2(o.principal * fx), fM = SP.r2(tM - pM), p = st.plan;
    return [{ account_id: p.loan_account_id, debit: pM, credit: 0 }, { account_id: p.fee_account_id, debit: fM, credit: 0 }, { account_id: o.bank, debit: 0, credit: tM }].filter(function (l) { return l.debit > 0 || l.credit > 0; });
  };
  /* ---------- funding draw ---------- */
  function drawLines(ov, b) {
    var amt = Number(String(ov.querySelector('#sp-dr-amt').value).replace(/,/g, '')) || 0, fx = SP.fxVal(ov, 'sp-dr-fx'), m = SP.r2(amt * (isFinite(fx) ? fx : 0));
    return { amt: SP.r2(amt), fx: fx, myr: m, lines: [{ account_id: ov.querySelector('#sp-dr-acct').value, debit: m, credit: 0 }, { account_id: st.plan.loan_account_id, debit: 0, credit: m }] };
  }
  function drawPrev(ov, b) { var x = drawLines(ov, b), el = ov.querySelector('#sp-dr-prev'); if (el) el.innerHTML = SP.jPreview(x.lines, SP.isMyr() ? '' : SP.fmtNum(x.amt, 2) + ' ' + st.plan.currency + ' × ' + (isFinite(x.fx) ? x.fx : '?')); }
  SP.drawModal = function (b) {
    var p = st.plan, cur = p.currency, k = SP.batchCalc(SP.ctx(), b);
    var today = SP.todayISO(), date = d10(b.actual_inbound) || today; if (date > today) date = today; var due = SP.addDays(date, num(b.tenure_days));
    var body = '<div class="sp-hint">' + esc(SP.batchName(b) + ' · ' + t('stock cost ', 'kos stok ') + SP.money(k.cost, cur) + ' · ' + num(b.financed_pct) + '% · ' + t('fee ', 'fi ') + num(b.fee_pct) + '%') + '</div>' +
      '<div class="form-row"><div class="form-group"><label class="form-label" for="sp-dr-date">' + esc(t('Drawn date', 'Tarikh dikeluarkan')) + '</label><input id="sp-dr-date" type="date" class="form-input" value="' + esc(date) + '"></div>' +
      '<div class="form-group"><label class="form-label" for="sp-dr-amt">' + esc(t('Principal', 'Prinsipal') + ' (' + SP.curSym(cur) + ')') + '</label><input id="sp-dr-amt" class="form-input" type="number" inputmode="decimal" min="0" step="0.01" value="' + esc(SP.r2(k.principal)) + '"></div></div>' +
      (SP.isMyr() ? '' : '<div class="form-group"><label class="form-label" for="sp-dr-fx">' + esc(t('FX rate: 1 ' + cur + ' = ? MYR', 'Kadar FX: 1 ' + cur + ' = ? MYR')) + '</label><input id="sp-dr-fx" class="form-input" type="number" inputmode="decimal" min="0" step="any" value="' + esc(b.fx_rate_to_myr || '') + '"><div class="sp-hint">' + esc(t('Required — journals are posted in MYR.', 'Wajib — jurnal disiarkan dalam MYR.')) + '</div></div>') +
      '<div class="form-row"><div class="form-group"><label class="form-label" for="sp-dr-acct">' + esc(t('Debit account (Inventory / Bank)', 'Akaun debit (Inventori / Bank)')) + '</label><select id="sp-dr-acct" class="form-select">' + SP.acctOpts(['asset'], b.draw_debit_account_id || p.draw_debit_account_id) + '</select></div>' +
      '<div class="form-group"><label class="form-label" for="sp-dr-due">' + esc(t('Repayment due date', 'Tarikh bayar balik')) + '</label><input id="sp-dr-due" type="date" class="form-input" value="' + esc(due) + '"></div></div>' +
      '<div id="sp-dr-prev"></div>';
    var ov = SP.openModal(t('Draw funding — ', 'Keluarkan pembiayaan — ') + SP.batchName(b), body, t('Post funding', 'Siarkan pembiayaan'), function (o, btn) { SP.postDraw(o, btn, b); }, function (o) { drawPrev(o, b); });
    ov.classList.add('sp-sheet'); drawPrev(ov, b);
  };
  SP.postDraw = async function (ov, btn, b) {
    if (st.busy) return;
    var p = st.plan, x = drawLines(ov, b), date = ov.querySelector('#sp-dr-date').value, due = ov.querySelector('#sp-dr-due').value, acct = ov.querySelector('#sp-dr-acct').value, err = null;
    if (!p.loan_account_id) err = t('Set the Financier Loan account in Settings first.', 'Tetapkan akaun Pinjaman Pembiaya dalam Tetapan dahulu.');
    else if (!acct) err = t('Choose the debit account.', 'Pilih akaun debit.');
    else if (!SP.isoOk(date)) err = t('Enter the drawn date.', 'Masukkan tarikh dikeluarkan.');
    else if (!(x.amt > 0)) err = t('Principal must be more than 0.', 'Prinsipal mesti lebih daripada 0.');
    else if (!isFinite(x.fx)) err = t('Enter the FX rate to MYR.', 'Masukkan kadar FX ke MYR.');
    else if (due && !SP.isoOk(due)) err = t('Check the due date.', 'Semak tarikh bayar balik.');
    if (err) { SP.toast(err, 'error'); return; }
    if (SP.lockedOn(date)) return;
    st.busy = true; btn.disabled = true;
    var done = function () { st.busy = false; btn.disabled = false; };
    try {
      if (typeof _journalAlreadyPosted === 'function' && await _journalAlreadyPosted('sales_plan_batches', b.id)) {
        var ex = await SP.findJournal('sales_plan_batches', b.id), rev = ex ? await SP.findJournal('sales_plan_batch_reversal', ex.id) : null;
        if (ex && !rev) { done(); SP.toast(t('A funding journal (' + (ex.ref_no || ex.id) + ') already exists for this batch. Reverse it in Accounting before drawing again.', 'Jurnal pembiayaan (' + (ex.ref_no || ex.id) + ') sudah wujud untuk batch ini. Balikkan dalam Perakaunan sebelum keluarkan semula.'), 'error'); return; }
      }
      var desc = ('Sales Plan funding drawn — ' + p.name + ' · ' + SP.batchName(b)).slice(0, 200);
      var res = await SP.postJ({ description: desc, entryDate: date, entryType: 'auto', lines: x.lines, sourceTable: 'sales_plan_batches', sourceId: b.id });
      if (!res) { done(); return; }
      var up = await sb.from('sales_plan_batches').update({ drawn_date: date, actual_principal: x.amt, fx_rate_to_myr: SP.isMyr() ? null : x.fx, draw_debit_account_id: acct, draw_journal_id: res.id, due_date: due || null })
        .eq('id', b.id).eq('tenant_id', SP.tid()).eq('plan_id', p.id);
      if (up.error) {
        await SP.postJ({ description: ('Reversal of ' + (res.ref_no || res.id) + ' — ' + desc).slice(0, 200), entryDate: date, entryType: 'manual', lines: SP.reverseLines(x.lines), sourceTable: 'sales_plan_batch_reversal', sourceId: res.id, skipLockCheck: true }).catch(function () {});
        throw up.error;
      }
      st.busy = false; SP.closeModal();
      SP.toast(t('Funding posted', 'Pembiayaan disiarkan') + ' (' + (res.ref_no || '') + ')', 'success');
      SP.go({ view: 'detail', id: p.id, tab: 'stock' });
    } catch (e) { done(); SP.toast(t('Could not post funding: ', 'Gagal siarkan pembiayaan: ') + SP.errMsg(e), 'error'); }
  };
  SP.actions['bt-draw'] = function (btn) { var b = st.batches.find(function (x) { return SP.same(x.id, btn.getAttribute('data-id')); }); if (b && SP.isAdmin()) SP.drawModal(b); };
})();
