(function () {
  var old = document.getElementById('jnl-print-css');
  if (old) old.remove();
  var s = document.createElement('style');
  s.id = 'jnl-print-css';
  s.textContent =
    '@media print{' +
    '@page{size:A4 landscape;margin:8mm;}' +
    '#jnl-table-wrap{overflow:visible!important;max-height:none!important;height:auto!important;}' +
    '#jnl-table-wrap table{width:100%!important;min-width:0!important;table-layout:fixed!important;font-size:8px!important;}' +
    '#jnl-table-wrap th,#jnl-table-wrap td{white-space:normal!important;word-break:break-word!important;padding:2px 3px!important;}' +
    '}';
  document.head.appendChild(s);

  var saved = [];
  function snap(el) {
    saved.push({ el: el, css: el.getAttribute('style') || '' });
  }
  function before() {
    saved = [];
    var wrap = document.getElementById('jnl-table-wrap');
    if (!wrap) return;
    if (typeof _pdocSetPageOrientation === 'function') _pdocSetPageOrientation('landscape', 8);
    snap(wrap);
    wrap.style.overflow = 'visible';
    wrap.style.maxHeight = 'none';
    wrap.style.width = '100%';
    var table = wrap.querySelector('table');
    if (!table) return;
    snap(table);
    table.style.width = '100%';
    table.style.minWidth = '0';
    table.style.tableLayout = 'fixed';
    table.style.fontSize = '8px';
    var widths = ['18%', '11%', '28%', '13%', '15%', '15%'];
    wrap.querySelectorAll('th,td').forEach(function (cell) {
      snap(cell);
      var i = cell.cellIndex;
      cell.style.whiteSpace = 'normal';
      cell.style.wordBreak = 'break-word';
      cell.style.maxWidth = 'none';
      cell.style.padding = '2px 4px';
      cell.style.fontSize = '8px';
      if (widths[i]) cell.style.width = widths[i];
    });
  }
  function after() {
    saved.forEach(function (x) {
      if (x.css) x.el.setAttribute('style', x.css);
      else x.el.removeAttribute('style');
    });
    saved = [];
  }
  window.addEventListener('beforeprint', before);
  window.addEventListener('afterprint', after);
})();
