/* dk-staff.js — DK Phase 2 · Staff (Leave, OT claims, Expense claims, Cash advances).
   Lists → DK.list cards at all widths, each card with PDF + Print slip (light A4 "SD style", signature boxes from DKSign
   when signed, otherwise blank lines with the slot labels). Notifications are server-side (supabase/dk_phase2_staff.sql). */
(function () {
  if (window.DKStaff) return;
  var S = window.DKStaff = { v: 1 };
  function bm() { try { return APP.language === 'bm'; } catch (e) { return false; } }
  function L(en, b) { return bm() ? b : en; }
  function money(n) { return window.DK ? DK.money(n) : 'RM ' + Number(n || 0).toFixed(2); }
  function fd(d) { return d ? (window.DK ? DK.date(d) : String(d).slice(0, 10)) : '-'; }
  function tid() { try { return APP.tenant.id; } catch (e) { return null; } }
  function toast(m, k) { try { showToast(m, k || 'success'); } catch (e) {} }
  function q(p) { return Promise.resolve(p).then(function (r) { if (r && r.error) throw r.error; return r ? r.data : null; }); }
  function slug(s) { return String(s || 'doc').replace(/[^A-Za-z0-9_-]+/g, '_'); }
  function tenant() { try { return typeof _pdocGetTenant === 'function' ? Promise.resolve(_pdocGetTenant()).catch(function () { return APP.tenant || {}; }) : Promise.resolve(APP.tenant || {}); } catch (e) { return Promise.resolve({}); } }
  function coSub(t) { var a = ''; try { a = typeof _pdocAddressLine === 'function' ? _pdocAddressLine(t) : (t.address || ''); } catch (e) {} return [a, t.phone].filter(Boolean).join(' · '); }
  function base(t, title, meta) { return { co: t.name || (APP.tenant && APP.tenant.name) || '', sub: coSub(t), logo: t.logo_url || '', title: title, meta: meta || [], party: { name: '', lines: [] }, cols: [], rows: [], tots: [], notes: [], sigs: [], foot: t.name || '' }; }
  var ST = { pending: ['Pending', 'Menunggu'], submitted: ['Submitted', 'Dihantar'], approved: ['Approved', 'Diluluskan'], rejected: ['Rejected', 'Ditolak'], paid: ['Paid', 'Dibayar'], draft: ['Draft', 'Draf'], disbursed: ['Disbursed', 'Dikeluarkan'], cancelled: ['Cancelled', 'Dibatalkan'] };
  function st(s) { var x = ST[String(s || '').toLowerCase()]; return x ? L(x[0], x[1]) : (s || '-'); }
  var LT = { annual: ['Annual', 'Tahunan'], medical: ['Medical', 'Sakit'], sick: ['Medical', 'Sakit'], emergency: ['Emergency', 'Kecemasan'], unpaid: ['Unpaid', 'Tanpa gaji'], maternity: ['Maternity', 'Bersalin'], paternity: ['Paternity', 'Paterniti'], compassionate: ['Compassionate', 'Ihsan'], hospitalization: ['Hospitalisation', 'Hospital'], replacement: ['Replacement', 'Ganti'] };
  function lt(s) { var x = LT[String(s || '').toLowerCase()]; return x ? L(x[0], x[1]) : String(s || '-').replace(/_/g, ' '); }
  var DT = { normal: ['Normal day', 'Hari biasa'], rest: ['Rest day', 'Hari rehat'], rest_day: ['Rest day', 'Hari rehat'], public_holiday: ['Public holiday', 'Cuti umum'], holiday: ['Public holiday', 'Cuti umum'] };
  function dt(s) { var x = DT[String(s || '').toLowerCase()]; return x ? L(x[0], x[1]) : String(s || '-').replace(/_/g, ' '); }
  function who(id) { var t = tid(); return id ? q(sb.from('user_profiles').select('full_name').eq('id', id).eq('tenant_id', t).maybeSingle()).then(function (r) { return (r && r.full_name) || ''; }, function () { return ''; }) : Promise.resolve(''); }
  function emp(id) { var t = tid(); return id ? q(sb.from('employees').select('*').eq('id', id).eq('tenant_id', t).maybeSingle()).catch(function () { return null; }) : Promise.resolve(null); }
  function empLines(e) { if (!e) return []; return [[e.employee_no || e.staff_no || e.emp_no, e.position || e.designation || e.job_title, e.department].filter(Boolean).join(' · ')].filter(Boolean); }

  /* doc → table, title, signature slots */
  var DOC = {
    leave: { table: 'leave_requests', title: ['Leave Application', 'Permohonan Cuti'], file: 'Leave' },
    ot: { table: 'ot_claims', title: ['Overtime Claim', 'Tuntutan Kerja Lebih Masa'], file: 'OT' },
    exp: { table: 'expense_claims', title: ['Expense Claim', 'Tuntutan Perbelanjaan'], file: 'Expense' },
    adv: { table: 'cash_advances', title: ['Cash Advance', 'Pendahuluan Tunai'], file: 'Advance' }
  };
  var SLOT = { leave: ['applicant', 'approved'], ot: ['claimant', 'approved'], exp: ['claimant', 'approved'], adv: ['requested', 'approved'] };
  function sigs(doc, id, names) {
    var blank = SLOT[doc].map(function (s, i) { return { label: window.DKSign ? DKSign.slotLabel(doc, s) : s, name: names[i] || '', at: '' }; });
    if (!window.DKSign || !DKSign.has(doc)) return Promise.resolve(blank);
    return DKSign.sigsFor(doc, id).then(function (a) {
      if (!a || !a.length) return blank;
      return a.map(function (s, i) { return { label: s.label, name: s.name || (blank[i] && blank[i].name) || '', at: s.at || '' }; });
    }, function () { return blank; });
  }

  function load(doc, id) {
    var t = tid(), D = DOC[doc];
    return Promise.all([tenant(), q(sb.from(D.table).select('*').eq('id', id).eq('tenant_id', t).maybeSingle())]).then(function (a) {
      var tn = a[0] || {}, r = a[1]; if (!r) return null;
      return Promise.all([doc === 'exp' ? Promise.resolve(null) : emp(r.employee_id), who(doc === 'exp' ? r.claimed_by : null), who(r.approved_by),
        doc === 'exp' && r.category_id ? q(sb.from('expense_categories').select('name').eq('id', r.category_id).eq('tenant_id', t).maybeSingle()).catch(function () { return null; }) : null
      ]).then(function (b) { return { doc: doc, tn: tn, r: r, e: b[0], claimant: doc === 'exp' ? b[1] : ((b[0] && (b[0].name || b[0].full_name)) || ''), appr: b[2], cat: b[3] && b[3].name }; });
    });
  }
  function model(d) {
    var r = d.r, D = DOC[d.doc], ref = r.ref_no || r.doc_no || String(r.id).slice(0, 8).toUpperCase();
    var meta = [{ k: L('Ref', 'Rujukan'), v: ref }, { k: L('Status', 'Status'), v: st(r.status) }, { k: L('Submitted', 'Dihantar'), v: fd(r.created_at || r.claim_date || r.start_date) }];
    var m = base(d.tn, L(D.title[0], D.title[1]), meta);
    m.party = { name: d.claimant || '-', lines: empLines(d.e) };
    m.cols = [L('Item', 'Butiran'), L('Details', 'Maklumat')];
    var R = m.rows;
    if (d.doc === 'leave') {
      R.push([L('Leave type', 'Jenis cuti'), lt(r.leave_type)], [L('From', 'Dari'), fd(r.start_date)], [L('To', 'Hingga'), fd(r.end_date)], [L('Days', 'Hari'), String(r.days_count == null ? '-' : r.days_count)]);
      if (r.half_day || r.is_half_day) R.push([L('Half day', 'Separuh hari'), L('Yes', 'Ya')]);
    } else if (d.doc === 'ot') {
      R.push([L('Date', 'Tarikh'), fd(r.claim_date)], [L('Day type', 'Jenis hari'), dt(r.day_type)], [L('Hours claimed', 'Jam dituntut'), String(r.ot_hours == null ? '-' : r.ot_hours)]);
      if (r.approved_hours != null) R.push([L('Hours approved', 'Jam diluluskan'), String(r.approved_hours)]);
      m.tots.push({ k: L('Amount', 'Amaun'), v: money(r.approved_amount != null ? r.approved_amount : r.amount), g: true });
    } else if (d.doc === 'exp') {
      R.push([L('Claim date', 'Tarikh tuntutan'), fd(r.claim_date)], [L('Category', 'Kategori'), d.cat || '-'], [L('Description', 'Keterangan'), r.description || '-']);
      m.tots.push({ k: L('Total claimed', 'Jumlah dituntut'), v: money(r.total_amount), g: true });
    } else {
      R.push([L('Requested on', 'Tarikh mohon'), fd(r.request_date || r.created_at)]);
      if (r.disbursed_at) R.push([L('Disbursed on', 'Dikeluarkan pada'), fd(r.disbursed_at)]);
      m.tots.push({ k: L('Advance amount', 'Amaun pendahuluan'), v: money(r.amount), g: true });
      if (r.outstanding_amount != null) m.tots.push({ k: L('Outstanding', 'Baki tertunggak'), v: money(r.outstanding_amount) });
    }
    if (d.appr) R.push([L('Actioned by', 'Diproses oleh'), d.appr]);
    var why = r.reason || r.note || r.notes || (d.doc === 'exp' ? '' : r.description);
    if (why) m.notes.push({ k: L('Reason / notes', 'Sebab / nota'), v: why });
    if (r.reject_reason || r.rejection_reason) m.notes.push({ k: L('Rejection reason', 'Sebab ditolak'), v: r.reject_reason || r.rejection_reason });
    m.file = D.file + '_' + slug(ref) + '_' + slug(d.claimant || '');
    return sigs(d.doc, r.id, [d.claimant, String(r.status).toLowerCase() === 'approved' || String(r.status).toLowerCase() === 'paid' ? d.appr : '']).then(function (s) { m.sigs = s; return m; });
  }
  function slip(doc, id) { return load(doc, id).then(function (d) { if (!d) throw new Error(L('Record not found', 'Rekod tidak dijumpai')); return model(d); }); }
  function pdf(doc, id) { return slip(doc, id).then(function (m) { return DKD.file(m, m.file + '.pdf').then(DKD.download); }); }
  function print(doc, id) {
    return slip(doc, id).then(function (m) {
      var p = DKD.paper(m, { cls: 'dk-tmp' }); DKD.sigBoxes(p, m.sigs);
      (document.getElementById('main') || document.body).appendChild(p);
      var gone = false, rm = function () { if (gone) return; gone = true; p.remove(); window.removeEventListener('afterprint', rm); };
      window.addEventListener('afterprint', rm); DKD.printOne(p, { title: m.file }); setTimeout(rm, 4500);
    });
  }
  S.slip = slip; S.pdf = pdf; S.print = print;
  function busy(b, p) { if (b) { b.disabled = true; b.classList.add('dk-busy'); } return Promise.resolve(p).catch(function (e) { toast(L('Failed: ', 'Gagal: ') + (e && e.message || e), 'error'); }).then(function () { if (b) { b.disabled = false; b.classList.remove('dk-busy'); } }); }
  function extra(doc) { return function (it) { return [
    { label: 'PDF', icon: 'ti-file-download', onClick: function (b) { busy(b, pdf(doc, it.id)); } },
    { label: L('Print', 'Cetak'), icon: 'ti-printer', onClick: function (b) { busy(b, print(doc, it.id)); } }]; }; }

  function regLists() {
    if (!window.DK || !DK.list) return;
    DK.list({ key: 'exp', sel: '#exp-table-wrap', doc: 'exp', fns: ['_expRenderListTable', 'renderExpenseClaims'], title: 2, party: 0, date: 1, amount: 3, status: 4, table: 'expense_claims', emptyText: L('No expense claims yet.', 'Belum ada tuntutan perbelanjaan.'), extra: extra('exp') });
    DK.list({ key: 'leave', sel: '#lv-table-wrap', doc: 'leave', fns: ['_leaveLoadTable', 'renderLeave'], title: 0, sub: 1, date: 2, amount: -1, status: 5, table: 'leave_requests', emptyText: L('No leave requests yet.', 'Belum ada permohonan cuti.'), extra: extra('leave') });
    DK.list({ key: 'adv', sel: '#adv-table-wrap', doc: 'adv', fns: ['_advLoadTable', 'renderAdvance'], title: 0, amount: 1, status: 3, date: -1, table: 'cash_advances', emptyText: L('No cash advances yet.', 'Belum ada pendahuluan tunai.'), extra: extra('adv') });
    DK.list({ key: 'ot', sel: '#ot-appr-wrap', doc: 'ot', fns: ['renderOTApprovals'], title: 0, date: 1, sub: 2, amount: 4, status: -1, table: 'ot_claims', emptyText: L('No pending OT claims.', 'Tiada tuntutan OT menunggu.'), extra: extra('ot') });
  }
  function boot() {
    if (!window.DK || !window.DKD || !document.getElementById('main')) return setTimeout(boot, 300);
    regLists();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
