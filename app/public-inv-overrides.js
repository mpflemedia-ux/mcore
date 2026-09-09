/* Public invoice: redirect SPA deep-link + force scrollable light card */
(function () {
  var q = location.search;
  if (q.indexOf('public_inv=') !== -1 && !/public\.html$/i.test(location.pathname)) {
    var base = location.pathname.replace(/index\.html$/i, '').replace(/\/?$/, '/');
    location.replace(base + 'public.html' + q + location.hash);
    return;
  }
  document.documentElement.style.overflowY = 'auto';
  document.body.style.overflowY = 'auto';
  document.body.style.height = 'auto';
  document.body.style.minHeight = '100%';
  document.body.style.color = '#0f172a';
  document.body.style.background = '#F1F5F9';
  function apply() {
    var root = document.getElementById('public-inv-root') || document.getElementById('root');
    if (!root) return;
    root.style.overflow = 'visible';
    root.style.minHeight = '100%';
    root.style.paddingBottom = '64px';
    root.querySelectorAll('img[alt="Payment QR"]').forEach(function (img) {
      img.style.display = 'block';
      img.style.margin = '0 auto';
      img.style.width = 'auto';
      img.style.maxWidth = 'min(280px,100%)';
      img.style.maxHeight = '280px';
      img.style.height = 'auto';
      img.style.objectFit = 'contain';
    });
  }
  apply();
  setTimeout(apply, 200);
  setTimeout(apply, 800);
})();
