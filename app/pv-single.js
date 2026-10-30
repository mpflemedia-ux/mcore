/* Payment Vouchers — single PV detail as cards v1 (loads after pv-core.js / pv-cards.js).
   Overrides renderPVDetail: payee card (payee, bank · account no, amount, chips), inline edit while Draft,
   locked once shared / signed / approved, 4-signature card (PVS kind 'pv'), pay section (paid date, bank ref,
   receipt upload) and sticky Total + Save footer. Approve-without-signatures only for approver roles.
   Also wraps renderPVForm: payee picker on #pv-payee (fills bank / account no), and a locked PV
   can't be opened in the old edit form. */
(function () {
  if (window.PVSG_V1 || !window.PVX || !window.PVC) return;
  window.PVSG_V1 = true;
  var X = window.PVX, C = window.PVC, L = X.L, esc = X.esc, rm = X.rm;
  function $(id) { return document.getElementById(id); }
  var S = null;
  var FIELDS = ['payee_name', 'payee_type', 'payee_id', 'supplier_id', 'amount', 'voucher_date', 'payment_method', 'bank_name', 'bank_account_no', 'phone', 'cheque_no', 'category', 'gl_account_id', 'description'];
  var NEWCOLS = ['payee_id', 'bank_account_no', 'phone', 'category', 'gl_account_id'];

  function ro(label, val, mono, full) {
    return '<div' + (full ? ' class="pvc-full"' : '') + '><div class="pvc-cap">' + esc(label) + '</div><div class="pvc-val' + (mono ? ' pvc-mono' : '') + '">' + (val ? esc(val) : '<span style="color:var(--text-3)">—</span>') + '</div></div>';
  }
  function fld(f, label, val, attrs, full) {
    return '<div class="form-group' + (full ? ' pvc-full' : '') + '"><label class="form-label" for="pvsg-' + f + '">' + esc(label) + '</label>' +
      '<input id="pvsg-' + f + '" class="form-input" data-f="' + f + '" value="' + esc(val == null ? '' : val) + '" ' + (attrs || '') + '></div>';
  }
  function sel(f, label, opts) {
    return '<div class="form-group"><label class="form-label" for="pvsg-' + f + '">' + esc(label) + '</label><select id="pvsg-' + f + '" class="form-select" data-f="' + f + '">' + opts + '</select></div>';
  }
  function editable() { return !X.locked(S.v.status); }
  function glName(id) { var a = (S.accs || []).filter(function (x) { return x.id === id; })[0]; return a ? (a.code ? a.code + ' · ' : '') + (a.name_en || '') : ''; }

  async function renderPVDetail(id) {
    C.css();
    var m = $('main'); if (!m) return;
    m.innerHTML = '<div class="pvc-empty"><div class="spinner"></div></div>';
    var q = await sb.from('payment_vouchers').select('*').eq('id', id).eq('tenant_id', X.tid()).maybeSingle();
    if (!q.data) { m.innerHTML = '<div class="empty-state" style="padding:60px"><p>' + esc(L('Voucher not found.', 'Baucar tidak dijumpai.')) + '</p></div>'; return; }
    var st = { v: q.data, ready: await X.ready(), dirty: false, open: true, accs: [], dup: [], batch: null };
    try { st.accs = await X.accounts(); } catch (e) {}
    if (st.v.batch_id) {
      try { var bq = await sb.from('payment_voucher_batches').select('id,ref_no').eq('id', st.v.batch_id).eq('tenant_id', X.tid()).maybeSingle(); st.batch = bq.data || null; } catch (e) {}
    }
    S = st;
    try { if (typeof _pdocSetPageOrientation === 'function') _pdocSetPageOrientation('portrait'); } catch (e) {}
    draw();
    if (editable()) refreshDup();
    if (X.remindTick) X.remindTick();
  }

  function headHtml(v) {
    var chips = X.stBadge(v.status) + '<span class="badge badge-gray">' + esc(X.methodLabel(v.payment_method)) + '</span>' +
      (v.category ? '<span class="badge badge-blue">' + esc(X.catLabel(v.category)) + '</span>' : '') +
      (v.receipt_path ? '<span class="badge badge-green"><i class="ti ti-paperclip"></i> ' + esc(L('Receipt', 'Resit')) + '</span>' : '');
    return '<div class="pvc-main"><div class="pvc-name">' + esc(v.payee_name || L('New payee', 'Penerima baru')) + '</div>' +
      '<div class="pvc-sub">' + esc(C.bankLine(v) || (v.payment_method === 'Cheque' && v.cheque_no ? L('Cheque ', 'Cek ') + v.cheque_no : L('No bank details', 'Tiada butiran bank'))) + '</div>' +
      '<div class="pvc-chips">' + chips + '</div></div><div class="pvc-amt">' + esc(rm(v.amount)) + '</div><i class="ti ti-chevron-down pvc-chev"></i>';
  }
  function bodyEdit(v) {
    return '<div class="pvc-grid">' +
      '<div class="form-group pvc-full"><label class="form-label" for="pvsg-payee_name">' + esc(L('Payee', 'Penerima')) + ' <span style="color:var(--text-3);font-weight:400">· ' + esc(C.payeeTypeLabel(v.payee_type)) + '</span></label>' +
      '<div class="pvc-field"><input id="pvsg-payee_name" class="form-input" data-f="payee_name" maxlength="160" placeholder="' + esc(L('Search supplier / employee or type a name', 'Cari pembekal / pekerja atau taip nama')) + '" value="' + esc(v.payee_name || '') + '"></div></div>' +
      fld('amount', L('Amount (RM)', 'Jumlah (RM)'), v.amount || '', 'type="number" inputmode="decimal" min="0" step="0.01"') +
      fld('voucher_date', L('Date', 'Tarikh'), v.voucher_date || X.today(), 'type="date"') +
      sel('payment_method', L('Method', 'Kaedah'), C.methodOpts(v.payment_method || 'Bank Transfer')) +
      fld('bank_name', L('Bank', 'Bank'), v.bank_name, 'maxlength="80"') +
      fld('bank_account_no', L('Account no.', 'No. akaun'), v.bank_account_no, 'maxlength="40" inputmode="numeric"') +
      fld('phone', L('Phone', 'Telefon'), v.phone, 'maxlength="30" inputmode="tel"') +
      fld('cheque_no', L('Cheque / ref no.', 'No. cek / rujukan'), v.cheque_no, 'maxlength="40"') +
      sel('category', L('Category', 'Kategori'), C.catOpts(v.category)) +
      sel('gl_account_id', L('GL account', 'Akaun GL'), C.glOpts(v.gl_account_id, S.accs)) +
      '<div class="form-group pvc-full"><label class="form-label" for="pvsg-description">' + esc(L('Description / purpose', 'Keterangan / tujuan')) + '</label><textarea id="pvsg-description" class="form-input" data-f="description" rows="2" maxlength="500">' + esc(v.description || '') + '</textarea></div>' +
      (v.category === 'salary' ? '<div class="pvc-full" style="font-size:11px;color:var(--text-3)">' + esc(L('Salary is already expensed by the payroll journal — paying this posts no second expense.', 'Gaji sudah direkod oleh jurnal gaji — bayaran ini tidak merekod perbelanjaan kedua.')) + '</div>' : '') +
      '</div>';
  }
  function bodyView(v) {
    return '<div class="pvc-grid">' +
      ro(L('Payee', 'Penerima'), (v.payee_name || '') + ' · ' + C.payeeTypeLabel(v.payee_type), false, true) +
      ro(L('Date', 'Tarikh'), X.dmy(v.voucher_date)) + ro(L('Method', 'Kaedah'), X.methodLabel(v.payment_method)) +
      ro(L('Bank', 'Bank'), v.bank_name) + ro(L('Account no.', 'No. akaun'), v.bank_account_no, true) +
      ro(L('Phone', 'Telefon'), v.phone) + ro(L('Cheque / ref no.', 'No. cek / rujukan'), v.cheque_no) +
      ro(L('Category', 'Kategori'), X.catLabel(v.category)) +
      ro(L('GL account', 'Akaun GL'), glName(v.gl_account_id) || (v.category === 'salary' ? L('Payroll journal', 'Jurnal gaji') : L('Default for category', 'Lalai mengikut kategori'))) +
      ro(L('Description', 'Keterangan'), v.description, false, true) + '</div>';
  }
  function payHtml(v) {
    var st = v.status;
    if (['approved', 'paid'].indexOf(st) < 0) return '';
    var h = '<div class="pvc-meta" style="grid-template-columns:minmax(0,1fr)"><div class="pvc-grid">' +
      '<div><div class="pvc-cap">' + esc(L('Payment', 'Bayaran')) + '</div><div class="pvc-val">' + X.payBadge(st === 'paid' ? 'paid' : 'unpaid') + (v.paid_at ? ' ' + esc(X.dmy(v.paid_at)) : '') + '</div></div>' +
      (v.approved_by ? ro(L('Approved by', 'Diluluskan oleh'), v.approved_by) : '') + '</div><div class="pvc-acts">';
    if (st === 'approved') h += '<button type="button" class="btn btn-primary btn-sm" data-h="paid"><i class="ti ti-cash"></i> ' + esc(L('Mark as paid', 'Tanda dibayar')) + '</button>';
    h += '<button type="button" class="btn btn-outline btn-sm" data-h="rcpt"><i class="ti ti-upload"></i> ' + esc(v.receipt_path ? L('Replace receipt', 'Ganti resit') : L('Upload receipt', 'Muat naik resit')) + '</button>' +
      (v.receipt_path ? '<button type="button" class="btn btn-outline btn-sm" data-h="vrcpt"><i class="ti ti-eye"></i> ' + esc(L('View receipt', 'Lihat resit')) + '</button>' : '') + '</div></div>';
    return h;
  }

  function draw() {
    var m = $('main'); if (!m || !S) return;
    var v = S.v, st = v.status || 'draft', ed = editable();
    var acts = '<button type="button" class="btn btn-outline btn-sm" data-h="print"><i class="ti ti-printer"></i> ' + esc(L('Print', 'Cetak')) + '</button>' +
      '<button type="button" class="btn btn-outline btn-sm" data-h="pdf"><i class="ti ti-file-type-pdf"></i> PDF</button>' +
      '<button type="button" class="btn btn-outline btn-sm" data-h="wa"><i class="ti ti-brand-whatsapp"></i> ' + esc(L('Share PDF', 'Kongsi PDF')) + '</button>' +
      (typeof window._pvShareEmail === 'function' ? '<button type="button" class="btn btn-outline btn-sm" data-h="email"><i class="ti ti-mail"></i> ' + esc(L('Email', 'E-mel')) + '</button>' : '');
    if (st === 'draft' && v.bill_id !== undefined) acts += '<button type="button" class="btn btn-outline btn-sm" data-h="form"><i class="ti ti-link"></i> ' + esc(L('Bill link', 'Link bil')) + '</button>';
    if (['draft', 'shared', 'pending'].indexOf(st) >= 0 && X.isApprover()) acts += '<button type="button" class="btn btn-outline btn-sm" data-h="approve"><i class="ti ti-check"></i> ' + esc(L('Approve now', 'Luluskan terus')) + '</button>';
    if (st === 'draft') acts += '<button type="button" class="btn btn-outline btn-sm pvc-danger" data-h="del"><i class="ti ti-trash"></i> ' + esc(L('Delete', 'Padam')) + '</button>';
    if ((st !== 'void' && st !== 'paid') || (st === 'paid' && X.canVoidPaid())) acts += '<button type="button" class="btn btn-outline btn-sm pvc-danger" data-h="void"><i class="ti ti-ban"></i> ' + esc(L('Void', 'Batalkan')) + '</button>';
    var lock = ed ? '' : '<div class="pvc-note pvc-lock"><i class="ti ti-lock"></i><div>' + esc(
      st === 'paid' ? L('Paid — locked.', 'Dibayar — dikunci.') :
      st === 'void' ? L('Void — locked.', 'Batal — dikunci.') :
      st === 'approved' ? L('Approved — amount locked. Mark it paid when the money goes out.', 'Diluluskan — jumlah dikunci. Tanda dibayar apabila wang dikeluarkan.') :
      L('Shared for signing — amount locked. Reset signatures to edit.', 'Dikongsi untuk tandatangan — jumlah dikunci. Set semula tandatangan untuk edit.')) + '</div></div>';
    var links = [];
    if (S.batch) links.push('<a href="javascript:void(0)" style="color:var(--primary)" data-h="batch"><i class="ti ti-stack-2"></i> ' + esc(L('From ', 'Dari ') + (S.batch.ref_no || 'PVD')) + '</a>');
    if (v.bill_id) links.push('<a href="javascript:void(0)" style="color:var(--primary)" data-h="bill"><i class="ti ti-file-invoice"></i> ' + esc(L('Supplier bill linked', 'Bil pembekal dilink')) + '</a>');
    m.innerHTML =
      '<div class="pvc-page" id="pvsg-root">' +
      '<div class="page-header no-print"><div><div class="page-title">' + esc(v.ref_no || 'PV') + '</div>' +
      '<button type="button" class="btn btn-outline btn-sm" style="margin-top:6px;white-space:nowrap" data-h="back"><i class="ti ti-arrow-left"></i> ' + esc(L('Payment Vouchers', 'Baucar Bayaran')) + '</button></div>' +
      '<div class="pvc-hacts">' + acts + '</div></div>' +
      (S.ready ? '' : '<div class="pvc-note pvc-warn"><i class="ti ti-database"></i><div>' + esc(L('Signatures and payee details need supabase/pv_revamp_01.sql.', 'Tandatangan dan butiran penerima perlukan supabase/pv_revamp_01.sql.')) + '</div></div>') +
      lock + '<div class="pvc-mrow" style="margin:0 0 10px">' + X.stBadge(st) + '<span id="pvc-sigprog"></span>' + links.join('') + '</div>' +
      '<div id="pvc-dupbox">' + C.dupHtml(S.dup) + '</div>' +
      '<div class="pvc-wrap"><div class="pvc-card' + (S.open ? ' pvc-open' : '') + '" style="grid-column:1/-1"><button type="button" class="pvc-head" data-h="tog" aria-expanded="' + (S.open ? 'true' : 'false') + '">' + headHtml(v) + '</button>' +
      '<div class="pvc-body">' + (S.open ? (ed ? bodyEdit(v) : bodyView(v)) : '') + '</div></div></div>' +
      payHtml(v) + '<div id="pvs-slot"></div><div class="pvc-err" id="pvc-err" role="alert"></div></div>' +
      '<div class="pvc-bar no-print' + (S.dirty ? ' pvc-dirty' : '') + '" id="pvc-bar"><div class="pvc-tot"><span>' + esc(L('Amount', 'Jumlah')) + '</span><b id="pvc-tot">' + esc(rm(v.amount)) + '</b></div>' +
      '<div class="pvc-bacts"><span class="pvc-unsaved">' + esc(L('Unsaved changes', 'Perubahan belum disimpan')) + '</span>' +
      (ed ? '<button type="button" class="btn btn-primary" data-h="save"><i class="ti ti-device-floppy"></i> ' + esc(L('Save', 'Simpan')) + '</button>' : '') + '</div></div>';
    bind();
    if (S.ready && window.PVS) {
      PVS.mount($('pvs-slot'), { kind: 'pv', id: v.id, amount: Number(v.amount) || 0, status: st, ref: v.ref_no, title: v.payee_name,
        beforeShare: async function () { if (S.dirty) { var ok = await save(true); if (!ok) throw new Error(L('Save first.', 'Simpan dahulu.')); } return true; },
        onChange: function () { renderPVDetail(v.id); },
        onProgress: function (n, need) { var p = $('pvc-sigprog'); if (p) p.innerHTML = '<span class="badge ' + (n >= need ? 'badge-green' : 'badge-yellow') + '"><i class="ti ti-signature"></i> ' + esc(n + '/' + need + ' ' + L('signed', 'ditandatangani')) + '</span>'; } });
    }
  }

  function setDirty() { S.dirty = true; var b = $('pvc-bar'); if (b) b.classList.add('pvc-dirty'); }
  function refreshHead() { var h = document.querySelector('#pvsg-root .pvc-head'); if (h) h.innerHTML = headHtml(S.v); var t = $('pvc-tot'); if (t) t.textContent = rm(S.v.amount); }
  var dupT = null;
  function refreshDup() { clearTimeout(dupT); dupT = setTimeout(async function () {
    if (!S) return;
    var hits = await C.dupCheck({ lines: [S.v], date: S.v.voucher_date, pvId: S.v.id, batchId: S.v.batch_id });
    S.dup = hits; var b = $('pvc-dupbox'); if (b) b.innerHTML = C.dupHtml(hits);
  }, 400); }

  function bind() {
    var root = $('pvsg-root'), bar = $('pvc-bar');
    var click = function (e) {
      var b = e.target.closest('[data-h]'); if (!b) return;
      var k = b.getAttribute('data-h'), v = S.v;
      if (k === 'back') { if (S.dirty && !confirm(L('Discard unsaved changes?', 'Buang perubahan belum disimpan?'))) return; return openPage('vouchers', {}); }
      if (k === 'tog') { S.open = !S.open; return draw(); }
      if (k === 'save') return save(false);
      if (k === 'print' && window.PVP) return PVP.print('pv', v.id);
      if (k === 'pdf' && window.PVP) return PVP.pdf('pv', v.id, { download: true });
      if (k === 'wa' && window.PVP) return PVP.sharePdf('pv', v.id);
      if (k === 'email') return _pvShareEmail(v.id);
      if (k === 'form') return openPage('vouchers', { view: 'pv-form', id: v.id });
      if (k === 'batch' && S.batch) return openPage('vouchers', { view: 'pvd-detail', id: S.batch.id });
      if (k === 'bill') return openPage('purchasing', { view: 'bill-detail', id: v.bill_id });
      if (k === 'del') return _pvSoftDelete(v.id);
      if (k === 'void') return _pvSetStatus(v.id, 'void');
      if (k === 'approve') {
        if (S.dirty) return X.toast(L('Save first.', 'Simpan dahulu.'), 'error');
        if (!confirm(L('Approve this voucher now without collecting the signatures?', 'Luluskan baucar ini sekarang tanpa mengumpul tandatangan?'))) return;
        return _pvSetStatus(v.id, 'approved');
      }
      if (k === 'paid') return pay();
      if (k === 'rcpt') return C.uploadReceipt({ pvId: v.id, done: function () { renderPVDetail(v.id); } });
      if (k === 'vrcpt') return C.viewFile(v.receipt_path);
    };
    root.addEventListener('click', click); bar.addEventListener('click', click);
    root.addEventListener('input', onEdit); root.addEventListener('change', onEdit);
    var p = $('pvsg-payee_name');
    if (p) C.attachPicker(p, function (x) {
      var v = S.v;
      v.payee_name = x.name; v.payee_type = x.type || 'other'; v.payee_id = x.id || null;
      v.supplier_id = x.type === 'supplier' ? x.id : null;
      if (!x.free) {
        if (x.bank_name) v.bank_name = x.bank_name;
        if (x.bank_account_no) v.bank_account_no = x.bank_account_no;
        if (x.phone) v.phone = x.phone;
        if (!v.category) v.category = x.type === 'supplier' ? 'supplier' : 'other';
      }
      setDirty(); draw(); refreshDup();
    });
  }
  function onEdit(e) {
    var t = e.target, f = t && t.getAttribute && t.getAttribute('data-f'); if (!f || !editable()) return;
    var v = S.v, val = t.value;
    if (f === 'amount') v.amount = Number(val) || 0;
    else if (f === 'gl_account_id' || f === 'category') v[f] = val || null;
    else v[f] = val;
    if (f === 'payee_name' && e.type === 'input') { v.payee_type = 'other'; v.payee_id = null; v.supplier_id = null; }
    setDirty(); refreshHead();
    if (f === 'category' && e.type === 'change') draw();
    if (f === 'amount' || f === 'payee_name' || f === 'voucher_date') refreshDup();
  }

  async function save(quiet) {
    var v = S.v, er = $('pvc-err');
    var fail = function (m) { if (er) er.textContent = m; X.toast(m, 'error'); return false; };
    if (er) er.textContent = '';
    if (!String(v.payee_name || '').trim()) return fail(L('Payee name is required.', 'Nama penerima diperlukan.'));
    if (!(Number(v.amount) > 0)) return fail(L('Amount must be greater than 0.', 'Jumlah mesti lebih daripada 0.'));
    var cur = await sb.from('payment_vouchers').select('status').eq('id', v.id).eq('tenant_id', X.tid()).maybeSingle();
    if (cur.data && X.locked(cur.data.status)) { S.dirty = false; X.toast(L('This voucher is locked (shared or signed). Reloading.', 'Baucar ini dikunci (dikongsi atau ditandatangani). Memuat semula.'), 'error'); renderPVDetail(v.id); return false; }
    if (!quiet && S.dup.length && !confirm(L('Possible duplicate payment this month. Save anyway?', 'Kemungkinan bayaran berganda bulan ini. Simpan juga?'))) return false;
    var row = { updated_at: new Date().toISOString() };
    FIELDS.forEach(function (k) { if (v[k] !== undefined) row[k] = v[k] === '' ? null : v[k]; });
    row.payee_name = String(v.payee_name).trim(); row.amount = X.r2(v.amount);
    row.payee_type = row.payee_type || 'other';
    row.voucher_date = row.voucher_date || X.today();
    var r = await sb.from('payment_vouchers').update(row).eq('id', v.id).eq('tenant_id', X.tid()).eq('status', 'draft');
    if (r.error && /column/i.test(r.error.message || '')) { NEWCOLS.forEach(function (k) { delete row[k]; }); if (row.payee_type === 'employee') row.payee_type = 'other'; r = await sb.from('payment_vouchers').update(row).eq('id', v.id).eq('tenant_id', X.tid()).eq('status', 'draft'); }
    if (r.error) return fail(L('Could not save: ', 'Gagal simpan: ') + X.errMsg(r.error));
    try { auditLog('update', 'payment_vouchers', v.id); } catch (e) {}
    S.dirty = false;
    if (!quiet) { X.toast(L('Voucher saved.', 'Baucar disimpan.'), 'success'); renderPVDetail(v.id); }
    else { var b = $('pvc-bar'); if (b) b.classList.remove('pvc-dirty'); }
    return true;
  }

  async function pay() {
    var p = await C.askPay(L('Mark paid: ', 'Tanda dibayar: ') + (S.v.payee_name || ''));
    if (!p) return;
    await X.markPaid(S.v.id, { paidDate: p.date, ref: p.ref });
  }

  window.renderPVDetail = renderPVDetail;
  window.PVSG = { render: renderPVDetail, state: function () { return S; } };

  /* old full form (still used for New + bill link): payee picker + lock guard */
  var oldForm = window.renderPVForm;
  if (typeof oldForm === 'function' && !oldForm._pvsg) {
    var f = async function (id) {
      if (id) {
        var q = await sb.from('payment_vouchers').select('status').eq('id', id).eq('tenant_id', X.tid()).maybeSingle();
        if (q.data && X.locked(q.data.status)) {
          X.toast(L('This voucher is locked (shared, signed or approved).', 'Baucar ini dikunci (dikongsi, ditandatangani atau diluluskan).'), 'error');
          return renderPVDetail(id);
        }
      }
      var r = await oldForm.apply(this, arguments);
      var inp = $('pv-payee');
      if (inp) C.attachPicker(inp, function (p) {
        if (p.free) return;
        var bk = $('pv-bank'), ac = $('pv-bank-acc');
        if (bk && p.bank_name) bk.value = p.bank_name;
        if (ac && p.bank_account_no) ac.value = p.bank_account_no;
      });
      return r;
    };
    f._pvsg = true; window.renderPVForm = f;
  }
})();
