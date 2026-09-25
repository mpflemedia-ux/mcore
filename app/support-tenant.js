(function () {
  var KEY = 'mcore_support_session';
  function bm() { return typeof APP !== 'undefined' && APP.language === 'bm'; }
  function isPa() {
    try { return typeof isPlatformAdmin === 'function' && isPlatformAdmin(); } catch (e) { return false; }
  }
  function applyTenant(row) {
    if (!row || !row.id) return;
    APP.tenant = Object.assign({}, APP.tenant || {}, {
      id: row.id, code: row.code, name: row.name,
      plan: row.plan, plan_id: row.plan_id || APP.tenant.plan_id
    });
    try { localStorage.setItem('nexerp_pending_tenant_id', row.id); } catch (e) {}
    try { document.getElementById('tenant-name-header').textContent = row.name || '-'; } catch (e2) {}
    try { if (typeof buildSidebar === 'function') buildSidebar(); } catch (e3) {}
    try { if (typeof updateUserUI === 'function') updateUserUI(); } catch (e4) {}
  }
  function banner(on, name) {
    var el = document.getElementById('support-tenant-banner');
    if (!on) {
      if (el) el.remove();
      try { sessionStorage.removeItem(KEY); } catch (e) {}
      return;
    }
    try { sessionStorage.setItem(KEY, JSON.stringify({ name: name, at: Date.now() })); } catch (e2) {}
    if (!el) {
      el = document.createElement('div');
      el.id = 'support-tenant-banner';
      el.style.cssText = 'position:sticky;top:0;z-index:80;background:#0e7490;color:#fff;font-size:12px;padding:8px 12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap';
      var host = document.getElementById('app') || document.body;
      host.insertBefore(el, host.firstChild);
    }
    el.innerHTML = '<i class="ti ti-shield-check"></i> <strong>' +
      (bm() ? 'Mod sokongan' : 'Support mode') + '</strong> · ' +
      (name || '') +
      ' <span style="opacity:.85">' + (bm() ? '(layout platform admin)' : '(platform admin layout)') + '</span>' +
      '<button type="button" class="btn btn-sm" style="margin-left:auto;background:#fff;color:#0e7490;border:0" onclick="window._exitSupportTenant()">' +
      (bm() ? 'Keluar' : 'Exit') + '</button>';
  }
  window._enterSupportTenant = async function (tid) {
    if (!isPa() || !tid) return;
    var row = null;
    try {
      var rpc = await sb.rpc('enter_support_tenant', { p_tenant_id: tid });
      if (rpc.error) throw rpc.error;
      row = rpc.data;
    } catch (e) {
      var q = await sb.from('tenants').select('id,code,name,plan,plan_id').eq('id', tid).maybeSingle();
      row = q.data;
      if (!row) {
        showToast((e && e.message) || 'Tenant not found', 'error');
        return;
      }
      showToast(bm() ? 'Masuk workspace (jalankan SQL RPC untuk audit + RLS penuh)' : 'Entered workspace (run SQL RPC for audit + full RLS)', 'warning');
    }
    applyTenant(row);
    banner(true, row.name);
    showToast((bm() ? 'Masuk workspace: ' : 'Entered workspace: ') + (row.name || ''), 'success');
    if (typeof openPage === 'function') openPage('dashboard');
  };
  window._exitSupportTenant = async function () {
    if (!isPa()) return;
    var row = null;
    try {
      var rpc = await sb.rpc('exit_support_tenant');
      if (rpc.error) throw rpc.error;
      row = rpc.data;
    } catch (e) {
      showToast(e.message || 'exit failed', 'error');
    }
    if (row && row.id) applyTenant(row);
    banner(false);
    showToast(bm() ? 'Keluar mod sokongan' : 'Left support mode', 'success');
    if (typeof openPage === 'function') openPage('admin', { view: 'clients' });
  };
  function injectButtons() {
    if (!isPa()) return;
    document.querySelectorAll('#admin-clients-table-host tbody tr').forEach(function (tr) {
      if (tr.dataset.supportBtn) return;
      var chk = tr.querySelector('.admin-tenant-chk');
      if (!chk) return;
      var tid = chk.getAttribute('data-tenant-id');
      var td = tr.querySelector('td:last-child');
      if (!td) return;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn btn-sm btn-primary';
      b.style.marginRight = '4px';
      b.innerHTML = '<i class="ti ti-login-2"></i> ' + (bm() ? 'Masuk' : 'Enter');
      b.onclick = function (ev) { ev.stopPropagation(); window._enterSupportTenant(tid); };
      td.insertBefore(b, td.firstChild);
      tr.dataset.supportBtn = '1';
    });
    var title = document.querySelector('.page-title');
    if (title && /Admin/.test(title.textContent || '') === false) return;
  }
  function injectDetail() {
    if (!isPa()) return;
    var sub = document.querySelector('.page-header .page-title');
    if (!sub) return;
    if (document.getElementById('support-enter-detail')) return;
    var back = document.querySelector('.page-header [onclick*="clients"]');
    var hashTid = null;
    try {
      var st = window._adminClientsData || [];
      var name = (sub.textContent || '').trim();
      var hit = st.find(function (d) { return d.name === name; });
      if (hit) hashTid = hit.id;
    } catch (e) {}
    if (!hashTid) return;
    var btn = document.createElement('button');
    btn.id = 'support-enter-detail';
    btn.type = 'button';
    btn.className = 'btn btn-primary btn-sm';
    btn.style.marginTop = '8px';
    btn.innerHTML = '<i class="ti ti-login-2"></i> ' + (bm() ? 'Masuk workspace' : 'Enter workspace');
    btn.onclick = function () { window._enterSupportTenant(hashTid); };
    sub.parentNode.appendChild(btn);
  }
  function wrap() {
    var orig = window._adminClientsRenderTable;
    if (typeof orig === 'function' && !orig._support) {
      var w = function () {
        var r = orig.apply(this, arguments);
        setTimeout(injectButtons, 0);
        return r;
      };
      w._support = true;
      window._adminClientsRenderTable = w;
    }
    var det = window.renderAdminTenantDetail;
    if (typeof det === 'function' && !det._support) {
      var w2 = function () {
        var r = det.apply(this, arguments);
        if (r && r.then) r.then(function () { setTimeout(injectDetail, 80); });
        else setTimeout(injectDetail, 80);
        return r;
      };
      w2._support = true;
      window.renderAdminTenantDetail = w2;
    }
  }
  function restoreBanner() {
    if (!isPa()) return;
    try {
      var raw = sessionStorage.getItem(KEY);
      if (!raw) return;
      var s = JSON.parse(raw);
      banner(true, s.name);
    } catch (e) {}
  }
  function boot() {
    wrap();
    injectButtons();
    injectDetail();
    restoreBanner();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setTimeout(boot, 500);
  setInterval(function () { injectButtons(); injectDetail(); }, 1500);
})();
