/* M-Core Service Desk - core: probe gate, nav, routing, admin tabs, realtime toasts. Needs onboarding-core (COB helpers).
   Everything stays hidden until the service_* tables exist (42P01/PGRST205 => one console line, no UI). */
(function () {
  if (window.SD && window.SD._core) return;
  var SD = window.SD = window.SD || {};
  SD._core = 1; SD.view = SD.view || {}; SD.admin = SD.admin || {};
  SD.has = { contracts: false, desk: false, consent: false, packs: false };
  var C = function () { return window.COB || {}; };
  ['bm', 'L', 'esc', 'isPA', 'isTA', 'tid', 'date', 'time', 'dt', 'today', 'daysTo', 'age', 'size', 'toast', 'err', 'modal', 'closeModal', 'loading', 'fail'].forEach(function (k) {
    SD[k] = function () { var f = C()[k]; return typeof f === 'function' ? f.apply(null, arguments) : undefined; };
  });
  SD.uid = function () { return (typeof APP !== 'undefined' && APP.user && APP.user.id) ? String(APP.user.id) : null; };
  SD.same = function (a, b) { return String(a) === String(b); };
  SD.main = function () { return document.getElementById('main'); };
  SD.pages = { servis_saya: 1, laporan_bulanan: 1, sd_access: 1 };
  SD.adminViews = { sd_contracts: 1, sd_desk: 1 };
  var TABLES = { contracts: 'service_contracts', desk: 'service_requests', consent: 'support_access_consents', packs: 'service_report_packs' };
  var logged = false, probed = null, probedUid = null;
  SD.missing = function (e) { return !!e && (e.code === '42P01' || e.code === 'PGRST205' || /does not exist|schema cache/i.test(e.message || '')); };
  SD.probe = function () {
    var uid = SD.uid();
    if (!uid || typeof sb === 'undefined') return Promise.resolve(SD.has);
    if (probed && probedUid === uid) return probed;
    probedUid = uid;
    probed = Promise.all(Object.keys(TABLES).map(function (k) {
      return Promise.resolve().then(function () { return sb.from(TABLES[k]).select('id', { count: 'exact', head: true }).limit(1); })
        .then(function (r) { SD.has[k] = !!(r && !r.error); return r && r.error; }, function (e) { SD.has[k] = false; return e; });
    })).then(function (errs) {
      if (!logged && errs.some(SD.missing)) { logged = true; console.info('[M-Core Service Desk] tables not found - module hidden until SQL is run'); }
      SD.has.desk = SD.has.desk && SD.has.contracts;
      return SD.has;
    });
    return probed;
  };
  function navList() {
    try { if (typeof NAV_ITEMS !== 'undefined' && Array.isArray(NAV_ITEMS)) return NAV_ITEMS; } catch (e) {}
    return Array.isArray(window.NAV_ITEMS) ? window.NAV_ITEMS : null;
  }
  SD.client = function () { return SD.isTA() && !SD.isPA(); };
  SD.syncNav = function () {
    var list = navList(); if (!list) return;
    for (var i = list.length - 1; i >= 0; i--) if (list[i] && list[i]._sd) list.splice(i, 1);
    if (!SD.client()) return;
    var add = [];
    if (SD.has.desk) add.push({ id: 'servis_saya', icon: 'ti-headset', label_en: 'My Services', label_bm: 'Servis Saya', module: 'core', _sd: 1 });
    if (SD.has.packs) add.push({ id: 'laporan_bulanan', icon: 'ti-report-analytics', label_en: 'Monthly Reports', label_bm: 'Laporan Bulanan', module: 'core', _sd: 1 });
    if (!add.length) return;
    var at = list.findIndex(function (n) { return n && n.id === 'client_onboarding'; });
    if (at < 0) at = list.findIndex(function (n) { return n && n.id === 'learning'; });
    if (at < 0) at = Math.max(0, list.findIndex(function (n) { return n && n.id === 'settings'; }) - 1);
    Array.prototype.splice.apply(list, [at + 1, 0].concat(add));
  };
  function prep(page, params, active) {
    try { _clearUiOverlays(); } catch (e) {}
    try { _closeMobileSidebar(); } catch (e) {}
    try { closeUserDropdown(); } catch (e) {}
    try { _lsSet('nexerp_last_page', page); _lsSet('nexerp_last_params', JSON.stringify(params || {})); } catch (e) {}
    APP.currentPage = page;
    try { _navPushHistory(page, params || {}); } catch (e) {}
    document.querySelectorAll('.nav-item').forEach(function (el) { el.classList.toggle('active', el.dataset.page === (active || page)); });
  }
  SD.title = function (t) { var h = document.getElementById('header-title'); if (h) h.textContent = t; };
  SD.run = function (fn, params) {
    SD.loading();
    return Promise.resolve().then(function () { return fn ? fn(params || {}) : SD.fail(new Error('module not loaded')); }).catch(function (e) { console.warn('[sd]', e); SD.fail(e); });
  };
  SD.open = function (page, params, orig) {
    return SD.probe().then(function () {
      var ok = page === 'sd_access' ? SD.has.consent && SD.isTA() : page === 'laporan_bulanan' ? SD.has.packs && SD.client() : SD.has.desk && SD.client();
      if (!ok) return orig.call(window, 'dashboard', {});
      prep(page, params, page === 'sd_access' ? 'settings' : page);
      SD.title(page === 'servis_saya' ? SD.L('My Services', 'Servis Saya') : page === 'laporan_bulanan' ? SD.L('Monthly Reports', 'Laporan Bulanan') : SD.L('Support Access', 'Akses Sokongan'));
      return SD.need(SD.view, page).then(function () { if (APP.currentPage !== page) return; return SD.run(SD.view[page], params); });
    });
  };
  SD.openAdmin = function (params, orig) {
    return SD.probe().then(function () {
      var v = params.view;
      if (!SD.isPA() || !(v === 'sd_contracts' ? SD.has.contracts : SD.has.desk)) return orig.call(window, 'admin', {});
      prep('admin', params, 'admin');
      SD.title('Admin');
      return SD.need(SD.admin, v).then(function () { if (APP.currentPage !== 'admin') return; return SD.run(SD.admin[v], params); });
    });
  };
  /* boot race: init() can restore the last page before later sd-*.js tags finish loading -> wait (max 15s) */
  SD.need = function (o, k) {
    return new Promise(function (res) { var n = 0; (function t() { if (typeof o[k] === 'function' || ++n > 75) return res(); setTimeout(t, 200); })(); });
  };
  SD.go = function (page, params) { window.openPage(page, params || {}); };
  SD.tabs = function (active) { try { return _adminTabs(active); } catch (e) { return ''; } };
  SD.head = function (title, sub, right) {
    return '<div class="page-header"><div><div class="page-title">' + SD.esc(title) + '</div>' + (sub ? '<div style="font-size:13px;color:var(--text-3);margin-top:2px">' + SD.esc(sub) + '</div>' : '') + '</div>' + (right || '') + '</div>';
  };
  function tabBtn(v, icon, en, bm, active, badge) {
    var b = badge ? '<span id="sd-open-badge" style="margin-left:6px;min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:var(--danger);color:#fff;font-size:10px;font-weight:700;display:inline-flex;align-items:center;justify-content:center">' + badge + '</span>' : '';
    return '<button class="btn btn-sm ' + (active === v ? 'btn-primary' : 'btn-outline') + '" onclick="openPage(\'admin\',{view:\'' + v + '\'})"><i class="ti ' + icon + '"></i> ' + (SD.bm() ? bm : en) + b + '</button>';
  }
  function wrap() {
    var o = window.openPage;
    if (typeof o === 'function' && !o._sdW) {
      var w = function (page, params) {
        params = params || {};
        if (SD.pages[page]) return SD.open(page, params, o);
        if (page === 'admin' && SD.adminViews[params.view]) return SD.openAdmin(params, o);
        var r = o.apply(this, arguments);
        if (page === 'settings' && typeof SD.settingsHook === 'function') Promise.resolve(r).then(function () { [80, 500, 1200, 2500].forEach(function (t) { setTimeout(SD.settingsHook, t); }); });
        return r;
      };
      w._sdW = 1; window.openPage = w;
    }
    var b = window.buildSidebar;
    if (typeof b === 'function' && !b._sdW) {
      var wb = function () { SD.syncNav(); return b.apply(this, arguments); };
      wb._sdW = 1; window.buildSidebar = wb;
    }
    var t = window._adminTabs;
    if (typeof t === 'function' && !t._sdW) {
      var wt = function (active) {
        var h = t.apply(this, arguments);
        if (!SD.isPA() || !SD.has.contracts) return h;
        var add = tabBtn('sd_contracts', 'ti-file-certificate', 'Service Contracts', 'Kontrak Servis', active) + (SD.has.desk ? tabBtn('sd_desk', 'ti-headset', 'Service Desk', 'Service Desk', active, '') : '');
        if (SD.has.desk) setTimeout(function(){ SD.openBadge && SD.openBadge(); }, 50);
        var i = h.indexOf("view:'clients'"), j = i >= 0 ? h.indexOf('</button>', i) : -1;
        if (j >= 0) return h.slice(0, j + 9) + add + h.slice(j + 9);
        var k = h.lastIndexOf('</div>');
        return k >= 0 ? h.slice(0, k) + add + h.slice(k) : h + add;
      };
      wt._sdW = 1; window._adminTabs = wt;
    }
  }
  SD.chan = null;
  SD.realtime = function () {
    if (SD.chan || !SD.has.desk || typeof sb === 'undefined' || !sb.channel) return;
    try {
      SD.chan = sb.channel('sd-requests-' + SD.uid()).on('postgres_changes', { event: '*', schema: 'public', table: 'service_requests' }, function (p) {
        var n = p && p.new; if (!n || !n.ref_no) return;
        var mine = SD.same(n.tenant_id, SD.tid());
        if (SD.isPA() && p.eventType === 'INSERT') SD.toast(SD.L('New service request ', 'Permohonan servis baharu ') + n.ref_no, 'info');
        else if (!SD.isPA() && mine && p.eventType === 'UPDATE' && p.old && p.old.status && p.old.status !== n.status && SD.stLabel) SD.toast(n.ref_no + ': ' + SD.stLabel(n.status), 'info');
        if (typeof SD.onChange === 'function') SD.onChange(n);
      }).subscribe();
    } catch (e) { SD.chan = null; }
  };
  var tries = 0;
  function boot() {
    wrap();
    var ready = typeof APP !== 'undefined' && APP.user && APP.user.id && APP.tenant && APP.tenant.id;
    if (!ready) { if (++tries < 240) setTimeout(boot, 500); return; }
    SD.probe().then(function (h) {
      if (!h.contracts && !h.consent && !h.packs) return;
      try { window.buildSidebar(); } catch (e) {}
      SD.realtime();
    });
    setTimeout(function poll() {
      var u = SD.uid();
      if (u && u !== probedUid) { probed = null; tries = 0; if (SD.chan) { try { sb.removeChannel(SD.chan); } catch (e) {} SD.chan = null; } boot(); return; }
      setTimeout(poll, 3000);
    }, 3000);
  }
  boot();
})();
