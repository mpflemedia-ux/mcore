/* Show last 6 of tenant id under the header name. No layout change to other header items. */
(function () {
  if (window._tenantBadgeId) return; window._tenantBadgeId = 1;
  function css() {
    if (document.getElementById('tenant-badge-id-css')) return;
    var s = document.createElement('style'); s.id = 'tenant-badge-id-css';
    s.textContent = '.tenant-chip{align-items:center}.tenant-chip .tb-id{display:block;font-size:9px;font-weight:500;opacity:.7;line-height:1.1;letter-spacing:.02em}' +
      '@media(max-width:480px){.tenant-chip .tb-id{font-size:8px}}';
    document.head.appendChild(s);
  }
  function paint() {
    css();
    var el = document.getElementById('tenant-name-header'); if (!el) return;
    var id = (typeof APP !== 'undefined' && APP.tenant && APP.tenant.id) ? String(APP.tenant.id) : '';
    var short = id ? id.replace(/-/g, '').slice(0, 6) : '';
    var sub = el.querySelector('.tb-id');
    if (!short) { if (sub) sub.remove(); return; }
    if (!sub) { sub = document.createElement('span'); sub.className = 'tb-id'; el.appendChild(sub); }
    if (sub.textContent !== short) sub.textContent = short;
  }
  function hook() {
    var orig = window.refreshCurrentPage;
    paint();
    setInterval(paint, 1500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hook); else hook();
})();
