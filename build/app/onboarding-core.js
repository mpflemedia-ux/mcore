/* M-Core Onboarding Checklist - core: probe gate, nav, routing, helpers. Prefix COB/cob. Nav stays hidden until cob_* tables exist. */
(function () {
  if (window.COB && window.COB._core) return;
  var C = window.COB = window.COB || {};
  C._core = 1;
  C.pages = { client_onboarding: 1, cob_admin: 1, cob_master: 1 };
  C.ok = false; C.probed = null; C.uid = null; C.pending = 0; C.readyHooks = C.readyHooks || []; C.view = C.view || {};
  C.bm = function () { return typeof APP !== 'undefined' && APP.language === 'bm'; };
  C.L = function (en, bm) { return C.bm() ? bm : en; };
  C.lab = function (o, k) { return (C.bm() ? o[k + '_bm'] : o[k + '_en']) || o[k + '_bm'] || o[k + '_en'] || ''; };
  C.esc = function (s) {
    return String(s == null ? '' : s).replace(/&/g, '\u0026amp;').replace(/</g, '\u0026lt;').replace(/>/g, '\u0026gt;').replace(/"/g, '\u0026quot;').replace(/'/g, '\u0026#39;');
  };
  C.isPA = function () { try { return typeof isPlatformAdmin === 'function' && !!isPlatformAdmin(); } catch (e) { return false; } };
  C.isTA = function () { try { return typeof isTenantAdmin === 'function' && !!isTenantAdmin(); } catch (e) { return false; } };
  C.tid = function () { return (typeof APP !== 'undefined' && APP.tenant && APP.tenant.id) ? String(APP.tenant.id) : null; };
  var MB = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];
  var ME = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  /* Asia/Kuala_Lumpur wall clock (UTC+8, no DST) */
  C.myt = function (d) { var t = new Date(d); if (isNaN(t)) return null; return new Date(t.getTime() + 8 * 3600000); };
  C.date = function (d, year) {
    if (!d) return '—';
    var m = /^\d{4}-\d{2}-\d{2}$/.test(String(d)) ? new Date(d + 'T00:00:00Z') : C.myt(d);
    if (!m || isNaN(m)) return '—';
    return m.getUTCDate() + ' ' + (C.bm() ? MB : ME)[m.getUTCMonth()] + (year === false ? '' : ' ' + m.getUTCFullYear());
  };
  C.time = function (d) {
    var m = C.myt(d); if (!m) return '';
    var h = m.getUTCHours(), mi = String(m.getUTCMinutes()).padStart(2, '0'), pm = h >= 12, h12 = h % 12 || 12;
    return h12 + ':' + mi + ' ' + (C.bm() ? (pm ? 'PTG' : 'PG') : (pm ? 'PM' : 'AM'));
  };
  C.dt = function (d) { return d ? C.date(d, false) + ', ' + C.time(d) : '—'; };
  C.today = function () { return C.myt(Date.now()).toISOString().slice(0, 10); };
  C.daysTo = function (ymd) { if (!ymd) return null; return Math.round((Date.parse(ymd + 'T00:00:00Z') - Date.parse(C.today() + 'T00:00:00Z')) / 86400000); };
  C.age = function (d) {
    var s = Math.max(0, (Date.now() - new Date(d).getTime()) / 1000);
    if (s < 3600) return Math.max(1, Math.round(s / 60)) + ' min';
    if (s < 86400) return Math.round(s / 3600) + C.L(' h', ' j');
    var n = Math.round(s / 86400); return n + C.L(n === 1 ? ' day' : ' days', ' hari');
  };
  C.mask = function (v) {
    v = String(v == null ? '' : v); if (!v) return '—';
    if (v.length <= 4) return '••••';
    return v.slice(0, Math.min(4, v.length - 4)) + ' •••• ' + v.slice(-4);
  };
  C.size = function (b) { b = +b || 0; return b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB'; };
  C.toast = function (m, t) { try { showToast(m, t || 'info'); } catch (e) { console.log(m); } };
  C.err = function (e) { return (e && (e.message || e.error_description)) || String(e || ''); };
  C.ST = {
    pending: ['gray', 'ti-circle-dashed', 'Not started', 'Belum'],
    submitted: ['blue', 'ti-clock-hour-4', 'Submitted', 'Dihantar'],
    approved: ['green', 'ti-circle-check', 'Approved', 'Lulus'],
    rejected: ['red', 'ti-circle-x', 'Rejected', 'Ditolak'],
    na: ['gray', 'ti-minus', 'Not applicable', 'Tak berkenaan']
  };
  C.st = function (s) { var x = C.ST[s] || C.ST.pending; return '<span class="badge badge-' + x[0] + ' cob-st"><i class="ti ' + x[1] + '"></i>' + C.L(x[2], x[3]) + '</span>'; };
  C.typeIcon = function (it) {
    if ((it.fields || []).some(function (f) { return f.kind === 'logo'; })) return 'ti-photo';
    return { doc: 'ti-file-text', form: 'ti-forms', list: 'ti-table-import' }[it.item_type] || 'ti-file-text';
  };
  C.done = function (s) { return s === 'approved' || s === 'na'; };
  C.loading = function () { var m = document.getElementById('main'); if (m) m.innerHTML = '<div class="page-loading"><div class="spinner dark"></div></div>'; };
  C.fail = function (e) {
    var m = document.getElementById('main');
    if (m) m.innerHTML = '<div class="empty-state" style="padding:48px"><i class="ti ti-alert-triangle" style="font-size:32px;color:var(--danger)"></i><p>' + C.esc(C.err(e)) + '</p></div>';
  };

  /* Safe gate: one head-only read. Any error (table missing, RLS, offline) => module stays hidden. */
  C.probe = function () {
    var uid = (typeof APP !== 'undefined' && APP.user && APP.user.id) ? String(APP.user.id) : null;
    if (!uid || typeof sb === 'undefined') return Promise.resolve(false);
    if (C.probed && C.uid === uid) return C.probed;
    C.uid = uid;
    C.probed = Promise.resolve().then(function () {
      return sb.from('cob_checklists').select('id', { count: 'exact', head: true }).limit(1);
    }).then(function (r) { C.ok = !!(r && !r.error); return C.ok; }, function () { C.ok = false; return false; });
    return C.probed;
  };

  function navList() {
    try { if (typeof NAV_ITEMS !== 'undefined' && Array.isArray(NAV_ITEMS)) return NAV_ITEMS; } catch (e) {}
    return Array.isArray(window.NAV_ITEMS) ? window.NAV_ITEMS : null;
  }
  function insertAfter(list, id, items) {
    var i = list.findIndex(function (n) { return n && n.id === id; });
    if (i < 0) { i = list.findIndex(function (n) { return n && n.id === 'settings'; }) - 1; if (i < -1) i = list.length - 1; }
    Array.prototype.splice.apply(list, [i + 1, 0].concat(items));
  }
  C.syncNav = function () {
    var list = navList(); if (!list) return;
    for (var i = list.length - 1; i >= 0; i--) if (list[i] && list[i]._cob) list.splice(i, 1);
    if (!C.ok) return;
    if (C.isPA()) {
      insertAfter(list, 'reports', [
        { section: 'Platform M-Core', _cob: 1 },
        { id: 'cob_admin', icon: 'ti-checklist', label_en: 'Client Onboarding', label_bm: 'Onboarding Klien', module: 'core', _cob: 1 },
        { id: 'cob_master', icon: 'ti-list-details', label_en: 'Checklist Master', label_bm: 'Master Senarai Semak', module: 'core', _cob: 1 }
      ]);
    } else if (C.isTA()) {
      insertAfter(list, 'learning', [{ id: 'client_onboarding', icon: 'ti-checklist', label_en: 'Onboarding', label_bm: 'Onboarding', module: 'core', _cob: 1 }]);
    }
  };
  /* Count pill (pending reviews) on the PA nav item. Plain count only - no 'NEW' badge. */
  C.paintCount = function () {
    var el = document.querySelector('.nav-item[data-page="cob_admin"]'); if (!el) return;
    var p = el.querySelector('.cob-navcnt');
    if (!C.pending) { if (p) p.remove(); return; }
    if (!p) { p = document.createElement('span'); p.className = 'cob-navcnt'; el.appendChild(p); }
    p.textContent = C.pending > 99 ? '99+' : String(C.pending);
  };
  C.refreshCount = function () {
    if (!C.ok || !C.isPA()) return Promise.resolve();
    return sb.from('cob_submissions').select('id', { count: 'exact', head: true }).is('decision', null).is('deleted_at', null)
      .then(function (r) { if (!r.error) { C.pending = r.count || 0; C.paintCount(); } }, function () {});
  };

  var ACCESS = { client_onboarding: function () { return C.isTA() && !C.isPA(); }, cob_admin: C.isPA, cob_master: C.isPA };
  C.open = function (page, params, orig) {
    params = params || {};
    return C.probe().then(function (ok) {
      if (!ok) return orig.call(window, 'dashboard', {});
      if (!ACCESS[page]()) { if (typeof renderAccessDenied === 'function') renderAccessDenied(); return; }
      try { _clearUiOverlays(); } catch (e) {}
      try { _closeMobileSidebar(); } catch (e) {}
      try { closeUserDropdown(); } catch (e) {}
      try { _sdUnregisterPrintListeners(); } catch (e) {}
      try { _lsSet('nexerp_last_page', page); _lsSet('nexerp_last_params', JSON.stringify(params)); } catch (e) {}
      APP.currentPage = page;
      try { _navPushHistory(page, params); } catch (e) {}
      document.querySelectorAll('.nav-item').forEach(function (el) { el.classList.toggle('active', el.dataset.page === page); });
      var item = (navList() || []).find(function (n) { return n && n.id === page; });
      var ht = document.getElementById('header-title');
      if (ht && item) ht.textContent = C.bm() ? item.label_bm : item.label_en;
      C.loading();
      var fn = C.view && C.view[page];
      return Promise.resolve().then(function () { return fn ? fn(params) : C.fail(new Error('module not loaded')); }).catch(C.fail);
    });
  };
  C.modal = function (title, html) {
    C.closeModal();
    var w = document.createElement('div'); w.className = 'cob-modal'; w.id = 'cob-modal';
    w.innerHTML = '<div class="cob-card cob-mbox" role="dialog" aria-modal="true" aria-label="' + C.esc(title) + '"><div class="row" style="justify-content:space-between;padding:12px 14px;border-bottom:1px solid var(--border)"><b style="font-size:15px">' + C.esc(title) + '</b><button class="btn btn-sm btn-outline btn-icon" data-x aria-label="Close" style="width:32px;height:32px"><i class="ti ti-x"></i></button></div><div class="cob-mbody">' + html + '</div></div>';
    w.onclick = function (e) { if (e.target === w || e.target.closest('[data-x]')) C.closeModal(); };
    document.body.appendChild(w); var b = w.querySelector('[data-x]'); if (b) b.focus();
    return w;
  };
  C.closeModal = function () { var o = document.getElementById('cob-modal'); if (o) o.remove(); };
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') C.closeModal(); });
  C.go = function (page, params) { window.openPage(page, params || {}); };

  function wrap() {
    var o = window.openPage;
    if (typeof o === 'function' && !o._cobW) {
      var w = function (page, params) { if (C.pages[page]) return C.open(page, params, o); return o.apply(this, arguments); };
      w._cobW = 1; window.openPage = w;
    }
    var b = window.buildSidebar;
    if (typeof b === 'function' && !b._cobW) {
      var wb = function () { C.syncNav(); var r = b.apply(this, arguments); C.paintCount(); return r; };
      wb._cobW = 1; window.buildSidebar = wb;
    }
  }
  var tries = 0;
  function boot() {
    wrap();
    var ready = typeof APP !== 'undefined' && APP.user && APP.user.id && APP.tenant && APP.tenant.id;
    if (!ready) { if (++tries < 240) setTimeout(boot, 500); return; }
    var was = C.uid;
    C.probe().then(function (ok) {
      if (!ok) return;
      try { window.buildSidebar(); } catch (e) {}
      C.refreshCount();
      (C.readyHooks || []).forEach(function (f) { try { f(); } catch (e) { console.warn('cob ready', e); } });
    });
    /* re-check for user switch (logout/login without reload) */
    setTimeout(function poll() {
      var u = typeof APP !== 'undefined' && APP.user && APP.user.id ? String(APP.user.id) : null;
      if (u && u !== C.uid) { C.probed = null; tries = 0; boot(); return; }
      setTimeout(poll, 3000);
    }, 3000);
    return was;
  }
  boot();
})();
