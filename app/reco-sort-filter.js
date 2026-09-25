(function () {
  window._recoView = window._recoView || { q: '', cat: '', sort: 'date', dir: 'asc' };

  function table() {
    return document.querySelector('#reco-result table');
  }
  function rowData(tr) {
    var tds = tr.querySelectorAll('td');
    var sel = tr.querySelector('select');
    var amtTxt = ((tds[2] && tds[2].textContent) || '').replace(/,/g, '');
    var amtN = parseFloat(amtTxt.replace(/[^0-9.-]/g, ''));
    if (isNaN(amtN)) amtN = 0;
    if (/-/.test(amtTxt) && amtN > 0) amtN = -amtN;
    return {
      tr: tr,
      date: ((tds[0] && tds[0].textContent) || '').trim(),
      desc: ((tds[1] && tds[1].textContent) || '').trim(),
      amount: ((tds[2] && tds[2].textContent) || '').trim(),
      amountN: amtN,
      cat: (sel && sel.value) || ((tds[3] && tds[3].textContent) || '').trim(),
      match: ((tds[4] && tds[4].textContent) || '').trim(),
      conf: parseFloat((tds[5] && tds[5].textContent) || '') || 0
    };
  }
  function applyDom() {
    var tbl = table();
    if (!tbl || !tbl.tBodies[0]) return;
    var v = window._recoView;
    var q = String(v.q || '').toLowerCase().trim();
    var rows = [].slice.call(tbl.tBodies[0].rows).map(rowData);
    var cats = {};
    rows.forEach(function (r) { if (r.cat) cats[r.cat] = true; });
    window._recoCats = Object.keys(cats).sort();
    var dir = v.dir === 'desc' ? -1 : 1;
    rows.sort(function (a, b) {
      var va, vb;
      if (v.sort === 'amount') { va = a.amountN; vb = b.amountN; return (va - vb) * dir; }
      if (v.sort === 'conf') { va = a.conf; vb = b.conf; return (va - vb) * dir; }
      va = v.sort === 'desc' ? a.desc : v.sort === 'cat' ? a.cat : v.sort === 'match' ? a.match : a.date;
      vb = v.sort === 'desc' ? b.desc : v.sort === 'cat' ? b.cat : v.sort === 'match' ? b.match : b.date;
      return String(va).localeCompare(String(vb), undefined, { numeric: true }) * dir;
    });
    var shown = 0;
    rows.forEach(function (r) {
      var ok = true;
      if (v.cat && r.cat !== v.cat) ok = false;
      if (ok && q) {
        var blob = [r.date, r.desc, r.amount, r.cat, r.match, r.conf].join(' ').toLowerCase();
        ok = blob.indexOf(q) !== -1;
      }
      r.tr.style.display = ok ? '' : 'none';
      if (ok) {
        shown++;
        tbl.tBodies[0].appendChild(r.tr);
      }
    });
    var hint = document.getElementById('reco-view-count');
    if (hint) hint.textContent = shown + ' / ' + rows.length;
  }
  function toolbarHtml() {
    var isBm = typeof APP !== 'undefined' && APP.language === 'bm';
    var v = window._recoView;
    var cats = window._recoCats || [];
    function opt(val, label, cur) {
      return '<option value="' + val + '"' + (cur === val ? ' selected' : '') + '>' + label + '</option>';
    }
    return '<div id="reco-view-bar" class="no-print" style="display:flex;flex-wrap:wrap;gap:8px;padding:0 0 10px;align-items:center">' +
      '<input id="reco-q" class="form-input" style="flex:1;min-width:140px" placeholder="' +
        (isBm ? 'Cari…' : 'Search…') + '" value="' + String(v.q || '').replace(/"/g, '&quot;') + '">' +
      '<select id="reco-cat" class="form-select" style="width:auto;min-width:140px">' +
        '<option value="">' + (isBm ? 'Semua kategori' : 'All categories') + '</option>' +
        cats.map(function (c) { return opt(c.replace(/"/g, '&quot;'), c, v.cat); }).join('') +
      '</select>' +
      '<select id="reco-sort" class="form-select" style="width:auto">' +
        opt('date', isBm ? 'Tarikh' : 'Date', v.sort) +
        opt('desc', isBm ? 'Keterangan' : 'Description', v.sort) +
        opt('amount', isBm ? 'Amaun' : 'Amount', v.sort) +
        opt('cat', isBm ? 'Kategori' : 'Category', v.sort) +
        opt('match', isBm ? 'Padanan' : 'Match', v.sort) +
        opt('conf', isBm ? 'Yakin' : 'Conf.', v.sort) +
      '</select>' +
      '<select id="reco-dir" class="form-select" style="width:auto">' +
        opt('asc', isBm ? 'Menaik' : 'Ascending', v.dir) +
        opt('desc', isBm ? 'Menurun' : 'Descending', v.dir) +
      '</select>' +
      '<span id="reco-view-count" style="font-size:12px;color:var(--text-3)"></span></div>';
  }
  function bind() {
    function read() {
      var q = document.getElementById('reco-q');
      var cat = document.getElementById('reco-cat');
      var sort = document.getElementById('reco-sort');
      var dir = document.getElementById('reco-dir');
      window._recoView.q = q ? q.value : '';
      window._recoView.cat = cat ? cat.value : '';
      window._recoView.sort = sort ? sort.value : 'date';
      window._recoView.dir = dir ? dir.value : 'asc';
      applyDom();
      var catEl = document.getElementById('reco-cat');
      if (catEl && !(window._recoCats || []).length) refillCats(catEl);
    }
    var q = document.getElementById('reco-q');
    if (q) q.oninput = function () { clearTimeout(window._recoQTimer); window._recoQTimer = setTimeout(read, 200); };
    ['reco-cat', 'reco-sort', 'reco-dir'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.onchange = read;
    });
  }
  function refillCats(sel) {
    var cur = sel.value;
    applyDom();
    var cats = window._recoCats || [];
    var keep = sel.value;
    while (sel.options.length > 1) sel.remove(1);
    cats.forEach(function (c) {
      var o = document.createElement('option');
      o.value = c; o.textContent = c;
      if (c === cur) o.selected = true;
      sel.appendChild(o);
    });
    if (keep) sel.value = keep;
  }
  function inject() {
    var host = document.getElementById('reco-result');
    if (!host) return;
    var old = document.getElementById('reco-view-bar');
    var qKeep = window._recoView;
    if (old) old.remove();
    applyDom();
    host.insertAdjacentHTML('afterbegin', toolbarHtml());
    bind();
    applyDom();
  }
  function wrap() {
    var orig = window._recoRenderResults;
    if (typeof orig !== 'function' || orig._domView) return;
    window._recoRenderResults = function () {
      var r = orig.apply(this, arguments);
      setTimeout(inject, 0);
      return r;
    };
    window._recoRenderResults._domView = true;
  }
  wrap();
  setTimeout(wrap, 400);
  setTimeout(inject, 600);
})();
