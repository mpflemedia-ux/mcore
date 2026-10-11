/* Sales Plan — phase 2c. Batch form: Owner/Admin full CRUD (soft delete, only before funding),
   PIC updates stock actuals only. Financing terms lock once funding is drawn. */
(function () {
  'use strict';
  var SP = window.SP, st = SP.state, t = SP.t, esc = SP.esc, num = SP.num, d10 = SP.d10;
  function fg(id, label, html, hint) { return '<div class="form-group" id="' + id + '-g"><label class="form-label" for="' + id + '">' + esc(label) + '</label>' + html + (hint ? '<div class="sp-hint">' + esc(hint) + '</div>' : '') + '</div>'; }
  function nIn(id, v, dis, step) { return '<input id="' + id + '" class="form-input" type="number" inputmode="decimal" min="0" step="' + (step || 'any') + '" value="' + esc(v == null ? '' : v) + '"' + (dis ? ' disabled' : '') + '>'; }
  function dIn(id, v, dis) { return '<input id="' + id + '" class="form-input" type="date" value="' + esc(d10(v) || '') + '"' + (dis ? ' disabled' : '') + '>'; }
  function tIn(id, v, extra) { return '<input id="' + id + '" class="form-input" data-no-titlecase="1" value="' + esc(v == null ? '' : v) + '"' + (extra || '') + '>'; }
  function row2(a, b) { return '<div class="form-row">' + a + b + '</div>'; }
  SP.parseMix = function (s) {
    return String(s || '').split(/\n|;|\+|·/).map(function (x) { return x.trim(); }).filter(Boolean).map(function (x) {
      var m = /^([\d][\d,.]*)\s*(?:×|x|X|\*)?\s*(.+)$/.exec(x);
      return m ? { product_id: null, name: m[2].trim(), qty: Number(m[1].replace(/,/g, '')) || 0 } : { product_id: null, name: x, qty: null };
    });
  };
  function mixStr(b) { return (Array.isArray(b.product_mix) ? b.product_mix : []).map(function (x) { return (x.qty != null && x.qty !== '' ? x.qty + ' × ' : '') + (x.name || ''); }).join('\n'); }
  function nextCode() { var used = st.batches.map(function (b) { return String(b.code).toUpperCase(); }); for (var i = 0; i < 26; i++) { var c = String.fromCharCode(65 + i); if (used.indexOf(c) < 0) return c; } return 'B' + (st.batches.length + 1); }
  SP.batchModal = function (b) {
    var admin = SP.isAdmin(), isNew = !b, p = st.plan;
    b = b || { code: nextCode(), financed_pct: p.financing_enabled ? p.financed_pct : 0, fee_pct: p.financing_enabled ? p.fee_pct : 0, tenure_days: p.tenure_days, product_mix: [] };
    var drawn = b.actual_principal != null && b.actual_principal !== '', lockFin = drawn || !admin;
    var body = '';
    if (admin) {
      body += row2(fg('sp-bt-code', t('Batch code', 'Kod batch'), tIn('sp-bt-code', b.code, ' maxlength="12"')), fg('sp-bt-label', t('Label', 'Label'), tIn('sp-bt-label', b.label, ' maxlength="60" placeholder="Batch ' + esc(b.code) + '"'))) +
        fg('sp-bt-mix', t('Product mix', 'Campuran produk'), '<textarea id="sp-bt-mix" class="form-input" rows="2" data-no-titlecase="1" placeholder="3000 × Shampoo">' + esc(mixStr(b)) + '</textarea>', t('One per line: quantity × product', 'Satu setiap baris: kuantiti × produk')) +
        row2(fg('sp-bt-tin', t('Target inbound', 'Sasaran masuk'), dIn('sp-bt-tin', b.target_inbound)), fg('sp-bt-tqty', t('Target qty', 'Sasaran kuantiti'), nIn('sp-bt-tqty', b.target_qty))) +
        row2(fg('sp-bt-tcost', t('Target stock cost', 'Sasaran kos stok') + ' (' + SP.curSym(p.currency) + ')', nIn('sp-bt-tcost', b.target_cost)), fg('sp-bt-tdue', t('Target repayment date', 'Sasaran tarikh bayar'), dIn('sp-bt-tdue', b.target_due_date))) +
        '<div class="sp-sub">' + esc(t('Financing', 'Pembiayaan')) + '</div>' +
        row2(fg('sp-bt-fin', t('Financed %', 'Dibiayai %'), nIn('sp-bt-fin', b.financed_pct, lockFin), t('0 = self-funded', '0 = modal sendiri')), fg('sp-bt-fee', t('Fee %', 'Fi %'), nIn('sp-bt-fee', b.fee_pct, lockFin))) +
        row2(fg('sp-bt-ten', t('Tenure (days)', 'Tempoh (hari)'), nIn('sp-bt-ten', b.tenure_days, lockFin, '1')), drawn ? fg('sp-bt-due', t('Repayment due date', 'Tarikh bayar balik'), dIn('sp-bt-due', b.due_date)) : '') +
        (drawn ? '<div class="sp-note"><i class="ti ti-lock"></i><span>' + esc(t('Funding is drawn and posted — financing terms are locked.', 'Pembiayaan telah dikeluarkan dan disiarkan — terma pembiayaan dikunci.')) + '</span></div>' : '');
    } else {
      body += '<div class="sp-note"><i class="ti ti-packages"></i><span><b>' + esc(SP.batchName(b)) + '</b>' + (SP.mixText(b) ? '<br>' + esc(SP.mixText(b)) : '') + '</span></div>';
    }
    body += '<div class="sp-sub">' + esc(t('Stock actuals', 'Stok sebenar')) + '</div>' +
      row2(fg('sp-bt-ain', t('Actual inbound', 'Tarikh masuk sebenar'), dIn('sp-bt-ain', b.actual_inbound)), fg('sp-bt-aqty', t('Actual qty', 'Kuantiti sebenar'), nIn('sp-bt-aqty', b.actual_qty))) +
      row2(fg('sp-bt-acost', t('Actual stock cost', 'Kos stok sebenar'), nIn('sp-bt-acost', b.actual_cost)), fg('sp-bt-sold', t('Units sold', 'Unit terjual'), nIn('sp-bt-sold', b.units_sold))) +
      fg('sp-bt-notes', t('Notes', 'Nota'), '<textarea id="sp-bt-notes" class="form-input" rows="2" maxlength="500" data-no-titlecase="1">' + esc(b.notes || '') + '</textarea>');
    SP.openModal(isNew ? t('Add batch', 'Tambah batch') : t('Edit ', 'Ubah ') + SP.batchName(b), body, t('Save', 'Simpan'), function (o, btn) { SP.batchSave(o, btn, isNew ? null : b); });
  };
  function v(ov, id) { var e = ov.querySelector('#' + id); return e ? String(e.value == null ? '' : e.value).trim() : ''; }
  function n(ov, id) { var s = v(ov, id).replace(/,/g, ''); if (s === '') return null; var x = Number(s); return isFinite(x) && x >= 0 ? SP.r2(x) : NaN; }
  SP.batchSave = async function (ov, btn, b) {
    if (st.busy) return;
    var admin = SP.isAdmin(), row = {}, err = null, drawn = b && b.actual_principal != null && b.actual_principal !== '';
    var act = { actual_inbound: v(ov, 'sp-bt-ain') || null, actual_qty: n(ov, 'sp-bt-aqty'), actual_cost: n(ov, 'sp-bt-acost'), units_sold: n(ov, 'sp-bt-sold'), notes: v(ov, 'sp-bt-notes') || null };
    if ([act.actual_qty, act.actual_cost, act.units_sold].some(Number.isNaN)) err = t('Use numbers of 0 or more', 'Guna nombor 0 atau lebih');
    if (admin && !err) {
      var code = v(ov, 'sp-bt-code').toUpperCase();
      row = { code: code, label: v(ov, 'sp-bt-label') || null, product_mix: SP.parseMix(v(ov, 'sp-bt-mix')), target_inbound: v(ov, 'sp-bt-tin') || null, target_qty: n(ov, 'sp-bt-tqty'), target_cost: n(ov, 'sp-bt-tcost'), target_due_date: v(ov, 'sp-bt-tdue') || null };
      if (!drawn) { row.financed_pct = n(ov, 'sp-bt-fin') || 0; row.fee_pct = n(ov, 'sp-bt-fee') || 0; row.tenure_days = Math.round(n(ov, 'sp-bt-ten') || 0); }
      else row.due_date = v(ov, 'sp-bt-due') || null;
      if (!code) err = t('Batch code is required', 'Kod batch diperlukan');
      else if (st.batches.some(function (x) { return String(x.code).toUpperCase() === code && (!b || !SP.same(x.id, b.id)); })) err = t('Batch ' + code + ' already exists in this plan', 'Batch ' + code + ' sudah wujud dalam pelan ini');
      else if ([row.target_qty, row.target_cost, row.financed_pct, row.fee_pct, row.tenure_days].some(Number.isNaN)) err = t('Use numbers of 0 or more', 'Guna nombor 0 atau lebih');
      else if (!drawn && (row.financed_pct > 100 || row.fee_pct > 100)) err = t('Financed % and fee % must be 0–100', 'Dibiayai % dan fi % mesti 0–100');
      else if (!drawn && row.tenure_days > 3650) err = t('Tenure must be 3650 days or less', 'Tempoh mesti 3650 hari atau kurang');
      else if (row.financed_pct > 0 && !row.target_cost) err = t('Enter the target stock cost for a financed batch', 'Masukkan sasaran kos stok untuk batch berpembiayaan');
    }
    if (err) { SP.toast(err, 'error'); return; }
    Object.assign(row, act);
    st.busy = true; btn.disabled = true;
    try {
      var res = b ? await sb.from('sales_plan_batches').update(row).eq('id', b.id).eq('tenant_id', SP.tid()).eq('plan_id', st.plan.id)
        : await sb.from('sales_plan_batches').insert(Object.assign(row, { id: SP.uuid(), tenant_id: SP.tid(), plan_id: st.plan.id, sort_order: st.batches.length }));
      if (res.error) throw res.error;
      st.busy = false; SP.closeModal(); SP.toast(t('Batch saved', 'Batch disimpan'), 'success');
      SP.go({ view: 'detail', id: st.plan.id, tab: 'stock' });
    } catch (e) { st.busy = false; btn.disabled = false; SP.toast(t('Save failed: ', 'Gagal simpan: ') + SP.errMsg(e), 'error'); }
  };
  var A = SP.actions;
  function find(btn) { return st.batches.find(function (x) { return SP.same(x.id, btn.getAttribute('data-id')); }); }
  A['bt-add'] = function () { if (SP.isAdmin()) SP.batchModal(null); };
  A['bt-edit'] = function (btn) { var b = find(btn); if (b && st.canEdit) SP.batchModal(b); };
  A['bt-del'] = async function (btn) {
    var b = find(btn); if (!b || !SP.isAdmin() || st.busy) return;
    var c = SP.ctx(), k = SP.batchCalc(c, b);
    if (k.drawn || k.repays.length) { SP.toast(t('Funding was drawn for this batch — it cannot be deleted.', 'Pembiayaan telah dikeluarkan untuk batch ini — tidak boleh dipadam.'), 'error'); return; }
    if (st.miles.some(function (m) { return SP.same(m.link_batch_id, b.id); }) && !window.confirm(t('A milestone is linked to this batch. Delete anyway?', 'Ada milestone dipaut ke batch ini. Padam juga?'))) return;
    if (!window.confirm(t('Delete ' + SP.batchName(b) + '?', 'Padam ' + SP.batchName(b) + '?'))) return;
    st.busy = true;
    try {
      var res = await sb.from('sales_plan_batches').update({ deleted_at: new Date().toISOString() }).eq('id', b.id).eq('tenant_id', SP.tid()).eq('plan_id', st.plan.id);
      if (res.error) throw res.error;
      st.busy = false; SP.toast(t('Batch deleted', 'Batch dipadam'), 'success'); SP.go({ view: 'detail', id: st.plan.id, tab: 'stock' });
    } catch (e) { st.busy = false; SP.toast(SP.errMsg(e), 'error'); }
  };
})();
