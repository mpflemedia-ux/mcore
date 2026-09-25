(function () {
  function fit() {
    var wrap = document.getElementById('crm-table-wrap');
    if (!wrap) return;
    wrap.style.overflowX = 'auto';
    wrap.style.webkitOverflowScrolling = 'touch';
    var table = wrap.querySelector('table');
    if (!table) return;
    table.style.width = 'max-content';
    table.style.minWidth = '100%';
    table.style.borderCollapse = 'separate';
    table.style.borderSpacing = '0';
    wrap.querySelectorAll('th,td').forEach(function (cell) {
      cell.style.whiteSpace = 'nowrap';
      cell.style.verticalAlign = 'middle';
      cell.style.padding = '8px 12px';
    });
  }
  function wrapFn() {
    var orig = window._crmLoad;
    if (typeof orig !== 'function' || orig._colFit) return;
    window._crmLoad = async function () {
      var r = orig.apply(this, arguments);
      if (r && r.then) r.then(function () { setTimeout(fit, 0); setTimeout(fit, 80); });
      else { setTimeout(fit, 0); setTimeout(fit, 80); }
      return r;
    };
    window._crmLoad._colFit = true;
  }
  wrapFn();
  setTimeout(wrapFn, 400);
  setInterval(function () {
    if (document.getElementById('crm-table-wrap')) fit();
  }, 2000);
})();
