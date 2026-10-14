/* M-Core sidebar v2 — Admin › "Arrange menu": tenant admin sets section order + hides items for staff.
   Table sidebar_layouts (supabase/sidebar_01_layout.sql). Tab stays hidden until that SQL is run. */
(function () {
  if (!window.NV || NV._adm) return; NV._adm = 1;
  var L = NV.L, esc = NV.esc;
  var allowed = function () { return NV.isTA() && NV.layoutOk && !!NV.tid(); };
  function tabBtn(active) {
    return '<button class="btn btn-sm ' + (active === 'nav_layout' ? 'btn-primary' : 'btn-outline') + '" onclick="openPage(\'admin\',{view:\'nav_layout\'})"><i class="ti ti-layout-sidebar"></i> ' + esc(L('Arrange menu', 'Susun menu')) + '</button>';
  }
  function wrap() {
    if (!NV.ready()) return;
    NV.wrapFn('_adminTabs', 'a', function (t) {
      return function (active) {
        var h = t.apply(this, arguments); if (!allowed()) return h;
        var k = h.lastIndexOf('</div>'); return k >= 0 ? h.slice(0, k) + tabBtn(active) + h.slice(k) : h + tabBtn(active);
      };
    });
    NV.wrapFn('openPage', 'a', function (o) {
      return function (page, params) {
        if (page === 'admin' && params && params.view === 'nav_layout') return allowed() ? open(params) : o.call(window, 'admin', {});
        return o.apply(this, arguments);
      };
    });
  }
  var S = null;
  function model() {
    var m = {}, lay = NV.layout || {}, hide = Array.isArray(lay.hide) ? lay.hide : [];
    document.querySelectorAll('#sidebar-nav .nv-grp').forEach(function (g) {
      var sec = g.getAttribute('data-nv-grp'); if (sec === 'platform' || sec === 'lain') return;
      m[sec] = [].map.call(g.querySelectorAll('.nv-body > .nav-item'), function (el) {
        var p = NV.pageOf(el); return { id: p, label: el.dataset.label || (el.textContent || '').trim(), icon: (el.querySelector('.nav-icon') || {}).className || 'ti ti-point', hide: hide.indexOf(p) >= 0, child: el.classList.contains('nv-child') };
      });
    });
    return m;
  }
  function open(params) {
    try { _clearUiOverlays(); } catch (e) {}
    try { _closeMobileSidebar(); } catch (e) {}
    try { _lsSet('nexerp_last_page', 'admin'); _lsSet('nexerp_last_params', JSON.stringify(params || {})); } catch (e) {}
    APP.currentPage = 'admin';
    try { _navPushHistory('admin', params || {}); } catch (e) {}
    document.querySelectorAll('.nav-item').forEach(function (el) { el.classList.toggle('active', el.dataset.page === 'admin'); });
    var h = document.getElementById('header-title'); if (h) h.textContent = 'Admin';
    S = model(); draw();
  }
  function secName(id) { var s = NV.SECS.filter(function (x) { return x[0] === id; })[0]; return s ? L(s[1], s[2]) : id; }
  function draw() {
    var main = document.getElementById('main'); if (!main) return;
    var html = '<div class="page-header"><div><div class="page-title">' + esc(L('Arrange menu', 'Susun menu')) + '</div><div style="font-size:13px;color:var(--text-3);margin-top:2px">' +
      esc(L('Order applies to everyone in this company. Hidden items are hidden for staff only; admins still see everything.', 'Susunan untuk semua dalam syarikat ni. Item tersembunyi hanya untuk staf; admin masih nampak semua.')) + '</div></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn btn-sm btn-outline" data-nv-reset><i class="ti ti-restore"></i> ' + esc(L('Reset to default', 'Set semula')) + '</button>' +
      '<button type="button" class="btn btn-sm btn-primary" data-nv-save><i class="ti ti-device-floppy"></i> ' + esc(L('Save', 'Simpan')) + '</button></div></div>' +
      (typeof _adminTabs === 'function' ? _adminTabs('nav_layout') : '') + '<div class="nv-lay">';
    Object.keys(S).forEach(function (sec) {
      html += '<div class="nv-ls" data-sec="' + sec + '"><h4>' + esc(secName(sec)) + '</h4>' + S[sec].map(function (it, i) {
        var lock = it.id === 'dashboard' || it.id === 'settings';
        return '<div class="nv-lr" draggable="true" data-i="' + i + '"' + (it.child ? ' style="padding-left:32px"' : '') + '><i class="ti ti-grip-vertical" aria-hidden="true"></i><i class="' + esc(it.icon) + '" style="font-size:18px;color:var(--text-2)"></i><span>' + esc(it.label) + '</span>' +
          '<button type="button" class="nv-mv" data-mv="-1" aria-label="' + esc(L('Move up', 'Naik')) + '"><i class="ti ti-chevron-up"></i></button><button type="button" class="nv-mv" data-mv="1" aria-label="' + esc(L('Move down', 'Turun')) + '"><i class="ti ti-chevron-down"></i></button>' +
          '<label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text-2);white-space:nowrap"><input type="checkbox" data-show' + (it.hide ? '' : ' checked') + (lock ? ' disabled' : '') + '> ' + esc(L('Staff', 'Staf')) + '</label></div>';
      }).join('') + '</div>';
    });
    main.innerHTML = html + '</div>';
    wire(main);
  }
  function move(sec, i, j) { var a = S[sec]; if (j < 0 || j >= a.length) return; var x = a.splice(i, 1)[0]; a.splice(j, 0, x); draw(); }
  function wire(main) {
    var dragFrom = null;
    main.querySelectorAll('.nv-ls').forEach(function (box) {
      var sec = box.dataset.sec;
      box.querySelectorAll('.nv-lr').forEach(function (r) {
        var i = +r.dataset.i;
        r.querySelectorAll('[data-mv]').forEach(function (b) { b.onclick = function () { move(sec, i, i + (+b.dataset.mv)); }; });
        var cb = r.querySelector('[data-show]'); cb.onchange = function () { S[sec][i].hide = !cb.checked; };
        r.ondragstart = function (e) { dragFrom = { sec: sec, i: i }; r.classList.add('drag'); try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i)); } catch (e2) {} };
        r.ondragend = function () { r.classList.remove('drag'); };
        r.ondragover = function (e) { if (dragFrom && dragFrom.sec === sec) e.preventDefault(); };
        r.ondrop = function (e) { e.preventDefault(); if (dragFrom && dragFrom.sec === sec && dragFrom.i !== i) move(sec, dragFrom.i, i); dragFrom = null; };
      });
    });
    var sv = main.querySelector('[data-nv-save]'), rs = main.querySelector('[data-nv-reset]');
    sv.onclick = function () {
      var order = {}, hide = [];
      Object.keys(S).forEach(function (sec) { order[sec] = S[sec].map(function (x) { return x.id; }); S[sec].forEach(function (x) { if (x.hide) hide.push(x.id); }); });
      sv.disabled = true;
      sb.from('sidebar_layouts').upsert({ tenant_id: NV.tid(), layout: { v: 1, order: order, hide: hide }, updated_by: NV.uid() || null, updated_at: new Date().toISOString(), deleted_at: null }, { onConflict: 'tenant_id' })
        .then(function (r) {
          sv.disabled = false;
          if (r && r.error) return toast(L('Save failed: ', 'Gagal simpan: ') + r.error.message, 'error');
          toast(L('Menu saved', 'Menu disimpan'), 'success'); NV.reprobe().then(function () { NV.regroup(true); });
        }, function (e) { sv.disabled = false; toast(String(e && e.message || e), 'error'); });
    };
    rs.onclick = function () {
      if (!window.confirm(L('Reset menu to default for everyone?', 'Set semula menu ke asal untuk semua?'))) return;
      sb.from('sidebar_layouts').update({ deleted_at: new Date().toISOString(), updated_by: NV.uid() || null }).eq('tenant_id', NV.tid())
        .then(function (r) {
          if (r && r.error) return toast(r.error.message, 'error');
          toast(L('Menu reset', 'Menu diset semula'), 'success');
          NV.reprobe().then(function () { NV.regroup(true); S = model(); S && Object.keys(S).forEach(function (k) { S[k].forEach(function (x) { x.hide = false; }); }); draw(); });
        });
    };
  }
  function toast(m, t) { if (typeof showToast === 'function') showToast(m, t); }
  var wi = setInterval(function () { if (NV.ready()) { clearInterval(wi); setTimeout(wrap, 3000); } }, 500);
})();
