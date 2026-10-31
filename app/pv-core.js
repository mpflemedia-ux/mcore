/* Payment Vouchers revamp — core v1 (needs supabase/pv_revamp_01.sql; everything degrades to the old flow if not run).
   window.PVX: i18n (EN/BM), roles, settings (signature threshold), payee lists (Suppliers / Employees), categories,
   GL rules on Mark Paid, batch-line payment sync, and fixes:
   - _pvbNotify: recipients by role + created_by (no user_profiles.email), no amounts in bell/push.
   - _pvSetStatus('approved'): owner / admin / finance / accountant / manager / platform admin only (DB trigger too).
   - _pvMarkPaid(id, opts): category journal rules (no double expense) + keeps the PVD line in sync.
   - _pvdConvert: keeps first_approved_by, tenant-scoped, batch 'converted' only when every line converted.
   Tokens only, EN/BM. */
(function () {
  if (window.PVX) return;
  var X = window.PVX = {};

  function bm() { try { return APP.language === 'bm'; } catch (e) { return false; } }
  function L(en, ms) { return bm() ? ms : en; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function tid() { try { return APP.tenant.id; } catch (e) { return null; } }
  function uid() { try { return APP.user.id; } catch (e) { return null; } }
  function role() { try { return String(APP.user.role || '').toLowerCase(); } catch (e) { return ''; } }
  function me() { try { return String(APP.user.name || APP.user.full_name || APP.user.email || '').trim(); } catch (e) { return ''; } }
  function rm(n) { try { return formatRM(Number(n) || 0); } catch (e) { return 'RM ' + (Number(n) || 0).toFixed(2); } }
  function toast(m, t) { try { showToast(m, t || 'success'); } catch (e) {} }
  function r2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
  function today() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function dmy(iso) { if (!iso) return ''; var d = new Date(String(iso).length <= 10 ? iso + 'T00:00:00' : iso); if (isNaN(d)) return ''; return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear(); }
  function errMsg(e) { return String((e && (e.message || e.error_description)) || e || ''); }
  X.bm = bm; X.L = L; X.esc = esc; X.tid = tid; X.uid = uid; X.role = role; X.me = me; X.rm = rm; X.toast = toast; X.r2 = r2; X.today = today; X.dmy = dmy; X.errMsg = errMsg;

  X.isApprover = function () {
    if (['owner', 'admin', 'finance', 'accountant', 'manager', 'platform_admin'].indexOf(role()) >= 0) return true;
    try { return typeof isPlatformAdmin === 'function' && !!isPlatformAdmin(); } catch (e) { return false; }
  };
  X.canVoidPaid = function () {
    if (['owner', 'admin', 'finance', 'accountant'].indexOf(role()) >= 0) return true;
    try { return typeof isPlatformAdmin === 'function' && !!isPlatformAdmin(); } catch (e) { return false; }
  };

  /* ---------- statuses ---------- */
  var ST = {
    draft: ['Draft', 'Draf', 'badge-gray'], shared: ['Shared for signing', 'Dikongsi untuk tandatangan', 'badge-blue'],
    pending: ['Awaiting signatures', 'Menunggu tandatangan', 'badge-yellow'], approved: ['Approved', 'Diluluskan', 'badge-green'],
    converted: ['Converted', 'Ditukar', 'badge-blue'], paid: ['Paid', 'Dibayar', 'badge-green'], void: ['Void', 'Batal', 'badge-red']
  };
  X.stLabel = function (s) { var x = ST[s || 'draft']; return x ? L(x[0], x[1]) : String(s || ''); };
  X.stBadge = function (s) { var x = ST[s || 'draft'] || ST.draft; return '<span class="badge ' + x[2] + '">' + esc(X.stLabel(s)) + '</span>'; };
  X.locked = function (s) { return (s || 'draft') !== 'draft'; };

  var PS = { unpaid: ['Unpaid', 'Belum dibayar', 'badge-gray'], paid: ['Paid', 'Dibayar', 'badge-green'], failed: ['Failed', 'Gagal', 'badge-red'] };
  X.payBadge = function (s) { var x = PS[s || 'unpaid'] || PS.unpaid; return '<span class="badge ' + x[2] + '">' + esc(L(x[0], x[1])) + '</span>'; };

  /* ---------- categories + GL rules ---------- */
  X.CATS = [
    { k: 'supplier', en: 'Supplier', bm: 'Pembekal' },
    { k: 'salary', en: 'Salary', bm: 'Gaji' },
    { k: 'commission', en: 'Commission', bm: 'Komisen' },
    { k: 'statutory', en: 'KWSP / SOCSO', bm: 'KWSP / PERKESO' },
    { k: 'utility', en: 'Utility', bm: 'Utiliti' },
    { k: 'other', en: 'Other', bm: 'Lain-lain' }
  ];
  X.catLabel = function (k) { for (var i = 0; i < X.CATS.length; i++) if (X.CATS[i].k === k) return L(X.CATS[i].en, X.CATS[i].bm); return k ? String(k) : ''; };
  X.METHODS = ['Bank Transfer', 'Cheque', 'Cash', 'DuitNow', 'Online Banking'];
  X.methodLabel = function (m) {
    var t = { 'Bank Transfer': ['Bank Transfer', 'Pindahan Bank'], 'Cheque': ['Cheque', 'Cek'], 'Cash': ['Cash', 'Tunai'], 'DuitNow': ['DuitNow', 'DuitNow'], 'Online Banking': ['Online Banking', 'Perbankan Dalam Talian'] }[m];
    return t ? L(t[0], t[1]) : String(m || L('Other', 'Lain-lain'));
  };
  /* Journal for a paid voucher. Returns {skip:true, why} or {debit, debitKey}.
     - supplier bill linked: Dr Accounts Payable
     - salary: none (payroll journal already credited Cash for net pay)
     - commission imported from SD/payroll: none; otherwise Dr commission_expense
     - KWSP / SOCSO: Dr the payable (epf_payable default; GL override per line for socso / eis / pcb payable)
     - others: Dr line GL account, else tenant gl_map[category], else general_expense */
  X.journalRule = async function (v) {
    var cat = v.category || (v.bill_id ? 'supplier' : (v.payee_type === 'employee' ? 'other' : 'other'));
    if (v.bill_id) return { debit: await _getDefaultAccountId('accounts_payable'), debitKey: 'accounts_payable' };
    if (cat === 'salary') return { skip: true, why: 'salary' };
    if (cat === 'commission' && (v.source === 'sd' || v.source === 'payroll')) return { skip: true, why: 'salary' };
    if (v.gl_account_id) return { debit: v.gl_account_id, debitKey: 'line' };
    var s = await X.settings(), map = (s && s.gl_map) || {};
    if (map[cat]) return { debit: map[cat], debitKey: 'tenant_map' };
    if (cat === 'commission') { var c = await _getDefaultAccountId('commission_expense'); if (c) return { debit: c, debitKey: 'commission_expense' }; }
    if (cat === 'statutory') { var p = await _getDefaultAccountId('epf_payable'); if (p) return { debit: p, debitKey: 'epf_payable' }; }
    return { debit: await _getDefaultAccountId('general_expense'), debitKey: 'general_expense' };
  };

  /* ---------- feature detect (SQL run?) ---------- */
  var ready;
  X.ready = function () {
    if (ready !== undefined) return Promise.resolve(ready);
    if (!window.sb) return Promise.resolve(false);
    return Promise.resolve(sb.from('pv_signatures').select('id').limit(1)).then(function (r) { ready = !(r && r.error); return ready; }, function () { ready = false; return false; });
  };
  X.readySync = function () { return ready === true; };

  /* ---------- settings ---------- */
  var DEF = { sig_threshold: 5000, low_sig_count: 3, reminder_hours: 24, bank_formats: {}, gl_map: {} };
  var setCache = null;
  X.settings = async function (force) {
    if (setCache && !force && setCache.t === tid()) return setCache.v;
    var v = Object.assign({}, DEF);
    try {
      if (await X.ready()) {
        var r = await sb.from('pv_settings').select('*').eq('tenant_id', tid()).maybeSingle();
        if (r && r.data) v = Object.assign(v, r.data);
      }
    } catch (e) {}
    setCache = { t: tid(), v: v };
    return v;
  };
  X.saveSettings = async function (patch) {
    var row = Object.assign({ tenant_id: tid(), updated_at: new Date().toISOString(), updated_by: uid() }, patch);
    var r = await sb.from('pv_settings').upsert(row, { onConflict: 'tenant_id' });
    if (r.error) throw r.error;
    setCache = null;
    return X.settings(true);
  };
  X.ROLES = [
    { r: 'prepared', en: 'Prepared By', bm: 'Disediakan Oleh' },
    { r: 'checked', en: 'Checked By', bm: 'Disemak Oleh' },
    { r: 'first', en: 'First Approval', bm: 'Kelulusan Pertama' },
    { r: 'second', en: 'Second Approval', bm: 'Kelulusan Kedua' }
  ];
  X.roleLabel = function (r) { for (var i = 0; i < X.ROLES.length; i++) if (X.ROLES[i].r === r) return L(X.ROLES[i].en, X.ROLES[i].bm); return r; };
  X.requiredRoles = function (s, amount) {
    s = s || DEF;
    var all = X.ROLES.map(function (x) { return x.r; });
    if ((Number(amount) || 0) >= Number(s.sig_threshold == null ? 5000 : s.sig_threshold)) return all;
    return all.slice(0, Math.max(1, Math.min(4, Number(s.low_sig_count) || 3)));
  };

  /* ---------- payee lists ---------- */
  var payCache = null;
  X.payees = async function (force) {
    if (payCache && !force && payCache.t === tid() && Date.now() - payCache.at < 60000) return payCache.v;
    var out = [];
    try {
      var a = await Promise.all([
        sb.from('suppliers').select('*').eq('tenant_id', tid()).limit(1000),
        sb.from('employees').select('*').eq('tenant_id', tid()).limit(1000)
      ]);
      ((a[0] && a[0].data) || []).forEach(function (s) {
        if (s.deleted_at || s.is_active === false) return;
        out.push({ type: 'supplier', id: s.id, name: String(s.name || s.company_name || '').trim(), bank_name: s.bank_name || '', bank_account_no: s.bank_account_no || s.account_no || '', phone: s.phone || s.contact_phone || '', email: s.email || '' });
      });
      ((a[1] && a[1].data) || []).forEach(function (e) {
        var st = String(e.status || e.employment_status || '').toLowerCase();
        if (e.deleted_at || e.is_active === false || st === 'resigned' || st === 'terminated' || st === 'inactive') return;
        out.push({ type: 'employee', id: e.id, name: String(e.name || e.full_name || '').trim(), bank_name: e.bank_name || '', bank_account_no: e.bank_account_no || '', phone: e.phone || e.mobile || '', email: e.email || '' });
      });
    } catch (e) { console.warn('pv payees', e); }
    out = out.filter(function (p) { return p.name; }).sort(function (x, y) { return x.name.localeCompare(y.name); });
    payCache = { t: tid(), at: Date.now(), v: out };
    return out;
  };
  var coaCache = null;
  X.accounts = async function () {
    if (coaCache && coaCache.t === tid()) return coaCache.v;
    var r = await sb.from('chart_of_accounts').select('id,code,name_en,account_type').eq('tenant_id', tid()).is('deleted_at', null).eq('is_active', true).order('code');
    coaCache = { t: tid(), v: (r && r.data) || [] };
    return coaCache.v;
  };

  /* ---------- notifications (bell + push via NT). Never amounts. ---------- */
  X.notify = async function (evt, o) {
    try {
      if (!window.NT || typeof NT.notify !== 'function' || !tid()) return 0;
      o = o || {};
      var kind = o.kind || 'pv', table = kind === 'pvd' ? 'payment_voucher_batches' : 'payment_vouchers';
      var cols = kind === 'pvd' ? 'id,ref_no,title,created_by' : 'id,ref_no,payee_name,created_by,prepared_by';
      var q = await sb.from(table).select(cols).eq('id', o.id).eq('tenant_id', tid()).maybeSingle();
      if (q.error && /created_by/.test(q.error.message || '')) q = await sb.from(table).select(cols.replace(',created_by', '')).eq('id', o.id).eq('tenant_id', tid()).maybeSingle();
      var d = q.data; if (!d) return 0;
      var ref = d.ref_no || o.ref_no || '';
      var what = kind === 'pvd' ? L('PV Disbursement ', 'Penyaluran PV ') : L('Payment voucher ', 'Baucar bayaran ');
      var H = {
        pv_submitted: [L(' awaiting signatures', ' menunggu tandatangan'), ['owner', 'admin', 'finance', 'accountant', 'manager']],
        pv_approved: [L(' approved', ' diluluskan'), ['owner', 'admin', 'finance']],
        pv_paid: [L(' paid', ' dibayar'), ['owner', 'admin', 'finance']],
        pv_failed: [L(' payment failed', ' bayaran gagal'), ['owner', 'admin', 'finance']],
        pv_void: [L(' voided', ' dibatalkan'), ['owner', 'admin']]
      }[evt];
      if (!H) return 0;
      var title = what + ref + H[0];
      var body = kind === 'pvd' ? (d.title || '') : (d.payee_name || '');
      if (o.extra) body = [body, o.extra].filter(Boolean).join(' · ');
      var ups = await sb.from('user_profiles').select('id,role,full_name').eq('tenant_id', tid());
      var ids = [], prep = String(d.prepared_by || '').trim().toLowerCase();
      ((ups && ups.data) || []).forEach(function (u) {
        var hit = H[1].indexOf(String(u.role || '').toLowerCase()) >= 0 || (d.created_by && u.id === d.created_by) || (prep && String(u.full_name || '').trim().toLowerCase() === prep);
        if (hit && ids.indexOf(u.id) < 0) ids.push(u.id);
      });
      if (!ids.length) return 0;
      return await NT.notify({
        type: 'approval.' + evt, category: 'approval', kind: 'for_you', title: title, body: body || what + ref,
        link: { page: 'vouchers', params: { view: kind === 'pvd' ? 'pvd-detail' : 'pv-detail', id: d.id } },
        ref_table: table, ref_id: d.id, users: ids, tenant_id: tid(), group_key: table + ':' + d.id + ':' + evt
      });
    } catch (e) { console.warn('pv notify', evt, e); return 0; }
  };

  /* ---------- overrides of index.html globals ---------- */
  function install() {
    // 1) notifications: old _pvbNotify read user_profiles.email + put amounts in the body
    var oldNotify = window._pvbNotify;
    if (typeof oldNotify === 'function' && !oldNotify._pvx) {
      var n = function (evt, o) {
        if (evt === 'bill_created') return Promise.resolve(0); // DB trigger dk__purch_notify sends purchasing.bill_new (no amount); the client copy duplicated it with RM in the push
        return X.notify(evt, Object.assign({ kind: 'pv' }, o || {}));
      };
      n._pvx = true; window._pvbNotify = n;
    }
    // 2) approve gate (UI); DB trigger pv__approve_gate enforces the same
    var oldSet = window._pvSetStatus;
    if (typeof oldSet === 'function' && !oldSet._pvx) {
      var s = async function (id, status) {
        if (status === 'approved' && !X.isApprover()) {
          toast(L('Only owner / admin / finance / manager can approve directly. Collect the signatures instead.', 'Hanya pemilik / admin / kewangan / pengurus boleh meluluskan terus. Kumpul tandatangan sebagai ganti.'), 'error');
          return;
        }
        var r = await oldSet.apply(this, arguments);
        if (status === 'void') syncLine(id, { pay_status: 'unpaid', paid_date: null });
        return r;
      };
      s._pvx = true; window._pvSetStatus = s;
    }
    // 3) mark paid with category GL rules + PVD line sync
    if (!window._pvMarkPaid || !window._pvMarkPaid._pvx) { markPaid._pvx = true; window._pvMarkPaid = markPaid; }
    // 4) legacy convert (batches approved before signatures): fixed
    if (!window._pvdConvert || !window._pvdConvert._pvx) { convert._pvx = true; window._pvdConvert = convert; }
  }

  async function syncLine(pvId, patch) {
    try {
      var q = await sb.from('payment_vouchers').select('id,batch_line_id').eq('id', pvId).eq('tenant_id', tid()).maybeSingle();
      var lineId = q.data && q.data.batch_line_id;
      var up = sb.from('payment_voucher_batch_lines').update(Object.assign({ updated_at: new Date().toISOString() }, patch)).eq('tenant_id', tid());
      up = lineId ? up.eq('id', lineId) : up.eq('voucher_id', pvId);
      var r = await up; if (r && r.error) return;
      var l = await sb.from('payment_voucher_batch_lines').select('batch_id').eq('voucher_id', pvId).eq('tenant_id', tid()).limit(1);
      var bid = l.data && l.data[0] && l.data[0].batch_id; if (bid) await X.batchPaidCheck(bid);
    } catch (e) {}
  }
  X.syncLine = syncLine;
  X.batchPaidCheck = async function (bid) {
    var r = await sb.from('payment_voucher_batch_lines').select('id,pay_status').eq('batch_id', bid).eq('tenant_id', tid());
    var ls = (r && r.data) || []; if (!ls.length) return;
    var all = ls.every(function (x) { return x.pay_status === 'paid'; });
    var b = await sb.from('payment_voucher_batches').select('status').eq('id', bid).eq('tenant_id', tid()).maybeSingle();
    var st = b.data && b.data.status;
    if (all && (st === 'approved' || st === 'converted')) {
      await sb.from('payment_voucher_batches').update({ status: 'paid', updated_at: new Date().toISOString() }).eq('id', bid).eq('tenant_id', tid());
      X.notify('pv_paid', { kind: 'pvd', id: bid });
    } else if (!all && st === 'paid') {
      await sb.from('payment_voucher_batches').update({ status: 'approved', updated_at: new Date().toISOString() }).eq('id', bid).eq('tenant_id', tid());
    }
  };

  /* Same steps as index.html _pvMarkPaid (bill payment, PV paid, bill balance, payments row, journal),
     but the journal follows X.journalRule and opts = { paidDate, ref, silent, noRender }. Returns true on success. */
  async function markPaid(id, opts) {
    opts = opts || {};
    var isBm = bm(), T = tid();
    var g = await sb.from('payment_vouchers').select('*').eq('id', id).eq('tenant_id', T).single();
    var v = g.data;
    if (!v) { toast(isBm ? 'Baucar tidak dijumpai.' : 'Voucher not found.', 'error'); return false; }
    if (v.status === 'paid') { if (!opts.silent) toast(isBm ? 'Sudah dibayar.' : 'Already paid.', 'error'); return v.status === 'paid' && opts.silent; }
    if (v.status === 'void') { toast(isBm ? 'Baucar ini telah dibatalkan.' : 'This voucher is void.', 'error'); return false; }
    if (v.status !== 'approved') { toast(L('Approve the voucher (signatures) before paying.', 'Luluskan baucar (tandatangan) sebelum bayar.'), 'error'); return false; }
    var payDate = opts.paidDate || v.voucher_date || today();
    if (typeof assertNotPeriodLocked === 'function' && !assertNotPeriodLocked(payDate)) return false;
    var amt = r2(v.amount), memo = 'PV ' + (v.ref_no || '');
    var bill = null;
    if (v.bill_id) {
      var bq = await sb.from('supplier_bills').select('id,bill_no,total,paid_amt,status').eq('id', v.bill_id).eq('tenant_id', T).maybeSingle();
      if (bq.error || !bq.data) { toast(isBm ? 'Bil pembekal yang dilink tidak dijumpai.' : 'Linked supplier bill not found.', 'error'); return false; }
      bill = bq.data;
      var dup = await sb.from('supplier_payments').select('id').eq('tenant_id', T).eq('bill_id', bill.id).eq('memo', memo).limit(1);
      if (!dup.error && dup.data && dup.data.length) { toast(isBm ? 'Bayaran ' + memo + ' sudah direkod pada bil ini.' : 'Payment ' + memo + ' is already recorded on this bill.', 'error'); return false; }
      var bal = Math.max(0, r2(Number(bill.total || 0) - Number(bill.paid_amt || 0)));
      if (amt > bal + 0.005) { toast(isBm ? 'Jumlah baucar (' + rm(amt) + ') melebihi baki bil ' + (bill.bill_no || '') + ' (' + rm(bal) + ').' : 'Voucher amount (' + rm(amt) + ') exceeds bill ' + (bill.bill_no || '') + ' balance (' + rm(bal) + ').', 'error'); return false; }
    }
    var spId = null;
    if (bill) {
      var base = { tenant_id: T, bill_id: bill.id, payment_date: payDate, amount: amt, method: v.payment_method || 'Bank Transfer' };
      var ins = await sb.from('supplier_payments').insert(Object.assign({ memo: memo }, base)).select('id').single();
      if (ins.error && /memo/i.test(ins.error.message || '')) ins = await sb.from('supplier_payments').insert(base).select('id').single();
      if (ins.error) { toast((isBm ? 'Ralat: ' : 'Error: ') + ins.error.message, 'error'); return false; }
      spId = ins.data && ins.data.id;
    }
    var nowIso = new Date().toISOString();
    var e1 = (await sb.from('payment_vouchers').update({ status: 'paid', paid_at: payDate === today() ? nowIso : payDate + 'T12:00:00', approved_by: v.approved_by || me() || null, updated_at: nowIso }).eq('id', id).eq('tenant_id', T)).error;
    if (e1) {
      if (spId) await sb.from('supplier_payments').delete().eq('id', spId).eq('tenant_id', T);
      toast((isBm ? 'Ralat: ' : 'Error: ') + e1.message, 'error'); return false;
    }
    if (bill) {
      var np = r2(Number(bill.paid_amt || 0) + amt);
      var e2 = (await sb.from('supplier_bills').update({ paid_amt: np, status: np >= Number(bill.total || 0) - 0.005 ? 'paid' : 'partial' }).eq('id', bill.id).eq('tenant_id', T)).error;
      if (e2) toast((isBm ? 'Amaran: baki bil tidak dikemaskini — ' : 'Warning: bill balance not updated — ') + e2.message, 'error');
    }
    try {
      await sb.from('payments').insert({ tenant_id: T, ref_no: v.ref_no, payment_date: payDate, amount: Number(v.amount || 0), payment_type: 'payment',
        payment_method: v.payment_method || null, customer_name: v.payee_name,
        notes: 'Payment Voucher ' + (v.ref_no || '') + (v.description ? ' — ' + v.description : '') + (opts.ref ? ' · ' + opts.ref : '') });
    } catch (e) { console.warn('PV payments insert', e); }
    var jr = null;
    try {
      jr = await X.journalRule(v);
      if (!jr.skip) {
        var cash = await _getDefaultAccountId('cash');
        if (cash && jr.debit) {
          await _postJournalEntry({ description: 'PV ' + (v.ref_no || '') + ' — ' + (v.payee_name || ''), entryDate: payDate, entryType: 'auto',
            lines: [{ account_id: jr.debit, debit: Number(v.amount || 0), credit: 0 }, { account_id: cash, debit: 0, credit: Number(v.amount || 0) }],
            sourceTable: 'payment_vouchers', sourceId: id });
        } else console.warn('PV journal skipped (missing Cash / ' + jr.debitKey + ' default account)');
      }
    } catch (e) { console.warn('PV journal', e); }
    try { auditLog('update', 'payment_vouchers', id); } catch (e) {}
    await syncLine(id, { pay_status: 'paid', paid_date: payDate, pay_ref: opts.ref || null, fail_reason: null });
    if (!opts.silent) {
      toast(jr && jr.skip ? L('Voucher marked paid. No second journal — payroll already recorded this salary.', 'Baucar ditanda dibayar. Tiada jurnal kedua — gaji ini sudah direkod oleh jurnal gaji.')
        : (isBm ? 'Baucar ditanda dibayar. Kewangan dikemaskini.' : 'Voucher marked paid. Financials updated.'), 'success');
      X.notify('pv_paid', { kind: 'pv', id: id });
    }
    if (!opts.noRender && typeof window.renderPVDetail === 'function') window.renderPVDetail(id);
    return true;
  }
  X.markPaid = markPaid;

  /* legacy manual convert (approved batch without auto-created PVs) */
  async function convert(batchId) {
    var T = tid();
    var bq = await sb.from('payment_voucher_batches').select('*').eq('id', batchId).eq('tenant_id', T).single();
    var b = bq.data;
    if (!b) { toast(L('Batch not found.', 'Kelompok tidak dijumpai.'), 'error'); return; }
    if (['approved', 'converted'].indexOf(b.status) < 0) { toast(L('Approve the batch first (signatures).', 'Luluskan kelompok dahulu (tandatangan).'), 'error'); return; }
    if (!confirm(L('Create one payment voucher per line that has none yet?', 'Cipta satu baucar bayaran bagi setiap baris yang belum ada?'))) return;
    var lq = await sb.from('payment_voucher_batch_lines').select('*').eq('batch_id', batchId).eq('tenant_id', T).order('sort_order');
    var lines = (lq.data || []).filter(function (l) { return !l.voucher_id; });
    var ok = 0, fail = [];
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i];
      var ref = await _genFallbackRefNo('payment_vouchers', 'ref_no', 'PV');
      var row = { tenant_id: T, ref_no: ref, voucher_date: b.batch_date, payee_name: l.payee_name, payee_type: l.payee_type || 'other',
        supplier_id: l.payee_type === 'supplier' ? l.payee_id : null, amount: Number(l.amount || 0), payment_method: l.payment_method, bank_name: l.bank_name,
        cheque_no: l.cheque_no, description: l.description || b.title, bill_id: l.bill_id || null, status: 'approved',
        prepared_by: b.prepared_by, checked_by: b.checked_by, approved_by: b.approved_by || b.first_approved_by || null, created_at: new Date().toISOString() };
      var extra = { bank_account_no: l.bank_account_no || null, payee_id: l.payee_id || null, phone: l.phone || null, category: l.category || null,
        gl_account_id: l.gl_account_id || null, batch_id: b.id, batch_line_id: l.id, source: l.source === 'sd' ? 'sd' : 'pvd' };
      var ins = await sb.from('payment_vouchers').insert(Object.assign({}, row, extra)).select('id').single();
      if (ins.error && /column/i.test(ins.error.message || '')) ins = await sb.from('payment_vouchers').insert(row).select('id').single();
      if (ins.error) { fail.push((l.payee_name || '#' + (i + 1)) + ': ' + ins.error.message); continue; }
      var u = await sb.from('payment_voucher_batch_lines').update({ voucher_id: ins.data.id }).eq('id', l.id).eq('tenant_id', T);
      if (u.error) { fail.push((l.payee_name || '#' + (i + 1)) + ': ' + u.error.message); continue; }
      ok++;
    }
    if (!fail.length) {
      await sb.from('payment_voucher_batches').update({ status: b.status === 'approved' && X.readySync() ? 'approved' : 'converted', pvs_created_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', batchId).eq('tenant_id', T).then(function (r) {
        if (r && r.error && /pvs_created_at/.test(r.error.message || '')) return sb.from('payment_voucher_batches').update({ status: 'converted', updated_at: new Date().toISOString() }).eq('id', batchId).eq('tenant_id', T);
      });
      toast(L(ok + ' payment voucher(s) created.', ok + ' baucar bayaran dicipta.'), 'success');
    } else {
      toast(L('Created ' + ok + ', failed ' + fail.length + ': ', 'Dicipta ' + ok + ', gagal ' + fail.length + ': ') + fail.slice(0, 2).join('; '), 'error');
    }
    try { auditLog('update', 'payment_voucher_batches', batchId); } catch (e) {}
    if (typeof window.renderPVDDetail === 'function') window.renderPVDDetail(batchId);
  }
  X.convert = convert;

  /* ---------- reminder on app open (own tenant; cron does every tenant) ---------- */
  var reminded = false;
  X.remindTick = function () {
    if (reminded || !window.sb || !tid() || !uid()) return;
    reminded = true;
    X.ready().then(function (ok) { if (ok) Promise.resolve(sb.rpc('pv_remind_pending')).then(function () {}, function () {}); });
  };

  install();
  setTimeout(install, 800);
  setTimeout(function () { install(); X.remindTick(); }, 6000);
})();
