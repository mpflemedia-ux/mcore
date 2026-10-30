/* Payment Vouchers — tools v1 (loads after pv-core.js / pv-cards.js).
   PVT.importSD()        approved Salary Disbursement -> new PVD draft (rpc pv_import_sd; one PVD per SD batch)
   PVT.settingsSheet()   signature threshold + count, reminder hours, bank CSV layouts (pv_settings)
   PVT.duplicate(id)     copy a PVD as a new draft "(copy)" — payees/amounts/methods, no pay status / signatures
   PVT.bankCsv(b, lines) bulk payment CSV (Public Bank / RHB default layouts, configurable per tenant)
   Bank layouts are an assumption of the common "bulk payment upload" columns; each tenant can edit them in Settings. */
(function () {
  if (window.PVT || !window.PVX) return;
  var X = window.PVX, L = X.L, esc = X.esc;
  var T = window.PVT = {};
  function $(id) { return document.getElementById(id); }
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function modal(id, title, body, foot, wide) {
    var old = $(id); if (old) old.remove();
    var ov = document.createElement('div');
    ov.id = id; ov.className = 'modal-overlay active';
    ov.innerHTML = '<div class="modal-box" style="max-width:' + (wide ? 560 : 460) + 'px" role="dialog" aria-modal="true" aria-labelledby="' + id + '-t">' +
      '<div class="modal-box-header" id="' + id + '-t">' + title + '</div><div class="modal-box-body">' + body + '</div>' +
      '<div class="modal-box-footer" style="flex-wrap:wrap">' + foot + '</div></div>';
    ov.addEventListener('click', function (e) { if (e.target === ov || (e.target.closest && e.target.closest('[data-x]'))) ov.remove(); });
    document.body.appendChild(ov);
    return ov;
  }
  function css() {
    if ($('pvt-css')) return;
    var s = document.createElement('style'); s.id = 'pvt-css';
    s.textContent =
      '.pvt-list{display:flex;flex-direction:column;gap:8px;max-height:55vh;overflow:auto}' +
      '.pvt-item{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px;background:var(--bg-card);color:var(--text);text-align:left;cursor:pointer;width:100%;font:inherit}' +
      '.pvt-item:hover{border-color:var(--primary)}.pvt-item[disabled]{opacity:.6;cursor:default}' +
      '.pvt-in{flex:1 1 160px;min-width:0}.pvt-n{font-weight:600;font-size:13px}.pvt-s{font-size:11px;color:var(--text-3)}' +
      '.pvt-amt{font-weight:700;font-size:13px;white-space:nowrap}' +
      '.pvt-g{display:grid;grid-template-columns:minmax(0,1fr);gap:10px}@media(min-width:520px){.pvt-g{grid-template-columns:repeat(3,minmax(0,1fr))}}' +
      '.pvt-h{font-size:11px;color:var(--text-3);margin-top:4px}' +
      '.pvt-ta{width:100%;min-height:160px;font-family:monospace;font-size:11px}' +
      '.pvt-err{font-size:12px;color:var(--danger)}.pvt-err:empty{display:none}' +
      '.modal-box-footer .btn{white-space:nowrap}';
    document.head.appendChild(s);
  }

  /* ---------- import from Salary Disbursement ---------- */
  T.importSD = async function () {
    css();
    if (!(await X.ready())) { X.toast(L('Run supabase/pv_revamp_01.sql first.', 'Jalankan supabase/pv_revamp_01.sql dahulu.'), 'error'); return; }
    var ov = modal('pvt-sd', '<i class="ti ti-file-import"></i> ' + esc(L('Import from Salary Disbursement', 'Import dari Penyaluran Gaji')),
      '<div class="pvt-h" style="margin:0 0 8px">' + esc(L('Approved salary disbursements only. Each one makes a single PVD draft (employees as payees, net pay, category Salary) — the expense stays with payroll.', 'Penyaluran gaji yang diluluskan sahaja. Setiap satu menjadi satu draf PVD (pekerja sebagai penerima, gaji bersih, kategori Gaji) — perbelanjaan kekal dengan gaji.')) + '</div>' +
      '<div class="pvt-list" id="pvt-sd-l"><div class="spinner" style="margin:16px auto"></div></div><div class="pvt-err" id="pvt-sd-e"></div>',
      '<button type="button" class="btn btn-outline" data-x>' + esc(L('Close', 'Tutup')) + '</button>');
    var q = await sb.from('salary_disbursement_batches').select('id,month,year,total_net_pay,employee_count,status,ref_no').eq('tenant_id', X.tid()).eq('status', 'approved').is('deleted_at', null).order('year', { ascending: false }).order('month', { ascending: false }).limit(24);
    if (q.error && /ref_no/.test(q.error.message || '')) q = await sb.from('salary_disbursement_batches').select('id,month,year,total_net_pay,employee_count,status').eq('tenant_id', X.tid()).eq('status', 'approved').is('deleted_at', null).order('year', { ascending: false }).order('month', { ascending: false }).limit(24);
    var rows = (q && q.data) || [];
    var done = {};
    if (rows.length) {
      var ex = await sb.from('payment_voucher_batches').select('id,source_ref,ref_no').eq('tenant_id', X.tid()).eq('source', 'sd').is('deleted_at', null).in('source_ref', rows.map(function (r) { return r.id; }));
      ((ex && ex.data) || []).forEach(function (b) { done[b.source_ref] = b; });
    }
    var el = $('pvt-sd-l'); if (!el) return;
    el.innerHTML = rows.length ? rows.map(function (r) {
      var d = done[r.id];
      return '<button type="button" class="pvt-item" data-id="' + esc(r.id) + '"><div class="pvt-in"><div class="pvt-n">' + esc(L('Salary ', 'Gaji ') + (MON[(r.month || 1) - 1] || '') + ' ' + r.year) + (r.ref_no ? ' · ' + esc(r.ref_no) : '') + '</div>' +
        '<div class="pvt-s">' + esc((r.employee_count || 0) + ' ' + L('employees', 'pekerja')) + (d ? ' · ' + esc(L('Already imported', 'Sudah diimport') + ' ' + (d.ref_no || '')) : '') + '</div></div>' +
        '<span class="pvt-amt">' + esc(X.rm(r.total_net_pay)) + '</span>' +
        '<span class="badge ' + (d ? 'badge-blue' : 'badge-green') + '">' + esc(d ? L('Open', 'Buka') : L('Import', 'Import')) + '</span></button>';
    }).join('') : '<div class="pvt-s" style="padding:16px;text-align:center">' + esc(L('No approved salary disbursements yet.', 'Tiada penyaluran gaji yang diluluskan lagi.')) + '</div>';
    el.onclick = async function (e) {
      var b = e.target.closest('.pvt-item'); if (!b || b.disabled) return;
      var id = b.getAttribute('data-id');
      if (done[id]) { ov.remove(); openPage('vouchers', { view: 'pvd-detail', id: done[id].id }); return; }
      b.disabled = true;
      var r = await sb.rpc('pv_import_sd', { p_sd_batch: id });
      if (r.error) { b.disabled = false; $('pvt-sd-e').textContent = L('Import failed: ', 'Import gagal: ') + X.errMsg(r.error); return; }
      var res = r.data || {};
      try { auditLog('create', 'payment_voucher_batches', res.id, null, { source: 'sd', source_ref: id }); } catch (x) {}
      X.toast(res.existing ? L('Already imported — opening it.', 'Sudah diimport — membukanya.') : L('Imported ' + (res.lines || 0) + ' employee(s) as a draft.', (res.lines || 0) + ' pekerja diimport sebagai draf.'), 'success');
      ov.remove();
      openPage('vouchers', { view: 'pvd-detail', id: res.id });
    };
  };

  /* ---------- bank CSV layouts ---------- */
  // f = field: payee_name | bank_name | bank_code | bank_account_no | amount | ref | description | phone | email | payee_id_no | blank
  var DEF_FORMATS = {
    pbb: {
      label: 'Public Bank (PBe bulk payment)', delimiter: ',', header: true, amount_decimals: 2,
      cols: [
        { h: 'Beneficiary Name', f: 'payee_name', max: 40 },
        { h: 'Beneficiary Bank', f: 'bank_name', max: 40 },
        { h: 'Beneficiary Account No', f: 'bank_account_no', max: 20, digits: true },
        { h: 'Amount', f: 'amount' },
        { h: 'Payment Reference', f: 'ref', max: 20 },
        { h: 'Payment Description', f: 'description', max: 40 },
        { h: 'Beneficiary Mobile No', f: 'phone', max: 15, digits: true }
      ]
    },
    rhb: {
      label: 'RHB (Reflex bulk payment)', delimiter: ',', header: true, amount_decimals: 2,
      cols: [
        { h: 'Payee Name', f: 'payee_name', max: 40 },
        { h: 'Payee Account Number', f: 'bank_account_no', max: 20, digits: true },
        { h: 'Payee Bank', f: 'bank_name', max: 40 },
        { h: 'Payment Amount', f: 'amount' },
        { h: 'Recipient Reference', f: 'ref', max: 20 },
        { h: 'Other Payment Details', f: 'description', max: 40 },
        { h: 'Payee Mobile', f: 'phone', max: 15, digits: true }
      ]
    }
  };
  T.DEF_FORMATS = DEF_FORMATS;
  function formats(set) {
    var f = Object.assign({}, DEF_FORMATS);
    var cust = (set && set.bank_formats) || {};
    Object.keys(cust).forEach(function (k) { if (cust[k] && Array.isArray(cust[k].cols) && cust[k].cols.length) f[k] = cust[k]; });
    return f;
  }
  function cell(v, d) {
    v = v == null ? '' : String(v);
    if (d) v = v.replace(/\D/g, '');
    v = v.replace(/[\r\n]+/g, ' ');
    return v;
  }
  function quote(v, delim) { return /["\n\r]/.test(v) || v.indexOf(delim) >= 0 || /^[=+\-@]/.test(v) ? '"' + v.replace(/^([=+\-@])/, "'$1").replace(/"/g, '""') + '"' : v; }
  function isBank(l) { return /bank|transfer|ibg|duitnow|giro|online/i.test(String(l.payment_method || '')); }

  T.bankCsv = async function (b, lines) {
    css();
    var set = await X.settings(), F = formats(set);
    var todo = (lines || []).filter(function (l) { return (l.pay_status || 'unpaid') !== 'paid' && isBank(l) && Number(l.amount) > 0; });
    if (!todo.length) { X.toast(L('No unpaid bank transfer lines.', 'Tiada baris pindahan bank belum dibayar.'), 'error'); return; }
    var miss = todo.filter(function (l) { return !String(l.bank_account_no || '').replace(/\D/g, ''); });
    var sum = todo.reduce(function (a, l) { return a + (Number(l.amount) || 0); }, 0);
    var opts = Object.keys(F).map(function (k) { return '<option value="' + esc(k) + '">' + esc(F[k].label || k) + '</option>'; }).join('');
    var ov = modal('pvt-csv', '<i class="ti ti-file-spreadsheet"></i> ' + esc(L('Bank bulk payment CSV', 'CSV bayaran pukal bank')),
      '<div class="form-group" style="margin:0 0 10px"><label class="form-label" for="pvt-csv-f">' + esc(L('Bank layout', 'Format bank')) + '</label><select id="pvt-csv-f" class="form-select">' + opts + '</select></div>' +
      '<div class="pvt-s" style="margin:0 0 6px">' + esc(todo.length + ' ' + L('unpaid bank transfer line(s)', 'baris pindahan bank belum dibayar') + ' · ' + X.rm(sum)) + '</div>' +
      (miss.length ? '<div class="pvc-note pvc-warn" style="margin:0 0 6px"><i class="ti ti-alert-triangle"></i> <span>' + esc(L('Missing account no (left out of the file): ', 'Tiada no akaun (dikeluarkan dari fail): ') + miss.map(function (l) { return l.payee_name || '—'; }).join(', ')) + '</span></div>' : '') +
      '<div class="pvt-h">' + esc(L('Check the columns against your bank\'s current upload template before uploading. Layouts can be changed in PV Settings.', 'Semak lajur dengan templat muat naik bank anda sebelum memuat naik. Format boleh diubah dalam Tetapan PV.')) + '</div>',
      '<button type="button" class="btn btn-outline" data-x>' + esc(L('Cancel', 'Batal')) + '</button>' +
      '<button type="button" class="btn btn-primary" id="pvt-csv-go"><i class="ti ti-download"></i> ' + esc(L('Download CSV', 'Muat turun CSV')) + '</button>');
    $('pvt-csv-go').onclick = function () {
      var k = $('pvt-csv-f').value, f = F[k], d = f.delimiter || ',', dec = f.amount_decimals == null ? 2 : f.amount_decimals;
      var ok = todo.filter(function (l) { return String(l.bank_account_no || '').replace(/\D/g, ''); });
      var out = [];
      if (f.header !== false) out.push(f.cols.map(function (c) { return quote(String(c.h || ''), d); }).join(d));
      ok.forEach(function (l) {
        var val = { payee_name: l.payee_name, bank_name: l.bank_name, bank_code: l.bank_code || '', bank_account_no: l.bank_account_no, amount: (Number(l.amount) || 0).toFixed(dec), ref: b.ref_no || '', description: l.description || b.title || '', phone: l.phone || '', email: l.email || '', payee_id_no: l.payee_id_no || '', blank: '' };
        out.push(f.cols.map(function (c) { var v = cell(val[c.f], c.digits); if (c.max) v = v.slice(0, c.max); return quote(v, d); }).join(d));
      });
      var blob = new Blob(['\ufeff' + out.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = (b.ref_no || 'PVD') + '-' + k + '.csv'; document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      try { auditLog('export', 'payment_voucher_batches', b.id, null, { bank_csv: k, lines: ok.length }); } catch (e) {}
      X.toast(L('CSV downloaded — ' + ok.length + ' line(s).', 'CSV dimuat turun — ' + ok.length + ' baris.'), 'success');
      ov.remove();
    };
  };

  /* ---------- settings ---------- */
  T.settingsSheet = async function () {
    css();
    if (!(await X.ready())) { X.toast(L('Run supabase/pv_revamp_01.sql first.', 'Jalankan supabase/pv_revamp_01.sql dahulu.'), 'error'); return; }
    var s = await X.settings(true);
    var cust = s.bank_formats && Object.keys(s.bank_formats).length ? s.bank_formats : DEF_FORMATS;
    var ov = modal('pvt-set', '<i class="ti ti-settings"></i> ' + esc(L('Payment voucher settings', 'Tetapan baucar bayaran')),
      '<div class="pvt-g">' +
      '<div class="form-group" style="margin:0"><label class="form-label" for="pvt-th">' + esc(L('4-signature threshold (RM)', 'Had 4 tandatangan (RM)')) + '</label><input id="pvt-th" class="form-input" type="number" min="0" step="0.01" inputmode="decimal" value="' + esc(s.sig_threshold) + '"></div>' +
      '<div class="form-group" style="margin:0"><label class="form-label" for="pvt-lo">' + esc(L('Signatures below it', 'Tandatangan di bawahnya')) + '</label><select id="pvt-lo" class="form-select">' + [1, 2, 3, 4].map(function (n) { return '<option' + (Number(s.low_sig_count) === n ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></div>' +
      '<div class="form-group" style="margin:0"><label class="form-label" for="pvt-rh">' + esc(L('Reminder after (hours)', 'Peringatan selepas (jam)')) + '</label><input id="pvt-rh" class="form-input" type="number" min="1" max="720" step="1" inputmode="numeric" value="' + esc(s.reminder_hours) + '"></div></div>' +
      '<div class="pvt-h">' + esc(L('Below the threshold: Prepared, Checked, First Approval (by count). At or above: all 4.', 'Bawah had: Disediakan, Disemak, Kelulusan Pertama (ikut bilangan). Pada atau atas had: kesemua 4.')) + '</div>' +
      '<div class="form-group" style="margin:12px 0 0"><label class="form-label" for="pvt-bf">' + esc(L('Bank CSV layouts (JSON)', 'Format CSV bank (JSON)')) + '</label>' +
      '<textarea id="pvt-bf" class="form-input pvt-ta" spellcheck="false">' + esc(JSON.stringify(cust, null, 1)) + '</textarea>' +
      '<div class="pvt-h">' + esc(L('Fields: payee_name, bank_name, bank_code, bank_account_no, amount, ref, description, phone, email, payee_id_no, blank. Per column: h (header), f (field), max (length), digits (numbers only).', 'Medan: payee_name, bank_name, bank_code, bank_account_no, amount, ref, description, phone, email, payee_id_no, blank. Setiap lajur: h (tajuk), f (medan), max (panjang), digits (nombor sahaja).')) + '</div></div>' +
      '<div class="pvt-err" id="pvt-set-e" role="alert"></div>',
      '<button type="button" class="btn btn-outline" id="pvt-set-def">' + esc(L('Default layouts', 'Format asal')) + '</button>' +
      '<button type="button" class="btn btn-outline" data-x>' + esc(L('Cancel', 'Batal')) + '</button>' +
      '<button type="button" class="btn btn-primary" id="pvt-set-go"><i class="ti ti-check"></i> ' + esc(L('Save', 'Simpan')) + '</button>', true);
    $('pvt-set-def').onclick = function () { $('pvt-bf').value = JSON.stringify(DEF_FORMATS, null, 1); };
    $('pvt-set-go').onclick = async function () {
      var e = $('pvt-set-e'), btn = this, bf;
      try { bf = JSON.parse($('pvt-bf').value || '{}'); if (!bf || typeof bf !== 'object' || Array.isArray(bf)) throw 0; Object.keys(bf).forEach(function (k) { if (!Array.isArray(bf[k].cols)) throw 0; }); }
      catch (x) { e.textContent = L('Bank layouts: invalid JSON (each layout needs a "cols" list).', 'Format bank: JSON tidak sah (setiap format perlu senarai "cols").'); return; }
      var th = Number($('pvt-th').value), rh = Math.round(Number($('pvt-rh').value));
      if (!(th >= 0)) { e.textContent = L('Enter a valid threshold.', 'Masukkan had yang sah.'); return; }
      if (!(rh >= 1 && rh <= 720)) { e.textContent = L('Reminder hours must be 1–720.', 'Jam peringatan mestilah 1–720.'); return; }
      btn.disabled = true;
      try {
        await X.saveSettings({ sig_threshold: th, low_sig_count: Number($('pvt-lo').value), reminder_hours: rh, bank_formats: bf });
        try { auditLog('update', 'pv_settings', X.tid(), null, { sig_threshold: th, low_sig_count: Number($('pvt-lo').value), reminder_hours: rh }); } catch (x) {}
        X.toast(L('Settings saved.', 'Tetapan disimpan.'), 'success'); ov.remove();
      } catch (x) { btn.disabled = false; e.textContent = L('Could not save (owner / admin / finance / accountant only): ', 'Gagal simpan (pemilik / admin / kewangan / akauntan sahaja): ') + X.errMsg(x); }
    };
  };

  /* ---------- duplicate batch ---------- */
  T.duplicate = async function (id) {
    var bq = await sb.from('payment_voucher_batches').select('*').eq('id', id).eq('tenant_id', X.tid()).maybeSingle();
    var b = bq.data; if (!b) return;
    var lq = await sb.from('payment_voucher_batch_lines').select('*').eq('batch_id', id).eq('tenant_id', X.tid()).order('sort_order');
    var src = (lq.data || []);
    if (!confirm(L('Make a new draft copy of ' + (b.ref_no || '') + ' with ' + src.length + ' payee(s)? Pay status, receipts and signatures are not copied.', 'Buat salinan draf baharu ' + (b.ref_no || '') + ' dengan ' + src.length + ' penerima? Status bayaran, resit dan tandatangan tidak disalin.'))) return;
    try {
      var ref = typeof _genFallbackRefNo === 'function' ? await _genFallbackRefNo('payment_voucher_batches', 'ref_no', 'PVD') : 'PVD-' + Date.now().toString().slice(-6);
      var total = src.reduce(function (a, l) { return a + (Number(l.amount) || 0); }, 0);
      var row = { tenant_id: X.tid(), ref_no: ref, batch_date: X.today(), title: ((b.title || '') + ' ' + L('(copy)', '(salinan)')).trim(), status: 'draft', prepared_by: X.me(), total_amount: X.r2(total), line_count: src.length, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      var ins = await sb.from('payment_voucher_batches').insert(row).select('id').single();
      if (ins.error) throw ins.error;
      var nid = ins.data.id;
      var keep = ['payee_name', 'amount', 'payment_method', 'bank_name', 'cheque_no', 'description', 'bill_id', 'bank_account_no', 'payee_type', 'payee_id', 'phone', 'category', 'gl_account_id'];
      var rows = src.map(function (l, i) { var o = { tenant_id: X.tid(), batch_id: nid, sort_order: i + 1 }; keep.forEach(function (k) { if (l[k] !== undefined) o[k] = l[k]; }); o.bill_id = null; o.cheque_no = null; return o; });
      if (rows.length) { var li = await sb.from('payment_voucher_batch_lines').insert(rows); if (li.error) throw li.error; }
      try { auditLog('create', 'payment_voucher_batches', nid, null, { duplicated_from: id }); } catch (x) {}
      X.toast(L('Copy created as draft.', 'Salinan dicipta sebagai draf.'), 'success');
      openPage('vouchers', { view: 'pvd-detail', id: nid });
    } catch (e) { X.toast(L('Could not duplicate: ', 'Gagal menyalin: ') + X.errMsg(e), 'error'); }
  };
})();
