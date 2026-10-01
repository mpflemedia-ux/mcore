/* settings-form-fit v3 — Settings cards ONLY (do not touch Sales/Invoice/Quo/PO) */
(function () {
  var old = document.getElementById('settings-form-fit-css');
  if (old) old.remove();
  var s = document.createElement('style');
  s.id = 'settings-form-fit-css';
  s.textContent =
    '@media screen{' +
    '[id^="stg-"] .form-label{white-space:nowrap!important;}' +
    '[id^="stg-"] .form-input,[id^="stg-"] .form-select{' +
      'min-width:240px!important;width:100%!important;max-width:100%!important;box-sizing:border-box;' +
    '}' +
    '[id^="stg-"]{' +
      'overflow-x:auto!important;-webkit-overflow-scrolling:touch;' +
    '}' +
    /* Sales form grids: contain tracks so labels/inputs never overlay */ +
    '#main .card:has(#inv-form-err) .form-group,' +
    '#main .card:has(#quo-form-err) .form-group,' +
    '#main .card:has(#po-form-err) .form-group{' +
      'min-width:0!important;max-width:100%!important;' +
    '}' +
    '#main .card:has(#inv-form-err) .form-input,' +
    '#main .card:has(#inv-form-err) .form-select,' +
    '#main .card:has(#quo-form-err) .form-input,' +
    '#main .card:has(#quo-form-err) .form-select,' +
    '#main .card:has(#po-form-err) .form-input,' +
    '#main .card:has(#po-form-err) .form-select{' +
      'min-width:0!important;width:100%!important;max-width:100%!important;box-sizing:border-box;' +
    '}' +
    '#main .card:has(#inv-form-err) > div[style*="grid-template-columns"],' +
    '#main .card:has(#quo-form-err) > div[style*="grid-template-columns"],' +
    '#main .card:has(#po-form-err) > div[style*="grid-template-columns"]{' +
      'grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr))!important;' +
      'gap:16px!important;' +
    '}' +
    '}';
  document.head.appendChild(s);

  function fitGrids() {
    var nodes = document.querySelectorAll('[id^="stg-"]');
    nodes.forEach(function (el) {
      var style = el.getAttribute('style') || '';
      if (style.indexOf('grid-template-columns') >= 0) {
        var n = (style.match(/1fr/g) || []).length || 2;
        el.style.display = 'grid';
        el.style.gridTemplateColumns = 'repeat(' + n + ', minmax(260px, 1fr))';
        el.style.overflowX = 'auto';
        el.style.webkitOverflowScrolling = 'touch';
        el.style.maxWidth = '100%';
      } else {
        el.style.overflowX = 'auto';
        el.style.webkitOverflowScrolling = 'touch';
      }
      el.querySelectorAll('div[style*="grid-template-columns"]').forEach(function (grid) {
        var gs = grid.getAttribute('style') || '';
        var n = (gs.match(/1fr/g) || []).length || 2;
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = 'repeat(' + n + ', minmax(260px, 1fr))';
        grid.style.overflowX = 'auto';
        grid.style.webkitOverflowScrolling = 'touch';
        grid.style.maxWidth = '100%';
      });
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
  // Do NOT run fitGrids on every page load — Settings-only via renderSettings hook
})();
