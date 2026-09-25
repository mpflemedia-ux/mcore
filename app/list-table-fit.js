(function () {
  function fitWrap(wrap) {
    if (!wrap) return;
    wrap.style.overflow = 'auto';
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
      cell.style.padding = cell.style.padding || '8px 12px';
    });
  }
  function fitAll() {
    var main = document.getElementById('main');
    if (main) main.style.paddingBottom = '120px';
    var nodes = document.querySelectorAll('[id$="-list-wrap"],[id$="-table-wrap"]');
    nodes.forEach(fitWrap);
  }
  function hook(name) {
    var orig = window[name];
    if (typeof orig !== 'function' || orig._listFit) return;
    window[name] = function () {
      var r = orig.apply(this, arguments);
      if (r && r.then) r.then(function () { setTimeout(fitAll, 0); setTimeout(fitAll, 80); });
      else { setTimeout(fitAll, 0); setTimeout(fitAll, 80); }
      return r;
    };
    window[name]._listFit = true;
  }
  function wrapFns() {
    ['renderPOList', '_poRenderListTable', 'renderInvList', '_invRenderListTable',
      'renderProductList', '_invLoad', 'renderCustomerList', '_crmLoad',
      'renderDOList', '_doRenderListTable', 'renderBillList', '_billRenderListTable',
      'renderPVList', 'renderSuppList', 'renderJournalList'].forEach(hook);
  }
  wrapFns();
  setTimeout(wrapFns, 400);
  setTimeout(fitAll, 200);
  if (document.getElementById('main')) {
    try {
      new MutationObserver(function () { fitAll(); }).observe(document.getElementById('main'), { childList: true, subtree: true });
    } catch (e) {}
  }
})();
