(function () {
  window._jnlView = window._jnlView || { q: '', src: '' };

  function apply() {
    var wrap = document.getElementById('jnl-table-wrap');
    var tbl = wrap && wrap.querySelector('table');
    if (!tbl || !tbl.tBodies[0]) return;
    var v = window._jnlView;
    var q = String(v.q || '').toLowerCase().trim();
    var srcs = {};
    var shown = 0, total = 0;
    [].slice.call(tbl.tBodies[0].rows).forEach(function (tr) {
      var tds = tr.querySelectorAll('td');
      var no = ((tds[0] && tds[0].textContent) || '').trim();
      var date = ((tds[1] && tds[1].textContent) || '').trim();
      var desc = ((tds[2] && tds[2].textContent) || '').trim();
      var src = ((tds[3] && tds[3].textContent) || '').trim();
      var debit = ((tds[4] && tds[4].textContent) || '').trim();
      var credit = ((tds[5] && tds[5].textContent) || '').trim();
      if (src) srcs[src] = true;
      total++;
      var ok = true;
      if (v.src && src !== v.src) ok = false;
      if (ok && q) {
        var blob = [no, date, desc, src, debit, credit].join(' ').toLowerCase();
        ok = blob.indexOf(q) !== -1;
      }
      tr.style.display = ok ? '' : 'none';
      if (ok) shown++;
    });
    window._jnlSrcs = Object.keys(srcs).sort();
    var hint = document.getElementById('jnl-view-count');
    if (hint) hint.textContent = shown + ' / ' + total;
    var sel = document.getElementById('jnl-src');
    if (sel && sel.options.length <= 1 && window._jnlSrcs.length) {
      var cur = sel.value;
      window._jnlSrcs.forEach(function (s) {
        var o = document.createElement('option');
        o.value = s; o.textContent = s;
        if (s === cur) o.selected = true;
        sel.appendChild(o);
      });
    }
  }
  function bar() {
    var isBm = typeof APP !== 'undefined' && APP.language === 'bm';
    var v = window._jnlView;
    var srcs = window._jnlSrcs || [];
    var host = document.getElementById('jnl-sort-bar');
    if (!host) {
      var wrap = document.getElementById('jnl-table-wrap');
      if (!wrap || document.getElementById('jnl-view-bar')) return;
      host = wrap.parentNode;
    }
    if (document.getElementById('jnl-view-bar')) return;
    var html = '<div id="jnl-view-bar" class="no-print" style="display:flex;flex-wrap:wrap;gap:8px;margin:0 0 8px;align-items:center">' +
      '<input id="jnl-q" class="form-input" style="flex:1;min-width:160px" placeholder="' +
        (isBm ? 'Cari no. entri, keterangan, sumber…' : 'Search entry no, description, source…') +
        '" value="' + String(v.q || '').replace(/"/g, '&quot;') + '">' +
      '<select id="jnl-src" class="form-select" style="width:auto;min-width:140px">' +
        '<option value="">' + (isBm ? 'Semua sumber' : 'All sources') + '</option>' +
        srcs.map(function (s) {
          return '<option value="' + s.replace(/"/g, '&quot;') + '"' + (v.src === s ? ' selected' : '') + '>' + s + '</option>';
        }).join('') +
      '</select>' +
      '<span id="jnl-view-count" style="font-size:12px;color:var(--text-3)"></span></div>';
    if (host.id === 'jnl-sort-bar') host.insertAdjacentHTML('beforebegin', html);
    else host.insertAdjacentHTML('afterbegin', html);
    var q = document.getElementById('jnl-q');
    var src = document.getElementById('jnl-src');
    function read() {
      window._jnlView.q = q ? q.value : '';
      window._jnlView.src = src ? src.value : '';
      apply();
    }
    if (q) q.oninput = function () { clearTimeout(window._jnlQTimer); window._jnlQTimer = setTimeout(read, 200); };
    if (src) src.onchange = read;
  }
  function hook(name) {
    var orig = window[name];
    if (typeof orig !== 'function' || orig._jnlSearch) return;
    window[name] = function () {
      var r = orig.apply(this, arguments);
      if (r && r.then) r.then(function () { setTimeout(function () { bar(); apply(); }, 0); });
      else setTimeout(function () { bar(); apply(); }, 0);
      return r;
    };
    window[name]._jnlSearch = true;
  }
  function wrap() {
    hook('_jnlLoadTable');
    hook('renderJournalList');
  }
  wrap();
  setTimeout(wrap, 400);
  setTimeout(function () { bar(); apply(); }, 600);
})();
