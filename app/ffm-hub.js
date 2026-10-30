/* M-Core — FFM hub: openPage('logistics',{view:'ffm',tab}) — Accounts (write-only keys), Products, Stock, Recon, Funded. */
(function () {
  'use strict';
  function ready() { return window.FFM && typeof window.renderLogistics === 'function'; }
  function boot() {
    if (!ready()) { setTimeout(boot, 200); return; }
    if (window.renderLogistics.__ffm) return;
    var F = window.FFM, t = F.t, esc = F.esc, orig = window.renderLogistics;
    var wrapped = function (params) {
      params = params || {};
      if (params.view === 'ffm') return renderHub(params);
      var r = orig.apply(this, arguments);
      if (!params.view || params.view === 'list') F.enabled().then(function (ok) { if (ok) addHeaderBtn(); });
      return r;
    };
    wrapped.__ffm = true;
    window.renderLogistics = wrapped;

    function addHeaderBtn() {
      var main = document.getElementById('main'); if (!main) return;
      var head = main.querySelector('.page-header'); if (!head || head.querySelector('[data-ffm-hub]')) return;
      var btns = Array.prototype.filter.call(head.children, function (c) { return c.tagName === 'BUTTON'; });
      var box = document.createElement('div'); box.className = 'ffm-actions ffm-root';
      var b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-outline btn-sm'; b.setAttribute('data-ffm-hub', '1');
      b.innerHTML = '<i class="ti ti-building-warehouse"></i> ' + esc(t('Flash Fulfillment', 'Flash Fulfillment'));
      b.onclick = function () { openPage('logistics', { view: 'ffm' }); };
      box.appendChild(b); btns.forEach(function (x) { box.appendChild(x); });
      head.classList.add('ffm-page-head'); head.style.flexWrap = 'wrap'; head.style.gap = '10px';
      head.appendChild(box);
    }

    var TABS = [['accounts', 'Accounts', 'Akaun', 'ti-plug'], ['products', 'Products', 'Produk', 'ti-barcode'], ['stock', 'Stock', 'Stok', 'ti-box'], ['recon', 'Reconciliation', 'Rekonsiliasi', 'ti-scale'], ['funded', 'Funded', 'Dibiayai', 'ti-coin']];

    async function renderHub(params) {
      var main = document.getElementById('main');
      if (!(await F.enabled())) { return orig.call(this, {}); }
      if (typeof canAccess === 'function' && !canAccess('logistics')) { main.innerHTML = '<div class="empty-state"><i class="ti ti-lock"></i><h3>' + esc(t('No access', 'Tiada akses')) + '</h3></div>'; return; }
      var tab = TABS.some(function (x) { return x[0] === params.tab; }) ? params.tab : 'accounts';
      main.innerHTML = '<div class="ffm-root"><div class="page-header ffm-page-head"><div><div class="page-title">Flash Fulfillment (FFM)</div>' +
        '<div class="ffm-muted" style="cursor:pointer;margin-top:2px" data-hub="back">← ' + esc(t('Delivery Orders', 'Delivery Order')) + '</div></div></div>' +
        '<div class="ffm-tabs" role="tablist">' + TABS.map(function (x) { return '<button type="button" role="tab" class="btn btn-outline btn-sm ffm-tab' + (x[0] === tab ? ' active' : '') + '" data-tab="' + x[0] + '"><i class="ti ' + x[3] + '"></i> ' + esc(t(x[1], x[2])) + '</button>'; }).join('') + '</div>' +
        '<div id="ffm-hub-body"><div class="card" style="padding:24px"><span class="ffm-spin"></span> ' + esc(t('Loading…', 'Memuatkan…')) + '</div></div></div>';
      main.querySelector('[data-hub="back"]').onclick = function () { openPage('logistics', {}); };
      main.querySelectorAll('[data-tab]').forEach(function (b) { b.onclick = function () { openPage('logistics', { view: 'ffm', tab: b.getAttribute('data-tab') }); }; });
      var body = document.getElementById('ffm-hub-body');
      try {
        var accts = await F.loadAccounts();
        if (tab === 'accounts') return accountsTab(body, accts);
        if (!accts.length) { body.innerHTML = emptyNoAcct(); return; }
        if (tab === 'products') return productsTab(body, accts, params.account);
        if (tab === 'stock') return stockTab(body, accts);
        if (tab === 'recon') return reconTab(body, accts);
        if (tab === 'funded') return fundedTab(body, accts);
      } catch (e) { body.innerHTML = '<div class="card" style="padding:20px"><div class="ffm-err">' + esc(e.message || e) + '</div></div>'; }
    }
    function emptyNoAcct() {
      return '<div class="card"><div class="empty-state"><i class="ti ti-plug-connected-x"></i><h3>' + esc(t('No FFM account yet', 'Belum ada akaun FFM')) + '</h3><p>' +
        esc(F.isAdmin() ? t('Add one in the Accounts tab.', 'Tambah di tab Akaun.') : t('Ask the owner/admin to connect FFM.', 'Minta pemilik/admin sambungkan FFM.')) + '</p></div></div>';
    }
    function reload(tab, extra) { openPage('logistics', Object.assign({ view: 'ffm', tab: tab }, extra || {})); }

    /* ---------- Accounts ---------- */
    function accountsTab(body, accts) {
      var admin = F.isAdmin();
      var head = '<div class="ffm-actions" style="margin-bottom:12px">' + (admin ? '<button type="button" class="btn btn-primary btn-sm" data-a="add"><i class="ti ti-plus"></i> ' + esc(t('Add FFM account', 'Tambah akaun FFM')) + '</button>' : '') +
        '<span class="ffm-muted">' + esc(t('Keys are write-only and stored server-side. They are never shown again.', 'Kunci hanya boleh ditulis dan disimpan di server. Tidak akan dipaparkan semula.')) + '</span></div>';
      if (!accts.length) { body.innerHTML = head + emptyNoAcct(); bind(); return; }
      body.innerHTML = head + accts.map(function (a) {
        return '<div class="card" style="padding:16px;margin-bottom:12px"><div class="ffm-actions" style="justify-content:space-between;margin-bottom:10px"><div><strong>' + esc(a.label) + '</strong> ' +
          (a.is_funded ? '<span class="badge badge-yellow">' + esc(t('Funded', 'Dibiayai')) + '</span> ' : '') + (a.is_active ? '<span class="badge badge-green">' + esc(t('Active', 'Aktif')) + '</span>' : '<span class="badge badge-gray">' + esc(t('Inactive', 'Tidak aktif')) + '</span>') + '</div>' +
          (admin ? '<div class="ffm-actions"><button type="button" class="btn btn-outline btn-sm" data-a="test" data-id="' + esc(a.id) + '"><i class="ti ti-plug-connected"></i> ' + esc(t('Test connection', 'Uji sambungan')) + '</button>' +
            '<button type="button" class="btn btn-outline btn-sm" data-a="edit" data-id="' + esc(a.id) + '"><i class="ti ti-edit"></i> ' + esc(t('Edit', 'Ubah')) + '</button>' +
            '<button type="button" class="btn btn-outline btn-sm" data-a="del" data-id="' + esc(a.id) + '"><i class="ti ti-trash"></i> ' + esc(t('Remove', 'Buang')) + '</button></div>' : '') + '</div>' +
          '<div class="ffm-grid">' + kv(t('Merchant ID', 'ID Pedagang'), a.mch_id_masked || t('Not set', 'Belum diset')) + kv(t('API key', 'Kunci API'), a.has_api_key ? t('Saved', 'Disimpan') : t('Not set', 'Belum diset')) +
          kv(t('Webhook secret', 'Rahsia webhook'), a.has_webhook_secret ? t('Saved', 'Disimpan') : t('Not set (polling only)', 'Belum diset (polling sahaja)')) + kv(t('Warehouse ID', 'ID Gudang'), a.warehouse_id || '-') + kv(t('Store code', 'Kod kedai'), a.store_code || '-') +
          kv(t('Last sync', 'Segerak terakhir'), F.dt(a.last_sync_at)) + '</div>' + (a.last_error ? '<div class="ffm-err" style="margin-top:10px"><i class="ti ti-alert-triangle"></i> ' + esc(a.last_error) + ' · ' + esc(F.dt(a.last_error_at)) + '</div>' : '') +
          '<div id="ffm-test-' + esc(a.id) + '"></div></div>';
      }).join('');
      bind();
      function bind() {
        body.querySelectorAll('[data-a]').forEach(function (b) {
          b.onclick = function () {
            var a = accts.find(function (x) { return F.same(x.id, b.getAttribute('data-id')); }), act = b.getAttribute('data-a');
            if (act === 'add') return acctForm(newAcctDefaults(accts));
            if (act === 'edit') return acctForm(a);
            if (act === 'test') return testAcct(a, b);
            if (act === 'del') return delAcct(a, b);
          };
        });
      }
    }
    // Add form prefill (non-secret only; keys always typed by the user). Values = DB column defaults + FFM MY docs.
    function newAcctDefaults(accts) {
      var own = (accts || []).some(function (x) { return !x.is_funded; }), fund = (accts || []).some(function (x) { return x.is_funded; });
      var d = { base_url: 'https://open.flashfulfillment.my', sign_mode: 'json', api_prefix: '', amount_multiplier: 100, fee_source: 'shipping', pay_mode: '2', order_source_platform: 'Line', auto_approve: false, low_stock_enabled: true };
      if (!own) { d.label = 'Brzky'; d.is_funded = false; } else if (!fund) { d.label = 'Funded'; d.is_funded = true; d._pickPlan = true; }
      return d;
    }
    function kv(k, v) { return '<div><div class="ffm-k">' + esc(k) + '</div><div class="ffm-v">' + esc(v) + '</div></div>'; }
    function inp(id, label, val, extra) { return '<div class="form-group"><label class="form-label" for="' + id + '">' + esc(label) + '</label><input id="' + id + '" class="form-input" value="' + esc(val == null ? '' : val) + '" ' + (extra || '') + '></div>'; }
    function sel(id, label, val, opts) { return '<div class="form-group"><label class="form-label" for="' + id + '">' + esc(label) + '</label><select id="' + id + '" class="form-select">' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(val == null ? '' : val) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></div>'; }
    function chk(id, label, on) { return '<label class="ffm-chk"><input type="checkbox" id="' + id + '"' + (on ? ' checked' : '') + '> ' + esc(label) + '</label>'; }
    var NOCAP = 'autocapitalize="off" autocorrect="off" spellcheck="false" autocomplete="off"';
    function normUrl(s) { s = String(s || '').trim(); var m = s.match(/^([a-z][a-z0-9+.-]*:\/\/[^\/?#]*)(.*)$/i); return m ? m[1].toLowerCase() + m[2] : s; } // mobile auto-capital → https://open.…
    function secret(id, label, has) { return inp(id, label, '', 'type="password" autocomplete="new-password" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="' + esc(has ? t('Saved — leave blank to keep', 'Disimpan — biar kosong untuk kekal') : t('Paste here', 'Tampal di sini')) + '"'); }

    async function acctForm(a) {
      a = a || {};
      var plans = [];
      try { var r = await sb.from('sales_plans').select('id,name').eq('tenant_id', F.tid()).is('deleted_at', null).order('created_at', { ascending: false }); plans = r.data || []; } catch (e) { plans = []; }
      if (a._pickPlan && !a.sales_plan_id && plans.length === 1) a.sales_plan_id = plans[0].id; // only one plan → preselect
      var html = '<div class="ffm-sec">' + esc(t('Account', 'Akaun')) + '</div>' + inp('fa-label', t('Label (e.g. Brzky / Funded)', 'Label (cth. Brzky / Funded)'), a.label, 'maxlength="60"') +
        '<div class="ffm-sec">' + esc(t('API keys (write-only)', 'Kunci API (tulis sahaja)')) + '</div><div class="ffm-row">' + secret('fa-mch', 'mchId', !!a.mch_id_masked) + secret('fa-key', 'API key', !!a.has_api_key) + '</div>' +
        '<div class="ffm-sec">' + esc(t('Webhook (from FFM, optional)', 'Webhook (daripada FFM, pilihan)')) + '</div><div class="ffm-row">' + secret('fa-wk', 'App Key', !!a.has_webhook_secret) + secret('fa-ws', 'App Secret', !!a.has_webhook_secret) + secret('fa-wc', 'App Code', !!a.has_webhook_secret) + '</div>' +
        '<div class="ffm-sec">' + esc(t('Orders', 'Pesanan')) + '</div><div class="ffm-row">' + inp('fa-wh', t('Warehouse ID', 'ID Gudang'), a.warehouse_id, NOCAP) + inp('fa-store', t('Store code', 'Kod kedai'), a.store_code, NOCAP) + '</div>' +
        '<div class="ffm-row">' + inp('fa-plat', t('Order source platform', 'Platform sumber pesanan'), a.order_source_platform || 'Line') + sel('fa-pay', t('Default payment', 'Bayaran lalai'), a.pay_mode || '2', [['1', 'COD'], ['2', t('Bank transfer', 'Pindahan bank')], ['3', t('E-payment', 'E-bayaran')]]) + '</div>' +
        inp('fa-track', t('Tracking link (https…{pno}, optional)', 'Pautan jejak (https…{pno}, pilihan)'), a.tracking_url_template, NOCAP + ' inputmode="url" placeholder="https://…{pno}"') +
        chk('fa-auto', t('Auto-approve orders at FFM (check=1)', 'Lulus auto pesanan di FFM (check=1)'), a.auto_approve) + chk('fa-low', t('Low-stock alerts', 'Amaran stok rendah'), a.low_stock_enabled !== false) +
        '<div class="ffm-sec">' + esc(t('Financing', 'Pembiayaan')) + '</div>' + chk('fa-fund', t('Funded stock (Sales Plan financing)', 'Stok dibiayai (pembiayaan Pelan Jualan)'), a.is_funded) +
        sel('fa-plan', t('Sales Plan', 'Pelan Jualan'), a.sales_plan_id || '', [['', '—']].concat(plans.map(function (p) { return [p.id, p.name || p.id]; }))) +
        '<div class="ffm-sec">' + esc(t('Advanced (verify with FFM MY)', 'Lanjutan (sahkan dengan FFM MY)')) + '</div><div class="ffm-row">' +
        sel('fa-sign', t('Sign mode', 'Mod tandatangan'), a.sign_mode || 'json', [['json', 'JSON (Algorithm 2)'], ['form', 'Form (Algorithm 1)']]) + inp('fa-prefix', t('API path prefix', 'Awalan laluan API'), a.api_prefix, NOCAP + ' placeholder="(empty) or /open/v2"') + '</div><div class="ffm-row">' +
        sel('fa-mult', t('Amount unit', 'Unit amaun'), a.amount_multiplier || 100, [['100', t('sen (×100)', 'sen (×100)')], ['1', 'RM (×1)']]) + sel('fa-fee', t('Fee source', 'Sumber yuran'), a.fee_source || 'shipping', [['shipping', t('FFM order fee API', 'API yuran pesanan FFM')], ['manual', t('Manual entry', 'Masuk manual')]]) + '</div>' +
        '<div class="ffm-row">' + inp('fa-base', 'Base URL', a.base_url || 'https://open.flashfulfillment.my', NOCAP + ' inputmode="url"') + inp('fa-src', 'FFM-Source-From', a.source_from, NOCAP) + '</div>' +
        (a.id ? chk('fa-active', t('Active', 'Aktif'), a.is_active !== false) : '');
      F.modal(a.id ? t('Edit FFM account', 'Ubah akaun FFM') : t('Add FFM account', 'Tambah akaun FFM'), html, t('Save', 'Simpan'), async function (ov, btn) {
        var v = function (id) { var el = ov.querySelector('#' + id); return el ? el.value.trim() : ''; }, c = function (id) { var el = ov.querySelector('#' + id); return !!(el && el.checked); };
        if (!v('fa-label')) return F.modalErr(t('Label is required.', 'Label diperlukan.'));
        if (!a.id && (!v('fa-mch') || !v('fa-key'))) return F.modalErr(t('mchId and API key are required for a new account.', 'mchId dan kunci API diperlukan untuk akaun baharu.'));
        if (c('fa-fund') && !v('fa-plan')) return F.modalErr(t('Pick the Sales Plan for funded stock.', 'Pilih Pelan Jualan untuk stok dibiayai.'));
        var body = { id: a.id || undefined, label: v('fa-label'), mch_id: v('fa-mch'), api_key: v('fa-key'), webhook_app_key: v('fa-wk'), webhook_app_secret: v('fa-ws'), webhook_app_code: v('fa-wc'),
          warehouse_id: v('fa-wh') || null, store_code: v('fa-store') || null, order_source_platform: v('fa-plat') || 'Line', pay_mode: v('fa-pay'), tracking_url_template: normUrl(v('fa-track')),
          auto_approve: c('fa-auto'), low_stock_enabled: c('fa-low'), is_funded: c('fa-fund'), sales_plan_id: c('fa-fund') ? v('fa-plan') : null,
          sign_mode: v('fa-sign'), api_prefix: v('fa-prefix'), amount_multiplier: Number(v('fa-mult')), fee_source: v('fa-fee'), base_url: normUrl(v('fa-base')).replace(/\/+$/, ''), source_from: v('fa-src') || null };
        if (a.id) body.is_active = c('fa-active');
        F.modalErr(''); F.busy(btn, true, t('Saving…', 'Menyimpan…'));
        try {
          await F.api('save_account', body);
          ov.querySelectorAll('input[type=password]').forEach(function (i) { i.value = ''; });
          F.closeModal(); showToast(t('FFM account saved', 'Akaun FFM disimpan'), 'success');
          if (typeof auditLog === 'function') auditLog(a.id ? 'update' : 'create', 'ffm_accounts', a.id || null);
          reload('accounts');
        } catch (e) { F.busy(btn, false); F.modalErr(e.message || String(e)); }
      }, true);
    }
    async function testAcct(a, btn) {
      var out = document.getElementById('ffm-test-' + a.id);
      F.busy(btn, true, t('Testing…', 'Menguji…'));
      try {
        var r = await F.api('test', { account_id: a.id });
        showToast(t('Connected to FFM', 'Bersambung ke FFM'), 'success');
        var wh = (r.warehouses || []).map(function (w) { return '<button type="button" class="btn btn-outline btn-sm" data-wh="' + esc(w.id) + '">' + esc((w.name || w.warehouseNo || w.id) + ' · ID ' + w.id) + '</button>'; }).join('');
        var st = (r.stores || []).map(function (s) { return '<button type="button" class="btn btn-outline btn-sm" data-st="' + esc(s.storeCode) + '">' + esc((s.storeName || s.storeCode) + (s.platform ? ' · ' + s.platform : '')) + '</button>'; }).join('');
        out.innerHTML = '<div style="margin-top:12px"><div class="ffm-sec">' + esc(t('Warehouses — tap to use', 'Gudang — tekan untuk guna')) + '</div><div class="ffm-actions" style="margin:6px 0 10px">' + (wh || '<span class="ffm-muted">-</span>') + '</div>' +
          '<div class="ffm-sec">' + esc(t('Stores — tap to use', 'Kedai — tekan untuk guna')) + '</div><div class="ffm-actions" style="margin-top:6px">' + (st || '<span class="ffm-muted">-</span>') + '</div></div>';
        out.querySelectorAll('[data-wh],[data-st]').forEach(function (b) {
          b.onclick = async function () {
            var body = { id: a.id }; if (b.hasAttribute('data-wh')) body.warehouse_id = b.getAttribute('data-wh'); else body.store_code = b.getAttribute('data-st');
            F.busy(b, true, t('Saving…', 'Menyimpan…'));
            try { await F.api('save_account', body); showToast(t('Saved', 'Disimpan'), 'success'); reload('accounts'); } catch (e) { F.busy(b, false); F.err(e); }
          };
        });
      } catch (e) { out.innerHTML = '<div class="ffm-err" style="margin-top:10px">' + esc(e.message || e) + '</div>'; }
      finally { F.busy(btn, false); }
    }
    function delAcct(a, btn) {
      F.modal(t('Remove FFM account?', 'Buang akaun FFM?'), '<p style="margin:0;font-size:14px">' + esc(t('“' + a.label + '” will be disconnected and its keys erased. Past shipments stay.', '“' + a.label + '” akan diputuskan dan kuncinya dipadam. Penghantaran lama kekal.')) + '</p>', t('Remove', 'Buang'), async function (ov, b) {
        F.busy(b, true);
        try { await F.api('delete_account', { account_id: a.id }); F.closeModal(); showToast(t('Removed', 'Dibuang'), 'success'); if (typeof auditLog === 'function') auditLog('delete', 'ffm_accounts', a.id); reload('accounts'); }
        catch (e) { F.busy(b, false); F.modalErr(e.message); }
      });
    }

    function acctPicker(accts, cur) { return '<select class="form-select" id="ffm-acct-pick" style="max-width:260px">' + accts.map(function (a) { return '<option value="' + esc(a.id) + '"' + (F.same(a.id, cur) ? ' selected' : '') + '>' + esc(a.label + (a.is_funded ? ' · ' + t('Funded', 'Dibiayai') : '')) + '</option>'; }).join('') + '</select>'; }

    /* ---------- Products (per-account FFM barcode + pcs per FFM unit) ---------- */
    async function productsTab(body, accts, accountId) {
      var acct = accts.find(function (a) { return F.same(a.id, accountId); }) || accts[0];
      var rs = await Promise.all([
        sb.from('products').select('id,code,name_en,name_bm,barcode').eq('tenant_id', F.tid()).is('deleted_at', null).order('name_en').limit(1000),
        sb.from('ffm_product_links').select('product_id,barcode,pcs_per_unit,synced_ok,last_synced_at,last_error').eq('account_id', acct.id).is('deleted_at', null)
      ]);
      var prods = rs[0].data || [], links = {}; (rs[1].data || []).forEach(function (l) { links[String(l.product_id)] = l; });
      var bcOf = function (p) { var l = links[String(p.id)]; return String((l && l.barcode) || p.barcode || '').trim(); };
      var nBc = prods.filter(bcOf).length, noBc = prods.length - nBc;
      body.innerHTML = '<div class="card" style="padding:16px"><div class="ffm-actions" style="margin-bottom:12px">' + acctPicker(accts, acct.id) +
        '<button type="button" class="btn btn-primary btn-sm" id="ffm-sync"' + (nBc ? '' : ' disabled') + '><i class="ti ti-refresh"></i> ' + esc(t('Sync products with barcode', 'Segerak produk berbarkod')) + ' (' + nBc + ')</button>' +
        (noBc ? '<span class="ffm-muted">' + esc(t(noBc + ' product(s) without barcode are skipped', noBc + ' produk tanpa barkod dilangkau')) + '</span>' : '') + '</div>' +
        '<p class="ffm-muted" style="margin:0 0 10px">' + esc(t('Barcode and pcs per unit are set per FFM account. M-Core quantities are pcs; FFM counts units (e.g. 1 carton = 24 pcs).', 'Barkod dan pcs seunit ditetapkan ikut akaun FFM. Kuantiti M-Core dalam pcs; FFM kira unit (cth. 1 karton = 24 pcs).')) + '</p>' +
        (prods.length ? '<div class="ffm-tbl"><table><thead><tr><th>' + esc(t('Product', 'Produk')) + '</th><th>' + esc(t('FFM barcode', 'Barkod FFM')) + '</th><th>' + esc(t('Pcs / unit', 'Pcs / unit')) + '</th><th>' + esc(t('FFM', 'FFM')) + '</th><th></th></tr></thead><tbody>' +
          prods.map(function (p) {
            var l = links[String(p.id)], bc = bcOf(p);
            var s = !bc ? '<span class="badge badge-gray">' + esc(t('No barcode', 'Tiada barkod')) + '</span>' : !l || (!l.synced_ok && !l.last_error) ? '<span class="badge badge-gray">' + esc(t('Not synced', 'Belum segerak')) + '</span>' : l.synced_ok ? '<span class="badge badge-green">' + esc(t('Synced', 'Disegerak')) + '</span> <span class="ffm-muted">' + esc(F.dt(l.last_synced_at)) + '</span>' : '<span class="badge badge-red">' + esc(t('Error', 'Ralat')) + '</span><div class="ffm-err">' + esc(l.last_error || '') + '</div>';
            var inv = l && p.barcode && String(p.barcode).trim() !== bc ? '<div class="ffm-muted">' + esc(t('Inventory: ', 'Inventori: ') + p.barcode) + '</div>' : '';
            return '<tr><td>' + esc(typeof prodName === 'function' ? prodName(p) : (p.name_en || p.code)) + '</td><td>' + (bc ? esc(bc) : '<span class="ffm-muted">-</span>') + inv + '</td><td>' + esc(F.ppu(l && l.pcs_per_unit)) + '</td><td>' + s + '</td>' +
              '<td><div class="ffm-actions"><button type="button" class="btn btn-outline btn-sm" data-edit="' + esc(p.id) + '"><i class="ti ti-pencil"></i> ' + esc(t('Edit', 'Ubah')) + '</button></div></td></tr>';
          }).join('') + '</tbody></table></div>'
          : '<div class="empty-state" style="padding:30px"><i class="ti ti-barcode"></i><h3>' + esc(t('No products yet', 'Belum ada produk')) + '</h3><p>' + esc(t('Add products in Inventory first — FFM matches goods by barcode.', 'Tambah produk di Inventori dahulu — FFM padankan barang ikut barkod.')) + '</p></div>') + '</div>';
      document.getElementById('ffm-acct-pick').onchange = function () { reload('products', { account: this.value }); };
      body.querySelectorAll('[data-edit]').forEach(function (b) {
        b.onclick = function () { var p = prods.find(function (x) { return F.same(x.id, b.getAttribute('data-edit')); }); if (p) linkModal(acct, p, links[String(p.id)], bcOf(p)); };
      });
      var sbtn = document.getElementById('ffm-sync');
      sbtn.onclick = async function () {
        F.busy(sbtn, true, t('Syncing…', 'Menyegerak…'));
        try {
          var r = await F.api('sync_products', { account_id: acct.id });
          showToast(t('Synced ' + r.ok + ', failed ' + (r.failed || []).length, 'Disegerak ' + r.ok + ', gagal ' + (r.failed || []).length) + (r.remaining ? t(' — run again for ' + r.remaining + ' more', ' — ulang untuk ' + r.remaining + ' lagi') : ''), (r.failed || []).length ? 'warning' : 'success');
          reload('products', { account: acct.id });
        } catch (e) { F.busy(sbtn, false); F.err(e); }
      };
    }

    function linkModal(acct, p, l, bc) {
      var ppu = F.ppu(l && l.pcs_per_unit), warned = '';
      var html = '<div class="ffm-muted" style="margin-bottom:10px">' + esc((typeof prodName === 'function' ? prodName(p) : p.name_en) + ' · ' + acct.label) + '</div>' +
        '<div class="ffm-row">' + inp('fl-bc', t('FFM barcode for this account', 'Barkod FFM untuk akaun ini'), bc, 'maxlength="40" autocomplete="off" autocapitalize="characters"') +
        inp('fl-ppu', t('Pcs per FFM unit', 'Pcs seunit FFM'), String(ppu), 'type="number" min="1" step="1" inputmode="numeric"') + '</div>' +
        '<div class="ffm-muted" id="fl-hint"></div><div class="ffm-warn" id="fl-warn" role="status"></div>';
      var ov = F.modal(t('FFM barcode & pack size', 'Barkod FFM & saiz pek'), html, t('Save', 'Simpan'), async function (ov, btn) {
        var nb = ov.querySelector('#fl-bc').value.trim(), np = Number(ov.querySelector('#fl-ppu').value);
        if (!F.barcodeOk(nb)) return F.modalErr(t('Barcode: letters and digits only (max 40).', 'Barkod: huruf dan digit sahaja (maks 40).'));
        if (!(np >= 1 && Math.floor(np) === np)) return F.modalErr(t('Pcs per unit must be a whole number of 1 or more.', 'Pcs seunit mesti nombor bulat 1 atau lebih.'));
        F.modalErr('');
        if (!F.ean13Ok(nb) && warned !== nb) { warned = nb; ov.querySelector('#fl-warn').textContent = t('Warning: ' + nb + ' fails the EAN-13 check digit. Check the barcode, or press Save again to keep it.', 'Amaran: ' + nb + ' gagal semakan digit EAN-13. Semak barkod, atau tekan Simpan sekali lagi untuk kekalkan.'); return; }
        F.busy(btn, true, t('Saving…', 'Menyimpan…'));
        try {
          var r = await F.api('save_link', { account_id: acct.id, product_id: p.id, barcode: nb, pcs_per_unit: np });
          F.closeModal();
          showToast(r.resync ? t('Saved — sync products to send the new barcode to FFM', 'Disimpan — segerak produk untuk hantar barkod baharu ke FFM') : t('Saved', 'Disimpan'), r.resync ? 'warning' : 'success');
          reload('products', { account: acct.id });
        } catch (e) { F.busy(btn, false); F.modalErr(e.message); }
      });
      var hint = function () { var n = Number(ov.querySelector('#fl-ppu').value); ov.querySelector('#fl-hint').textContent = n >= 1 && Math.floor(n) === n ? t('1 FFM unit = ' + n + ' pcs. Example: 36 units = ' + (36 * n) + ' pcs.', '1 unit FFM = ' + n + ' pcs. Contoh: 36 unit = ' + (36 * n) + ' pcs.') : ''; };
      ov.querySelector('#fl-ppu').oninput = hint; ov.querySelector('#fl-bc').oninput = function () { ov.querySelector('#fl-warn').textContent = ''; warned = ''; }; hint();
    }

    /* ---------- Stock (FFM only; M-Core stock shown for reference, never overwritten) ---------- */
    async function stockTab(body, accts) {
      var rs = await sb.from('ffm_stock').select('account_id,product_id,barcode,available_qty,total_qty,synced_at').eq('tenant_id', F.tid()).is('deleted_at', null);
      var lk = await sb.from('ffm_product_links').select('account_id,product_id,pcs_per_unit').eq('tenant_id', F.tid()).is('deleted_at', null);
      var ppu = {}; (lk.data || []).forEach(function (l) { ppu[l.account_id + ':' + l.product_id] = F.ppu(l.pcs_per_unit); });
      var st = rs.data || [], pids = Array.from(new Set(st.map(function (s) { return s.product_id; }).filter(Boolean)));
      var pr = pids.length ? await sb.from('products').select('id,code,name_en,name_bm,stock_qty,reorder_point').in('id', pids).eq('tenant_id', F.tid()) : { data: [] };
      var pm = {}; (pr.data || []).forEach(function (p) { pm[String(p.id)] = p; });
      var rows = {}; st.forEach(function (s) { var k = String(s.product_id || s.barcode); (rows[k] = rows[k] || { p: pm[String(s.product_id)], bc: s.barcode, by: {} }).by[String(s.account_id)] = s; });
      var keys = Object.keys(rows);
      body.innerHTML = '<div class="card" style="padding:16px"><div class="ffm-actions" style="margin-bottom:12px"><button type="button" class="btn btn-primary btn-sm" id="ffm-pull"><i class="ti ti-refresh"></i> ' + esc(t('Refresh from FFM', 'Muat semula dari FFM')) + '</button>' +
        '<span class="ffm-muted">' + esc(t('Auto every 30 min. FFM stock is kept separate — M-Core stock is not changed.', 'Auto setiap 30 min. Stok FFM diasingkan — stok M-Core tidak diubah.')) + '</span></div>' +
        (keys.length ? '<div class="ffm-tbl"><table><thead><tr><th>' + esc(t('Product', 'Produk')) + '</th>' + accts.map(function (a) { return '<th>' + esc(a.label) + '<div class="ffm-muted" style="text-transform:none">' + esc(t('avail / total', 'tersedia / jumlah')) + '</div></th>'; }).join('') + '<th>' + esc(t('M-Core stock', 'Stok M-Core')) + '</th></tr></thead><tbody>' +
          keys.map(function (k) {
            var r = rows[k], p = r.p, rp = p && p.reorder_point != null ? Number(p.reorder_point) : 5;
            return '<tr><td>' + esc(p ? (typeof prodName === 'function' ? prodName(p) : p.name_en) : r.bc) + '<div class="ffm-muted">' + esc(r.bc) + '</div></td>' + accts.map(function (a) {
              var s = r.by[String(a.id)]; if (!s) return '<td class="ffm-muted">-</td>';
              var k = ppu[a.id + ':' + s.product_id] || 1, low = Number(s.available_qty) * k <= rp; // reorder point is pcs
              return '<td><strong>' + esc(F.qty(s.available_qty, k)) + '</strong><div>/ ' + esc(F.qty(s.total_qty, k)) + '</div>' + (low ? ' <span class="badge badge-red">' + esc(t('Low', 'Rendah')) + '</span>' : '') + '<div class="ffm-muted">' + esc(F.dt(s.synced_at)) + '</div></td>';
            }).join('') + '<td>' + esc(p ? p.stock_qty + ' pcs' : '-') + '</td></tr>';
          }).join('') + '</tbody></table></div>'
          : '<div class="empty-state" style="padding:30px"><i class="ti ti-box"></i><h3>' + esc(t('No FFM stock yet', 'Belum ada stok FFM')) + '</h3><p>' + esc(t('Sync products first, then refresh.', 'Segerak produk dahulu, kemudian muat semula.')) + '</p></div>') + '</div>';
      var b = document.getElementById('ffm-pull');
      b.onclick = async function () {
        F.busy(b, true, t('Refreshing…', 'Memuat semula…'));
        try { var r = await F.api('sync_stock', {}); var errs = (r.results || []).filter(function (x) { return x.error; }); showToast(errs.length ? errs[0].error : t('FFM stock updated', 'Stok FFM dikemas kini'), errs.length ? 'error' : 'success'); reload('stock'); }
        catch (e) { F.busy(b, false); F.err(e); }
      };
    }

    /* ---------- Reconciliation ---------- */
    async function reconTab(body) {
      var al = {}; (await F.loadAccounts().catch(function () { return []; })).forEach(function (a) { al[String(a.id)] = a.label; });
      var r = await sb.from('ffm_recon_runs').select('*').eq('tenant_id', F.tid()).is('deleted_at', null).order('run_date', { ascending: false }).limit(1);
      var run = (r.data || [])[0], diffs = run ? (run.rows || []).filter(function (x) { return Number(x.diff) !== 0; }) : [];
      body.innerHTML = '<div class="card" style="padding:16px"><div class="ffm-actions" style="margin-bottom:12px"><button type="button" class="btn btn-primary btn-sm" id="ffm-recon"><i class="ti ti-scale"></i> ' + esc(t('Run now', 'Jalankan sekarang')) + '</button>' +
        '<span class="ffm-muted">' + esc(run ? t('Last run ' + run.run_date + ' · ' + run.product_count + ' products · ' + run.diff_count + ' differences', 'Terakhir ' + run.run_date + ' · ' + run.product_count + ' produk · ' + run.diff_count + ' perbezaan') : t('Runs daily 07:15 MYT', 'Berjalan setiap hari 07:15 MYT')) + '</span></div>' +
        (!run ? '<div class="empty-state" style="padding:30px"><i class="ti ti-scale"></i><h3>' + esc(t('No report yet', 'Belum ada laporan')) + '</h3></div>'
          : !diffs.length ? '<div class="empty-state" style="padding:30px"><i class="ti ti-circle-check"></i><h3>' + esc(t('All matched', 'Semua sepadan')) + '</h3></div>'
          : '<div class="ffm-tbl"><table><thead><tr><th>' + esc(t('Product', 'Produk')) + '</th><th>' + esc(t('M-Core', 'M-Core')) + '</th><th>' + esc(t('FFM total', 'Jumlah FFM')) + '</th><th>' + esc(t('Difference', 'Perbezaan')) + '</th></tr></thead><tbody>' +
            diffs.map(function (x) { return '<tr><td>' + esc(APP.language === 'bm' ? (x.name_bm || x.name_en) : x.name_en) + '<div class="ffm-muted">' + esc(x.code || '') + '</div></td><td>' + esc(x.mcore_qty) + ' pcs</td><td>' + esc(x.ffm_total) + ' pcs' + byAcct(x) + '</td><td style="font-weight:600;color:var(' + (x.diff > 0 ? '--warning' : '--danger') + ')">' + (x.diff > 0 ? '+' : '') + esc(x.diff) + ' pcs</td></tr>'; }).join('') + '</tbody></table></div>') +
        '<p class="ffm-muted" style="margin:12px 0 0">' + esc(t('Report only — nothing is adjusted automatically.', 'Laporan sahaja — tiada pelarasan automatik.')) + '</p></div>';
      function byAcct(x) { var u = x.by_account_units || {}; return Object.keys(u).map(function (id) { return '<div class="ffm-muted">' + esc((al[id] || 'FFM') + ': ' + F.qty(u[id].units, u[id].ppu)) + '</div>'; }).join(''); }
      var b = document.getElementById('ffm-recon');
      b.onclick = async function () { F.busy(b, true); try { await F.api('recon', {}); reload('recon'); } catch (e) { F.busy(b, false); F.err(e); } };
    }

    /* ---------- Funded (read-only link to Sales Plan repayment; no journals → no double count) ---------- */
    async function fundedTab(body, accts) {
      var funded = accts.filter(function (a) { return a.is_funded; });
      if (!funded.length) { body.innerHTML = '<div class="card"><div class="empty-state"><i class="ti ti-coin"></i><h3>' + esc(t('No funded FFM account', 'Tiada akaun FFM dibiayai')) + '</h3><p>' + esc(t('Mark an account as Funded and link its Sales Plan.', 'Tandakan akaun sebagai Dibiayai dan pautkan Pelan Jualan.')) + '</p></div></div>'; return; }
      var r = await sb.from('ffm_shipments').select('account_id,status,goods,total_amount,shipped_at,returned_at').eq('tenant_id', F.tid()).is('deleted_at', null).in('account_id', funded.map(function (a) { return a.id; })).not('shipped_at', 'is', null);
      var ships = r.data || [];
      body.innerHTML = funded.map(function (a) {
        var m = {};
        ships.filter(function (s) { return F.same(s.account_id, a.id); }).forEach(function (s) {
          var k = String(s.shipped_at).slice(0, 7), sign = s.status === 'returned' ? 0 : 1, units = (s.goods || []).reduce(function (n, g) { return n + (g.pcs != null ? Number(g.pcs) : Number(g.num || 0)); }, 0); // pcs (older rows: num was pcs)
          var x = m[k] = m[k] || { units: 0, value: 0, ret: 0 };
          if (sign) { x.units += units; x.value += Number(s.total_amount || 0); } else x.ret += units;
        });
        var ks = Object.keys(m).sort().reverse();
        return '<div class="card" style="padding:16px;margin-bottom:12px"><div class="ffm-actions" style="justify-content:space-between;margin-bottom:10px"><strong>' + esc(a.label) + '</strong>' +
          (a.sales_plan_id && (typeof canAccess !== 'function' || canAccess('sales_plan')) ? '<button type="button" class="btn btn-outline btn-sm" data-sp="' + esc(a.sales_plan_id) + '"><i class="ti ti-external-link"></i> ' + esc(t('Open Sales Plan → Stock & Financing', 'Buka Pelan Jualan → Stok & Pembiayaan')) + '</button>' : '') + '</div>' +
          (ks.length ? '<div class="ffm-tbl"><table><thead><tr><th>' + esc(t('Month', 'Bulan')) + '</th><th>' + esc(t('Shipped (net, pcs)', 'Dihantar (bersih, pcs)')) + '</th><th>' + esc(t('Returned (pcs)', 'Dipulangkan (pcs)')) + '</th><th>' + esc(t('Sales value', 'Nilai jualan')) + '</th></tr></thead><tbody>' +
            ks.map(function (k) { return '<tr><td>' + esc(k) + '</td><td>' + esc(m[k].units) + '</td><td>' + esc(m[k].ret) + '</td><td>' + esc(F.rm(m[k].value)) + '</td></tr>'; }).join('') + '</tbody></table></div>'
            : '<div class="ffm-muted">' + esc(t('No shipped funded orders yet.', 'Belum ada pesanan dibiayai dihantar.')) + '</div>') +
          '<p class="ffm-muted" style="margin:10px 0 0">' + esc(t('Read-only. Record repayments in the Sales Plan — no journal is posted here, so nothing is counted twice.', 'Baca sahaja. Rekod bayaran balik di Pelan Jualan — tiada jurnal di sini, jadi tiada kiraan berganda.')) + '</p></div>';
      }).join('');
      body.querySelectorAll('[data-sp]').forEach(function (b) { b.onclick = function () { openPage('sales_plan', { view: 'detail', id: b.getAttribute('data-sp'), tab: 'stock' }); }; });
    }
  }
  boot();
})();
