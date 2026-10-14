/* M-Core sidebar v2 — regroup layer. Never rewrites buildSidebar: it MOVES the original .nav-item nodes
   (their onclick, gating and active state untouched) into sections, and adds links to existing pages only. */
(function () {
  if (!window.NV || NV._render) return; NV._render = 1;
  var L = NV.L, esc = NV.esc, busy = false, sched = 0;
  function nav() { return document.getElementById('sidebar-nav'); }
  function needs(n) {
    if (!n || busy) return false;
    if (n.querySelector(':scope > .nav-section, :scope > .nav-item')) return true;
    var all = n.querySelectorAll('.nav-item[data-page]:not([data-nv])');
    for (var i = 0; i < all.length; i++) if (!all[i].hasAttribute('data-nv-sec')) return true;
    return false;
  }
  function extraEl(x) {
    var el = document.createElement('div'); el.className = 'nav-item nv-x'; el.setAttribute('data-nv', 'x'); el.setAttribute('data-nv-page', x.id);
    var lb = L(x.en, x.ms); el.dataset.label = lb;
    el.innerHTML = '<i class="ti ' + x.ic + ' nav-icon"></i><span class="nav-label">' + esc(lb) + '</span>';
    el.onclick = function () { NV.touch(x.id); x.go(); NV.markActive(x.id); };
    return el;
  }
  NV.pageOf = function (el) { return el.getAttribute('data-nv-page') || el.dataset.page; };
  NV.findItem = function (page) {
    var n = nav(); if (!n) return null;
    return n.querySelector('.nv-body .nav-item[data-page="' + page + '"]:not([data-nv])') || n.querySelector('.nv-body .nav-item[data-nv-page="' + page + '"][data-nv="x"]');
  };
  NV.go = function (page) { var el = NV.findItem(page); if (el && el.style.display !== 'none') { el.click(); return true; } return false; };
  function cloneEl(page, s) {
    var src = NV.findItem(page); if (!src) return null;
    var el = document.createElement('div'); el.className = 'nav-item nv-c'; el.setAttribute('data-nv', 'c'); el.setAttribute('data-nv-page', page);
    el.dataset.label = src.dataset.label || '';
    var ic = src.querySelector('.nav-icon'); var lb = src.dataset.label || (src.textContent || '').trim();
    el.innerHTML = (ic ? ic.outerHTML : '<i class="ti ti-point nav-icon"></i>') + '<span class="nav-label">' + esc(lb) + '</span>' +
      (s === 'pin' ? '<button type="button" class="nv-unpin" title="' + L('Unpin', 'Nyahpin') + '" aria-label="' + L('Unpin', 'Nyahpin') + '"><i class="ti ti-pin-filled"></i></button>' : '');
    el.onclick = function (e) {
      if (e.target.closest('.nv-unpin')) { e.stopPropagation(); NV.togglePin(page); return; }
      var t = NV.findItem(page); if (t) t.click();
    };
    return el;
  }
  NV.togglePin = function (page) {
    var s = NV.st(), i = s.pin.indexOf(page);
    if (i >= 0) s.pin.splice(i, 1); else if (s.pin.length < 8) s.pin.push(page);
    NV.save(s); NV.quick();
  };
  NV.markActive = function (page) {
    var n = nav(); if (!n) return;
    n.querySelectorAll('[data-nv-page]').forEach(function (el) { el.classList.toggle('active', NV.pageOf(el) === page); });
  };
  function group(id, title) {
    var g = document.createElement('div'); g.className = 'nv-grp'; g.setAttribute('data-nv-grp', id);
    g.innerHTML = '<button type="button" class="nv-h" aria-expanded="true"><span>' + esc(title) + '</span><i class="ti ti-chevron-down nv-chev"></i></button><div class="nv-body"></div>';
    g.firstChild.onclick = function () {
      var s = NV.st(); s.closed[id] = !s.closed[id]; NV.save(s); g.classList.toggle('nv-closed', !!s.closed[id]); g.firstChild.setAttribute('aria-expanded', String(!s.closed[id]));
    };
    return g;
  }
  /* pinned + recent */
  NV.quick = function () {
    var n = nav(); if (!n) return; var q = n.querySelector('.nv-quick'); if (!q) return;
    var s = NV.st(), html = document.createDocumentFragment(), seen = {};
    function add(list, kind, title) {
      var els = []; list.forEach(function (p) { if (seen[p]) return; var c = cloneEl(p, kind); if (c) { seen[p] = 1; els.push(c); } });
      if (!els.length) return;
      var h = document.createElement('div'); h.className = 'nv-qh'; h.textContent = title; html.appendChild(h);
      els.forEach(function (e) { html.appendChild(e); });
    }
    add(s.pin, 'pin', L('Pinned', 'Pin'));
    add(s.recent, 'rec', L('Recent', 'Terkini'));
    q.innerHTML = ''; q.appendChild(html);
    q.style.display = q.childNodes.length ? '' : 'none';
    NV.markActive(NV.cur || '');
    n.querySelectorAll('.nv-body .nav-item').forEach(function (el) { el.classList.toggle('nv-pinned', s.pin.indexOf(NV.pageOf(el)) >= 0); });
  };
  /* badges */
  NV.badges = function () {
    var n = nav(); if (!n) return; var c = NV.counts();
    n.querySelectorAll('[data-nv-page], .nav-item[data-page]').forEach(function (el) {
      var p = NV.pageOf(el), v = c[p] || 0, b = el.querySelector(':scope > .nv-bdg');
      if (p === 'admin') return;
      if (!v) { if (b) b.remove(); return; }
      if (!b) { b = document.createElement('span'); b.className = 'nv-bdg'; el.appendChild(b); }
      b.textContent = v > 99 ? '99+' : String(v);
    });
    var bb = document.querySelectorAll('[data-nv-bb-badge]');
    bb.forEach(function (b) { var v = c[b.getAttribute('data-nv-bb-badge')] || 0; b.textContent = v > 99 ? '99+' : String(v); b.style.display = v ? '' : 'none'; });
  };
  NV.filter = function (q) {
    var n = nav(); if (!n) return; q = String(q || '').trim().toLowerCase();
    n.classList.toggle('nv-searching', !!q); var hits = 0;
    n.querySelectorAll('.nv-grp').forEach(function (g) {
      var any = 0;
      g.querySelectorAll('.nv-body > .nav-item').forEach(function (el) {
        if (el.hasAttribute('data-nv-hide')) return;
        var ok = !q || ((el.dataset.label || el.textContent || '') + ' ' + String(NV.pageOf(el) || '').replace(/^nv_/, '').replace(/_/g, ' ')).toLowerCase().indexOf(q) >= 0;
        el.classList.toggle('nv-miss', !ok); if (ok) any++;
      });
      g.classList.toggle('nv-miss', !any); hits += any;
    });
    var e = n.querySelector('.nv-empty'); if (e) e.style.display = q && !hits ? '' : 'none';
  };
  function regroup() {
    var n = nav(); if (!n || !needs(n)) return;
    busy = true;
    try {
      var keepScroll = n.scrollTop, st = NV.st(), q = n.querySelector('.nv-search input'), qv = q ? q.value : '';
      var items = [].slice.call(n.querySelectorAll('.nav-item[data-page]:not([data-nv])'));
      var seen = {}; items = items.filter(function (el) { var p = el.dataset.page; if (seen[p]) { el.remove(); return false; } seen[p] = 1; return true; });
      items.forEach(function (el) { el.remove(); });
      n.innerHTML = '';
      var top = document.createElement('div'); top.className = 'nv-top';
      top.innerHTML = (NV.chipHtml ? NV.chipHtml() : '') +
        '<label class="nv-search"><i class="ti ti-search"></i><input type="search" autocomplete="off" placeholder="' + esc(L('Search menu', 'Cari menu')) + '" aria-label="' + esc(L('Search menu', 'Cari menu')) + '"><kbd>/</kbd></label>';
      n.appendChild(top);
      var inp = top.querySelector('input'); inp.value = qv;
      inp.oninput = function () { NV.filter(inp.value); };
      inp.onkeydown = function (e) {
        if (e.key === 'Escape') { inp.value = ''; NV.filter(''); inp.blur(); }
        if (e.key === 'Enter') { var f = n.querySelector('.nv-body > .nav-item:not(.nv-miss):not([data-nv-hide])'); if (f) { f.click(); inp.value = ''; NV.filter(''); } }
      };
      if (NV.wireChip) NV.wireChip(top);
      var quick = document.createElement('div'); quick.className = 'nv-quick'; n.appendChild(quick);
      var bySec = {};
      items.forEach(function (el) { var p = el.dataset.page; el.setAttribute('data-nv-sec', NV.secOf(p)); (bySec[NV.secOf(p)] = bySec[NV.secOf(p)] || []).push(el); });
      var has = {}; items.forEach(function (el) { has[el.dataset.page] = 1; });
      NV.EXTRA.forEach(function (x) { var ok = false; try { ok = x.ok(has); } catch (e) {} if (ok) { var el = extraEl(x); (bySec[NV.secOf(x.id)] = bySec[NV.secOf(x.id)] || []).push(el); } });
      NV.SECS.forEach(function (s) {
        var list = bySec[s[0]]; if (!list || !list.length) return;
        var g = group(s[0], L(s[1], s[2])), body = g.lastChild, map = {};
        list.forEach(function (el) { map[NV.pageOf(el)] = el; });
        NV.rank(s[0], Object.keys(map)).forEach(function (p) {
          var el = map[p]; var par = NV.CHILD[p];
          if (par && map[par]) { el.classList.add('nv-child'); } else el.classList.remove('nv-child');
          if (NV.hidden(p)) { el.setAttribute('data-nv-hide', '1'); el.style.display = 'none'; } else if (el.hasAttribute('data-nv-hide')) { el.removeAttribute('data-nv-hide'); el.style.display = ''; }
          body.appendChild(el);
        });
        /* children right after their parent */
        Object.keys(NV.CHILD).forEach(function (c) { var ce = map[c], pe = map[NV.CHILD[c]]; if (ce && pe) pe.after(ce); });
        if (st.closed[s[0]]) { g.classList.add('nv-closed'); g.firstChild.setAttribute('aria-expanded', 'false'); }
        n.appendChild(g);
      });
      var emp = document.createElement('div'); emp.className = 'nv-empty'; emp.style.display = 'none'; emp.textContent = L('No menu matches', 'Tiada menu sepadan'); n.appendChild(emp);
      var stl = document.createElement('div'); stl.className = 'nv-status'; n.appendChild(stl);
      NV.quick(); NV.badges(); NV.status(); if (qv) NV.filter(qv);
      var act = document.querySelector('.nav-item.active[data-page]'); NV.markActive(NV.cur || (act && act.dataset.page) || (typeof APP !== 'undefined' && APP.currentPage) || '');
      n.scrollTop = keepScroll;
      n.classList.add('nv-on'); document.body.classList.add('nv-ready');
    } catch (e) { try { console.warn('nav regroup', e); } catch (e2) {} }
    busy = false;
    if (NV.after) try { NV.after(); } catch (e) {}
  }
  NV.regroup = function (force) {
    if (force) { var n = nav(); if (n) n.querySelectorAll('[data-nv-sec]').forEach(function (el) { el.removeAttribute('data-nv-sec'); }); }
    regroup();
  };
  NV.status = function () {
    var el = document.querySelector('#sidebar-nav .nv-status'); if (!el) return;
    var on = navigator.onLine !== false, d = new Date(document.lastModified), t = new Date(NV.syncAt || Date.now());
    var p = function (x) { return (x < 10 ? '0' : '') + x; };
    var ver = isNaN(d) ? '' : d.getFullYear() + '.' + p(d.getMonth() + 1) + '.' + p(d.getDate());
    el.innerHTML = '<span class="nv-dot' + (on ? '' : ' off') + '"></span><span>' + esc(on ? L('Online', 'Dalam talian') : L('Offline', 'Luar talian')) +
      ' · ' + esc(L('Sync ', 'Sync ')) + p(t.getHours()) + ':' + p(t.getMinutes()) + '</span>' + (ver ? '<span class="nv-ver">v' + ver + '</span>' : '');
  };
  function schedule() { if (sched) return; sched = setTimeout(function () { sched = 0; regroup(); }, 0); }
  function observe() {
    var n = nav(); if (!n || n._nvObs) return; n._nvObs = 1;
    new MutationObserver(function () { if (!busy && needs(n)) { regroup(); schedule(); } }).observe(n, { childList: true, subtree: true });
    if (n.children.length) regroup();
  }
  /* wrap openPage: recent + clone active state (original behaviour untouched) */
  function wrapOpen() {
    NV.wrapFn('openPage', 'r', function (o) {
      return function (page) {
        var r = o.apply(this, arguments);
        try { NV.cur = page; NV.syncAt = Date.now(); if (NV.findItem(page)) NV.touch(page); NV.quick(); NV.badges(); NV.status(); } catch (e) {}
        return r;
      };
    });
  }
  function boot() {
    observe();
    if (!nav() || !NV.ready()) return setTimeout(boot, 400);
    setTimeout(wrapOpen, 3000);
    if (NV.tid() && NV.probe) NV.probe().then(function () { NV.regroup(true); });
  }
  window.addEventListener('online', function () { NV.status(); }); window.addEventListener('offline', function () { NV.status(); });
  setInterval(function () { try { NV.badges(); var t = NV.tid(); if (t && t !== NV._lastT) { NV._lastT = t; NV.reprobe().then(function () { NV.regroup(true); }); } } catch (e) {} }, 4000);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
