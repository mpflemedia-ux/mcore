/* M-Core PA Enter: platform admin direct Enter (no popup/consent), orange PA-only banner, view-only, switch tenant, 60-min idle exit. */
(function () {
  if (window._paCore) return; window._paCore = 1;
  var KEY = 'mcore_support_session', LA = 'mcore_pa_last_active', REC = 'mcore_pa_recent', VO = 'mcore_pa_view_only';
  var IDLE = 60 * 60 * 1000, WARN = 2 * 60 * 1000, uid = null, warned = false, tenants = null, busy = false;
  function bm() { return typeof APP !== 'undefined' && APP.language === 'bm'; }
  function L(en, ms) { return bm() ? ms : en; }
  function isPa() { try { return typeof isPlatformAdmin === 'function' && isPlatformAdmin(); } catch (e) { return false; } }
  function sess() { try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
  function inS() { return isPa() && !!sess(); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function toast(m, k) { try { showToast(m, k || 'success'); } catch (e) {} }
  async function me() { if (uid) return uid; try { var r = await sb.auth.getUser(); uid = r.data.user.id; } catch (e) {} return uid; }
  async function audit(action, tid, name) {
    try { var u = await me(); var em = (APP.user && APP.user.email) || null;
      await sb.from('platform_admin_audit').insert({ actor_user_id: u, actor_email: em, action: action, target_tenant_id: tid || null, target_tenant_name: name || null }); } catch (e) {}
  }
  async function closeWin(reason) {
    try { var u = await me(); await sb.from('platform_support_sessions').update({ ended_at: new Date().toISOString(), end_reason: reason || 'exit' }).eq('actor_id', u).is('ended_at', null); } catch (e) {}
  }
  async function openWin(tid) {
    try { var u = await me(); await sb.from('platform_support_sessions').insert({ actor_id: u, tenant_id: tid, view_only: false }); } catch (e) {}
  }
  function css() {
    if (document.getElementById('pa-core-css')) return;
    var s = document.createElement('style'); s.id = 'pa-core-css';
    s.textContent = ':root{--pa-banner-bg:#c2410c;--pa-banner-fg:#ffffff;--pa-banner-btn-bg:#ffffff;--pa-banner-btn-fg:#9a3412}' +
      '[data-theme="dark"]{--pa-banner-bg:#fb923c;--pa-banner-fg:#1c1917;--pa-banner-btn-bg:#1c1917;--pa-banner-btn-fg:#fed7aa}' +
      'body.pa-in #support-tenant-banner{display:none!important}' +
      '#pa-banner{position:fixed;top:0;left:0;right:0;z-index:85;background:var(--pa-banner-bg);color:var(--pa-banner-fg);font-size:12px;padding:6px 10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;line-height:1.3}' +
      '#pa-banner .pa-n{font-weight:700;max-width:46vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '#pa-banner label{display:inline-flex;gap:4px;align-items:center;cursor:pointer;font-weight:600}' +
      '#pa-banner select{max-width:150px;font-size:12px;padding:3px 4px;border-radius:6px;border:0;background:var(--pa-banner-btn-bg);color:var(--pa-banner-btn-fg)}' +
      '#pa-banner .pa-t{font-variant-numeric:tabular-nums;font-weight:600}#pa-banner .pa-t.warn{text-decoration:underline;font-weight:800}' +
      '#pa-banner .pa-x{margin-left:auto;background:var(--pa-banner-btn-bg);color:var(--pa-banner-btn-fg);border:0;border-radius:6px;padding:4px 10px;font-weight:700;font-size:12px;cursor:pointer;min-height:28px}' +
      '#pa-banner .pa-reset{margin-left:auto;background:var(--pa-banner-btn-bg);color:var(--pa-banner-btn-fg);border:1px solid var(--pa-banner-btn-fg);border-radius:6px;padding:4px 10px;font-weight:700;font-size:12px;cursor:pointer;min-height:28px;display:flex;align-items:center;gap:4px}' +
      '#pa-banner .pa-x{margin-left:8px}' +
      '#pa-banner .pa-vo{padding:1px 6px;border-radius:4px;background:var(--pa-banner-btn-bg);color:var(--pa-banner-btn-fg);font-weight:700}' +
      '@media(max-width:480px){#pa-banner .pa-n{max-width:60vw}#pa-banner select{max-width:120px}}' +
      '@media print{#pa-banner,#support-tenant-banner{display:none!important}}';
    document.head.appendChild(s);
  }
  function fmt(ms) { ms = Math.max(0, ms); var m = Math.floor(ms / 60000), s = Math.floor(ms % 60000 / 1000); return m + ':' + (s < 10 ? '0' : '') + s; }
  function measureBannerHeight() {
    var el = document.getElementById('pa-banner');
    if (el) document.documentElement.style.setProperty('--pa-banner-h', el.offsetHeight + 'px');
    else document.documentElement.style.removeProperty('--pa-banner-h');
  }
  function lastA() { var v = +localStorage.getItem(LA); return v || Date.now(); }
  function touch() { if (inS()) try { localStorage.setItem(LA, String(Date.now())); warned = false; } catch (e) {} }
  async function loadTenants() {
    if (tenants) return tenants;
    try { var q = await sb.from('tenants').select('id,name').is('deleted_at', null).order('name'); tenants = q.data || []; } catch (e) { tenants = []; }
    return tenants;
  }
  function draw() {
    var s = sess(), el = document.getElementById('pa-banner'), lg = document.getElementById('support-tenant-banner');
    if (lg) lg.remove();
    if (!inS()) { if (el) el.remove(); document.body.classList.remove('pa-in'); document.documentElement.style.removeProperty('--pa-banner-h'); return; }
    css(); document.body.classList.add('pa-in');
    if (!el) { el = document.createElement('div'); el.id = 'pa-banner'; el.setAttribute('role', 'status');
      var host = document.getElementById('app') || document.body; host.insertBefore(el, host.firstChild); }
    var vo = localStorage.getItem(VO) === '1';
    var isDemo = !!(APP.tenant && String(APP.tenant.code) === 'DEMO');
    el.innerHTML = '<i class="ti ti-shield-lock" aria-hidden="true"></i><span>' + L('Support', 'Sokongan') + ':</span><span class="pa-n" title="' + esc(s.name) + '">' + esc(s.name) + '</span>' +
      (vo ? '<span class="pa-vo">' + L('VIEW ONLY', 'LIHAT SAHAJA') + '</span>' : '') +
      '<label><input type="checkbox" id="pa-vo-t"' + (vo ? ' checked' : '') + '> ' + L('View only', 'Lihat sahaja') + '</label>' +
      '<select id="pa-sw" aria-label="' + L('Switch tenant', 'Tukar tenant') + '"><option value="">' + L('Switch tenant…', 'Tukar tenant…') + '</option></select>' +
      '<span title="' + L('Auto exit when idle', 'Keluar auto bila tiada aktiviti') + '"><i class="ti ti-clock" aria-hidden="true"></i> <span class="pa-t" id="pa-t">' + fmt(IDLE - (Date.now() - lastA())) + '</span></span>' +
      (isDemo ? '<button type="button" class="pa-reset" id="pa-reset"><i class="ti ti-refresh-dot" aria-hidden="true"></i>' + L('Reset Demo', 'Reset Demo') + '</button>' : '') +
      '<button type="button" class="pa-x" id="pa-x">' + L('Exit', 'Keluar') + '</button>';
    el.querySelector('#pa-x').onclick = function () { window._exitSupportTenant(); };
    el.querySelector('#pa-vo-t').onchange = function () { setVO(this.checked); };
    var rb = el.querySelector('#pa-reset');
    if (rb) rb.onclick = resetDemo;
    var sel = el.querySelector('#pa-sw');
    loadTenants().then(function (ts) { ts.forEach(function (t) { if (String(t.id) === String(s.tid)) return; var o = document.createElement('option'); o.value = t.id; o.textContent = t.name; sel.appendChild(o); }); });
    sel.onchange = function () { if (this.value) sw(this.value); };
    measureBannerHeight();
  }
  async function resetDemo() {
    if (!inS() || busy) return;
    if (!(APP.tenant && String(APP.tenant.code) === 'DEMO')) return;
    if (!window.confirm(L(
      'Reset ALL demo tenant data to a fresh demo? This permanently deletes every customer, invoice, product, notification, payment claim, WhatsApp/share history, and public link for the DEMO tenant, then repopulates original sample data with today\'s date. This cannot be undone.',
      'Reset SEMUA data demo tenant ke demo baharu? Ni akan padam kekal semua customer, invois, produk, notifikasi, tuntutan bayaran, sejarah WhatsApp/kongsi dan pautan awam untuk tenant DEMO, lepas tu isi semula data sample asal ikut tarikh hari ini. Tindakan ni tak boleh undo.'
    ))) return;
    busy = true;
    toast(L('Resetting and repopulating demo data…', 'Sedang reset dan isi semula data demo…'), 'warning');
    try {
      var rpc = await sb.rpc('reset_demo_tenant');
      if (rpc.error) { toast(rpc.error.message || L('Reset failed', 'Reset gagal'), 'error'); return; }
      toast(L(
        'Demo reset complete — fresh sample data loaded. Notifications, payment claims, WhatsApp/share history, and public links cleared.',
        'Reset demo selesai — data sample baharu dimuat. Notifikasi, tuntutan bayaran, sejarah WhatsApp/kongsi dan pautan awam dikosongkan.'
      ), 'success');
      if (typeof openPage === 'function') openPage('dashboard');
    } catch (e) {
      toast((e && e.message) || L('Reset failed', 'Reset gagal'), 'error');
    } finally { busy = false; }
  }
  async function setVO(on) {
    try { localStorage.setItem(VO, on ? '1' : '0'); } catch (e) {}
    var s = sess() || {};
    try { var u = await me(); await sb.from('platform_support_sessions').update({ view_only: !!on }).eq('actor_id', u).is('ended_at', null); } catch (e) {}
    audit(on ? 'support_view_only_on' : 'support_view_only_off', s.tid, s.name);
    toast(on ? L('View only ON', 'Lihat sahaja AKTIF') : L('View only OFF', 'Lihat sahaja DIMATIKAN'));
    draw();
  }
  function recent(row) {
    try { var a = JSON.parse(localStorage.getItem(REC) || '[]').filter(function (x) { return String(x.id) !== String(row.id); });
      a.unshift({ id: row.id, name: row.name, at: Date.now() }); localStorage.setItem(REC, JSON.stringify(a.slice(0, 6))); } catch (e) {}
  }
  function apply(row) {
    APP.tenant = Object.assign({}, APP.tenant || {}, { id: row.id, code: row.code, name: row.name, plan: row.plan, plan_id: row.plan_id || (APP.tenant && APP.tenant.plan_id) });
    try { localStorage.setItem('nexerp_pending_tenant_id', row.id); } catch (e) {}
    try { document.getElementById('tenant-name-header').textContent = row.name || '-'; } catch (e) {}
    try { if (typeof buildSidebar === 'function') buildSidebar(); } catch (e) {}
    try { if (typeof updateUserUI === 'function') updateUserUI(); } catch (e) {}
  }
  function cur() { var q = {}; try { q = JSON.parse(localStorage.getItem('nexerp_last_params') || '{}') || {}; } catch (e) {} if (q.id) q = {};
    return { p: APP.currentPage || 'dashboard', q: q, od: !!document.getElementById('wad-od'), op: !!document.getElementById('bo-opl') }; }
  function back(k) { openPage(k.p, k.q); setTimeout(function () { try { if (k.od && WAD.openOverdue) WAD.openOverdue(); if (k.op && BO.openedList) BO.openedList(); } catch (e) {} }, 900); }
  async function enter(tid, quiet, keep) {
    if (!isPa() || !tid || busy) return; busy = true;
    try {
      var rpc = await sb.rpc('enter_support_tenant', { p_tenant_id: tid });
      if (rpc.error || !rpc.data) { toast((rpc.error && rpc.error.message) || L('Could not enter', 'Gagal masuk'), 'error'); return; }
      var row = rpc.data;
      try { sessionStorage.removeItem('mcore_sd_support'); localStorage.setItem(VO, '0'); localStorage.setItem(LA, String(Date.now()));
        sessionStorage.setItem(KEY, JSON.stringify({ name: row.name, at: Date.now(), tid: row.id })); } catch (e) {}
      await closeWin('switch'); await openWin(row.id);
      recent(row); apply(row); draw();
      if (!quiet) toast(L('Entered: ', 'Masuk: ') + (row.name || ''));
      if (typeof openPage === 'function') { if (keep && keep.p && keep.p !== 'admin') back(keep); else openPage('dashboard'); }
    } finally { busy = false; }
  }
  async function exit(reason, stay) {
    if (!isPa()) return;
    var s = sess() || {};
    await closeWin(reason || 'exit');
    var row = null;
    try { var rpc = await sb.rpc('exit_support_tenant'); if (rpc.error) throw rpc.error; row = rpc.data; } catch (e) { toast((e && e.message) || 'exit failed', 'error'); }
    if (reason === 'idle') audit('support_idle_exit', s.tid, s.name);
    try { sessionStorage.removeItem(KEY); sessionStorage.removeItem('mcore_sd_support'); localStorage.setItem(VO, '0'); } catch (e) {}
    var b = document.getElementById('support-tenant-banner'); if (b) b.remove();
    draw();
    if (row && row.id) apply(row); else try { if (typeof buildSidebar === 'function') buildSidebar(); } catch (e) {}
    toast(reason === 'idle' ? L('Support session ended (60 min idle)', 'Sesi sokongan tamat (60 min tiada aktiviti)') : L('Left support mode', 'Keluar mod sokongan'));
    if (typeof openPage === 'function' && !stay) openPage('admin', { view: 'clients' });
  }
  async function sw(tid) {
    var s = sess() || {};
    audit('support_switch_tenant', tid, null);
    var k = cur(); await exit('switch', 1); await enter(tid, false, k);
  }
  var en = function (tid) { return enter(tid, false, inS() ? cur() : null); }; en._sd = 1; en._pa = 1;
  var ex = function () { return exit('exit'); }; ex._sd = 1; ex._pa = 1;
  function install() { if (!window._enterSupportTenant || !window._enterSupportTenant._pa) window._enterSupportTenant = en;
    if (!window._exitSupportTenant || !window._exitSupportTenant._pa) window._exitSupportTenant = ex; }
  window.PAE = { inSupport: inS, sess: sess, enter: enter, exit: exit, viewOnly: function () { return inS() && localStorage.getItem(VO) === '1'; }, audit: audit, L: L, esc: esc, recentKey: REC };
  function tick() {
    install();
    if (!inS()) { if (document.getElementById('pa-banner')) draw(); return; }
    if (!document.getElementById('pa-banner')) draw();
    var left = IDLE - (Date.now() - lastA()), t = document.getElementById('pa-t');
    if (t) { t.textContent = fmt(left); t.classList.toggle('warn', left <= WARN); }
    if (left <= WARN && !warned) { warned = true; toast(L('Support session ends in 2 min unless you continue', 'Sesi sokongan tamat dalam 2 min jika tiada aktiviti'), 'warning'); }
    if (left <= 0) exit('idle');
    measureBannerHeight();
  }
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(function (e) { document.addEventListener(e, touch, { passive: true, capture: true }); });
  try { window.addEventListener('resize', measureBannerHeight, { passive: true }); } catch (e) {}
  install();
  setInterval(tick, 1000);
  setTimeout(function () { if (inS() && Date.now() - lastA() > IDLE) exit('idle'); else tick(); }, 800);
})();
