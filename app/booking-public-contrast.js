/* Force readable dark text on public booking page */
(function () {
  function apply() {
    if (!/\bbook=/.test(location.search)) return;
    var root = document.getElementById('public-book-root');
    if (!root) return;
    var shell = document.getElementById('shell');
    if (shell) shell.style.display = 'none';
    var auth = document.getElementById('auth-page');
    if (auth) auth.style.display = 'none';
    document.body.style.background = '#F1F5F9';
    root.style.cssText = 'min-height:100vh;background:#F1F5F9;padding:24px 16px;font-family:Inter,system-ui,sans-serif;color:#0F172A';
    root.querySelectorAll('*').forEach(function (el) {
      var tag = el.tagName;
      if (tag === 'BUTTON') {
        el.style.color = '#0F172A';
        el.style.background = '#fff';
        el.style.border = '1px solid #CBD5E1';
        return;
      }
      if (tag === 'INPUT' || tag === 'SELECT') {
        el.style.color = '#0F172A';
        el.style.background = '#fff';
        el.style.border = '1px solid #94A3B8';
        return;
      }
      if (tag === 'A') { el.style.color = '#0E7490'; return; }
      if (tag === 'H1' || tag === 'H2' || tag === 'H3') {
        el.style.color = '#0F172A';
        return;
      }
      if (!el.style.color || el.style.color.indexOf('var(') >= 0) {
        el.style.color = '#334155';
      }
    });
    var h = root.querySelector('h1');
    if (h) { h.style.color = '#0F172A'; h.style.fontWeight = '700'; }
    root.querySelectorAll('div').forEach(function (d) {
      if ((d.style.fontWeight === '700' || d.style.fontWeight === 'bold') && !d.querySelector('button')) {
        d.style.color = '#0F172A';
      }
    });
  }
  function boot() {
    apply();
    setTimeout(apply, 200);
    setTimeout(apply, 800);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
