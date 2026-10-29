/* M-Core sidebar v2 — core: section map, extra links (existing pages only), per-user state, tenant layout + industry probes, badges. */
(function () {
  if (window.NV && window.NV._core) return;
  var NV = window.NV = window.NV || {}; NV._core = 1;
  var bm = function () { return typeof APP !== 'undefined' && APP.language === 'bm'; };
  NV.L = function (en, ms) { return bm() ? ms : en; };
  NV.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  NV.same = function (a, b) { return String(a) === String(b); };
  NV.uid = function () { return (typeof APP !== 'undefined' && APP.user && APP.user.id) ? String(APP.user.id) : ''; };
  NV.tid = function () { return (typeof APP !== 'undefined' && APP.tenant && APP.tenant.id) ? String(APP.tenant.id) : ''; };
  NV.isPA = function () { try { return typeof isPlatformAdmin === 'function' && !!isPlatformAdmin(); } catch (e) { return false; } };
  NV.isTA = function () { try { return typeof isTenantAdmin === 'function' && !!isTenantAdmin(); } catch (e) { return false; } };
  NV.can = function (m) { try { return typeof canAccess === 'function' && !!canAccess(m); } catch (e) { return false; } };
  /* wrap a global ONCE; keeps other modules' _xxW flags so they never double-wrap */
  NV._w = {};
  NV.wrapFn = function (name, tag, make) {
    var o = window[name]; if (typeof o !== 'function' || NV._w[name + tag]) return false;
    var w = make(o); Object.keys(o).forEach(function (k) { if (/^_/.test(k)) w[k] = o[k]; }); NV._w[name + tag] = 1; window[name] = w; return true;
  };
  NV.ready = function () { return !!(NV.uid() && NV.tid()); };
  NV.mobile = function () { return window.innerWidth <= 768; };
  /* sections, in display order */
  NV.SECS = [['utama', 'Main', 'Utama'], ['jualan', 'Sales', 'Jualan'], ['stok', 'Stock', 'Stok'], ['orang', 'People', 'Orang'], ['kewangan', 'Finance', 'Kewangan'],
    ['sokongan', 'Support', 'Sokongan'], ['platform', 'M-Core Platform', 'Platform M-Core'], ['sistem', 'System', 'Sistem'], ['lain', 'More', 'Lain-lain']];
  NV.MAP = {
    dashboard: 'utama', planner: 'utama', projects: 'utama', nv_notif: 'utama', nv_activity: 'utama',
    crm: 'jualan', sales: 'jualan', pos: 'jualan', sales_plan: 'jualan', sales_commission: 'jualan', achievements: 'jualan', nv_bookings: 'jualan',
    inventory: 'stok', purchasing: 'stok', production: 'stok', logistics: 'stok',
    hr: 'orang', shifts: 'orang', applicants: 'orang', nv_tracker: 'orang',
    accounting: 'kewangan', expense_claims: 'kewangan', vouchers: 'kewangan', reports: 'kewangan',
    nv_sd_access: 'sokongan', client_onboarding: 'sokongan', servis_saya: 'sokongan', laporan_bulanan: 'sokongan', docs: 'sokongan', learning: 'sokongan', sales_academy: 'sokongan',
    cob_admin: 'platform', cob_master: 'platform', nv_sd_desk: 'platform', nv_sd_contracts: 'platform',
    admin: 'sistem', settings: 'sistem', nv_devroadmap: 'sistem', nv_promptcoll: 'sistem'
  };
  NV.ORDER = ['dashboard', 'planner', 'projects', 'nv_notif', 'nv_activity', 'crm', 'sales', 'pos', 'sales_plan', 'sales_commission', 'achievements', 'nv_bookings',
    'inventory', 'purchasing', 'production', 'logistics', 'hr', 'shifts', 'applicants', 'nv_tracker', 'accounting', 'expense_claims', 'vouchers', 'reports',
    'sd_desk_client', 'nv_sd_access', 'client_onboarding', 'servis_saya', 'laporan_bulanan', 'docs', 'learning', 'sales_academy',
    'cob_admin', 'cob_master', 'nv_sd_desk', 'nv_sd_contracts', 'admin', 'settings', 'nv_devroadmap', 'nv_promptcoll'];
  NV.CHILD = { achievements: 'sales_commission', sales_academy: 'learning' };
  var SD = function () { return window.SD || { has: {} }; };
  var scrollTo = function (id) {
    return function () {
      window.openPage('dashboard'); var n = 0;
      (function t() { var el = document.getElementById(id); if (el && typeof _dbScrollToSec === 'function') return _dbScrollToSec(id); if (++n < 40) setTimeout(t, 150); else if (typeof _dbScrollToSec === 'function') _dbScrollToSec(id); })();
    };
  };
  /* new links: every target is an EXISTING page / tab / dashboard section */
  NV.EXTRA = [
    { id: 'nv_notif', ic: 'ti-bell', en: 'Notifications', ms: 'Pemberitahuan', ok: function () { return true; },
      go: function () { if (window.NT && NT.on) window.openPage('notifikasi', {}); else if (typeof toggleNotifMenu === 'function') setTimeout(toggleNotifMenu, 0); } },
    { id: 'nv_activity', ic: 'ti-activity', en: 'Activity Log', ms: 'Activity Log', ok: function () { return true; }, go: scrollTo('db-sec-activity') },
    { id: 'nv_bookings', ic: 'ti-calendar-plus', en: 'Bookings', ms: 'Tempahan', ok: function (h) { return !!h.planner && typeof _dbScrollToSec === 'function'; }, go: scrollTo('db-sec-booking') },
    { id: 'nv_tracker', ic: 'ti-calendar-stats', en: 'Att. Tracker', ms: 'Att. Tracker', ok: function (h) { return !!h.hr; }, go: scrollTo('db-sec-tracker') },
    { id: 'nv_sd_access', ic: 'ti-shield-lock', en: 'Support Access Consent', ms: 'Consent Akses Sokongan', ok: function () { return !!(SD().has && SD().has.consent) && NV.isTA(); }, go: function () { window.openPage('sd_access', {}); } },
    { id: 'nv_sd_desk', ic: 'ti-headset', en: 'Service Desk (all tenants)', ms: 'Service Desk semua tenant', ok: function () { return NV.isPA() && !!(SD().has && SD().has.desk); }, go: function () { window.openPage('admin', { view: 'sd_desk' }); } },
    { id: 'nv_sd_contracts', ic: 'ti-file-certificate', en: 'Service Contracts', ms: 'Kontrak Servis', ok: function () { return NV.isPA() && !!(SD().has && SD().has.contracts); }, go: function () { window.openPage('admin', { view: 'sd_contracts' }); } },
    { id: 'nv_devroadmap', ic: 'ti-rocket', en: 'System Development', ms: 'System Development', ok: NV.isPA, go: function () { window.openPage('admin', { view: 'devroadmap' }); } },
    { id: 'nv_promptcoll', ic: 'ti-notes', en: 'Prompt Collections', ms: 'Koleksi Prompt', ok: NV.isPA, go: function () { window.openPage('admin', { view: 'prompt-collections' }); } }
  ];
  /* Admin tab (params.view) -> sidebar shortcut id, so the shortcut stays highlighted while on that tab */
  NV.VIEW = { devroadmap: 'nv_devroadmap', 'prompt-collections': 'nv_promptcoll' };
  NV.curOf = function (page, params) { return (page === 'admin' && params && NV.VIEW[params.view]) || page; };
  NV.secOf = function (page) {
    if (page === 'nv_sd_access' && NV.isPA()) return 'platform';
    return NV.MAP[page] || 'lain';
  };
  /* ---- per-user state (localStorage, keyed by user + tenant) ---- */
  NV.key = function () { return 'mcore_nv_' + NV.uid() + '_' + NV.tid(); };
  NV.st = function () {
    var s = {}; try { s = JSON.parse(localStorage.getItem(NV.key()) || '{}') || {}; } catch (e) {}
    s.pin = Array.isArray(s.pin) ? s.pin : []; s.recent = Array.isArray(s.recent) ? s.recent : []; s.closed = s.closed && typeof s.closed === 'object' ? s.closed : {};
    return s;
  };
  NV.save = function (s) { try { localStorage.setItem(NV.key(), JSON.stringify({ pin: s.pin.slice(0, 8), recent: s.recent.slice(0, 3), closed: s.closed })); } catch (e) {} };
  NV.touch = function (page) {
    if (!page || !NV.uid()) return; var s = NV.st();
    s.recent = [page].concat(s.recent.filter(function (p) { return p !== page; })).slice(0, 3); NV.save(s);
  };
  /* ---- tenant layout (sidebar_layouts; hidden until SQL) + industry (tenants.industry) ---- */
  NV.layout = null; NV.layoutOk = false; NV.industry = ''; var probed = '';
  NV.probe = function () {
    var t = NV.tid(); if (!t || typeof sb === 'undefined') return Promise.resolve();
    if (probed === t) return Promise.resolve(); probed = t;
    var a = Promise.resolve().then(function () { return sb.from('sidebar_layouts').select('layout').eq('tenant_id', t).is('deleted_at', null).maybeSingle(); })
      .then(function (r) { NV.layoutOk = !!(r && !r.error); NV.layout = (r && r.data && r.data.layout) || null; }, function () { NV.layoutOk = false; });
    var b = Promise.resolve().then(function () { return sb.from('tenants').select('industry').eq('id', t).maybeSingle(); })
      .then(function (r) { NV.industry = (r && !r.error && r.data && r.data.industry) ? String(r.data.industry).toLowerCase() : ''; }, function () {});
    return Promise.all([a, b]);
  };
  NV.reprobe = function () { probed = ''; return NV.probe(); };
  /* order inside a section: tenant layout > industry > default */
  NV.IND = { food: ['pos'], retail: ['pos'], services: ['projects', 'servis_saya'], construction: ['projects'] };
  NV.rank = function (sec, ids) {
    var base = function (id) { var i = NV.ORDER.indexOf(id); return i < 0 ? 999 : i; };
    var up = NV.IND[NV.industry] || [];
    var lay = NV.layout && NV.layout.order && NV.layout.order[sec];
    return ids.slice().sort(function (a, b) {
      if (Array.isArray(lay)) { var x = lay.indexOf(a), y = lay.indexOf(b); if (x >= 0 || y >= 0) return (x < 0 ? 999 : x) - (y < 0 ? 999 : y); }
      var ua = up.indexOf(a) >= 0 ? 0 : 1, ub = up.indexOf(b) >= 0 ? 0 : 1;
      if (ua !== ub && !NV.CHILD[a] && !NV.CHILD[b]) return ua - ub;
      return base(a) - base(b);
    });
  };
  NV.hidden = function (id) {
    if (NV.isTA()) return false;
    var h = NV.layout && NV.layout.hide; return Array.isArray(h) && h.indexOf(id) >= 0 && id !== 'dashboard' && id !== 'settings';
  };
  /* ---- badges: bell Tindakan items grouped by target page; hidden when 0 ---- */
  NV.counts = function () {
    var c = {};
    try {
      if (window.NT && NT.on && typeof NT.build === "function" && Array.isArray(NT.rows)) {
        (NT.build().action || []).forEach(function (it) {
          var g = it.go || (it.row && it.row.link && [it.row.link.page, it.row.link.params || {}]) || [];
          var p = g[0], v = (g[1] || {}).view;
          if (p === 'accounting' && (v === 'exp-form' || v === 'expense')) p = 'expense_claims';
          else if (p === 'admin' && v === 'sd_desk') p = 'nv_sd_desk';
          else if (!p && it.cat === 'sd') p = NV.isPA() ? 'nv_sd_desk' : 'servis_saya';
          if (p) c[p] = (c[p] || 0) + 1;
        });
      }
      var b = document.getElementById('notif-badge'); var n = b && b.classList.contains('show') ? parseInt(b.textContent, 10) : 0;
      if (n > 0) c.nv_notif = n;
    } catch (e) {}
    return c;
  };
})();
