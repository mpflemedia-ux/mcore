/* Sales Plan — File 5/12: plan setup form markup (step 1 / Settings tab). */
(function () {
  'use strict';
  var SP = window.SP, st = SP.state, t = SP.t, esc = SP.esc;

  SP.initForm = function (key) {
    if (st.form && st.formKey === key) return;
    var p = st.plan, maps = (st.refs && st.refs.maps) || {}, n = SP.num;
    st.formKey = key; st.formDirty = false;
    st.form = p ? {
      name: p.name || '', start_date: SP.d10(p.start_date), end_date: SP.d10(p.end_date), currency: p.currency || 'MYR',
      sales_source: p.sales_source === 'auto' ? 'auto' : 'manual', product_filter: (p.product_filter || []).map(String),
      watch_pct: String(p.watch_pct != null ? n(p.watch_pct) : 85), on_track_pct: String(p.on_track_pct != null ? n(p.on_track_pct) : 100),
      financing_enabled: !!p.financing_enabled, financed_pct: String(n(p.financed_pct)), fee_pct: String(n(p.fee_pct)), tenure_days: String(n(p.tenure_days)),
      loan_account_id: p.loan_account_id || '', fee_account_id: p.fee_account_id || '',
      draw_debit_account_id: p.draw_debit_account_id || '', default_bank_account_id: p.default_bank_account_id || '',
      pic_employee_id: p.pic_employee_id || '', pic_name: p.pic_name || '', prodQ: ''
    } : {
      name: '', start_date: SP.todayISO(), end_date: '', currency: 'MYR', sales_source: 'manual', product_filter: [],
      watch_pct: '85', on_track_pct: '100', financing_enabled: false, financed_pct: '90', fee_pct: '7', tenure_days: '30',
      loan_account_id: '', fee_account_id: '', draw_debit_account_id: maps.inventory || '', default_bank_account_id: maps.bank || '',
      pic_employee_id: '', pic_name: '', prodQ: ''
    };
  };
  function inp(field, val, type, extra) {
    return '<input class="form-input" id="sp-f-' + field + '" data-ff="' + field + '" type="' + (type || 'text') + '"' + (!type || type === 'text' ? ' data-no-titlecase="1"' : '') + ' value="' + esc(val) + '"' + (extra || '') + '>';
  }
  function sufInp(field, val, suf, extra) {
    return '<div class="sp-suf">' + inp(field, val, 'number', ' inputmode="decimal" min="0"' + (extra || '')) + '<span aria-hidden="true">' + esc(suf) + '</span></div>';
  }
  function grp(field, label, control, cls) {
    return '<div class="form-group' + (cls ? ' ' + cls : '') + '"><label class="form-label" for="sp-f-' + field + '">' + esc(label) + '</label>' + control + '</div>';
  }
  function acctSelect(field, type, label) {
    var f = st.form, acc = ((st.refs && st.refs.accounts) || []).filter(function (a) { return String(a.account_type) === type; });
    var opts = '<option value="">' + esc(t('— Select account —', '— Pilih akaun —')) + '</option>' + acc.map(function (a) {
      return '<option value="' + esc(a.id) + '"' + (SP.same(a.id, f[field]) ? ' selected' : '') + '>' + esc((a.code ? a.code + ' — ' : '') + (a.name_en || '')) + '</option>';
    }).join('');
    var bmType = { asset: 'aset', liability: 'liabiliti', expense: 'perbelanjaan' }[type] || type;
    var none = !acc.length ? '<div class="sp-hint sp-warn-t">' + esc(t('No ' + type + ' accounts in your Chart of Accounts. Add one in Accounting first.', 'Tiada akaun ' + bmType + ' dalam Carta Akaun. Tambah dalam Perakaunan dahulu.')) + '</div>' : '';
    return grp(field, label, '<select class="form-select" id="sp-f-' + field + '" data-ff="' + field + '">' + opts + '</select>' + none);
  }
  SP.srcHint = function (s) {
    return s === 'auto' ? t('Summed automatically from invoices & POS (Invoice + POS).', 'Dijumlah automatik dari invois & POS (Invois + POS).') : t('PIC enters RM, units & orders every week.', 'PIC isi RM, unit & order setiap minggu.');
  };
  SP.prodChipsHtml = function () {
    var f = st.form, all = (st.refs && st.refs.products) || [];
    if (!all.length) return '<div class="sp-hint">' + esc(t('No products yet — all sales count towards the plan.', 'Belum ada produk — semua jualan dikira dalam pelan.')) + '</div>';
    var sel = f.product_filter, q = String(f.prodQ || '').trim().toLowerCase(), LIMIT = 40;
    var chosen = all.filter(function (p) { return sel.indexOf(String(p.id)) >= 0; });
    var rest = all.filter(function (p) { return sel.indexOf(String(p.id)) < 0 && (!q || (SP.prodName(p) + ' ' + (p.code || '')).toLowerCase().indexOf(q) >= 0); });
    var search = all.length > 12 ? '<label class="sp-search sp-prod-search"><i class="ti ti-search" aria-hidden="true"></i><input id="sp-prod-q" type="search" autocomplete="off" value="' + esc(f.prodQ || '') + '" placeholder="' + esc(t('Search products...', 'Cari produk...')) + '" aria-label="' + esc(t('Search products', 'Cari produk')) + '"></label>' : '';
    return search + '<div class="sp-chiprow">' + chosen.concat(rest.slice(0, LIMIT)).map(function (p) {
      var on = sel.indexOf(String(p.id)) >= 0;
      return '<button type="button" class="sp-chip' + (on ? ' on' : '') + '" aria-pressed="' + on + '" data-act="prod" data-id="' + esc(p.id) + '">' + (on ? '<i class="ti ti-check" aria-hidden="true"></i>' : '') + '<span>' + esc(SP.prodName(p)) + '</span></button>';
    }).join('') + '</div><div class="sp-hint">' + esc(sel.length ? t(sel.length + ' selected', sel.length + ' dipilih') : t('None selected = all products.', 'Tiada dipilih = semua produk.')) +
      (rest.length > LIMIT ? ' ' + esc(t('Showing ' + LIMIT + ' of ' + rest.length + ' — search to find more.', 'Menunjukkan ' + LIMIT + ' daripada ' + rest.length + ' — cari untuk lebih.')) : '') + '</div>';
  };
  SP.formFieldsHtml = function () {
    var f = st.form, emps = (st.refs && st.refs.employees) || [], cur = SP.CURRENCIES.slice();
    if (!cur.some(function (c) { return c.code === f.currency; })) cur.push({ code: f.currency, en: f.currency, bm: f.currency });
    var seg = function (v, label) { var on = f.sales_source === v; return '<button type="button" role="radio" aria-checked="' + on + '" class="' + (on ? 'on' : '') + '" data-act="src" data-v="' + v + '">' + esc(label) + '</button>'; };
    return '<div class="sp-grid">' +
      grp('name', t('Plan name', 'Nama pelan'), inp('name', f.name, 'text', ' maxlength="120" autocomplete="off" required'), 'sp-full') +
      '<div class="form-row sp-full">' + grp('start_date', t('Start date', 'Tarikh mula'), inp('start_date', f.start_date, 'date', ' required')) +
      grp('end_date', t('End date', 'Tarikh tamat'), inp('end_date', f.end_date, 'date', ' required')) + '</div>' +
      grp('currency', t('Currency', 'Mata wang'), '<select class="form-select" id="sp-f-currency" data-ff="currency">' + cur.map(function (c) { return '<option value="' + esc(c.code) + '"' + (c.code === f.currency ? ' selected' : '') + '>' + esc(t(c.en, c.bm)) + '</option>'; }).join('') + '</select>') +
      '<div class="form-group"><span class="form-label" id="sp-src-l">' + esc(t('Sales source', 'Sumber jualan')) + '</span><div class="sp-seg" role="radiogroup" aria-labelledby="sp-src-l">' +
      seg('manual', t('Manual entry', 'Taip sendiri')) + seg('auto', t('Auto from M-Core sales', 'Auto dari jualan M-Core')) + '</div>' +
      '<div class="sp-hint" id="sp-src-hint">' + esc(SP.srcHint(f.sales_source)) + '</div></div>' +
      '<div class="form-group sp-full"><span class="form-label">' + esc(t('Product filter', 'Tapis produk')) + '</span><div id="sp-prod">' + SP.prodChipsHtml() + '</div></div>' +
      '<div class="form-row sp-full">' + grp('watch_pct', t('Watch threshold', 'Had Watch'), sufInp('watch_pct', f.watch_pct, '%', ' max="999" step="any"')) +
      grp('on_track_pct', t('On Track threshold', 'Had On Track'), sufInp('on_track_pct', f.on_track_pct, '%', ' max="999" step="any"')) + '</div>' +
      grp('pic_employee_id', t('PIC (staff)', 'PIC (staf)'), '<select class="form-select" id="sp-f-pic_employee_id" data-ff="pic_employee_id"><option value="">' + esc(t('— None —', '— Tiada —')) + '</option>' +
        emps.map(function (e) { return '<option value="' + esc(e.id) + '"' + (SP.same(e.id, f.pic_employee_id) ? ' selected' : '') + '>' + esc(e.nickname || e.name || '') + '</option>'; }).join('') + '</select>') +
      grp('pic_name', t('PIC label (optional)', 'Label PIC (pilihan)'), inp('pic_name', f.pic_name, 'text', ' maxlength="80" autocomplete="off" placeholder="' + esc(t('e.g. PIC KeraVive', 'cth. PIC KeraVive')) + '"')) +
      '</div>' +
      '<div class="sp-fin"><div class="sp-fin-head"><div><div class="sp-fin-title" id="sp-fin-l">' + esc(t('Enable Stock & Financing', 'Aktifkan Stok & Pembiayaan')) + '</div><div class="sp-hint">' + esc(t('Stock batches, financier loans & auto journal entries', 'Batch stok, pinjaman pembiaya & entry akaun auto')) + '</div></div>' +
      '<button type="button" role="switch" aria-labelledby="sp-fin-l" aria-checked="' + f.financing_enabled + '" class="sp-switch' + (f.financing_enabled ? ' on' : '') + '" data-act="fin"></button></div>' +
      '<div id="sp-fin-body"' + (f.financing_enabled ? '' : ' hidden') + '><div class="sp-fin-params">' +
      grp('financed_pct', t('% financed', '% dibiayai'), sufInp('financed_pct', f.financed_pct, '%', ' max="100" step="any"')) +
      grp('fee_pct', t('Fee', 'Fee'), sufInp('fee_pct', f.fee_pct, '%', ' max="100" step="any"')) +
      grp('tenure_days', t('Tenure', 'Tempoh'), sufInp('tenure_days', f.tenure_days, t('days', 'hari'), ' max="3650" step="1"')) + '</div>' +
      '<div class="sp-acc-grid">' +
      acctSelect('loan_account_id', 'liability', t('Financier loan account (liability)', 'Akaun pinjaman pembiaya (liabiliti)')) +
      acctSelect('fee_account_id', 'expense', t('Financing fee account (expense)', 'Akaun fee pembiayaan (perbelanjaan)')) +
      acctSelect('draw_debit_account_id', 'asset', t('Funding drawn — debit (Inventory or Bank)', 'Pembiayaan diterima — debit (Inventori atau Bank)')) +
      acctSelect('default_bank_account_id', 'asset', t('Default bank for repayments (optional)', 'Bank lalai untuk bayaran balik (pilihan)')) +
      '</div><div class="sp-hint">' + esc(t('Accounts come from your Chart of Accounts. Nothing is created automatically.', 'Akaun diambil daripada Carta Akaun anda. Tiada akaun dicipta secara automatik.')) + '</div></div></div>';
  };
})();
