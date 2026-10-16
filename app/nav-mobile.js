/* M-Core sidebar v2 — phone bottom bar (<=768) + "+ Baru" sheet (existing create flows only) */
(function () {
  if (!window.NV || NV._mob) return; NV._mob = 1;
  var L = NV.L, esc = NV.esc;
  /* create actions: each calls an EXISTING create flow; shown only when that page is reachable */
  NV.CREATE = [
    { ic: 'ti-file-invoice', en: 'Invoice', ms: 'Invois', s: ['Sales · customer & items', 'Jualan · pelanggan & item'], ok: function () { return !!NV.findItem('sales'); }, go: function () { window.openPage('sales', { view: 'inv-form' }); } },
    { ic: 'ti-checkbox', en: 'Task', ms: 'Task', s: ['Projects · assign staff', 'Projects · tugaskan staf'], ok: function () { return !!NV.findItem('projects'); },
      go: function () { window.openPage('projects', {}); var n = 0; (function t() { var b = document.querySelector('#main .pj-add[data-add]'); if (b) return b.click(); if (++n < 30) setTimeout(t, 200); })(); } },
    { ic: 'ti-headset', en: 'Request', ms: 'Request', s: ['Service Desk · new ticket', 'Service Desk · tiket baharu'], ok: function () { return !!NV.findItem('servis_saya'); }, go: function () { window.openPage('servis_saya', { new: 1 }); } },
    { ic: 'ti-receipt', en: 'Claim', ms: 'Claim', s: ['Expense Claims · claim', 'Expense Claims · tuntutan'], ok: function () { return !!(NV.findItem('expense_claims') || NV.findItem('accounting')); }, go: function () { window.openPage('accounting', { view: 'exp-form' }); } }
  ];
  NV.sheet = function () {
    var acts = NV.CREATE.filter(function (a) { try { return a.ok(); } catch (e) { return false; } });
    if (!acts.length) { if (typeof showToast === 'function') showToast(L('Nothing to create here', 'Tiada apa untuk dibuat'), 'info'); return; }
    var old = document.querySelector('.nv-sheet-bg'); if (old) old.remove();
    var bg = document.createElement('div'); bg.className = 'nv-sheet-bg';
    bg.innerHTML = '<div class="nv-sheet" role="dialog" aria-modal="true" aria-label="' + esc(L('Create new', 'Buat baharu')) + '"><div class="nv-grab"></div>' +
      '<div class="nv-sh"><b>' + esc(L('Create new', 'Buat baharu')) + '</b><button type="button" class="nv-shx" aria-label="' + esc(L('Close', 'Tutup')) + '"><i class="ti ti-x"></i></button></div>' +
      acts.map(function (a, i) { return '<button type="button" class="nv-sr" data-i="' + i + '"><i class="ti ' + a.ic + '"></i><span><b>' + esc(L(a.en, a.ms)) + '</b><small>' + esc(L(a.s[0], a.s[1])) + '</small></span><i class="ti ti-chevron-right"></i></button>'; }).join('') + '</div>';
    var close = function () { bg.remove(); document.removeEventListener('keydown', key); };
    var key = function (e) { if (e.key === 'Escape') close(); };
    bg.onclick = function (e) {
      e.stopPropagation();
      if (e.target === bg || e.target.closest('.nv-shx')) return close();
      var b = e.target.closest('.nv-sr'); if (!b) return;
      close(); try { if (typeof _closeMobileSidebar === 'function') _closeMobileSidebar(); } catch (e2) {}
      acts[+b.dataset.i].go();
    };
    document.addEventListener('keydown', key); document.body.appendChild(bg);
    var f = bg.querySelector('.nv-sr'); if (f) f.focus();
  };
  /* "+ Baru" button in the sidebar logo row */
  NV.after = function () {
    var lg = document.querySelector('#sidebar .sidebar-logo'); if (!lg) return;
    var b = lg.querySelector('.nv-new'), fresh = !b;
    if (fresh) { b = document.createElement('button'); b.type = 'button'; b.className = 'nv-new'; }
    /* label re-resolved on every sidebar render so a language switch (or late profile language) is reflected */
    b.innerHTML = '<i class="ti ti-plus"></i><span>' + esc(L('New', 'Baru')) + '</span>'; b.setAttribute('aria-label', L('Create new', 'Buat baharu'));
    if (!fresh) return;
    b.onclick = function (e) { e.stopPropagation(); NV.sheet(); };
    lg.style.alignItems = 'center'; lg.appendChild(b);
  };
  function bar() {
    var el = document.getElementById('nv-bb'), on = !!(NV.tid() && document.querySelector('#sidebar-nav.nv-on'));
    document.body.classList.toggle('nv-bb', on && NV.mobile());
    if (!on) return;
    var bmK = (typeof APP !== 'undefined' && APP.language) + '|' + !!NV.findItem('projects');
    if (el && el.getAttribute('data-k') === bmK) return mark();
    if (!el) { el = document.createElement('nav'); el.id = 'nv-bb'; el.setAttribute('aria-label', L('Quick navigation', 'Navigasi pantas')); document.body.appendChild(el); }
    el.setAttribute('data-k', bmK);
    var btn = function (k, ic, lb, extra) { return '<button type="button" data-bb="' + k + '" aria-label="' + esc(lb) + '"><i class="ti ' + ic + '"></i>' + (extra || '') + '<span>' + esc(lb) + '</span></button>'; };
    el.innerHTML = btn('dashboard', 'ti-layout-dashboard', L('Dashboard', 'Dashboard')) +
      (NV.findItem('projects') ? btn('projects', 'ti-layout-kanban', L('Projects', 'Projects')) : '') +
      btn('bell', 'ti-bell', L('Alerts', 'Notis'), '<span class="nv-bb-b" data-nv-bb-badge="nv_notif" style="display:none"></span>') +
      btn('menu', 'ti-menu-2', L('Menu', 'Menu'));
    el.onclick = function (e) {
      var b = e.target.closest('[data-bb]'); if (!b) return; var k = b.dataset.bb;
      if (k === 'menu') { e.stopPropagation(); if (typeof toggleSidebar === 'function') toggleSidebar(); return; }
      if (k === 'bell') { e.stopPropagation(); try { if (typeof _closeMobileSidebar === 'function') _closeMobileSidebar(); } catch (e2) {} if (typeof toggleNotifMenu === 'function') toggleNotifMenu(); else NV.go('nv_notif'); return; }
      NV.go(k);
    };
    mark(); NV.badges();
  }
  function mark() {
    var el = document.getElementById('nv-bb'); if (!el) return; var cur = NV.cur || (typeof APP !== 'undefined' && APP.currentPage) || '';
    el.querySelectorAll('[data-bb]').forEach(function (b) { b.classList.toggle('on', b.dataset.bb === cur); });
  }
  NV.bar = bar;
  window.addEventListener('resize', function () { clearTimeout(NV._rz); NV._rz = setTimeout(bar, 120); });
  setInterval(bar, 1500);
  var css = document.createElement('style'); css.id = 'nv-css-m';
  css.textContent = '.nv-new{margin-left:auto;display:inline-flex;align-items:center;gap:4px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);color:#fff;border-radius:8px;padding:5px 9px;font-size:11.5px;font-weight:600;cursor:pointer;white-space:nowrap}' +
    '.nv-new:hover,.nv-new:focus-visible{border-color:var(--primary);outline:0}#sidebar.collapsed .nv-new{display:none}' +
    '.nv-sh{display:flex;align-items:center;margin:4px 2px 4px}.nv-sh b{flex:1;font-size:16px}.nv-shx{background:none;border:0;color:var(--text-2);font-size:20px;cursor:pointer;width:40px;height:40px}' +
    '.nv-sr{display:flex;gap:12px;align-items:center;width:100%;padding:12px;border:1px solid var(--border);border-radius:10px;margin-top:8px;background:var(--bg);color:var(--text);cursor:pointer;text-align:left;min-height:56px}' +
    '.nv-sr:hover,.nv-sr:focus-visible{border-color:var(--primary);outline:0}.nv-sr>i:first-child{font-size:22px;color:var(--primary)}.nv-sr>i:last-child{color:var(--text-3)}' +
    '.nv-sr span{flex:1;min-width:0}.nv-sr b{display:block;font-size:14px}.nv-sr small{display:block;font-size:12px;color:var(--text-2)}';
  document.head.appendChild(css);
})();
