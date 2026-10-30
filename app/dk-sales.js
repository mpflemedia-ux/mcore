/* dk-sales.js — DK Phase 1 · Sales cards & documents (EN/BM, existing tokens only).
   Lists (inv / quo / do / cn) → DK.list cards. Invoice detail → document card + Receipts card.
   Customer SOA, Delivery Order, Credit Note, Receipt → generated .pdoc (DKD.paper) + card view, PDF, Print, WhatsApp (DKS).
   DO public link: dk-public.html?public_do=<token> → customer confirms receipt (supabase/dk_phase1_sales.sql). */
(function () {
  if (window.DKSales) return;
  var S = window.DKSales = { v: 1 };
  function bm() { try { return APP.language === 'bm'; } catch (e) { return false; } }
  function L(en, b) { return bm() ? b : en; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(n) { return window.DK ? DK.money(n) : 'RM ' + Number(n || 0).toFixed(2); }
  function fd(d) { return window.DK ? DK.date(d) : String(d || '').slice(0, 10); }
  function tid() { try { return APP.tenant.id; } catch (e) { return null; } }
  function toast(m, k) { try { showToast(m, k || 'success'); } catch (e) {} }
  function main() { return document.getElementById('main'); }
  function cur() { return (window.DK && DK.cur) || { page: '', params: {} }; }
  function tenant() { try { return typeof _pdocGetTenant === 'function' ? Promise.resolve(_pdocGetTenant()).catch(function () { return APP.tenant || {}; }) : Promise.resolve(APP.tenant || {}); } catch (e) { return Promise.resolve({}); } }
  function coSub(t) { var a = ''; try { a = typeof _pdocAddressLine === 'function' ? _pdocAddressLine(t) : (t.address || ''); } catch (e) {} return [a, t.phone].filter(Boolean).join(' · '); }
  function base(t, title, meta) { return { co: t.name || (APP.tenant && APP.tenant.name) || '', sub: coSub(t), logo: t.logo_url || '', title: title, meta: meta || [], party: { name: '', lines: [] }, cols: [], rows: [], tots: [], notes: [], sigs: [], foot: t.name || '' }; }
  function custLines(c) { if (!c) return []; return [[c.address_line1, [c.postcode, c.city].filter(Boolean).join(' '), c.state].filter(Boolean).join(', '), c.phone, c.email].filter(Boolean); }
  var METHOD = { cash: ['Cash', 'Tunai'], bank_transfer: ['Bank Transfer', 'Pindahan Bank'], online_banking: ['Online Banking', 'Perbankan Online'], card: ['Card', 'Kad'] };
  function method(m) { var x = METHOD[m]; return x ? L(x[0], x[1]) : (m || '-'); }
  var DOST = { pending: ['Pending', 'Menunggu'], in_transit: ['In Transit', 'Dalam Perjalanan'], delivered: ['Delivered', 'Dihantar'], cancelled: ['Cancelled', 'Dibatalkan'] };
  function dost(s) { var x = DOST[s]; return x ? L(x[0], x[1]) : (s || '-'); }
  function slug(s) { return String(s || 'doc').replace(/[^A-Za-z0-9_-]+/g, '_'); }
  function q(p) { return Promise.resolve(p).then(function (r) { if (r && r.error) throw r.error; return r ? r.data : null; }); }
  function sec(title, inner, cls) { return '<div class="dk-doc-card ' + (cls || '') + '"><div class="dk-doc-lb">' + esc(title) + '</div>' + inner + '</div>'; }

  /* ---------- models ---------- */
  function rcptData(payId) {
    var t = tid();
    return Promise.all([tenant(), q(sb.from('payments').select('id,ref_no,payment_date,amount,payment_method,notes,customer_id,status').eq('id', payId).eq('tenant_id', t).maybeSingle()),
      q(sb.from('payment_allocations').select('invoice_id,amount').eq('payment_id', payId).eq('tenant_id', t))]).then(function (a) {
      var tn = a[0] || {}, p = a[1], al = a[2] || []; if (!p) return null;
      var ids = al.map(function (x) { return x.invoice_id; }).filter(Boolean);
      return Promise.all([ids.length ? q(sb.from('invoices').select('id,ref_no,total,paid_amt,customer_id,customer_name').in('id', ids).eq('tenant_id', t)) : [],
        p.customer_id ? q(sb.from('customers').select('name,phone,email,address_line1,city,state,postcode').eq('id', p.customer_id).eq('tenant_id', t).maybeSingle()).catch(function () { return null; }) : null]).then(function (b) {
        var invs = b[0] || [], c = b[1];
        if (!c && invs[0] && invs[0].customer_id) return q(sb.from('customers').select('name,phone,email,address_line1,city,state,postcode').eq('id', invs[0].customer_id).eq('tenant_id', t).maybeSingle()).catch(function () { return null; }).then(function (c2) { return { tn: tn, p: p, al: al, invs: invs, c: c2 }; });
        return { tn: tn, p: p, al: al, invs: invs, c: c };
      });
    });
  }
  function rcptModel(d) {
    var p = d.p, m = base(d.tn, L('Official Receipt', 'Resit Rasmi'), [{ k: L('Receipt No', 'No. Resit'), v: p.ref_no || '-' }, { k: L('Date', 'Tarikh'), v: fd(p.payment_date) }, { k: L('Method', 'Kaedah'), v: method(p.payment_method) }]);
    var name = (d.c && d.c.name) || (d.invs[0] && d.invs[0].customer_name) || '-';
    m.party = { name: L('Received from: ', 'Diterima daripada: ') + name, lines: custLines(d.c) };
    m.cols = [L('Description', 'Keterangan'), L('Amount', 'Amaun')];
    var inv = {}; d.invs.forEach(function (i) { inv[i.id] = i; });
    m.rows = (d.al.length ? d.al : [{ amount: p.amount }]).map(function (a) { var i = inv[a.invoice_id]; return [i ? L('Payment for invoice ', 'Bayaran bagi invois ') + i.ref_no : L('Payment received', 'Bayaran diterima'), money(a.amount)]; });
    m.tots = [{ k: L('Amount received', 'Amaun diterima'), v: money(p.amount), g: true }];
    if (d.invs.length === 1) m.tots.push({ k: L('Invoice balance', 'Baki invois'), v: money(Math.max(0, Number(d.invs[0].total || 0) - Number(d.invs[0].paid_amt || 0))) });
    if (p.notes) m.notes.push({ k: L('Notes', 'Nota'), v: p.notes });
    m.foot = (d.tn.name || '') + ' · ' + L('Computer-generated receipt. No signature required.', 'Resit janaan komputer. Tandatangan tidak diperlukan.');
    m.file = 'Receipt_' + slug(p.ref_no || p.id);
    return m;
  }
  function soaData(custId) {
    var t = tid();
    return Promise.all([tenant(), q(sb.from('customers').select('*').eq('id', custId).eq('tenant_id', t).maybeSingle()),
      q(sb.from('invoices').select('id,ref_no,issue_date,due_date,total,paid_amt,status').eq('customer_id', custId).eq('tenant_id', t).is('deleted_at', null).order('issue_date', { ascending: true })),
      q(sb.from('payments').select('id,ref_no,payment_date,amount,payment_method,status').eq('customer_id', custId).eq('tenant_id', t).order('payment_date', { ascending: true }).limit(200)).catch(function () { return []; })
    ]).then(function (a) { return a[1] ? { tn: a[0] || {}, c: a[1], invs: a[2] || [], pays: a[3] || [] } : null; });
  }
  function ymd() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function soaCalc(d) {
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var ag = { current: 0, d30: 0, d60: 0, d90: 0, d90p: 0 }, out = 0;
    var rows = d.invs.map(function (i) { var bal = Math.max(0, Number(i.total || 0) - Number(i.paid_amt || 0)); out += bal; return { i: i, bal: bal }; });
    rows.forEach(function (r) {
      if (r.bal <= 0.005) return;
      var due = r.i.due_date ? new Date(r.i.due_date) : (r.i.issue_date ? new Date(r.i.issue_date) : today); due.setHours(0, 0, 0, 0);
      var days = Math.floor((today - due) / 864e5);
      if (days <= 0) ag.current += r.bal; else if (days <= 30) ag.d30 += r.bal; else if (days <= 60) ag.d60 += r.bal; else if (days <= 90) ag.d90 += r.bal; else ag.d90p += r.bal;
    });
    return { rows: rows, ag: ag, out: out, today: today };
  }
  function soaModel(d) {
    var x = soaCalc(d), todayS = fd(ymd());
    var m = base(d.tn, L('Statement of Account', 'Penyata Akaun'), [{ k: L('As at', 'Setakat'), v: todayS }, { k: L('Customer', 'Pelanggan'), v: d.c.name || '-' }]);
    m.party = { name: d.c.name || '-', lines: custLines(d.c) };
    m.cols = [L('Invoice', 'Invois'), L('Total', 'Jumlah'), L('Paid', 'Dibayar'), L('Balance', 'Baki')];
    m.rows = x.rows.map(function (r) { return [(r.i.ref_no || '-') + ' · ' + fd(r.i.issue_date) + (r.i.due_date ? ' · ' + L('due ', 'tamat ') + fd(r.i.due_date) : ''), money(r.i.total), money(r.i.paid_amt), money(r.bal)]; });
    m.tots = [{ k: L('Current', 'Semasa'), v: money(x.ag.current) }, { k: L('1–30 days', '1–30 hari'), v: money(x.ag.d30) }, { k: L('31–60 days', '31–60 hari'), v: money(x.ag.d60) }, { k: L('61–90 days', '61–90 hari'), v: money(x.ag.d90) }, { k: L('>90 days', '>90 hari'), v: money(x.ag.d90p) }, { k: L('Total Outstanding', 'Jumlah Hutang'), v: money(x.out), g: true }];
    var pl = d.pays.filter(function (p) { return p.status !== 'void' && p.status !== 'voided'; }).slice(-30).map(function (p) { return fd(p.payment_date) + ' · ' + (p.ref_no || '-') + ' · ' + method(p.payment_method) + ' · ' + money(p.amount); });
    if (pl.length) m.notes.push({ k: L('Payment History', 'Sejarah Bayaran'), v: pl.join('\n') });
    m.foot = (d.tn.name || '') + ' · ' + L('Computer-generated statement.', 'Penyata janaan komputer.');
    m.file = 'SOA_' + slug(d.c.name) + '_' + ymd();
    m._out = x.out; m._today = todayS;
    return m;
  }
  function doData(id) {
    var t = tid();
    return Promise.all([tenant(), q(sb.from('delivery_orders').select('*,customers(name,phone,email,address_line1,city,state,postcode),invoices(ref_no)').eq('id', id).eq('tenant_id', t).maybeSingle())]).then(function (a) {
      var r = a[1]; if (!r) return null;
      var items = Promise.resolve(sb.from('delivery_order_items').select('*').eq('delivery_order_id', id)).then(function (x) { if (x.error) throw x.error; return x.data || []; })
        .then(function (rows) { if (rows.length) return rows.map(function (i) { return { d: i.description || i.product_name || i.name || '-', q: i.qty != null ? i.qty : i.quantity }; }); throw 0; })
        .catch(function () { return r.invoice_id ? Promise.resolve(sb.from('invoice_items').select('description,qty').eq('invoice_id', r.invoice_id)).then(function (x) { return (x.data || []).map(function (i) { return { d: i.description || '-', q: i.qty }; }); }, function () { return []; }) : []; });
      return items.then(function (it) { return { tn: a[0] || {}, r: r, items: it }; });
    });
  }
  function doModel(d) {
    var r = d.r, c = r.customers || {};
    var m = base(d.tn, L('Delivery Order', 'Pesanan Penghantaran'), [{ k: L('DO No', 'No. DO'), v: r.do_no || '-' }, { k: L('Date', 'Tarikh'), v: fd(r.created_at) }, { k: L('Invoice', 'Invois'), v: (r.invoices && r.invoices.ref_no) || '-' }, { k: L('Status', 'Status'), v: dost(r.status) }]);
    m.party = { name: c.name || '-', lines: [r.delivery_address || custLines(c)[0] || '', c.phone].filter(Boolean) };
    m.cols = [L('Item', 'Item'), L('Qty', 'Kuantiti')];
    m.rows = d.items.map(function (i) { return [i.d, i.q == null ? '-' : String(i.q)]; });
    var dv = [r.driver_name && L('Driver: ', 'Pemandu: ') + r.driver_name, r.vehicle_no && L('Vehicle: ', 'Kenderaan: ') + r.vehicle_no].filter(Boolean).join(' · ');
    if (dv) m.notes.push({ k: L('Delivery', 'Penghantaran'), v: dv });
    if (r.notes) m.notes.push({ k: L('Notes', 'Nota'), v: r.notes });
    if (r.received_at) m.notes.push({ k: L('Received', 'Diterima'), v: L('Confirmed by ', 'Disahkan oleh ') + (r.received_by_name || '-') + ' · ' + fd(r.received_at) + (r.received_note ? '\n' + r.received_note : '') });
    m.file = 'DO_' + slug(r.do_no || r.id);
    return m;
  }
  function cnData(id) {
    var t = tid();
    return Promise.all([tenant(), q(sb.from('credit_notes').select('*').eq('id', id).eq('tenant_id', t).maybeSingle())]).then(function (a) {
      var r = a[1]; if (!r) return null;
      return Promise.all([r.invoice_id ? q(sb.from('invoices').select('ref_no,customer_id').eq('id', r.invoice_id).eq('tenant_id', t).maybeSingle()).catch(function () { return null; }) : null]).then(function (b) {
        var inv = b[0], cid = r.customer_id || (inv && inv.customer_id);
        return (cid ? q(sb.from('customers').select('name,phone,email,address_line1,city,state,postcode').eq('id', cid).eq('tenant_id', t).maybeSingle()).catch(function () { return null; }) : Promise.resolve(null)).then(function (c) { return { tn: a[0] || {}, r: r, inv: inv, c: c }; });
      });
    });
  }
  function cnModel(d) {
    var r = d.r;
    var m = base(d.tn, L('Credit Note', 'Nota Kredit'), [{ k: L('CN No', 'No. NK'), v: r.ref_no || '-' }, { k: L('Date', 'Tarikh'), v: fd(r.credit_date) }, { k: L('Invoice', 'Invois'), v: (d.inv && d.inv.ref_no) || '-' }]);
    m.party = { name: r.customer_name || (d.c && d.c.name) || '-', lines: custLines(d.c) };
    m.cols = [L('Description', 'Keterangan'), L('Amount', 'Amaun')];
    m.rows = [[r.reason || L('Credit adjustment', 'Pelarasan kredit'), money(r.amount)]];
    m.tots = [{ k: L('Total credit', 'Jumlah kredit'), v: money(r.amount), g: true }, { k: L('Refunded', 'Dipulangkan'), v: r.refunded ? L('Yes', 'Ya') : L('No', 'Tidak') }];
    m.file = 'CN_' + slug(r.ref_no || r.id);
    return m;
  }
  function pdfOf(m) { return DKD.file(m, m.file ? m.file + '.pdf' : undefined).then(DKD.download); }
  function busy(b, p) { if (b) { b.disabled = true; b.classList.add('dk-busy'); } return Promise.resolve(p).catch(function (e) { toast(L('Failed: ', 'Gagal: ') + (e && e.message || e), 'error'); }).then(function () { if (b) { b.disabled = false; b.classList.remove('dk-busy'); } }); }

  /* ---------- DO public link (mirrors WAD.ensureLink; table delivery_orders, page dk-public.html) ---------- */
  function newTok() { var a = new Uint8Array(24); crypto.getRandomValues(a); return Array.prototype.map.call(a, function (x) { return (x < 16 ? '0' : '') + x.toString(16); }).join(''); }
  function doLink(id, lang) {
    var W = window.WAD, t = tid(), tok;
    return q(sb.from('delivery_orders').select('public_token').eq('id', id).eq('tenant_id', t).single()).then(function (r) {
      tok = r && r.public_token;
      return tok ? W.sha(tok).then(function (h) { return Promise.resolve(sb.from('doc_public_links').select('id,expires_at,revoked_at').eq('token_hash', h).maybeSingle()).then(function (x) { return x.data; }); }) : null;
    }).then(function (row) {
      if (row && !row.revoked_at && new Date(row.expires_at) > new Date()) return row;
      var fresh = !tok || row; if (fresh) tok = newTok();
      return (fresh ? q(sb.from('delivery_orders').update({ public_token: tok }).eq('id', id).eq('tenant_id', t)) : Promise.resolve()).then(function () { return W.sha(tok); })
        .then(function (h) { return q(sb.from('doc_public_links').insert({ tenant_id: t, doc_type: 'do', doc_id: id, token_hash: h, expires_at: new Date(Date.now() + 30 * 864e5).toISOString(), created_by: W.uid() }).select('id,expires_at').single()); });
    }).then(function (row) {
      return { link_id: row.id, expires_at: row.expires_at, url: W.base() + 'dk-public.html?public_do=' + encodeURIComponent(tok) + (lang === 'bm' ? '&lang=bm' : '') };
    }).catch(function (e) {
      console.warn('[dk-sales] DO link', e);
      toast(L('Confirm link not available yet (run supabase/dk_phase1_sales.sql).', 'Pautan pengesahan belum tersedia (jalankan supabase/dk_phase1_sales.sql).'), 'warning');
      return null;
    });
  }
  S.doLink = doLink;

  /* ---------- share registry ---------- */
  function regShare() {
    if (!window.DKS) return;
    DKS.reg({ doc: 'rcpt', mod: 'sales', tpls: ['rcpt_send'], load: function (id) { return rcptData(id).then(function (d) { if (!d) return null; var m = rcptModel(d), nm = (d.c && d.c.name) || (d.invs[0] && d.invs[0].customer_name) || ''; return { ref: d.invs.map(function (i) { return i.ref_no; }).join(', ') || d.p.ref_no, to: nm, phone: d.c && d.c.phone, vars: { name: nm, amt: money(d.p.amount), co: d.tn.name || '' }, model: m }; }); } });
    DKS.reg({ doc: 'soa', mod: 'sales', tpls: ['soa_send'], load: function (id) { return soaData(id).then(function (d) { if (!d) return null; var m = soaModel(d); return { ref: L('Statement', 'Penyata') + ' ' + m._today, to: d.c.name, phone: d.c.phone, vars: { name: d.c.name || '', amt: money(m._out), due: m._today, co: d.tn.name || '' }, model: m }; }); } });
    DKS.reg({ doc: 'do', mod: 'logistics', tpls: ['do_send', 'do_remind'], linkKeys: ['do_send', 'do_remind'], k: function (d) { return d._shared ? 'do_remind' : 'do_send'; },
      load: function (id) { return doData(id).then(function (d) { if (!d) return null; var c = d.r.customers || {}; return Promise.resolve(sb.from('doc_shares').select('id').eq('tenant_id', tid()).eq('doc_type', 'do').eq('doc_id', id).limit(1)).then(function (x) { return (x.data || []).length > 0; }, function () { return false; }).then(function (sh) {
        return { ref: d.r.do_no || 'DO', to: c.name || '', phone: c.phone, _shared: sh && !d.r.received_at, vars: { name: c.name || '', status: dost(d.r.status), co: d.tn.name || '' }, model: doModel(d), link: d.r.received_at ? null : function (lang) { return doLink(id, lang); } }; }); }); },
      onShared: function () { var p = cur().params || {}; if (cur().page === 'logistics' && p.view === 'do-detail' && S._doEl) S._doEl.dataset.dkTl = '1'; } });
    DKS.reg({ doc: 'cn', mod: 'sales', tpls: ['cn_send'], load: function (id) { return cnData(id).then(function (d) { if (!d) return null; var nm = d.r.customer_name || (d.c && d.c.name) || ''; return { ref: d.r.ref_no || 'CN', to: nm, phone: d.c && d.c.phone, vars: { name: nm, amt: money(d.r.amount), co: d.tn.name || '' }, model: cnModel(d) }; }); } });
  }

  /* ---------- lists → cards ---------- */
  function regLists() {
    if (!window.DK || !DK.list) return;
    DK.list({ key: 'inv', sel: '#inv-list-wrap', doc: 'inv', fns: ['_invRenderListTable', 'renderInvList'], title: 0, party: 1, date: 2, amount: 4, status: 6, bulk: true, table: 'invoices', emptyText: L('No invoices yet.', 'Belum ada invois.') });
    DK.list({ key: 'quo', sel: '#quo-list-wrap', doc: 'quo', fns: ['_quoRenderListTable', 'renderQuoList'], bulk: true, table: 'quotations', emptyText: L('No quotations yet.', 'Belum ada sebut harga.') });
    DK.list({ key: 'do', sel: '#do-list-wrap', doc: 'do', fns: ['_doRenderListTable', 'renderDOList'], amount: -1, bulk: true, table: 'delivery_orders', emptyText: L('No delivery orders yet.', 'Belum ada pesanan penghantaran.') });
    DK.list({ key: 'cn', sel: '#cn-list-wrap', doc: 'cn', fns: ['renderCreditNoteList', 'renderCreditNotes', '_cnRenderList'], title: 0, date: 1, party: 2, amount: 4, table: 'credit_notes', emptyText: L('No credit notes yet.', 'Belum ada nota kredit.'),
      extra: function (it) { return [
        { label: 'PDF', icon: 'ti-file-download', onClick: function (b) { busy(b, cnData(it.id).then(function (d) { if (d) return pdfOf(cnModel(d)); })); } },
        { label: L('Print', 'Cetak'), icon: 'ti-printer', onClick: function (b) { busy(b, cnData(it.id).then(function (d) { if (d) { var m = cnModel(d); DKD.printOne(m, { title: m.file }); } })); } }]; } });
  }

  /* ---------- invoice detail: document card + receipts ---------- */
  function mountInv(id) {
    var M = main(), p = M && M.querySelector('.pdoc:not(.print-only):not(.dk-gen)'); if (!p || p.dataset.dkMounted === id) return;
    p.dataset.dkMounted = id;
    var ref = (M.querySelector('.page-title') || {}).textContent || '';
    var acts = [];
    var paySec = document.getElementById('inv-pay-section');
    if (paySec) acts.push({ label: L('Record payment', 'Rekod bayaran'), icon: 'ti-cash', cls: 'btn-primary', onClick: function () { paySec.scrollIntoView({ behavior: 'smooth', block: 'center' }); var a = document.getElementById('pay-amount'); if (a) setTimeout(function () { a.focus(); }, 300); } });
    DKD.mount(p, { doc: 'inv', id: id, ref: ref, name: 'Invoice_' + slug(ref) + '.pdf', title: 'Invoice_' + slug(ref), actions: acts, sign: false });
    receipts(id);
  }
  function receipts(invId) {
    var M = main(); if (!M) return;
    var old = [].filter.call(M.querySelectorAll(':scope > .card.no-print'), function (c) { return c.id !== 'inv-pay-section' && !c.classList.contains('dk-rc'); }).pop();
    var t = tid();
    Promise.resolve(sb.from('payment_allocations').select('id,payment_id,amount').eq('invoice_id', invId).eq('tenant_id', t)).then(function (r) {
      var al = (r && r.data) || [];
      var ids = al.map(function (a) { return a.payment_id; }).filter(Boolean);
      return (ids.length ? Promise.resolve(sb.from('payments').select('id,ref_no,payment_date,payment_method').in('id', ids).eq('tenant_id', t)).then(function (x) { return x.data || []; }) : Promise.resolve([])).then(function (ps) {
        return al.map(function (a) { var p = ps.filter(function (x) { return String(x.id) === String(a.payment_id); })[0] || {}; return { aid: a.id, pid: a.payment_id, amt: a.amount, date: p.payment_date, method: p.payment_method, ref: p.ref_no }; })
          .sort(function (x, y) { return new Date(y.date || 0) - new Date(x.date || 0); });
      });
    }).then(function (rows) {
      if (!M.isConnected || main() !== M) return;
      var w = M.querySelector('.dk-rc'); if (w) w.remove();
      w = document.createElement('div'); w.className = 'dk-doc dk-rc no-print'; w.style.marginTop = '0';
      var h = rows.length ? rows.map(function (x, i) {
        return '<div class="dk-doc-it" data-i="' + i + '" style="flex-wrap:wrap"><div><b>' + esc(x.ref || L('Receipt', 'Resit')) + '</b><small>' + esc(fd(x.date) + ' · ' + method(x.method)) + '</small></div><span>' + esc(money(x.amt)) + '</span>' +
          '<div class="dk-doc-ft" style="flex-basis:100%"></div></div>';
      }).join('') : '<div style="color:var(--text-3);font-size:13px;padding:6px 0">' + esc(L('No payments recorded yet. Receipts appear here after each payment.', 'Belum ada bayaran direkod. Resit akan dipaparkan di sini selepas setiap bayaran.')) + '</div>';
      w.innerHTML = sec(L('Receipts', 'Resit') + (rows.length ? ' (' + rows.length + ')' : ''), h);
      rows.forEach(function (x, i) {
        var ft = w.querySelector('.dk-doc-it[data-i="' + i + '"] .dk-doc-ft');
        var add = function (label, icon, cls, fn) { var b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-sm ' + cls; b.innerHTML = '<i class="ti ' + icon + '"></i> ' + esc(label); b.onclick = function () { fn(b); }; ft.appendChild(b); };
        if (!x.pid) return;
        add('PDF', 'ti-file-download', 'btn-outline', function (b) { busy(b, rcptData(x.pid).then(function (d) { if (d) return pdfOf(rcptModel(d)); })); });
        add(L('Print', 'Cetak'), 'ti-printer', 'btn-outline', function (b) { busy(b, rcptData(x.pid).then(function (d) { if (d) { var m = rcptModel(d); DKD.printOne(m, { title: m.file }); } })); });
        if (window.DKS && DKS.has('rcpt')) add('WhatsApp', 'ti-brand-whatsapp', 'btn-outline dk-wa', function () { DKS.share('rcpt', x.pid); });
        var vb = old && [].filter.call(old.querySelectorAll('[onclick*="_payVoid"]'), function (b) { return (b.getAttribute('onclick') || '').indexOf(String(x.aid)) >= 0; })[0];
        if (vb) add(L('Void', 'Batal'), 'ti-ban', 'btn-outline', function () { vb.click(); });
        var last = ft.lastChild; if (vb && last) { last.style.color = 'var(--danger)'; last.style.borderColor = 'var(--danger)'; }
      });
      var host = old || M.querySelector('.dk-doc:not(.dk-rc)');
      if (old) { old.parentNode.insertBefore(w, old); old.style.display = 'none'; } else if (host) host.parentNode.insertBefore(w, host.nextSibling); else M.appendChild(w);
    }).catch(function (e) { console.warn('[dk-sales] receipts', e); });
  }

  /* ---------- quotation: read-only card view above the editor (existing quotations) ---------- */
  function mountQuo(id) {
    var M = main(), p = M && M.querySelector('.pdoc.print-only'); if (!p || p.dataset.dkMounted === id) return;
    p.dataset.dkMounted = id;
    var ref = ''; try { ref = (parseMeta(p) || '').trim(); } catch (e) {}
    var r = DKD.mount(p, { doc: 'quo', id: id, ref: ref, name: 'Quotation_' + slug(ref) + '.pdf', title: 'Quotation_' + slug(ref),
      actions: [{ label: L('Edit', 'Edit'), icon: 'ti-pencil', onClick: function () { var f = M.querySelector('#qf-save'); if (f) f.closest('.card') ? f.closest('.card').scrollIntoView({ behavior: 'smooth', block: 'start' }) : f.scrollIntoView(); } }] });
    if (!r) return;
    var hd = M.querySelector('.page-header'); if (hd && hd.nextSibling) M.insertBefore(r.el, hd.nextSibling);
  }
  function parseMeta(p) { var s = (p.querySelector('.pdoc-meta strong') || {}).textContent; return s || ''; }

  /* ---------- SOA ---------- */
  function mountSoa(custId) {
    var M = main(), src = document.getElementById('soa-doc'); if (!src || src.dataset.dkMounted === custId) return;
    src.dataset.dkMounted = custId;
    soaData(custId).then(function (d) {
      if (!d || !src.isConnected) return;
      var m = soaModel(d), p = DKD.paper(m);
      src.parentNode.insertBefore(p, src.nextSibling);
      src.style.display = 'none'; src.classList.add('no-print');
      DKD.mount(p, { doc: 'soa', id: custId, model: m, partyLabel: L('Statement for', 'Penyata untuk'), ref: m.file, name: m.file + '.pdf', title: m.file, sign: false, timeline: false });
    }).catch(function (e) { console.warn('[dk-sales] soa', e); delete src.dataset.dkMounted; });
  }

  /* ---------- DO detail ---------- */
  function mountDo(id) {
    var M = main(), sel = document.getElementById('do-status-select'); if (!sel || sel.dataset.dkDo === id) return;
    sel.dataset.dkDo = id;
    doData(id).then(function (d) {
      if (!d || !sel.isConnected) return;
      var m = doModel(d), p = DKD.paper(m), card = sel.closest('.card');
      var old = M.querySelector('.pdoc.dk-gen.dk-do'); if (old) { if (old.previousElementSibling && old.previousElementSibling.classList.contains('dk-doc')) old.previousElementSibling.remove(); old.remove(); }
      p.classList.add('dk-do');
      card.parentNode.insertBefore(p, card.nextSibling);
      var grid = card.firstElementChild; if (grid && grid !== sel.closest('.form-group')) grid.style.display = 'none';
      var acts = [];
      if (!d.r.received_at) acts.push({ label: L('Copy confirm link', 'Salin pautan pengesahan'), icon: 'ti-link', onClick: function (b) { busy(b, doLink(id, bm() ? 'bm' : 'en').then(function (lk) { if (!lk) return; var done = function () { toast(L('Link copied', 'Pautan disalin')); }; if (navigator.clipboard) return navigator.clipboard.writeText(lk.url).then(done, function () { window.prompt(L('Copy this link', 'Salin pautan ini'), lk.url); }); window.prompt(L('Copy this link', 'Salin pautan ini'), lk.url); })); } });
      var res = DKD.mount(p, { doc: 'do', id: id, model: m, ref: d.r.do_no, partyLabel: L('Deliver to', 'Hantar kepada'), name: m.file + '.pdf', title: m.file, actions: acts });
      S._doEl = res && res.el;
      if (res && d.r.received_at) {
        var b = document.createElement('div'); b.className = 'dk-doc-card';
        b.innerHTML = '<div class="dk-doc-lb">' + esc(L('Customer confirmation', 'Pengesahan pelanggan')) + '</div><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><i class="ti ti-circle-check" style="color:var(--success);font-size:18px"></i><b style="color:var(--text)">' + esc(d.r.received_by_name || '-') + '</b><span style="color:var(--text-3);font-size:13px">' + esc(window.DK && DK.dt ? DK.dt(d.r.received_at) : fd(d.r.received_at)) + '</span></div>' + (d.r.received_note ? '<div class="dk-doc-note" style="margin-top:6px">' + esc(d.r.received_note) + '</div>' : '');
        var tl = res.el.querySelector('.dk-doc-tl'); if (tl) res.el.insertBefore(b, tl); else res.el.appendChild(b);
      }
    }).catch(function (e) { console.warn('[dk-sales] do', e); delete sel.dataset.dkDo; });
  }

  /* ---------- watcher: mount once the page renders (no function wrapping → coexists with other add-ons) ---------- */
  var tmr = null;
  function scan() {
    var c = cur(), p = c.params || {}, M = main(); if (!M || !window.DKD) return;
    try {
      if (c.page === 'sales' && p.view === 'inv-detail' && p.id) mountInv(p.id);
      else if (c.page === 'sales' && p.view === 'quo-form' && p.id) mountQuo(p.id);
      else if (c.page === 'crm' && p.view === 'soa' && p.id) mountSoa(p.id);
      else if (c.page === 'logistics' && p.view === 'do-detail' && p.id) mountDo(p.id);
    } catch (e) { console.warn('[dk-sales]', e); }
  }
  S.scan = scan;
  function boot() {
    if (!window.DK || !window.DKD || !document.getElementById('main')) return setTimeout(boot, 300);
    regShare(); regLists();
    new MutationObserver(function () { clearTimeout(tmr); tmr = setTimeout(scan, 120); }).observe(document.getElementById('main'), { childList: true });
    scan();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
