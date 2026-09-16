/* Force light readable colors on printed-doc preview (dark theme leak) */
(function () {
  var css = [
    '.pdoc,.pdoc table,.pdoc td,.pdoc th{background:#fff!important;color:#0F172A!important;}',
    '.pdoc td:first-child{color:#64748B!important;background:#fff!important;vertical-align:top!important;}',
    '.pdoc .pdoc-table td:last-child{white-space:pre-wrap!important;word-break:break-word!important;color:#0F172A!important;background:#fff!important;}',
    '.pdoc .pdoc-title-bar{color:#fff!important;}',
    '.pdoc .pdoc-net-bar,.pdoc .pdoc-net-bar *{color:#fff!important;}'
  ].join('');
  function inject() {
    if (document.getElementById('pdoc-preview-light')) return;
    var s = document.createElement('style');
    s.id = 'pdoc-preview-light';
    s.textContent = css;
    document.head.appendChild(s);
  }
  function paint() {
    inject();
    document.querySelectorAll('.pdoc td, .pdoc th').forEach(function (el) {
      var bg = window.getComputedStyle(el).backgroundColor;
      if (bg && bg !== 'rgba(0, 0, 0, 0)') {
        var m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (m && (Number(m[1])+Number(m[2])+Number(m[3])) < 180) {
          el.style.background = '#fff';
          el.style.color = el.cellIndex === 0 ? '#64748B' : '#0F172A';
        }
      }
    });
  }
  function boot() { paint(); setTimeout(paint, 300); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setInterval(paint, 1000);
})();
