/* M-Core Learning Center v2: small "?" button in each page header that opens the matching lesson (or chapter).
   Only appears when a lesson/chapter for that page exists and is visible to the role, so it stays hidden until lc_02 SQL is run. */
(function () {
  var LC = window.LC; if (!LC || LC._help) return; LC._help = 1;
  var L = LC.L, cur = null, tries = 0, tm = null;
  var ADMIN = { sd_desk: 1, sd_contracts: 1 };
  LC.helpFor = function (c, page, params) {
    if (!c || c.error || page === 'learning') return null;
    if (page === 'admin' && !(params && ADMIN[params.view])) return null;
    var vis = new Set(c.ls.map(function (l) { return String(l.id); }));
    var st = c.st.find(function (s) { return s.try_it_page === page && vis.has(String(s.lesson_id)); });
    if (page === 'admin' && params) { var a = c.ls.find(function (l) { return /desk|contract/i.test(l.title_en || '') && String(l.title_en).toLowerCase().indexOf(params.view === 'sd_desk' ? 'desk' : 'contract') >= 0; }); if (a) return { view: 'lesson', id: a.id }; }
    if (st) return { view: 'lesson', id: st.lesson_id };
    var ch = c.ch.find(function (x) { return LC.PAGES[x.module_key] === page && x.module_key !== 'core_nav' && x.module_key !== 'register'; });
    return ch ? { view: 'chapter', id: ch.id } : null;
  };
  function inject() {
    clearTimeout(tm); if (!cur) return;
    var h = document.querySelector('#main .page-header'), m = document.getElementById('main');
    if (!m) return;
    if (!h) { if (++tries < 8) { tm = setTimeout(inject, 400); return; } if (m.querySelector('.lc-help')) return; h = null; }
    else if (h.querySelector('.lc-help')) return;
    var me = cur;
    LC.load().then(function (c) {
      if (me !== cur || m.querySelector('.lc-help') || (h && !document.body.contains(h))) return;
      var t = LC.helpFor(c, me.page, me.params); if (!t) return;
      var b = document.createElement('button'); b.type = 'button'; b.className = 'lc-help'; b.textContent = '?';
      b.title = L('How to use this page', 'Cara guna halaman ini'); b.setAttribute('aria-label', b.title);
      b.onclick = function () { openPage('learning', t); };
      if (!h) { var row = document.createElement('div'); row.className = 'lc-help-row'; row.style.cssText = 'display:flex;justify-content:flex-end;margin:0 0 6px'; row.appendChild(b); m.insertBefore(row, m.firstChild); return; }
      var tt = h.querySelector('.page-title');
      if (tt) { tt.style.display = 'flex'; tt.style.alignItems = 'center'; tt.appendChild(b); } else h.appendChild(b);
    }).catch(function () {});
  }
  function onOpen(page, params) { cur = { page: page, params: params || {} }; tries = 0; clearTimeout(tm); tm = setTimeout(inject, 350); }
  var make = function (o) { return function (page, params) { var r = o.apply(this, arguments); try { onOpen(page, params); } catch (e) {} return r; }; };
  if (window.NV && NV.wrapFn) NV.wrapFn('openPage', 'lc', make);
  else if (typeof window.openPage === 'function' && !window.openPage._lcW) { var o = window.openPage, w = make(o); Object.keys(o).forEach(function (k) { w[k] = o[k]; }); w._lcW = 1; window.openPage = w; }
  /* re-renders inside the same page (tabs) wipe the header: re-inject on #main changes */
  var mo = new MutationObserver(function () { if (cur && !document.querySelector('#main .lc-help')) { tries = 0; clearTimeout(tm); tm = setTimeout(inject, 300); } });
  var start = function () { var m = document.getElementById('main'); if (m) mo.observe(m, { childList: true }); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
