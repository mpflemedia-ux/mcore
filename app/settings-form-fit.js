(function () {
  var old = document.getElementById('settings-form-fit-css');
  if (old) old.remove();
  var s = document.createElement('style');
  s.id = 'settings-form-fit-css';
  s.textContent =
    '@media screen{' +
    '#stg-company .form-label,#main .card .form-label{white-space:nowrap!important;}' +
    '#stg-company .form-input,#stg-company .form-select,' +
    '#main .card .form-input,#main .card .form-select{' +
      'min-width:200px!important;width:100%!important;box-sizing:border-box;' +
    '}' +
    '}';
  document.head.appendChild(s);

  function fitGrids() {
    var root = document.getElementById('stg-company') || document.getElementById('main');
    if (!root) return;
    root.querySelectorAll('div[style*="grid-template-columns"]').forEach(function (grid) {
      var cols = (grid.getAttribute('style') || '').match(/grid-template-columns:\s*([^;]+)/);
      var spec = cols ? cols[1] : '';
      var n = (spec.match(/1fr/g) || []).length;
      if (n < 2) return;
      grid.style.overflowX = 'auto';
      grid.style.webkitOverflowScrolling = 'touch';
      grid.style.gridTemplateColumns = 'repeat(' + n + ', minmax(220px, 1fr))';
      grid.style.minWidth = '0';
    });
  }

  function hook() {
    var orig = window.renderSettings;
    if (typeof orig !== 'function' || orig._stgFit) return;
    window.renderSettings = function () {
      var r = orig.apply(this, arguments);
      var go = function () { setTimeout(fitGrids, 40); setTimeout(fitGrids, 300); };
      if (r && typeof r.then === 'function') r.then(go);
      else go();
      return r;
    };
    window.renderSettings._stgFit = true;
  }
  hook();
  setTimeout(hook, 400);
  setTimeout(fitGrids, 600);
})();
