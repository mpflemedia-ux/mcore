(function () {
  function fit() {
    var body = document.getElementById('sl-items-body');
    if (!body) return;
    var table = body.closest('table');
    var wrap = table ? table.parentNode : null;
    if (wrap && wrap.style) {
      wrap.style.overflowX = 'auto';
      wrap.style.webkitOverflowScrolling = 'touch';
      wrap.style.maxWidth = '100%';
    }
    if (table) {
      table.style.width = 'max-content';
      table.style.minWidth = '100%';
      table.style.borderCollapse = 'separate';
      table.style.borderSpacing = '0';
    }
    body.querySelectorAll('th,td').forEach(function (cell) {
      cell.style.whiteSpace = 'nowrap';
      cell.style.verticalAlign = 'middle';
      cell.style.padding = '6px 8px';
    });
    body.querySelectorAll('select.form-select').forEach(function (el) {
      el.style.minWidth = '180px';
      el.style.width = 'auto';
    });
    body.querySelectorAll('input.form-input').forEach(function (el) {
      if (el.type === 'number') {
        el.style.minWidth = '92px';
        el.style.width = '92px';
      } else {
        el.style.minWidth = '240px';
        el.style.width = '240px';
      }
    });
    var main = document.getElementById('main');
    if (main) main.style.paddingBottom = '120px';
  }
  function wrapFn() {
    var orig = window._slRenderItems;
    if (typeof orig !== 'function' || orig._fit) return;
    window._slRenderItems = function () {
      var r = orig.apply(this, arguments);
      setTimeout(fit, 0);
      return r;
    };
    window._slRenderItems._fit = true;
  }
  wrapFn();
  setTimeout(wrapFn, 400);
  setTimeout(fit, 200);
})();
