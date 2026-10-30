/* dk-purch.js — DK Phase 3 · Purchasing (PO, GRN, Supplier bill + remittance advice, Supplier SOA). EN/BM, existing tokens only.
   Lists (po / bill / suppliers) → DK.list cards. PO detail → document card + signatures (prepared/approved) + GRN slips.
   Bill detail → generated bill voucher card (verified / approved-for-payment signatures) + remittance advice per payment.
   Supplier SOA → generated statement card (PDF / Print). Notifications: supabase/dk_phase3_purch.sql (server-side). */
(function () {
  if (window.DKPurch) return;
  var S = window.DKPurch = { v: 1 };
  function bm() { try { return APP.language === 'bm'; } catch (e) { return false; } }
  function L(en, b) { return bm() ? b : en; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(n) { return window.DK ? DK.money(n) : 'RM ' + Number(n || 0).toFixed(2); }
  function fd(d) { return d ? (window.DK ? DK.date(d) : String(d).slice(0, 10)) : '-'; }
  function tid() { try { return APP.tenant.id; } catch (e) { return null; } }
  function toast(m, k) { try { showToast(m, k || 'success'); } catch (e) {} }
  function main() { return document.getElementById('main'); }
  function cur() { return (window.DK && DK.cur) || { page: '', params: {} }; }
  function q(p) { return Promise.resolve(p).then(function (r) { if (r && r.error) throw r.error; return r ? r.data : null; }); }
  function slug(s) { return String(s || 'doc').replace(/[^A-Za-z0-9_-]+/g, '_'); }
  function ymd() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function tenant() { try { return typeof _pdocGetTenant === 'function' ? Promise.resolve(_pdocGetTenant()).catch(function () { return APP.tenant || {}; }) : Promise.resolve(APP.tenant || {}); } catch (e) { return Promise.resolve({}); } }
  function coSub(t) { var a = ''; try { a = typeof _pdocAddressLine === 'function' ? _pdocAddressLine(t) : (t.address || ''); } catch (e) {} return [a, t.phone].filter(Boolean).join(' · '); }
  function base(t, title, meta) { return { co: t.name || (APP.tenant && APP.tenant.name) || '', sub: coSub(t), logo: t.logo_url || '', title: title, meta: meta || [], party: { name: '', lines: [] }, cols: [], rows: [], tots: [], notes: [], sigs: [], foot: t.name || '' }; }
  function supLines(s) { if (!s) return []; return [s.address || [s.address_line1, [s.postcode, s.city].filter(Boolean).join(' '), s.state].filter(Boolean).join(', '), [s.phone, s.email].filter(Boolean).join(' · ')].filter(Boolean); }
  var METHOD = { cash: ['Cash', 'Tunai'], bank_transfer: ['Bank Transfer', 'Pindahan Bank'], online_banking: ['Online Banking', 'Perbankan Online'], card: ['Card', 'Kad'], cheque: ['Cheque', 'Cek'] };
  function method(m) { var x = METHOD[String(m || '').toLowerCase().replace(/ /g, '_')]; return x ? L(x[0], x[1]) : (m || '-'); }
  var BST = { paid: ['Paid', 'Lunas'], partial: ['Partial', 'Separa'], unpaid: ['Unpaid', 'Belum bayar'] };
  function bst(s) { var x = BST[s] || BST.unpaid; return L(x[0], x[1]); }
  function sec(title, inner, cls) { return '<div class="dk-doc-card ' + (cls || '') + '"><div class="dk-doc-lb">' + esc(title) + '</div>' + inner + '</div>'; }
  function busy(b, p) { if (b) { b.disabled = true; b.classList.add('dk-busy'); } return Promise.resolve(p).catch(function (e) { toast(L('Failed: ', 'Gagal: ') + (e && e.message || e), 'error'); }).then(function () { if (b) { b.disabled = false; b.classList.remove('dk-busy'); } }); }
  function pdfOf(m) { return DKD.file(m, m.file + '.pdf').then(DKD.download); }
  function printSig(m) {
    var p = DKD.paper(m, { cls: 'dk-tmp' }); if (m.sigs && m.sigs.length) DKD.sigBoxes(p, m.sigs);
    (main() || document.body).appendChild(p);
    var gone = false, rm = function () { if (gone) return; gone = true; p.remove(); window.removeEventListener('afterprint', rm); };
    window.addEventListener('afterprint', rm); DKD.printOne(p, { title: m.file }); setTimeout(rm, 4500);
  }
  function blankSigs(doc, names) { var sl = { bill: ['verified', 'approved'], grn: ['received', 'checked'], rem: [] }[doc] || []; return sl.map(function (s, i) { return { label: window.DKSign ? DKSign.slotLabel(doc, s) : s, name: (names || [])[i] || '', at: '' }; }); }
  function sigs(doc, id, names) { var b = blankSigs(doc, names); if (!window.DKSign || !DKSign.has(doc)) return Promise.resolve(b); return DKSign.sigsFor(doc, id).then(function (a) { return a && a.length ? a : b; }, function () { return b; }); }

  /* ---------- models ---------- */
  function supplier(id) { return id ? q(sb.from('suppliers').select('*').eq('id', id).eq('tenant_id', tid()).maybeSingle()).catch(function () { return null; }) : Promise.resolve(null); }
  function billData(id) {
    var t = tid();
    return Promise.all([tenant(), q(sb.from('supplier_bills').select('*').eq('id', id).eq('tenant_id', t).maybeSingle())]).then(function (a) {
      var b = a[1]; if (!b) return null;
      return Promise.all([supplier(b.supplier_id), b.po_id ? q(sb.from('purchase_orders').select('po_no').eq('id', b.po_id).eq('tenant_id', t).maybeSingle()).catch(function () { return null; }) : null,
        q(sb.from('supplier_payments').select('*').eq('bill_id', id).eq('tenant_id', t).order('payment_date', { ascending: true })).catch(function () { return []; })])
        .then(function (c) { return { tn: a[0] || {}, b: b, s: c[0], po: c[1], pays: c[2] || [] }; });
    });
  }
  function billModel(d) {
    var b = d.b, ref = b.bill_no || b.ref_no || '-', bal = Math.max(0, Number(b.total || 0) - Number(b.paid_amt || 0));
    var m = base(d.tn, L('Supplier Bill', 'Bil Pembekal'), [{ k: L('Bill No', 'No. Bil'), v: ref }, { k: L('Bill date', 'Tarikh bil'), v: fd(b.bill_date) }, { k: L('Due', 'Tarikh akhir'), v: fd(b.due_date) }, { k: 'PO', v: d.po && d.po.po_no }, { k: L('Status', 'Status'), v: bst(b.status) }]);
    m.party = { name: (d.s && d.s.name) || '-', lines: supLines(d.s) };
    m.cols = [L('Description', 'Keterangan'), L('Amount', 'Amaun')];
    m.rows = [[b.description || b.notes || L('Supplier bill', 'Bil pembekal') + ' ' + ref, money(b.total)]];
    m.tots = [{ k: L('Total', 'Jumlah'), v: money(b.total), g: true }, { k: L('Paid', 'Dibayar'), v: money(b.paid_amt) }, { k: L('Balance', 'Baki'), v: money(bal) }];
    var pl = d.pays.map(function (p) { return fd(p.payment_date) + ' · ' + method(p.method) + ' · ' + money(p.amount); });
    if (pl.length) m.notes.push({ k: L('Payments', 'Bayaran'), v: pl.join('\n') });
    m.file = 'Bill_' + slug(ref) + '_' + slug(d.s && d.s.name);
    return m;
  }
  function remModel(d, pid) {
    var p = d.pays.filter(function (x) { return String(x.id) === String(pid); })[0]; if (!p) return null;
    var b = d.b, ref = b.bill_no || b.ref_no || '-';
    var m = base(d.tn, L('Remittance Advice', 'Nasihat Kiriman Wang'), [{ k: L('Payment date', 'Tarikh bayaran'), v: fd(p.payment_date) }, { k: L('Method', 'Kaedah'), v: method(p.method) }, { k: L('Reference', 'Rujukan'), v: p.reference || p.ref_no || p.memo || '' }]);
    m.party = { name: L('To: ', 'Kepada: ') + ((d.s && d.s.name) || '-'), lines: supLines(d.s) };
    m.cols = [L('Bill', 'Bil'), L('Bill total', 'Jumlah bil'), L('Paid now', 'Dibayar kini')];
    m.rows = [[ref + (b.bill_date ? ' · ' + fd(b.bill_date) : ''), money(b.total), money(p.amount)]];
    m.tots = [{ k: L('Amount remitted', 'Amaun dikirim'), v: money(p.amount), g: true }, { k: L('Bill balance', 'Baki bil'), v: money(Math.max(0, Number(b.total || 0) - Number(b.paid_amt || 0))) }];
    if (d.s && (d.s.bank_name || d.s.bank_account)) m.notes.push({ k: L('Paid to account', 'Dibayar ke akaun'), v: [d.s.bank_name, d.s.bank_account || d.s.bank_account_no].filter(Boolean).join(' · ') });
    m.foot = (d.tn.name || '') + ' · ' + L('Please reconcile against your statement. Computer-generated advice.', 'Sila padankan dengan penyata anda. Nasihat janaan komputer.');
    m.file = 'Remittance_' + slug(ref) + '_' + slug(p.payment_date);
    return m;
  }
  function grnData(id) {
    var t = tid();
    return Promise.all([tenant(), q(sb.from('goods_received_notes').select('*').eq('id', id).eq('tenant_id', t).maybeSingle())]).then(function (a) {
      var g = a[1]; if (!g) return null;
      return Promise.all([supplier(g.supplier_id), g.po_id ? q(sb.from('purchase_orders').select('po_no').eq('id', g.po_id).eq('tenant_id', t).maybeSingle()).catch(function () { return null; }) : null,
        q(sb.from('goods_received_items').select('*').eq('grn_id', id)).catch(function () { return []; }),
        g.po_id ? q(sb.from('purchase_order_items').select('*,products(name_en,name_bm)').eq('po_id', g.po_id)).catch(function () { return []; }) : [],
        g.received_by ? q(sb.from('user_profiles').select('full_name').eq('id', g.received_by).eq('tenant_id', t).maybeSingle()).catch(function () { return null; }) : null])
        .then(function (c) { return { tn: a[0] || {}, g: g, s: c[0], po: c[1], items: c[2] || [], poi: c[3] || [], by: c[4] && c[4].full_name }; });
    });
  }
  function grnModel(d) {
    var g = d.g, pi = {}; d.poi.forEach(function (x) { pi[x.id] = x; });
    var m = base(d.tn, L('Goods Received Note', 'Nota Penerimaan Barang'), [{ k: L('GRN No', 'No. GRN'), v: g.grn_no || '-' }, { k: L('Received', 'Diterima'), v: fd(g.received_date) }, { k: 'PO', v: d.po && d.po.po_no }]);
    m.party = { name: L('From: ', 'Daripada: ') + ((d.s && d.s.name) || '-'), lines: supLines(d.s) };
    m.cols = [L('Item', 'Item'), L('Ordered', 'Dipesan'), L('Received', 'Diterima')];
    m.rows = d.items.map(function (it) { var p = pi[it.po_item_id] || {}, pr = p.products || {}; return [p.description || (bm() ? pr.name_bm || pr.name_en : pr.name_en || pr.name_bm) || '-', p.qty == null ? '-' : String(p.qty), String(it.qty_received == null ? '-' : it.qty_received)]; });
    if (g.notes) m.notes.push({ k: L('Notes', 'Nota'), v: g.notes });
    m.foot = (d.tn.name || '') + ' · ' + L('Goods received in good order unless noted.', 'Barang diterima dalam keadaan baik melainkan dinyatakan.');
    m.file = 'GRN_' + slug(g.grn_no || g.id);
    return sigs('grn', g.id, [d.by || '', '']).then(function (s) { m.sigs = s; return m; });
  }
  function ssoaData(id) {
    var t = tid();
    return Promise.all([tenant(), supplier(id), q(sb.from('supplier_bills').select('id,bill_no,bill_date,due_date,total,paid_amt,status').eq('supplier_id', id).eq('tenant_id', t).is('deleted_at', null).order('bill_date', { ascending: true }))])
      .then(function (a) { return a[1] ? { tn: a[0] || {}, s: a[1], bills: a[2] || [] } : null; });
  }
  function ssoaModel(d) {
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var ag = { c: 0, a: 0, b: 0, e: 0, f: 0 }, out = 0;
    var rows = d.bills.map(function (b) {
      var bal = Math.max(0, Number(b.total || 0) - Number(b.paid_amt || 0)); out += bal;
      if (bal > 0.005) { var due = new Date(b.due_date || b.bill_date || today); due.setHours(0, 0, 0, 0); var n = Math.floor((today - due) / 864e5); if (n <= 0) ag.c += bal; else if (n <= 30) ag.a += bal; else if (n <= 60) ag.b += bal; else if (n <= 90) ag.e += bal; else ag.f += bal; }
      return [(b.bill_no || '-') + ' · ' + fd(b.bill_date) + (b.due_date ? ' · ' + L('due ', 'tamat ') + fd(b.due_date) : ''), money(b.total), money(b.paid_amt), money(bal)];
    });
    var m = base(d.tn, L('Supplier Statement of Account', 'Penyata Akaun Pembekal'), [{ k: L('As at', 'Setakat'), v: fd(ymd()) }, { k: L('Supplier', 'Pembekal'), v: d.s.name || '-' }]);
    m.party = { name: d.s.name || '-', lines: supLines(d.s) };
    m.cols = [L('Bill', 'Bil'), L('Total', 'Jumlah'), L('Paid', 'Dibayar'), L('Balance', 'Baki')];
    m.rows = rows;
    m.tots = [{ k: L('Current', 'Semasa'), v: money(ag.c) }, { k: L('1–30 days', '1–30 hari'), v: money(ag.a) }, { k: L('31–60 days', '31–60 hari'), v: money(ag.b) }, { k: L('61–90 days', '61–90 hari'), v: money(ag.e) }, { k: L('>90 days', '>90 hari'), v: money(ag.f) }, { k: L('Total Outstanding', 'Jumlah Hutang'), v: money(out), g: true }];
    m.foot = (d.tn.name || '') + ' · ' + L('Computer-generated statement.', 'Penyata janaan komputer.');
    m.file = 'Supplier_SOA_' + slug(d.s.name) + '_' + ymd();
    return m;
  }
  S.billData = billData; S.billModel = billModel; S.remModel = remModel; S.grnData = grnData; S.grnModel = grnModel; S.ssoaData = ssoaData; S.ssoaModel = ssoaModel;

  /* ---------- PO detail: card view + signatures + GRN slips ---------- */
  function mountPo(id) {
    var M = main(), p = M && M.querySelector('.pdoc.print-only'); if (!p || p.dataset.dkMounted === id) return;
    p.dataset.dkMounted = id;
    var ref = ((p.querySelector('.pdoc-meta strong') || {}).textContent || '').trim();
    if (window.DKSign && DKSign.has('po')) [].forEach.call(p.querySelectorAll('div'), function (d) { if (!d.children.length && /Signature is not required|Tandatangan tidak diperlukan/.test(d.textContent || '')) d.remove(); }); // replaced by signature boxes
    var r = DKD.mount(p, { doc: 'po', id: id, ref: ref, name: 'PO_' + slug(ref) + '.pdf', title: 'PO_' + slug(ref) });
    if (!r) return;
    var hd = M.querySelector('.page-header'), act = hd && hd.nextElementSibling;
    var anchor = act && act.classList.contains('no-print') && !act.classList.contains('card') ? act : hd;
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(r.el, anchor.nextSibling);
    grnCard(id);
  }
  function grnCard(poId) {
    var M = main(); var hist = [].filter.call(M.querySelectorAll('.card.no-print'), function (c) { var h = c.firstElementChild; return h && /Receiving History|Sejarah Penerimaan/.test(h.textContent || ''); })[0];
    if (!hist) return;
    Promise.resolve(sb.from('goods_received_notes').select('id,grn_no,received_date').eq('po_id', poId).eq('tenant_id', tid()).order('received_date', { ascending: false })).then(function (x) {
      var rows = (x && x.data) || []; if (!hist.isConnected) return;
      var w = document.createElement('div'); w.className = 'dk-doc dk-grn no-print';
      w.innerHTML = sec(L('Receiving History', 'Sejarah Penerimaan') + (rows.length ? ' (' + rows.length + ')' : ''), rows.length ? rows.map(function (g, i) {
        return '<div class="dk-doc-it" data-i="' + i + '" style="flex-wrap:wrap"><div><b>' + esc(g.grn_no || 'GRN') + '</b><small>' + esc(fd(g.received_date)) + '</small></div><div class="dk-doc-ft" style="flex-basis:100%"></div></div>';
      }).join('') : '<div style="color:var(--text-3);font-size:13px;padding:6px 0">' + esc(L('No receipts yet', 'Tiada penerimaan lagi')) + '</div>');
      rows.forEach(function (g, i) {
        var ft = w.querySelector('.dk-doc-it[data-i="' + i + '"] .dk-doc-ft');
        var add = function (label, icon, fn) { var b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-sm btn-outline'; b.innerHTML = '<i class="ti ' + icon + '"></i> ' + esc(label); b.onclick = function () { fn(b); }; ft.appendChild(b); };
        add('PDF', 'ti-file-download', function (b) { busy(b, grnData(g.id).then(function (d) { if (d) return grnModel(d).then(pdfOf); })); });
        add(L('Print', 'Cetak'), 'ti-printer', function (b) { busy(b, grnData(g.id).then(function (d) { if (d) return grnModel(d).then(printSig); })); });
        if (window.DKSign && DKSign.has('grn')) add(L('Sign', 'Tandatangan'), 'ti-signature', function () { DKSign.open('grn', g.id, g.grn_no || 'GRN'); });
      });
      hist.parentNode.insertBefore(w, hist); hist.style.display = 'none';
    }, function (e) { console.warn('[dk-purch] grn', e); });
  }

  /* ---------- Bill detail: voucher card + remittance advice ---------- */
  function mountBill(id) {
    var M = main(), hd = M && M.querySelector('.page-header'); if (!hd || M.dataset.dkBill === id) return;
    M.dataset.dkBill = id;
    var pay = document.getElementById('bill-pay-date'), grid = pay && pay.closest('div[style*="grid-template-columns"]');
    if (grid) grid.style.gridTemplateColumns = 'repeat(auto-fit,minmax(150px,1fr))'; // was 1fr 1fr 1fr auto → overflowed at 390px
    billData(id).then(function (d) {
      if (!d || !hd.isConnected) return;
      var m = billModel(d), p = DKD.paper(m), sum = hd.nextElementSibling;
      p.classList.add('dk-bill'); p.style.display = 'none'; p.classList.add('print-only');
      M.appendChild(p);
      var r = DKD.mount(p, { doc: 'bill', id: id, model: m, ref: d.b.bill_no || d.b.ref_no, partyLabel: L('Supplier', 'Pembekal'), name: m.file + '.pdf', title: m.file });
      if (!r) return;
      p.style.display = '';
      hd.parentNode.insertBefore(r.el, hd.nextSibling);
      if (sum && sum.classList.contains('card') && !sum.querySelector('input,select,button')) sum.style.display = 'none';
      remCard(d, M);
    }).catch(function (e) { console.warn('[dk-purch] bill', e); delete M.dataset.dkBill; });
  }
  function remCard(d, M) {
    var hist = [].filter.call(M.querySelectorAll(':scope > .card'), function (c) { var h = c.firstElementChild; return h && /Payment History|Sejarah Bayaran/.test(h.textContent || ''); })[0];
    var rows = d.pays.slice().reverse();
    var w = document.createElement('div'); w.className = 'dk-doc dk-rem no-print';
    w.innerHTML = sec(L('Payments & remittance advice', 'Bayaran & nasihat kiriman wang') + (rows.length ? ' (' + rows.length + ')' : ''), rows.length ? rows.map(function (p, i) {
      return '<div class="dk-doc-it" data-i="' + i + '" style="flex-wrap:wrap"><div><b>' + esc(fd(p.payment_date)) + '</b><small>' + esc(method(p.method)) + '</small></div><span>' + esc(money(p.amount)) + '</span><div class="dk-doc-ft" style="flex-basis:100%"></div></div>';
    }).join('') : '<div style="color:var(--text-3);font-size:13px;padding:6px 0">' + esc(L('No payments yet. A remittance advice appears here after each payment.', 'Belum ada bayaran. Nasihat kiriman wang akan dipaparkan selepas setiap bayaran.')) + '</div>');
    rows.forEach(function (p, i) {
      var ft = w.querySelector('.dk-doc-it[data-i="' + i + '"] .dk-doc-ft');
      var add = function (label, icon, fn, danger) { var b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-sm btn-outline'; if (danger) { b.style.color = 'var(--danger)'; b.style.borderColor = 'var(--danger)'; } b.innerHTML = '<i class="ti ' + icon + '"></i> ' + esc(label); b.onclick = function () { fn(b); }; ft.appendChild(b); };
      add('PDF', 'ti-file-download', function (b) { busy(b, pdfOf(remModel(d, p.id))); });
      add(L('Print', 'Cetak'), 'ti-printer', function () { var m = remModel(d, p.id); DKD.printOne(m, { title: m.file }); });
      var vb = hist && [].filter.call(hist.querySelectorAll('[onclick*="_billPayVoid"]'), function (b) { return (b.getAttribute('onclick') || '').indexOf(String(p.id)) >= 0; })[0];
      if (vb) add(L('Void', 'Batal'), 'ti-ban', function () { vb.click(); }, true);
    });
    if (hist) { hist.parentNode.insertBefore(w, hist); hist.style.display = 'none'; } else M.appendChild(w);
  }

  /* ---------- Supplier SOA ---------- */
  function mountSsoa(id) {
    var src = document.getElementById('sup-soa-doc'); if (!src || src.dataset.dkMounted === id) return;
    src.dataset.dkMounted = id;
    ssoaData(id).then(function (d) {
      if (!d || !src.isConnected) return;
      var m = ssoaModel(d), p = DKD.paper(m);
      src.parentNode.insertBefore(p, src.nextSibling); src.style.display = 'none'; src.classList.add('no-print');
      var hb = main().querySelector('.page-header > button'); if (hb) hb.style.display = 'none'; // old window.print() button → card's Print
      DKD.mount(p, { doc: 'ssoa', id: id, model: m, partyLabel: L('Statement for', 'Penyata untuk'), ref: m.file, name: m.file + '.pdf', title: m.file, sign: false, timeline: false });
    }).catch(function (e) { console.warn('[dk-purch] ssoa', e); delete src.dataset.dkMounted; });
  }

  /* ---------- lists ---------- */
  function regLists() {
    if (!window.DK || !DK.list) return;
    DK.list({ key: 'po', sel: '#po-list-wrap', doc: 'po', fns: ['_poRenderListTable', 'renderPOList'], title: 0, party: 1, date: 2, amount: 3, status: 4, bulk: true, table: 'purchase_orders', emptyText: L('No purchase orders yet.', 'Belum ada pesanan belian.') });
    DK.list({ key: 'bill', sel: '#bill-list-wrap', doc: 'bill', fns: ['_billRenderListTable', 'renderSupplierBills'], title: 0, party: 1, date: 2, amount: 4, status: 5, table: 'supplier_bills', emptyText: L('No supplier bills yet.', 'Belum ada bil pembekal.'),
      extra: function (it) { return [
        { label: 'PDF', icon: 'ti-file-download', onClick: function (b) { busy(b, billData(it.id).then(function (d) { if (d) return pdfOf(billModel(d)); })); } },
        { label: L('Print', 'Cetak'), icon: 'ti-printer', onClick: function (b) { busy(b, billData(it.id).then(function (d) { if (!d) return; var m = billModel(d); return sigs('bill', it.id, []).then(function (s) { m.sigs = s; printSig(m); }); })); } }]; } });
    DK.list({ key: 'supp', sel: '#supp-table-wrap', fns: ['renderSuppliers', '_suppLoad'], title: 0, sub: 1, party: -1, date: -1, amount: -1, status: -1, table: 'suppliers', emptyText: L('No suppliers yet.', 'Belum ada pembekal.'),
      id: function (tr) { var b = tr.querySelector('[onclick*="supplier-soa"]'), m = b && /id:'([^']+)'/.exec(b.getAttribute('onclick')); return m ? m[1] : null; },
      extra: function (it) { return [{ label: L('Statement PDF', 'PDF Penyata'), icon: 'ti-file-analytics', onClick: function (b) { busy(b, ssoaData(it.id).then(function (d) { if (d) return pdfOf(ssoaModel(d)); })); } }]; } });
  }

  var tmr = null;
  function scan() {
    var c = cur(), p = c.params || {}; if (!main() || !window.DKD) return;
    try {
      if (c.page !== 'purchasing') return;
      if (p.view === 'po-detail' && p.id) mountPo(p.id);
      else if (p.view === 'bill-detail' && p.id) mountBill(p.id);
      else if (p.view === 'supplier-soa' && p.id) mountSsoa(p.id);
      else delete main().dataset.dkBill;
    } catch (e) { console.warn('[dk-purch]', e); }
  }
  S.scan = scan;
  function boot() {
    if (!window.DK || !window.DKD || !document.getElementById('main')) return setTimeout(boot, 300);
    regLists();
    new MutationObserver(function () { clearTimeout(tmr); tmr = setTimeout(scan, 120); }).observe(document.getElementById('main'), { childList: true });
    scan();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
