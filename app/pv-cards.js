/* Payment Vouchers revamp — card UI v1 (loads after pv-core.js).
   Overrides renderPVDList / renderPVDForm / renderPVDDetail with the payroll-style layout:
   one card per payee (payee, bank · account no, amount, chips; accordion), sticky Total + Save footer,
   inline edit while Draft (replaces the 900px form), locked once shared / signed / approved.
   Payee picker (Suppliers + Employees -> bank, account no, phone; free text allowed), duplicate payee+amount
   warning (same month), method summary chips, per-line pay status / paid date / receipt once approved.
   Tokens only, EN/BM, flex-wrap buttons. */
(function () {
  if (window.PVC_V1 || !window.PVX) return;
  window.PVC_V1 = true;
  var X = window.PVX, L = X.L, esc = X.esc, rm = X.rm, r2 = X.r2;
  var C = window.PVC = {};
  function $(id) { return document.getElementById(id); }
  function main() { return $('main'); }
  function T() { return X.tid(); }

  /* ---------- css ---------- */
  function css() {
    if ($('pvc-css')) return;
    var s = document.createElement('style'); s.id = 'pvc-css';
    s.textContent =
      '.pvc-page{min-width:0}' +
      '.pvc-wrap{display:flex;flex-direction:column;gap:6px;margin:0 0 12px}' +
      '.pvc-card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);min-width:0;color:var(--text)}' +
      '.pvc-card.pvc-open{border-color:var(--primary)}' +
      '.pvc-card.pvc-dup{border-color:var(--warning)}' +
      '.pvc-head{display:flex;align-items:center;gap:10px;padding:10px 12px;min-height:48px;cursor:pointer;width:100%;background:none;border:0;color:inherit;text-align:left;font:inherit}' +
      '.pvc-main{flex:1 1 auto;min-width:0}' +
      '.pvc-name{font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.pvc-sub{font-size:11px;color:var(--text-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:1px}' +
      '.pvc-chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:5px}' +
      '.pvc-chips .badge{font-size:10px;white-space:nowrap}' +
      '.pvc-amt{font-family:"Space Grotesk",var(--font);font-size:14px;font-weight:700;white-space:nowrap;text-align:right}' +
      '.pvc-chev{color:var(--text-3);transition:transform var(--transition);flex:0 0 auto}' +
      '.pvc-open .pvc-chev{transform:rotate(180deg)}' +
      '.pvc-body{display:none;border-top:1px solid var(--border);padding:10px 12px 12px}' +
      '.pvc-open .pvc-body{display:block}' +
      '.pvc-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:8px 14px}' +
      '.pvc-full{grid-column:1/-1}' +
      '.pvc-grid .form-group{margin:0;min-width:0}' +
      '.pvc-grid .form-input,.pvc-grid .form-select{width:100%;min-height:36px}' +
      '.pvc-cap{font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:var(--text-3);font-weight:600;margin:0 0 3px}' +
      '.pvc-val{font-size:13px;overflow-wrap:anywhere;color:var(--text)}' +
      '.pvc-val.pvc-mono{font-family:"Space Grotesk",var(--font)}' +
      '.pvc-acts,.pvc-tools,.pvc-hacts{display:flex;flex-wrap:wrap;gap:6px;align-items:center}' +
      '.pvc-acts{margin-top:10px}' +
      '.pvc-tools{margin:0 0 10px}' +
      '.pvc-acts .btn,.pvc-tools .btn,.pvc-hacts .btn,.pvc-bar .btn{white-space:nowrap}' +
      '.pvc-danger{color:var(--danger)!important;border-color:var(--danger)!important}' +
      '.pvc-sec{border-top:1px dashed var(--border);margin-top:10px;padding-top:10px}' +
      '.pvc-meta{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:12px;margin:0 0 10px;display:grid;grid-template-columns:minmax(0,1fr);gap:10px}' +
      '.pvc-meta .form-group{margin:0}' +
      '.pvc-mrow{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;font-size:12px;color:var(--text-2)}' +
      '.pvc-sum{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}' +
      '.pvc-mchip{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--border);border-radius:999px;padding:4px 10px;font-size:11px;background:var(--bg-card);color:var(--text-2);white-space:nowrap}' +
      '.pvc-mchip b{color:var(--text);font-family:"Space Grotesk",var(--font)}' +
      '.pvc-note{font-size:12px;border-radius:var(--radius-sm);padding:8px 10px;border:1px solid var(--border);background:var(--bg);color:var(--text-2);margin:0 0 10px;display:flex;gap:8px;align-items:flex-start}' +
      '.pvc-note i{flex:0 0 auto;margin-top:1px}' +
      '.pvc-note.pvc-warn{border-color:var(--warning)}.pvc-note.pvc-warn i{color:var(--warning)}' +
      '.pvc-note.pvc-lock i{color:var(--info)}' +
      '.pvc-note ul{margin:4px 0 0 16px;padding:0}' +
      '.pvc-field{position:relative}' +
      '.pvc-pick{position:absolute;left:0;right:0;top:100%;z-index:60;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-sm);box-shadow:var(--shadow-lg);max-height:260px;overflow:auto;margin-top:2px}' +
      '.pvc-pick button{display:flex;width:100%;gap:8px;align-items:center;justify-content:space-between;padding:8px 10px;background:none;border:0;border-bottom:1px solid var(--border);color:var(--text);text-align:left;font:inherit;font-size:13px;cursor:pointer}' +
      '.pvc-pick button:hover,.pvc-pick button:focus{background:var(--bg)}' +
      '.pvc-pick small{color:var(--text-3);font-size:11px;white-space:nowrap}' +
      '.pvc-pick .pvc-pk-free{color:var(--text-3);font-style:italic}' +
      '.pvc-empty{padding:28px 12px;text-align:center;color:var(--text-3);font-size:13px}' +
      '.pvc-bar{z-index:50;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px 12px;background:var(--bg-card);border-top:1px solid var(--border);padding:10px 14px calc(10px + env(safe-area-inset-bottom));color:var(--text)}' +
      '.pvc-tot{display:flex;flex-direction:column;min-width:0}' +
      '.pvc-tot span{font-size:11px;color:var(--text-3);white-space:nowrap}' +
      '.pvc-tot b{font-family:"Space Grotesk",var(--font);font-size:16px;white-space:nowrap}' +
      '.pvc-bar .pvc-bacts{display:flex;align-items:center;gap:8px;flex-wrap:wrap}' +
      '.pvc-bar .pvc-unsaved{font-size:11px;font-weight:600;color:var(--warning);white-space:nowrap;display:none}' +
      '.pvc-bar.pvc-dirty .pvc-unsaved{display:inline}' +
      '.pvc-bar .btn{min-height:40px}' +
      '.pvc-listcard{cursor:pointer}' +
      '.pvc-filters{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}' +
      '.pvc-filters .btn{white-space:nowrap}' +
      '.pvc-err{font-size:12px;color:var(--danger)}.pvc-err:empty{display:none}' +
      '@media screen and (min-width:600px){.pvc-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.pvc-meta{grid-template-columns:2fr 1fr}}' +
      '@media screen and (max-width:900px){' +
        '#main:has(> .pvc-bar){padding-bottom:calc(76px + env(safe-area-inset-bottom))!important}' +
        '.pvc-bar{position:fixed;left:0;right:0;bottom:0}' +
        'body:has(.pvc-bar) #ai-chat-fab{bottom:84px}' +
        'body:has(.pvc-bar) #dash-home-fab{bottom:144px}' +
        'body:has(.pvc-bar) #scroll-top-btn{bottom:204px}' +
      '}' +
      '@media screen and (min-width:901px){' +
        '.pvc-wrap{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:8px;align-items:start}' +
        '.pvc-wrap>.pvc-open{grid-column:1/-1}' +
        '.pvc-open .pvc-grid{grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}' +
        '.pvc-bar{position:sticky;bottom:0;margin:4px 0 16px;border:1px solid var(--border);border-radius:var(--radius);padding:10px 16px;box-shadow:var(--shadow)}' +
      '}' +
      '@media print{.pvc-page,.pvc-bar{display:none!important}}';
    document.head.appendChild(s);
  }
  C.css = css;

  /* ---------- shared bits ---------- */
  function catOpts(v) {
    return '<option value="">' + esc(L('— Category —', '— Kategori —')) + '</option>' + X.CATS.map(function (c) {
      return '<option value="' + c.k + '"' + (v === c.k ? ' selected' : '') + '>' + esc(L(c.en, c.bm)) + '</option>';
    }).join('');
  }
  function methodOpts(v) {
    var list = X.METHODS.slice(); if (v && list.indexOf(v) < 0) list.push(v);
    return list.map(function (m) { return '<option value="' + esc(m) + '"' + (v === m ? ' selected' : '') + '>' + esc(X.methodLabel(m)) + '</option>'; }).join('');
  }
  function glOpts(v, accs) {
    return '<option value="">' + esc(L('Default for category', 'Lalai mengikut kategori')) + '</option>' + (accs || []).filter(function (a) {
      return ['expense', 'liability', 'cost_of_sales', 'cogs'].indexOf(String(a.account_type || '').toLowerCase()) >= 0 || a.id === v;
    }).map(function (a) { return '<option value="' + a.id + '"' + (a.id === v ? ' selected' : '') + '>' + esc((a.code ? a.code + ' · ' : '') + (a.name_en || '')) + '</option>'; }).join('');
  }
  C.catOpts = catOpts; C.methodOpts = methodOpts; C.glOpts = glOpts;
  function bankLine(l) { return [l.bank_name, l.bank_account_no].filter(function (x) { return String(x || '').trim(); }).join(' · '); }
  C.bankLine = bankLine;
  function payeeTypeLabel(t) { return t === 'supplier' ? L('Supplier', 'Pembekal') : t === 'employee' ? L('Employee', 'Pekerja') : L('Free text', 'Teks bebas'); }
  C.payeeTypeLabel = payeeTypeLabel;

  /* method summary chips: "Bank Transfer · 3 · RM 1,200.00" */
  function methodSummary(lines) {
    var m = {}, order = [];
    lines.forEach(function (l) {
      var k = l.payment_method || 'Bank Transfer';
      if (!m[k]) { m[k] = { n: 0, t: 0 }; order.push(k); }
      m[k].n++; m[k].t += Number(l.amount) || 0;
    });
    if (!order.length) return '';
    return '<div class="pvc-sum">' + order.map(function (k) {
      return '<span class="pvc-mchip"><i class="ti ti-' + (k === 'Cheque' ? 'file-dollar' : k === 'Cash' ? 'cash' : 'building-bank') + '"></i>' + esc(X.methodLabel(k)) + ' · ' + m[k].n + ' · <b>' + esc(rm(r2(m[k].t))) + '</b></span>';
    }).join('') + '</div>';
  }
  C.methodSummary = methodSummary;

  /* ---------- payee picker (works on any text input) ---------- */
  C.attachPicker = function (inp, onPick) {
    if (!inp || inp.__pvcPick) return;
    inp.__pvcPick = true;
    inp.setAttribute('autocomplete', 'off');
    var host = inp.parentElement; if (host && !host.classList.contains('pvc-field')) host.classList.add('pvc-field');
    var box = null, list = [];
    function close() { if (box) { box.remove(); box = null; } }
    function show() {
      var q = String(inp.value || '').trim().toLowerCase();
      X.payees().then(function (all) {
        if (document.activeElement !== inp) return;
        list = all.filter(function (p) { return !q || p.name.toLowerCase().indexOf(q) >= 0; }).slice(0, 12);
        close();
        box = document.createElement('div'); box.className = 'pvc-pick'; box.setAttribute('role', 'listbox');
        box.innerHTML = list.map(function (p, i) {
          return '<button type="button" role="option" data-i="' + i + '"><span>' + esc(p.name) + '</span><small>' + esc(payeeTypeLabel(p.type) + (p.bank_name ? ' · ' + p.bank_name : '')) + '</small></button>';
        }).join('') + (q ? '<button type="button" data-free="1" class="pvc-pk-free">' + esc(L('Use "' + inp.value.trim() + '" as free text', 'Guna "' + inp.value.trim() + '" sebagai teks bebas')) + '</button>' : '');
        if (!list.length && !q) { close(); return; }
        box.addEventListener('mousedown', function (e) { e.preventDefault(); });
        box.addEventListener('click', function (e) {
          var b = e.target.closest('button'); if (!b) return;
          if (b.getAttribute('data-free')) { onPick({ type: 'other', id: null, name: inp.value.trim(), free: true }); close(); return; }
          var p = list[Number(b.getAttribute('data-i'))]; if (!p) return;
          inp.value = p.name; onPick(p); close();
        });
        (host || inp.parentNode).appendChild(box);
      });
    }
    inp.addEventListener('focus', show);
    inp.addEventListener('input', show);
    inp.addEventListener('blur', function () { setTimeout(close, 150); });
    inp.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  };

  /* ---------- duplicate payee + amount (same month, other batches / single PVs, and inside this batch) ---------- */
  C.dupCheck = async function (o) {
    // o: { lines:[{payee_name,payee_id,amount,id}], date, batchId, pvId }
    var d = new Date((o.date || X.today()) + 'T00:00:00');
    var from = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01';
    var nx = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    var to = nx.getFullYear() + '-' + String(nx.getMonth() + 1).padStart(2, '0') + '-01';
    var hits = [];
    var key = function (x) { return String(x.payee_name || '').trim().toLowerCase(); };
    var same = function (a, b) { return Math.abs(r2(a.amount) - r2(b.amount)) < 0.005 && ((a.payee_id && b.payee_id && a.payee_id === b.payee_id) || (key(a) && key(a) === key(b))); };
    var mine = (o.lines || []).filter(function (l) { return key(l) && Number(l.amount) > 0; });
    if (!mine.length) return hits;
    mine.forEach(function (a, i) { mine.forEach(function (b, j) { if (j > i && same(a, b)) hits.push({ line: a, where: L('this batch (twice)', 'kelompok ini (dua kali)') }); }); });
    try {
      var bq = await sb.from('payment_voucher_batches').select('id,ref_no,status').eq('tenant_id', T()).is('deleted_at', null).gte('batch_date', from).lt('batch_date', to).limit(200);
      var bs = ((bq && bq.data) || []).filter(function (b) { return b.id !== o.batchId && b.status !== 'void'; });
      if (bs.length) {
        var ids = bs.map(function (b) { return b.id; }), refOf = {};
        bs.forEach(function (b) { refOf[b.id] = b.ref_no; });
        var lq = await sb.from('payment_voucher_batch_lines').select('*').in('batch_id', ids).eq('tenant_id', T()).limit(2000);
        ((lq && lq.data) || []).forEach(function (x) { mine.forEach(function (a) { if (same(a, x)) hits.push({ line: a, where: refOf[x.batch_id] || 'PVD' }); }); });
      }
      var pq = await sb.from('payment_vouchers').select('*').eq('tenant_id', T()).is('deleted_at', null).gte('voucher_date', from).lt('voucher_date', to).neq('status', 'void').limit(500);
      ((pq && pq.data) || []).forEach(function (v) {
        if (o.pvId && v.id === o.pvId) return;
        if (o.batchId && v.batch_id === o.batchId) return;
        if (v.batch_id) return; // counted through its batch line
        mine.forEach(function (a) { if (same(a, v)) hits.push({ line: a, where: v.ref_no || 'PV' }); });
      });
    } catch (e) { console.warn('pv dup', e); }
    return hits;
  };
  C.dupHtml = function (hits) {
    if (!hits || !hits.length) return '';
    var seen = {}, items = [];
    hits.forEach(function (h) { var k = (h.line.payee_name || '') + '|' + h.line.amount + '|' + h.where; if (seen[k]) return; seen[k] = 1; items.push('<li>' + esc((h.line.payee_name || '') + ' · ' + rm(h.line.amount) + ' — ' + h.where) + '</li>'); });
    return '<div class="pvc-note pvc-warn" role="status"><i class="ti ti-alert-triangle"></i><div><b>' + esc(L('Possible duplicate payment this month', 'Kemungkinan bayaran berganda bulan ini')) + '</b><ul>' + items.slice(0, 8).join('') + '</ul></div></div>';
  };

  /* ================= PVD list ================= */
  var LF = { st: 'all' };
  async function renderPVDList() {
    css();
    var m = main(); if (!m) return;
    var ready = await X.ready();
    m.innerHTML = '<div class="pvc-page">' +
      '<div class="page-header no-print"><div><div class="page-title">' + esc(L('PV Disbursement', 'Penyaluran PV')) + '</div>' +
      '<button type="button" class="btn btn-outline btn-sm" style="margin-top:6px;white-space:nowrap" onclick="openPage(\'vouchers\',{})"><i class="ti ti-arrow-left"></i> ' + esc(L('Vouchers', 'Baucar')) + '</button></div>' +
      '<div class="pvc-hacts">' +
      (ready ? '<button type="button" class="btn btn-outline btn-sm" data-pvl="sd"><i class="ti ti-file-import"></i> ' + esc(L('Import from Salary Disbursement', 'Import dari Penyaluran Gaji')) + '</button>' : '') +
      (ready && X.isApprover() ? '<button type="button" class="btn btn-outline btn-sm" data-pvl="set"><i class="ti ti-settings"></i> ' + esc(L('Settings', 'Tetapan')) + '</button>' : '') +
      '<button type="button" class="btn btn-primary btn-sm" onclick="openPage(\'vouchers\',{view:\'pvd-form\'})"><i class="ti ti-plus"></i> ' + esc(L('New Disbursement', 'Penyaluran Baru')) + '</button>' +
      '</div></div>' +
      (typeof _accTabs === 'function' ? '<div class="no-print">' + _accTabs('pv') + '</div>' : '') +
      (ready ? '' : '<div class="pvc-note pvc-warn"><i class="ti ti-database"></i><div>' + esc(L('Signatures, SD import and payment tracking need supabase/pv_revamp_01.sql (run it in Supabase).', 'Tandatangan, import SD dan jejak bayaran perlukan supabase/pv_revamp_01.sql (jalankan di Supabase).')) + '</div></div>') +
      '<div class="pvc-filters" id="pvc-lf"></div><div class="pvc-wrap" id="pvc-list"><div class="pvc-empty"><div class="spinner"></div></div></div></div>';
    m.querySelector('.pvc-hacts').addEventListener('click', function (e) {
      var b = e.target.closest('[data-pvl]'); if (!b) return;
      var a = b.getAttribute('data-pvl');
      if (a === 'sd' && window.PVT) PVT.importSD();
      if (a === 'set' && window.PVT) PVT.settingsSheet();
    });
    var r = await sb.from('payment_voucher_batches').select('*').eq('tenant_id', T()).is('deleted_at', null).order('batch_date', { ascending: false }).order('created_at', { ascending: false }).limit(200);
    var box = $('pvc-list'); if (!box) return;
    if (r.error) { box.innerHTML = '<div class="pvc-empty" style="color:var(--danger)">' + esc(r.error.message) + '</div>'; return; }
    var all = r.data || [];
    var groups = [
      { k: 'all', en: 'All', bm: 'Semua', f: function () { return true; } },
      { k: 'draft', en: 'Draft', bm: 'Draf', f: function (b) { return (b.status || 'draft') === 'draft'; } },
      { k: 'sign', en: 'Awaiting signatures', bm: 'Menunggu tandatangan', f: function (b) { return b.status === 'shared' || b.status === 'pending'; } },
      { k: 'approved', en: 'Approved', bm: 'Diluluskan', f: function (b) { return b.status === 'approved' || b.status === 'converted'; } },
      { k: 'paid', en: 'Paid', bm: 'Dibayar', f: function (b) { return b.status === 'paid'; } },
      { k: 'void', en: 'Void', bm: 'Batal', f: function (b) { return b.status === 'void'; } }
    ];
    function draw() {
      var g = groups.filter(function (x) { return x.k === LF.st; })[0] || groups[0];
      $('pvc-lf').innerHTML = groups.map(function (x) {
        var n = all.filter(x.f).length;
        return '<button type="button" class="btn btn-sm ' + (x.k === LF.st ? 'btn-primary' : 'btn-outline') + '" data-st="' + x.k + '">' + esc(L(x.en, x.bm)) + ' (' + n + ')</button>';
      }).join('');
      var rows = all.filter(g.f);
      box.innerHTML = rows.length ? rows.map(function (b) {
        return '<div class="pvc-card pvc-listcard" role="link" tabindex="0" data-id="' + b.id + '"><div class="pvc-head">' +
          '<div class="pvc-main"><div class="pvc-name">' + esc((b.ref_no || 'PVD') + ' · ' + (b.title || '')) + '</div>' +
          '<div class="pvc-sub">' + esc(X.dmy(b.batch_date) + ' · ' + (b.line_count || 0) + ' ' + L('payee(s)', 'penerima')) + '</div>' +
          '<div class="pvc-chips">' + X.stBadge(b.status) + (b.source === 'sd' ? '<span class="badge badge-blue">' + esc(L('From payroll', 'Dari gaji')) + '</span>' : '') + '</div></div>' +
          '<div class="pvc-amt">' + esc(rm(b.total_amount)) + '</div><i class="ti ti-chevron-right pvc-chev"></i></div></div>';
      }).join('') : '<div class="pvc-empty">' + esc(L('No disbursements yet', 'Tiada penyaluran lagi')) + '</div>';
    }
    draw();
    $('pvc-lf').addEventListener('click', function (e) { var b = e.target.closest('[data-st]'); if (!b) return; LF.st = b.getAttribute('data-st'); draw(); });
    box.addEventListener('click', function (e) { var c = e.target.closest('[data-id]'); if (c) openPage('vouchers', { view: 'pvd-detail', id: c.getAttribute('data-id') }); });
    box.addEventListener('keydown', function (e) { if (e.key !== 'Enter') return; var c = e.target.closest('[data-id]'); if (c) openPage('vouchers', { view: 'pvd-detail', id: c.getAttribute('data-id') }); });
  }

  /* ================= PVD detail (view + inline edit) ================= */
  var S = null;
  function blankLine() { return { _k: 'n' + Math.random().toString(36).slice(2, 8), payee_name: '', payee_type: 'other', payee_id: null, amount: 0, payment_method: 'Bank Transfer', bank_name: '', bank_account_no: '', phone: '', cheque_no: '', description: '', category: '', gl_account_id: null, bill_id: null }; }
  C.blankLine = blankLine;

  async function renderPVDForm(id) { return renderPVDDetail(id || null); }

  async function renderPVDDetail(id) {
    css();
    var m = main(); if (!m) return;
    m.innerHTML = '<div class="pvc-empty"><div class="spinner"></div></div>';
    var ready = await X.ready();
    var st = { id: id, isNew: !id, ready: ready, open: {}, dirty: false, dup: [], accs: [], set: await X.settings() };
    if (id) {
      var bq = await sb.from('payment_voucher_batches').select('*').eq('id', id).eq('tenant_id', T()).maybeSingle();
      if (!bq.data) { m.innerHTML = '<div class="empty-state" style="padding:60px"><p>' + esc(L('Not found', 'Tidak dijumpai')) + '</p></div>'; return; }
      st.b = bq.data;
      var lq = await sb.from('payment_voucher_batch_lines').select('*').eq('batch_id', id).eq('tenant_id', T()).order('sort_order');
      st.lines = (lq.data || []).map(function (l) { l._k = l.id; return l; });
    } else {
      st.b = { status: 'draft', title: '', batch_date: X.today(), ref_no: '' };
      st.lines = [blankLine()];
      st.open[st.lines[0]._k] = true;
    }
    try { st.accs = await X.accounts(); } catch (e) {}
    S = st;
    draw();
    if (!X.locked(st.b.status)) refreshDup();
    if (window.PVX && X.remindTick) X.remindTick();
  }

  function total() { return r2(S.lines.reduce(function (s, l) { return s + (Number(l.amount) || 0); }, 0)); }
  function editable() { return !X.locked(S.b.status); }
  function payPhase() { return ['approved', 'converted', 'paid'].indexOf(S.b.status) >= 0; }

  function headHtml(l) {
    var chips = '<span class="badge badge-gray">' + esc(X.methodLabel(l.payment_method)) + '</span>' +
      (l.category ? '<span class="badge badge-blue">' + esc(X.catLabel(l.category)) + '</span>' : '') +
      (payPhase() ? X.payBadge(l.pay_status) : '') +
      (l.receipt_path ? '<span class="badge badge-green"><i class="ti ti-paperclip"></i> ' + esc(L('Receipt', 'Resit')) + '</span>' : '');
    return '<div class="pvc-main"><div class="pvc-name">' + esc(l.payee_name || L('New payee', 'Penerima baru')) + '</div>' +
      '<div class="pvc-sub">' + esc(bankLine(l) || (l.payment_method === 'Cheque' && l.cheque_no ? L('Cheque ', 'Cek ') + l.cheque_no : L('No bank details', 'Tiada butiran bank'))) + '</div>' +
      '<div class="pvc-chips">' + chips + '</div></div>' +
      '<div class="pvc-amt">' + esc(rm(l.amount)) + '</div><i class="ti ti-chevron-down pvc-chev"></i>';
  }
  function fld(i, f, label, val, attrs, full) {
    return '<div class="form-group' + (full ? ' pvc-full' : '') + '"><label class="form-label" for="pvc-' + f + '-' + i + '">' + esc(label) + '</label>' +
      '<input id="pvc-' + f + '-' + i + '" class="form-input" data-f="' + f + '" data-i="' + i + '" value="' + esc(val == null ? '' : val) + '" ' + (attrs || '') + '></div>';
  }
  function ro(label, val, mono, full) {
    return '<div' + (full ? ' class="pvc-full"' : '') + '><div class="pvc-cap">' + esc(label) + '</div><div class="pvc-val' + (mono ? ' pvc-mono' : '') + '">' + (val ? esc(val) : '<span style="color:var(--text-3)">—</span>') + '</div></div>';
  }
  function bodyEdit(l, i) {
    return '<div class="pvc-grid">' +
      '<div class="form-group pvc-full"><label class="form-label" for="pvc-payee_name-' + i + '">' + esc(L('Payee', 'Penerima')) + ' <span style="color:var(--text-3);font-weight:400">· ' + esc(payeeTypeLabel(l.payee_type)) + '</span></label>' +
      '<div class="pvc-field"><input id="pvc-payee_name-' + i + '" class="form-input" data-f="payee_name" data-i="' + i + '" data-pick="1" maxlength="160" placeholder="' + esc(L('Search supplier / employee or type a name', 'Cari pembekal / pekerja atau taip nama')) + '" value="' + esc(l.payee_name) + '"></div></div>' +
      fld(i, 'amount', L('Amount (RM)', 'Jumlah (RM)'), l.amount ? l.amount : '', 'type="number" inputmode="decimal" min="0" step="0.01"') +
      '<div class="form-group"><label class="form-label" for="pvc-payment_method-' + i + '">' + esc(L('Method', 'Kaedah')) + '</label><select id="pvc-payment_method-' + i + '" class="form-select" data-f="payment_method" data-i="' + i + '">' + methodOpts(l.payment_method || 'Bank Transfer') + '</select></div>' +
      fld(i, 'bank_name', L('Bank', 'Bank'), l.bank_name, 'maxlength="80"') +
      fld(i, 'bank_account_no', L('Account no.', 'No. akaun'), l.bank_account_no, 'maxlength="40" inputmode="numeric"') +
      fld(i, 'phone', L('Phone', 'Telefon'), l.phone, 'maxlength="30" inputmode="tel"') +
      (l.payment_method === 'Cheque' ? fld(i, 'cheque_no', L('Cheque no.', 'No. cek'), l.cheque_no, 'maxlength="40"') : '') +
      '<div class="form-group"><label class="form-label" for="pvc-category-' + i + '">' + esc(L('Category', 'Kategori')) + '</label><select id="pvc-category-' + i + '" class="form-select" data-f="category" data-i="' + i + '">' + catOpts(l.category) + '</select></div>' +
      '<div class="form-group"><label class="form-label" for="pvc-gl_account_id-' + i + '">' + esc(L('GL account', 'Akaun GL')) + '</label><select id="pvc-gl_account_id-' + i + '" class="form-select" data-f="gl_account_id" data-i="' + i + '">' + glOpts(l.gl_account_id, S.accs) + '</select></div>' +
      fld(i, 'description', L('Description', 'Keterangan'), l.description, 'maxlength="300"', true) +
      (l.category === 'salary' ? '<div class="pvc-full" style="font-size:11px;color:var(--text-3)">' + esc(L('Salary is already expensed by the payroll journal — paying this line posts no second expense.', 'Gaji sudah direkod oleh jurnal gaji — bayaran baris ini tidak merekod perbelanjaan kedua.')) + '</div>' : '') +
      '</div><div class="pvc-acts"><button type="button" class="btn btn-outline btn-sm pvc-danger" data-a="rm" data-i="' + i + '"><i class="ti ti-trash"></i> ' + esc(L('Remove payee', 'Buang penerima')) + '</button></div>';
  }
  function glName(id) { var a = (S.accs || []).filter(function (x) { return x.id === id; })[0]; return a ? (a.code ? a.code + ' · ' : '') + (a.name_en || '') : ''; }
  function bodyView(l, i) {
    var h = '<div class="pvc-grid">' +
      ro(L('Payee', 'Penerima'), (l.payee_name || '') + ' · ' + payeeTypeLabel(l.payee_type), false, true) +
      ro(L('Bank', 'Bank'), l.bank_name) + ro(L('Account no.', 'No. akaun'), l.bank_account_no, true) +
      ro(L('Phone', 'Telefon'), l.phone) + ro(L('Method', 'Kaedah'), X.methodLabel(l.payment_method) + (l.cheque_no ? ' · ' + l.cheque_no : '')) +
      ro(L('Category', 'Kategori'), X.catLabel(l.category)) + ro(L('GL account', 'Akaun GL'), glName(l.gl_account_id) || (l.category === 'salary' ? L('Payroll journal', 'Jurnal gaji') : L('Default for category', 'Lalai mengikut kategori'))) +
      ro(L('Description', 'Keterangan'), l.description, false, true) + '</div>';
    if (payPhase()) h += payHtml(l, i);
    return h;
  }
  function payHtml(l, i) {
    var h = '<div class="pvc-sec"><div class="pvc-grid">' +
      '<div><div class="pvc-cap">' + esc(L('Payment', 'Bayaran')) + '</div><div class="pvc-val">' + X.payBadge(l.pay_status) + (l.paid_date ? ' ' + esc(X.dmy(l.paid_date)) : '') + '</div></div>' +
      (l.voucher_id ? '<div><div class="pvc-cap">' + esc(L('Payment voucher', 'Baucar bayaran')) + '</div><div class="pvc-val"><a href="javascript:void(0)" style="color:var(--primary)" data-a="pv" data-id="' + l.voucher_id + '">' + esc(L('Open PV', 'Buka PV')) + ' <i class="ti ti-external-link"></i></a></div></div>' : '') +
      (l.pay_ref ? ro(L('Bank reference', 'Rujukan bank'), l.pay_ref, true) : '') +
      (l.pay_status === 'failed' && l.fail_reason ? ro(L('Failure reason', 'Sebab gagal'), l.fail_reason, false, true) : '') +
      '</div><div class="pvc-acts">';
    if (l.pay_status !== 'paid') {
      if (l.voucher_id) h += '<button type="button" class="btn btn-primary btn-sm" data-a="paid" data-i="' + i + '"><i class="ti ti-cash"></i> ' + esc(L('Mark paid', 'Tanda dibayar')) + '</button>' +
        (l.pay_status !== 'failed' ? '<button type="button" class="btn btn-outline btn-sm pvc-danger" data-a="fail" data-i="' + i + '"><i class="ti ti-alert-circle"></i> ' + esc(L('Mark failed', 'Tanda gagal')) + '</button>' : '');
      else h += '<span style="font-size:12px;color:var(--text-3)">' + esc(L('Create the payment vouchers first.', 'Cipta baucar bayaran dahulu.')) + '</span>';
    }
    h += '<button type="button" class="btn btn-outline btn-sm" data-a="rcpt" data-i="' + i + '"><i class="ti ti-upload"></i> ' + esc(l.receipt_path ? L('Replace receipt', 'Ganti resit') : L('Upload receipt', 'Muat naik resit')) + '</button>' +
      (l.receipt_path ? '<button type="button" class="btn btn-outline btn-sm" data-a="vrcpt" data-i="' + i + '"><i class="ti ti-eye"></i> ' + esc(L('View receipt', 'Lihat resit')) + '</button>' : '') +
      '</div></div>';
    return h;
  }
  function cardHtml(l, i) {
    var dup = S.dup.some(function (h) { return h.line === l || (h.line._k && h.line._k === l._k); });
    return '<div class="pvc-card' + (S.open[l._k] ? ' pvc-open' : '') + (dup ? ' pvc-dup' : '') + '" data-k="' + esc(l._k) + '">' +
      '<button type="button" class="pvc-head" data-a="tog" data-i="' + i + '" aria-expanded="' + (S.open[l._k] ? 'true' : 'false') + '">' + headHtml(l) + '</button>' +
      '<div class="pvc-body">' + (S.open[l._k] ? (editable() ? bodyEdit(l, i) : bodyView(l, i)) : '') + '</div></div>';
  }

  function draw() {
    var m = main(); if (!m || !S) return;
    var b = S.b, ed = editable(), st = b.status || 'draft';
    var ref = b.ref_no || L('New disbursement', 'Penyaluran baru');
    var acts = '';
    if (!S.isNew) {
      acts += '<button type="button" class="btn btn-outline btn-sm" data-h="print"><i class="ti ti-printer"></i> ' + esc(L('Print', 'Cetak')) + '</button>' +
        '<button type="button" class="btn btn-outline btn-sm" data-h="pdf"><i class="ti ti-file-type-pdf"></i> PDF</button>' +
        '<button type="button" class="btn btn-outline btn-sm" data-h="wa"><i class="ti ti-brand-whatsapp"></i> ' + esc(L('Share PDF', 'Kongsi PDF')) + '</button>' +
        '<button type="button" class="btn btn-outline btn-sm" data-h="dupl"><i class="ti ti-copy"></i> ' + esc(L('Duplicate', 'Salin')) + '</button>';
      if (payPhase()) acts += '<button type="button" class="btn btn-outline btn-sm" data-h="csv"><i class="ti ti-file-spreadsheet"></i> ' + esc(L('Bank file (CSV)', 'Fail bank (CSV)')) + '</button>';
      var noPv = S.lines.some(function (l) { return !l.voucher_id; });
      if ((st === 'approved' || st === 'converted') && noPv && X.isApprover()) acts += '<button type="button" class="btn btn-outline btn-sm" data-h="conv"><i class="ti ti-transform"></i> ' + esc(L('Create payment vouchers', 'Cipta baucar bayaran')) + '</button>';
      if (st === 'draft') acts += '<button type="button" class="btn btn-outline btn-sm pvc-danger" data-h="del"><i class="ti ti-trash"></i> ' + esc(L('Delete', 'Padam')) + '</button>';
      else if (['shared', 'pending'].indexOf(st) >= 0 && X.isApprover()) acts += '<button type="button" class="btn btn-outline btn-sm pvc-danger" data-h="void"><i class="ti ti-ban"></i> ' + esc(L('Void', 'Batalkan')) + '</button>';
    }
    var lockNote = '';
    if (!ed) lockNote = '<div class="pvc-note pvc-lock"><i class="ti ti-lock"></i><div>' + esc(
      st === 'paid' ? L('Paid — locked.', 'Dibayar — dikunci.') :
      st === 'void' ? L('Void — locked.', 'Batal — dikunci.') :
      (st === 'approved' || st === 'converted') ? L('Approved — amounts locked. Record each payment below.', 'Diluluskan — jumlah dikunci. Rekod setiap bayaran di bawah.') :
      L('Shared for signing — amounts locked. Reset signatures to edit.', 'Dikongsi untuk tandatangan — jumlah dikunci. Set semula tandatangan untuk edit.')) + '</div></div>';
    var meta = '<div class="pvc-meta">' + (ed ?
      '<div class="form-group"><label class="form-label" for="pvc-title">' + esc(L('Title', 'Tajuk')) + '</label><input id="pvc-title" class="form-input" maxlength="160" data-b="title" value="' + esc(b.title || '') + '" placeholder="' + esc(L('e.g. Supplier payments – week 2', 'cth. Bayaran pembekal – minggu 2')) + '"></div>' +
      '<div class="form-group"><label class="form-label" for="pvc-date">' + esc(L('Date', 'Tarikh')) + '</label><input id="pvc-date" type="date" class="form-input" data-b="batch_date" value="' + esc(b.batch_date || X.today()) + '"></div>'
      : ro(L('Title', 'Tajuk'), b.title) + ro(L('Date', 'Tarikh'), X.dmy(b.batch_date))) +
      '<div class="pvc-mrow pvc-full" style="grid-column:1/-1">' + X.stBadge(st) +
      (b.source === 'sd' ? '<span class="badge badge-blue">' + esc(L('From payroll', 'Dari gaji')) + '</span>' : '') +
      '<span id="pvc-sigprog"></span></div></div>';
    var tools = '';
    if (ed) tools = '<div class="pvc-tools">' +
      '<button type="button" class="btn btn-outline btn-sm" data-h="add"><i class="ti ti-plus"></i> ' + esc(L('Add payee', 'Tambah penerima')) + '</button>' +
      (S.ready && S.isNew ? '<button type="button" class="btn btn-outline btn-sm" data-h="sd"><i class="ti ti-file-import"></i> ' + esc(L('Import from Salary Disbursement', 'Import dari Penyaluran Gaji')) + '</button>' : '') +
      '<select class="form-select" id="pvc-reuse" style="width:auto;min-height:32px;max-width:220px" aria-label="' + esc(L('Reuse lines', 'Guna semula baris')) + '"><option value="">' + esc(L('Reuse…', 'Guna semula…')) + '</option></select>' +
      '<button type="button" class="btn btn-outline btn-sm" data-h="tpl"><i class="ti ti-template"></i> ' + esc(L('Save as template', 'Simpan sebagai template')) + '</button></div>';
    else if (payPhase() && S.lines.some(function (l) { return l.pay_status !== 'paid' && l.voucher_id; })) tools = '<div class="pvc-tools">' +
      '<button type="button" class="btn btn-primary btn-sm" data-h="allpaid"><i class="ti ti-checks"></i> ' + esc(L('Mark all unpaid as paid', 'Tanda semua belum dibayar sebagai dibayar')) + '</button></div>';
    var paidN = S.lines.filter(function (l) { return l.pay_status === 'paid'; }).length;
    m.innerHTML =
      '<div class="pvc-page" id="pvc-root">' +
      '<div class="page-header no-print"><div><div class="page-title">' + esc(ref) + '</div>' +
      '<button type="button" class="btn btn-outline btn-sm" style="margin-top:6px;white-space:nowrap" data-h="back"><i class="ti ti-arrow-left"></i> ' + esc(L('Disbursement', 'Penyaluran')) + '</button></div>' +
      '<div class="pvc-hacts">' + acts + '</div></div>' +
      (S.ready || S.isNew ? '' : '<div class="pvc-note pvc-warn"><i class="ti ti-database"></i><div>' + esc(L('Signatures and payment tracking need supabase/pv_revamp_01.sql.', 'Tandatangan dan jejak bayaran perlukan supabase/pv_revamp_01.sql.')) + '</div></div>') +
      lockNote + meta + '<div id="pvc-dupbox">' + C.dupHtml(S.dup) + '</div>' +
      '<div id="pvc-sumbox">' + methodSummary(S.lines) + '</div>' + tools +
      '<div class="pvc-wrap" id="pvc-lines">' + (S.lines.length ? S.lines.map(cardHtml).join('') : '<div class="pvc-empty">' + esc(L('No payees yet', 'Tiada penerima lagi')) + '</div>') + '</div>' +
      '<div id="pvs-slot"></div><div class="pvc-err" id="pvc-err" role="alert"></div></div>' +
      '<div class="pvc-bar no-print' + (S.dirty ? ' pvc-dirty' : '') + '" id="pvc-bar"><div class="pvc-tot"><span id="pvc-totl">' + esc(L('Total', 'Jumlah') + ' · ' + S.lines.length + ' ' + L('payee(s)', 'penerima') + (payPhase() ? ' · ' + paidN + '/' + S.lines.length + ' ' + L('paid', 'dibayar') : '')) + '</span><b id="pvc-tot">' + esc(rm(total())) + '</b></div>' +
      '<div class="pvc-bacts"><span class="pvc-unsaved">' + esc(L('Unsaved changes', 'Perubahan belum disimpan')) + '</span>' +
      (ed ? '<button type="button" class="btn btn-primary" data-h="save"><i class="ti ti-device-floppy"></i> ' + esc(L('Save', 'Simpan')) + '</button>' : '') + '</div></div>';
    bind();
    if (ed) populateReuse();
    mountSigs();
  }

  function mountSigs() {
    var el = $('pvs-slot');
    if (!el || S.isNew || !S.ready || !window.PVS) return;
    PVS.mount(el, { kind: 'pvd', id: S.b.id, amount: Number(S.b.total_amount) || total(), status: S.b.status, ref: S.b.ref_no, title: S.b.title,
      beforeShare: async function () { if (S.dirty) { var ok = await save(true); if (!ok) throw new Error(L('Save first.', 'Simpan dahulu.')); } return true; },
      onChange: function () { renderPVDDetail(S.b.id); },
      onProgress: function (n, need) { var p = $('pvc-sigprog'); if (p) p.innerHTML = '<span class="badge ' + (n >= need ? 'badge-green' : 'badge-yellow') + '"><i class="ti ti-signature"></i> ' + esc(n + '/' + need + ' ' + L('signed', 'ditandatangani')) + '</span>'; } });
  }

  function setDirty() {
    S.dirty = true;
    var bar = $('pvc-bar'); if (bar) bar.classList.add('pvc-dirty');
  }
  function refreshTotals() {
    var t = $('pvc-tot'); if (t) t.textContent = rm(total());
    var tl = $('pvc-totl'); if (tl) tl.textContent = L('Total', 'Jumlah') + ' · ' + S.lines.length + ' ' + L('payee(s)', 'penerima');
    var sm = $('pvc-sumbox'); if (sm) sm.innerHTML = methodSummary(S.lines);
  }
  function refreshHead(i) {
    var l = S.lines[i]; if (!l) return;
    var card = document.querySelector('#pvc-lines .pvc-card[data-k="' + l._k + '"]');
    var h = card && card.querySelector('.pvc-head'); if (h) h.innerHTML = headHtml(l);
  }
  function redrawCard(i) {
    var l = S.lines[i]; if (!l) return;
    var card = document.querySelector('#pvc-lines .pvc-card[data-k="' + l._k + '"]'); if (!card) return;
    var tmp = document.createElement('div'); tmp.innerHTML = cardHtml(l, i);
    card.replaceWith(tmp.firstChild);
    pickers();
  }
  function pickers() {
    document.querySelectorAll('#pvc-lines input[data-pick]').forEach(function (inp) {
      C.attachPicker(inp, function (p) {
        var i = Number(inp.getAttribute('data-i')), l = S.lines[i]; if (!l) return;
        l.payee_name = p.name; l.payee_type = p.type || 'other'; l.payee_id = p.id || null;
        if (!p.free) {
          if (p.bank_name) l.bank_name = p.bank_name;
          if (p.bank_account_no) l.bank_account_no = p.bank_account_no;
          if (p.phone) l.phone = p.phone;
          if (!l.category) l.category = p.type === 'employee' ? 'other' : 'supplier';
        }
        setDirty(); redrawCard(i); refreshDupSoon();
      });
    });
  }
  var dupT = null;
  function refreshDupSoon() { clearTimeout(dupT); dupT = setTimeout(refreshDup, 700); }
  async function refreshDup() {
    if (!S) return;
    var my = S;
    var hits = await C.dupCheck({ lines: S.lines, date: S.b.batch_date, batchId: S.b.id });
    if (my !== S) return;
    S.dup = hits;
    var box = $('pvc-dupbox'); if (box) box.innerHTML = C.dupHtml(hits);
    document.querySelectorAll('#pvc-lines .pvc-card').forEach(function (c) {
      var k = c.getAttribute('data-k');
      c.classList.toggle('pvc-dup', hits.some(function (h) { return h.line._k === k; }));
    });
  }

  function bind() {
    var root = $('pvc-root'), bar = $('pvc-bar');
    pickers();
    root.addEventListener('input', function (e) {
      var t = e.target;
      if (t.getAttribute('data-b')) { S.b[t.getAttribute('data-b')] = t.value; setDirty(); if (t.getAttribute('data-b') === 'batch_date') refreshDupSoon(); return; }
      var f = t.getAttribute('data-f'); if (!f) return;
      var i = Number(t.getAttribute('data-i')), l = S.lines[i]; if (!l) return;
      l[f] = f === 'amount' ? (t.value === '' ? 0 : Number(t.value)) : (f === 'gl_account_id' ? (t.value || null) : t.value);
      if (f === 'payee_name') { l.payee_type = 'other'; l.payee_id = null; }
      setDirty(); refreshHead(i);
      if (f === 'amount' || f === 'payment_method') refreshTotals();
      if (f === 'amount' || f === 'payee_name') refreshDupSoon();
    });
    root.addEventListener('change', function (e) {
      var f = e.target.getAttribute('data-f');
      if (f === 'payment_method' || f === 'category') redrawCard(Number(e.target.getAttribute('data-i')));
      if (e.target.id === 'pvc-reuse') loadReuse(e.target);
    });
    root.addEventListener('click', function (e) {
      var a = e.target.closest('[data-a],[data-h]'); if (!a) return;
      var k = a.getAttribute('data-a') || a.getAttribute('data-h'), i = Number(a.getAttribute('data-i'));
      var l = S.lines[i];
      if (k === 'tog' && l) { S.open[l._k] = !S.open[l._k]; redrawCard(i); return; }
      if (k === 'rm' && l) { if (!confirm(L('Remove this payee?', 'Buang penerima ini?'))) return; S.lines.splice(i, 1); setDirty(); draw(); refreshDupSoon(); return; }
      if (k === 'pv') { openPage('vouchers', { view: 'pv-detail', id: a.getAttribute('data-id') }); return; }
      if (k === 'paid' && l) return payLine(i);
      if (k === 'fail' && l) return failLine(i);
      if (k === 'rcpt' && l) return C.uploadReceipt({ line: l, batchId: S.b.id, done: function () { renderPVDDetail(S.b.id); } });
      if (k === 'vrcpt' && l) return C.viewFile(l.receipt_path);
      if (k === 'back') return leave(function () { openPage('vouchers', { view: 'disbursements' }); });
      if (k === 'add') { var nl = blankLine(); S.lines.push(nl); S.open[nl._k] = true; setDirty(); draw(); var inp = document.querySelector('#pvc-lines .pvc-card[data-k="' + nl._k + '"] input[data-pick]'); if (inp) inp.focus(); return; }
      if (k === 'sd' && window.PVT) return PVT.importSD();
      if (k === 'tpl') return saveTemplate();
      if (k === 'print' && window.PVP) return PVP.print('pvd', S.b.id);
      if (k === 'pdf' && window.PVP) return PVP.pdf('pvd', S.b.id, { download: true });
      if (k === 'wa' && window.PVP) return PVP.sharePdf('pvd', S.b.id);
      if (k === 'dupl' && window.PVT) return PVT.duplicate(S.b.id);
      if (k === 'csv' && window.PVT) return PVT.bankCsv(S.b, S.lines);
      if (k === 'conv') return X.convert(S.b.id);
      if (k === 'del') return delBatch();
      if (k === 'void') return voidBatch();
      if (k === 'allpaid') return payAll();
    });
    bar.addEventListener('click', function (e) { var a = e.target.closest('[data-h="save"]'); if (a) save(false, a); });
  }
  function leave(go) { if (S && S.dirty && !confirm(L('Discard unsaved changes?', 'Buang perubahan yang belum disimpan?'))) return; go(); }

  /* ---------- save (draft only): batch + line diff (keeps line ids, receipts) ---------- */
  var NEWCOLS = ['bank_account_no', 'payee_type', 'payee_id', 'phone', 'category', 'gl_account_id'];
  function lineRow(l, i, bid) {
    return { tenant_id: T(), batch_id: bid, sort_order: i + 1, payee_name: String(l.payee_name || '').trim(), amount: r2(l.amount),
      payment_method: l.payment_method || 'Bank Transfer', bank_name: String(l.bank_name || '').trim() || null, cheque_no: String(l.cheque_no || '').trim() || null,
      description: String(l.description || '').trim() || null, bill_id: l.bill_id || null,
      bank_account_no: String(l.bank_account_no || '').trim() || null, payee_type: l.payee_type || 'other', payee_id: l.payee_id || null,
      phone: String(l.phone || '').trim() || null, category: l.category || null, gl_account_id: l.gl_account_id || null };
  }
  function strip(row) { var o = Object.assign({}, row); NEWCOLS.forEach(function (c) { delete o[c]; }); return o; }
  async function save(quiet, btn) {
    var er = $('pvc-err'); if (er) er.textContent = '';
    var b = S.b, title = String(b.title || '').trim();
    var fail = function (msg) { if (er) er.textContent = msg; X.toast(msg, 'error'); if (btn) btn.disabled = false; return false; };
    if (!title) return fail(L('Title is required.', 'Tajuk diperlukan.'));
    var valid = S.lines.filter(function (l) { return String(l.payee_name || '').trim() && Number(l.amount) > 0; });
    if (!valid.length) return fail(L('Add at least one payee with an amount.', 'Tambah sekurang-kurangnya seorang penerima dengan jumlah.'));
    if (valid.length < S.lines.length && !confirm(L('Payees without a name or amount will be dropped. Continue?', 'Penerima tanpa nama atau jumlah akan dibuang. Teruskan?'))) return false;
    if (!quiet) {
      var hits = await C.dupCheck({ lines: valid, date: b.batch_date, batchId: b.id });
      S.dup = hits; var db = $('pvc-dupbox'); if (db) db.innerHTML = C.dupHtml(hits);
      if (hits.length && !confirm(L('Possible duplicate payment (same payee and amount this month). Save anyway?', 'Kemungkinan bayaran berganda (penerima dan jumlah sama bulan ini). Simpan juga?'))) return false;
    }
    if (btn) btn.disabled = true;
    var tot = r2(valid.reduce(function (s, l) { return s + Number(l.amount); }, 0));
    var payload = { tenant_id: T(), title: title, batch_date: b.batch_date || X.today(), total_amount: tot, line_count: valid.length, updated_at: new Date().toISOString() };
    var bid = b.id;
    if (bid) {
      var cur = await sb.from('payment_voucher_batches').select('status').eq('id', bid).eq('tenant_id', T()).maybeSingle();
      if (cur.data && X.locked(cur.data.status)) { if (btn) btn.disabled = false; X.toast(L('Locked — someone already shared or signed it. Reloading.', 'Dikunci — sudah dikongsi atau ditandatangani. Memuat semula.'), 'error'); renderPVDDetail(bid); return false; }
      var u = await sb.from('payment_voucher_batches').update(payload).eq('id', bid).eq('tenant_id', T());
      if (u.error) return fail(u.error.message);
    } else {
      payload.status = 'draft';
      payload.ref_no = await _genFallbackRefNo('payment_voucher_batches', 'ref_no', 'PVD');
      payload.prepared_by = X.me() || null;
      var ins = await sb.from('payment_voucher_batches').insert(payload).select('id').single();
      if (ins.error) return fail(ins.error.message);
      bid = ins.data.id;
    }
    var keep = valid.filter(function (l) { return l.id; }).map(function (l) { return l.id; });
    var oldIds = [];
    if (b.id) { var oq = await sb.from('payment_voucher_batch_lines').select('id').eq('batch_id', bid).eq('tenant_id', T()); oldIds = (oq.data || []).map(function (x) { return x.id; }); }
    var gone = oldIds.filter(function (x) { return keep.indexOf(x) < 0; });
    if (gone.length) { var d = await sb.from('payment_voucher_batch_lines').delete().in('id', gone).eq('tenant_id', T()); if (d.error) return fail(d.error.message); }
    for (var i = 0; i < valid.length; i++) {
      var l = valid[i], row = lineRow(l, i, bid), r;
      if (l.id) {
        r = await sb.from('payment_voucher_batch_lines').update(row).eq('id', l.id).eq('tenant_id', T());
        if (r.error && /column/i.test(r.error.message || '')) r = await sb.from('payment_voucher_batch_lines').update(strip(row)).eq('id', l.id).eq('tenant_id', T());
      } else {
        r = await sb.from('payment_voucher_batch_lines').insert(row).select('id').single();
        if (r.error && /column/i.test(r.error.message || '')) r = await sb.from('payment_voucher_batch_lines').insert(strip(row)).select('id').single();
        if (!r.error && r.data) l.id = r.data.id;
      }
      if (r.error) return fail(L('Line ', 'Baris ') + (i + 1) + ': ' + r.error.message);
    }
    try { auditLog(b.id ? 'update' : 'create', 'payment_voucher_batches', bid); } catch (e) {}
    S.dirty = false;
    if (!quiet) X.toast(L('Disbursement saved.', 'Penyaluran disimpan.'), 'success');
    if (!b.id) { openPage('vouchers', { view: 'pvd-detail', id: bid }); return true; }
    if (!quiet) renderPVDDetail(bid);
    return true;
  }
  C.save = function () { return save(true); };

  /* ---------- reuse / templates (same localStorage keys as the old form) ---------- */
  function readTpls() { try { return typeof _pvdReadTemplates === 'function' ? _pvdReadTemplates() : []; } catch (e) { return []; } }
  async function populateReuse() {
    var sel = $('pvc-reuse'); if (!sel) return;
    var tpls = readTpls(), bs = [];
    try { var q = await sb.from('payment_voucher_batches').select('id,title,batch_date,ref_no').eq('tenant_id', T()).is('deleted_at', null).order('batch_date', { ascending: false }).limit(20); bs = (q.data || []).filter(function (x) { return x.id !== S.b.id; }); } catch (e) {}
    sel.innerHTML = '<option value="">' + esc(L('Reuse…', 'Guna semula…')) + '</option>' +
      (tpls.length ? '<optgroup label="' + esc(L('Templates', 'Template')) + '">' + tpls.map(function (t, i) { return '<option value="tpl:' + i + '">' + esc(t.name || 'Template ' + (i + 1)) + '</option>'; }).join('') + '</optgroup>' : '') +
      (bs.length ? '<optgroup label="' + esc(L('Previous disbursements', 'Penyaluran lepas')) + '">' + bs.map(function (x) { return '<option value="b:' + x.id + '">' + esc((x.ref_no || '') + ' · ' + (x.title || '') + ' · ' + X.dmy(x.batch_date)) + '</option>'; }).join('') + '</optgroup>' : '');
  }
  function cloneLine(l) {
    var n = blankLine();
    ['payee_name', 'payee_type', 'payee_id', 'amount', 'payment_method', 'bank_name', 'bank_account_no', 'phone', 'description', 'category', 'gl_account_id'].forEach(function (k) { if (l[k] != null) n[k] = l[k]; });
    n.amount = Number(n.amount) || 0; n.payment_method = n.payment_method || 'Bank Transfer';
    return n;
  }
  C.cloneLine = cloneLine;
  async function loadReuse(sel) {
    var v = sel.value; if (!v) return;
    var src = [];
    if (v.indexOf('tpl:') === 0) { var t = readTpls()[Number(v.slice(4))]; src = (t && t.lines) || []; }
    else { var q = await sb.from('payment_voucher_batch_lines').select('*').eq('batch_id', v.slice(2)).eq('tenant_id', T()).order('sort_order'); src = q.data || []; }
    sel.value = '';
    if (!src.length) return;
    var blanks = S.lines.every(function (l) { return !String(l.payee_name || '').trim() && !Number(l.amount); });
    if (blanks) S.lines = [];
    src.forEach(function (l) { S.lines.push(cloneLine(l)); });
    setDirty(); draw(); refreshDupSoon();
    X.toast(L('Lines added.', 'Baris ditambah.'), 'success');
  }
  function saveTemplate() {
    var lines = S.lines.filter(function (l) { return String(l.payee_name || '').trim(); });
    if (!lines.length) { X.toast(L('Nothing to save.', 'Tiada data untuk disimpan.'), 'error'); return; }
    var name = prompt(L('Template name:', 'Nama template:'), S.b.title || ''); if (!name || !name.trim()) return;
    var list = readTpls();
    var rec = { name: name.trim(), lines: lines.map(function (l) { return { payee_name: l.payee_name, amount: Number(l.amount) || 0, payment_method: l.payment_method, bank_name: l.bank_name || '', bank_account_no: l.bank_account_no || '', phone: l.phone || '', payee_type: l.payee_type, payee_id: l.payee_id, category: l.category || '', description: l.description || '', bill_id: null }; }), saved_at: new Date().toISOString() };
    var ix = list.findIndex(function (t) { return String(t.name).toLowerCase() === rec.name.toLowerCase(); });
    if (ix >= 0) list[ix] = rec; else list.unshift(rec);
    try { _pvdWriteTemplates(list); } catch (e) {}
    X.toast(L('Template saved.', 'Template disimpan.'), 'success');
    populateReuse();
  }

  /* ---------- payments per line ---------- */
  C.askPay = function (title) {
    return new Promise(function (res) {
      var ov = document.createElement('div'); ov.className = 'modal-overlay active'; ov.id = 'pvc-paym';
      ov.innerHTML = '<div class="modal-box" style="max-width:420px" role="dialog" aria-modal="true"><div class="modal-box-header"><i class="ti ti-cash"></i> ' + esc(title) + '</div>' +
        '<div class="modal-box-body" style="display:flex;flex-direction:column;gap:10px">' +
        '<div class="form-group" style="margin:0"><label class="form-label" for="pvc-pd">' + esc(L('Paid date', 'Tarikh bayar')) + '</label><input id="pvc-pd" type="date" class="form-input" value="' + X.today() + '"></div>' +
        '<div class="form-group" style="margin:0"><label class="form-label" for="pvc-pr">' + esc(L('Bank reference (optional)', 'Rujukan bank (pilihan)')) + '</label><input id="pvc-pr" class="form-input" maxlength="80"></div></div>' +
        '<div class="modal-box-footer" style="flex-wrap:wrap"><button type="button" class="btn btn-outline" data-x="0">' + esc(L('Cancel', 'Batal')) + '</button>' +
        '<button type="button" class="btn btn-primary" data-x="1"><i class="ti ti-check"></i> ' + esc(L('Confirm paid', 'Sahkan dibayar')) + '</button></div></div>';
      ov.addEventListener('click', function (e) {
        var b = e.target.closest('[data-x]'); if (!b && e.target !== ov) return;
        var ok = b && b.getAttribute('data-x') === '1';
        var v = ok ? { date: $('pvc-pd').value || X.today(), ref: String($('pvc-pr').value || '').trim() || null } : null;
        ov.remove(); res(v);
      });
      document.body.appendChild(ov);
    });
  };
  async function payLine(i) {
    var l = S.lines[i]; if (!l || !l.voucher_id) return;
    var p = await C.askPay(L('Mark paid: ', 'Tanda dibayar: ') + (l.payee_name || ''));
    if (!p) return;
    var ok = await X.markPaid(l.voucher_id, { paidDate: p.date, ref: p.ref, noRender: true });
    if (ok) renderPVDDetail(S.b.id);
  }
  async function payAll() {
    var todo = S.lines.filter(function (l) { return l.pay_status !== 'paid' && l.voucher_id; });
    if (!todo.length) return;
    var p = await C.askPay(L('Mark ' + todo.length + ' payee(s) paid', 'Tanda ' + todo.length + ' penerima dibayar'));
    if (!p) return;
    var ok = 0;
    for (var i = 0; i < todo.length; i++) { if (await X.markPaid(todo[i].voucher_id, { paidDate: p.date, ref: p.ref, silent: true, noRender: true })) ok++; }
    X.toast(L(ok + ' of ' + todo.length + ' marked paid.', ok + ' daripada ' + todo.length + ' ditanda dibayar.'), ok === todo.length ? 'success' : 'error');
    if (ok) X.notify('pv_paid', { kind: 'pvd', id: S.b.id, extra: ok + '/' + todo.length });
    renderPVDDetail(S.b.id);
  }
  async function failLine(i) {
    var l = S.lines[i]; if (!l) return;
    var why = prompt(L('Why did this payment fail? (e.g. wrong account no.)', 'Kenapa bayaran ini gagal? (cth. no. akaun salah)'), '');
    if (why === null) return;
    var r = await sb.from('payment_voucher_batch_lines').update({ pay_status: 'failed', fail_reason: String(why || '').trim().slice(0, 300) || null, updated_at: new Date().toISOString() }).eq('id', l.id).eq('tenant_id', T());
    if (r.error) { X.toast(r.error.message, 'error'); return; }
    X.notify('pv_failed', { kind: 'pvd', id: S.b.id, extra: l.payee_name });
    X.toast(L('Marked failed. Fix the details on the PV, then mark paid.', 'Ditanda gagal. Betulkan butiran pada PV, kemudian tanda dibayar.'), 'success');
    renderPVDDetail(S.b.id);
  }

  /* ---------- receipts: doc-files/{tenant}/pv-receipts/... ---------- */
  C.uploadReceipt = function (o) {
    var inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*,application/pdf';
    inp.onchange = async function () {
      var f = inp.files && inp.files[0]; if (!f) return;
      if (f.size > 10 * 1024 * 1024) { X.toast(L('File is over 10 MB.', 'Fail melebihi 10 MB.'), 'error'); return; }
      var ext = (String(f.name).split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'bin';
      var who = o.line ? o.line.id : o.pvId;
      var path = T() + '/pv-receipts/' + (o.batchId || 'pv') + '/' + who + '-' + Date.now() + '.' + ext;
      X.toast(L('Uploading…', 'Memuat naik…'), 'info');
      var up = await sb.storage.from('doc-files').upload(path, f, { contentType: f.type || 'application/octet-stream', upsert: false });
      if (up.error) { X.toast(L('Upload failed: ', 'Muat naik gagal: ') + up.error.message, 'error'); return; }
      var r1 = { error: null };
      if (o.line) r1 = await sb.from('payment_voucher_batch_lines').update({ receipt_path: path, updated_at: new Date().toISOString() }).eq('id', o.line.id).eq('tenant_id', T());
      var pv = (o.line && o.line.voucher_id) || o.pvId;
      if (pv) await sb.from('payment_vouchers').update({ receipt_path: path }).eq('id', pv).eq('tenant_id', T());
      if (r1.error) { X.toast(r1.error.message, 'error'); return; }
      X.toast(L('Receipt saved.', 'Resit disimpan.'), 'success');
      if (o.done) o.done(path);
    };
    inp.click();
  };
  C.viewFile = function (path) {
    if (!path) return;
    var w = window.open('', '_blank');
    Promise.resolve(sb.storage.from('doc-files').createSignedUrl(path, 600)).then(function (r) {
      if (r && r.data && r.data.signedUrl) { if (w) w.location = r.data.signedUrl; else window.open(r.data.signedUrl, '_blank'); }
      else { if (w) w.close(); X.toast(L('File not found.', 'Fail tidak dijumpai.'), 'error'); }
    }, function () { if (w) w.close(); });
  };

  async function delBatch() {
    if (!confirm(L('Delete this draft disbursement?', 'Padam draf penyaluran ini?'))) return;
    var r = await sb.from('payment_voucher_batches').update({ deleted_at: new Date().toISOString() }).eq('id', S.b.id).eq('tenant_id', T()).eq('status', 'draft');
    if (r.error) { X.toast(r.error.message, 'error'); return; }
    try { auditLog('delete', 'payment_voucher_batches', S.b.id); } catch (e) {}
    S.dirty = false;
    openPage('vouchers', { view: 'disbursements' });
  }
  async function voidBatch() {
    if (!confirm(L('Void this disbursement? Signatures and links stop working.', 'Batalkan penyaluran ini? Tandatangan dan pautan tidak lagi berfungsi.'))) return;
    var r = await sb.from('payment_voucher_batches').update({ status: 'void', updated_at: new Date().toISOString() }).eq('id', S.b.id).eq('tenant_id', T()).in('status', ['draft', 'shared', 'pending']);
    if (r.error) { X.toast(r.error.message, 'error'); return; }
    X.notify('pv_void', { kind: 'pvd', id: S.b.id });
    renderPVDDetail(S.b.id);
  }

  C.state = function () { return S; };
  C.renderPVDDetail = renderPVDDetail;
  window.renderPVDList = renderPVDList;
  window.renderPVDForm = renderPVDForm;
  window.renderPVDDetail = renderPVDDetail;
  css();
})();
