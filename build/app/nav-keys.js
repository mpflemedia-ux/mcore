/* M-Core sidebar v2 — keyboard ('/' + G-then-key), persisted laptop compact mode, PA tenant-switch chip */
(function () {
  if (!window.NV || NV._keys) return; NV._keys = 1;
  var L = NV.L, esc = NV.esc;
  NV.GKEYS = { d: 'dashboard', s: 'sales', p: 'projects', c: 'crm', i: 'inventory', h: 'hr', a: 'accounting', r: 'reports', n: 'nv_notif', t: 'settings' };
  function typing(e) {
    var t = e.target; if (!t) return false;
    return t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || !!(t.closest && t.closest('[contenteditable="true"]'));
  }
  NV.focusSearch = function () {
    var sb2 = document.getElementById('sidebar');
    if (sb2 && sb2.classList.contains('collapsed')) { if (typeof toggleSidebar === 'function') toggleSidebar(); }
    setTimeout(function () { var i = document.querySelector('#sidebar-nav .nv-search input'); if (i) { i.focus(); i.select(); } }, 60);
  };
  var gAt = 0;
  document.addEventListener('keydown', function (e) {
    if (!NV.tid() || e.ctrlKey || e.metaKey || e.altKey || typing(e)) return;
    if (document.querySelector('.modal-overlay.active, .nv-sheet-bg, [role="dialog"][aria-modal="true"]')) return;
    var k = (e.key || '').toLowerCase();
    if (k === '/') { e.preventDefault(); NV.focusSearch(); gAt = 0; return; }
    if (k === 'g' && !e.shiftKey) { gAt = Date.now(); return; }
    if (gAt && Date.now() - gAt < 1200 && NV.GKEYS[k]) { e.preventDefault(); gAt = 0; NV.go(NV.GKEYS[k]); return; }
    gAt = 0;
  });
  /* laptop compact: persist the existing #sidebar.collapsed (60px icon mode) per user */
  var CK = function () { return 'mcore_nv_compact_' + NV.uid(); };
  function wrapToggle() {
    NV.wrapFn('toggleSidebar', 'k', function (o) {
      return function () {
        var r = o.apply(this, arguments);
        try { if (!NV.mobile() && NV.uid()) localStorage.setItem(CK(), document.getElementById('sidebar').classList.contains('collapsed') ? '1' : '0'); } catch (e) {}
        return r;
      };
    });
  }
  var applied = '';
  NV.applyCompact = function () {
    var u = NV.uid(); if (!u || NV.mobile() || applied === u) return; applied = u;
    var s = document.getElementById('sidebar'); if (!s) return;
    var v = null; try { v = localStorage.getItem(CK()); } catch (e) {}
    if (v === '1') s.classList.add('collapsed'); else if (v === '0') s.classList.remove('collapsed');
  };
  /* PA tenant chip — reuses the existing support-tenant Enter/Exit (RPC enter_support_tenant logs the switch) */
  NV.chipHtml = function () {
    if (!NV.isPA() || typeof window._enterSupportTenant !== 'function') return '';
    var on = !!document.getElementById('support-tenant-banner'), nm = (typeof APP !== 'undefined' && APP.tenant && APP.tenant.name) || '-';
    return '<div class="nv-chipw"><button type="button" class="nv-chip' + (on ? ' on' : '') + '" aria-haspopup="listbox" aria-expanded="false"><i class="ti ti-switch-horizontal"></i><span><small>' +
      esc(on ? L('Support mode', 'Mod sokongan') : L('Tenant', 'Tenant')) + '</small>' + esc(nm) + '</span><i class="ti ti-chevron-down"></i></button></div>';
  };
  var cache = null;
  NV.wireChip = function (top) {
    var b = top.querySelector('.nv-chip'); if (!b) return;
    b.onclick = function (e) {
      e.stopPropagation(); var w = b.parentNode, p = w.querySelector('.nv-pop');
      if (p) { p.remove(); b.setAttribute('aria-expanded', 'false'); return; }
      p = document.createElement('div'); p.className = 'nv-pop';
      var on = !!document.getElementById('support-tenant-banner');
      p.innerHTML = '<input type="search" placeholder="' + esc(L('Find tenant', 'Cari tenant')) + '" aria-label="' + esc(L('Find tenant', 'Cari tenant')) + '">' +
        (on ? '<button type="button" data-exit="1"><i class="ti ti-logout"></i> ' + esc(L('Exit support mode', 'Keluar mod sokongan')) + '</button>' : '') +
        '<div class="nv-tl" role="listbox"><div style="padding:10px;font-size:12px;color:var(--text-2)">' + esc(L('Loading…', 'Memuat…')) + '</div></div>';
      w.appendChild(p); b.setAttribute('aria-expanded', 'true');
      var inp = p.querySelector('input'), tl = p.querySelector('.nv-tl');
      var draw = function () {
        var q = inp.value.trim().toLowerCase(), cur = NV.tid();
        var rows = (cache || []).filter(function (t) { return !q || String(t.name || '').toLowerCase().indexOf(q) >= 0 || String(t.code || '').toLowerCase().indexOf(q) >= 0; }).slice(0, 60);
        tl.innerHTML = rows.length ? rows.map(function (t) {
          return '<button type="button" role="option" data-t="' + esc(t.id) + '"' + (NV.same(t.id, cur) ? ' aria-selected="true" style="font-weight:700"' : '') + '>' + esc(t.name || '-') + (t.code ? ' <small style="color:var(--text-3)">' + esc(t.code) + '</small>' : '') + '</button>';
        }).join('') : '<div style="padding:10px;font-size:12px;color:var(--text-2)">' + esc(L('No tenants', 'Tiada tenant')) + '</div>';
      };
      inp.oninput = draw;
      p.onclick = function (ev) {
        ev.stopPropagation();
        if (ev.target.closest('[data-exit]')) { p.remove(); return window._exitSupportTenant(); }
        var t = ev.target.closest('[data-t]'); if (!t) return;
        p.remove(); if (NV.same(t.dataset.t, NV.tid())) return;
        window._enterSupportTenant(t.dataset.t);
      };
      if (cache) draw();
      else Promise.resolve().then(function () { return sb.from('tenants').select('id,name,code').is('deleted_at', null).order('name').limit(200); })
        .then(function (r) { cache = (r && r.data) || []; draw(); }, function () { cache = []; draw(); });
      setTimeout(function () { inp.focus(); }, 30);
    };
  };
  document.addEventListener('click', function (e) { if (!e.target.closest || e.target.closest('.nv-chipw')) return; var p = document.querySelector('.nv-pop'); if (p) p.remove(); });
  function tick() { if (!NV.ready()) return; wrapToggle(); NV.applyCompact(); }
  setInterval(tick, 1000); tick();
})();
