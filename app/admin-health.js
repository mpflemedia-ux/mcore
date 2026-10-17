/* Admin health card: orphan count, status chips, run check. Platform admin only. */
(function () {
  if (window._adminHealth) return; window._adminHealth = 1;
  function L(en, bm) { return (typeof APP !== 'undefined' && APP.language === 'bm') ? bm : en; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&', '<': '<', '>': '>', '"': '"', "'": '&#39;' })[c]; }); }
  function css() {
    if (document.getElementById('admin-health-css')) return;
    var s = document.createElement('style'); s.id = 'admin-health-css';
    s.textContent = '.ah-card{border:1px solid var(--border);border-radius:var(--radius,10px);padding:12px 14px;margin:0 0 12px;background:var(--card,#1a1d24)}' +
      '.ah-alert{background:color-mix(in srgb,var(--danger) 12%,transparent);border-color:var(--danger);color:var(--danger)}' +
      '.ah-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}' +
      '.ah-chip{flex:1 1 70px;min-width:70px;text-align:center;padding:8px 4px;border:1px solid var(--border);border-radius:8px;font-size:11px;color:var(--text-2)}' +
      '.ah-chip b{display:block;margin-top:2px;font-size:13px;color:var(--text)}' +
      '.ah-chip.bad b{color:var(--danger)}' +
      '.ah-chip.ok b{color:var(--success)}' +
      '.ah-btn{margin-top:10px}' +
      '@media(max-width:480px){.ah-chip{flex:1 1 60px;font-size:10px}}';
    document.head.appendChild(s);
  }
  function card(d) {
    d = d || { orphans: 0, dupes: 0, free_bad: 0 };
    var bad = (d.orphans || 0) > 0;
    var alert = bad ? '<div class="ah-card ah-alert"><i class="ti ti-alert-triangle"></i> <b>' + L('Orphan data', 'Data yatim') + ' ' + d.orphans + '</b><div style="font-size:12px;margin-top:4px;color:var(--text)">' + L('Contracts on a deleted tenant', 'Kontrak pada tenant yang sudah dipadam') + '</div></div>' : '';
    var chip = function (label, ok, val) { return '<div class="ah-chip ' + (ok ? 'ok' : 'bad') + '">' + esc(label) + '<b>' + esc(val) + '</b></div>'; };
    return alert + '<div class="ah-card" id="admin-health-card"><div style="font-weight:700">' + L('Health check', 'Semak kesihatan') + '</div>' +
      '<div class="ah-row">' +
      chip(L('Unique names', 'Nama unik'), !d.dupes, d.dupes ? d.dupes : 'OK') +
      chip(L('Contracts', 'Kontrak'), !d.free_bad, d.free_bad ? d.free_bad : 'OK') +
      chip(L('Orphans', 'Yatim'), !d.orphans, d.orphans || 0) +
      chip(L('FREE aligned', 'FREE selaras'), !d.free_bad, d.free_bad ? d.free_bad : 'OK') +
      '</div><button type="button" class="btn btn-sm btn-primary ah-btn" id="admin-health-run"><i class="ti ti-player-play"></i> ' + L('Run check', 'Jalankan semakan') + '</button></div>';
  }
  function inject(d) {
    css();
    var host = document.getElementById('main'); if (!host) return;
    var old = document.getElementById('admin-health-wrap'); if (old) old.remove();
    var wrap = document.createElement('div'); wrap.id = 'admin-health-wrap';
    wrap.innerHTML = card(d);
    var tabs = host.querySelector('.page-header');
    if (tabs && tabs.nextSibling) host.insertBefore(wrap, tabs.nextSibling); else host.insertBefore(wrap, host.firstChild);
    var btn = document.getElementById('admin-health-run');
    if (btn) btn.onclick = function () { run(true); };
  }
  function run(toast) {
    if (typeof sb === 'undefined') return;
    sb.rpc('tenant_health_check').then(function (r) {
      if (r.error) { if (toast && typeof showToast === 'function') showToast(r.error.message || 'error', 'error'); return; }
      inject(r.data || {});
      if (toast && typeof showToast === 'function') showToast(L('Check done', 'Semakan siap'), 'success');
    }, function () {});
  }
  function wrap() {
    var orig = window.renderAdminClients;
    if (typeof orig !== 'function' || orig._health) return;
    var w = function () {
      var p = orig.apply(this, arguments);
      Promise.resolve(p).then(function () { setTimeout(function () { run(false); }, 60); });
      return p;
    };
    w._health = true; window.renderAdminClients = w;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wrap); else wrap();
  setTimeout(wrap, 800);
})();
