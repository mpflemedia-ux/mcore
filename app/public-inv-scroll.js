/* Public invoice overlay: force scroll + contrast + full QR. No-op on app pages. */
(function () {
  if (location.search.indexOf('public_inv=') === -1) return;
  var css = document.createElement('style');
  css.id = 'mcore-pubinv-scroll';
  css.textContent = [
    'html,body{overflow-y:auto!important;height:auto!important;max-height:none!important;position:static!important;background:#F1F5F9!important;color-scheme:light!important}',
    '#shell,#auth-page{display:none!important}',
    '#public-inv-root{position:fixed!important;inset:0!important;overflow-y:auto!important;-webkit-overflow-scrolling:touch!important;z-index:2147483646!important;background:#F1F5F9!important;padding:12px 12px 64px!important}',
    '#public-inv-root [style*="color:#94a3b8"],#public-inv-root [style*="color:#64748b"]{color:#334155!important}',
    '#public-inv-root img[alt="Payment QR"]{width:200px!important;max-width:72vw!important;height:auto!important;display:block!important;margin:0 auto!important}'
  ].join('\n');
  document.documentElement.appendChild(css);
  document.documentElement.setAttribute('style', 'overflow-y:auto;height:auto;color-scheme:light');
})();
