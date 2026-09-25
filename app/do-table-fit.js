(function () {
  function fit() {
    var wrap = document.getElementById('do-list-wrap');
    var main = document.getElementById('main');
    if (main) main.style.paddingBottom = '120px';
    if (!wrap) return;
    wrap.style.overflow = 'auto';
    wrap.style.webkitOverflowScrolling = 'touch';
    wrap.style.maxHeight = 'calc(100dvh - 360px)';
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
    var orig = window._doRenderListTable;
    if (typeof orig !== 'function' || orig._colFit) return;
    window._doRenderListTable = function () {
      var r = orig.apply(this, arguments);
      setTimeout(fit, 0);
      setTimeout(fit, 80);
      return r;
    };
    window._doRenderListTable._colFit = true;
  }
  wrapFn();
  setTimeout(wrapFn, 400);
  setTimeout(fit, 200);
})();
