(function () {
  var old = document.getElementById('settings-form-fit-css');
  if (old) old.remove();
  var s = document.createElement('style');
  s.id = 'settings-form-fit-css';
  s.textContent =
    '@media screen{' +
    '#main .card .form-label{white-space:nowrap!important;}' +
    '#main .card .form-input,#main .card .form-select{' +
      'min-width:240px!important;width:100%!important;box-sizing:border-box;' +
    '}' +
    '#stg-company,#stg-default-accounts,#main .card{' +
      'overflow-x:auto!important;-webkit-overflow-scrolling:touch;' +
    '}' +
    '}';
  document.head.appendChild(s);

  function fitGrids() {
    var nodes = document.querySelectorAll(
      '#stg-company, #stg-default-accounts, #main .card, #main div[style*="grid-template-columns"]'
    );
    nodes.forEach(function (el) {
      var style = el.getAttribute('style') || '';
      if (style.indexOf('grid-template-columns') >= 0) {
        var n = (style.match(/1fr/g) || []).length || 2;
        el.style.display = 'grid';
        el.style.gridTemplateColumns = 'repeat(' + n + ', minmax(260px, 1fr))';
        el.style.overflowX = 'auto';
        el.style.webkitOverflowScrolling = 'touch';
        el.style.maxWidth = '100%';
      } else if (el.classList.contains('card') || el.id === 'stg-company' || el.id === 'stg-default-accounts') {
        el.style.overflowX = 'auto';
        el.style.webkitOverflowScrolling = 'touch';
      }
    });
    var main = document.getElementById('main');
    if (main) {
      main.style.overflowX = 'auto';
      main.style.webkitOverflowScrolling = 'touch';
    }
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
  setTimeout(fitGrids, 500);
})();
