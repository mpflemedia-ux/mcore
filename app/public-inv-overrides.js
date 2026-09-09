/* Public invoice only — never touch authenticated app pages */
(function () {
  var isPublicPage = /public\.html$/i.test(location.pathname);
  var hasToken = location.search.indexOf('public_inv=') !== -1;
  if (!isPublicPage && !hasToken) return;
  if (hasToken && !isPublicPage) {
    var base = location.pathname.replace(/index\.html$/i, '').replace(/\/?$/, '/');
    location.replace(base + 'public.html' + location.search + location.hash);
    return;
  }
  document.documentElement.style.overflowY = 'auto';
  document.body.style.overflowY = 'auto';
  document.body.style.height = 'auto';
  document.body.style.minHeight = '100%';
  document.body.style.color = '#0f172a';
  document.body.style.background = '#F1F5F9';
})();
