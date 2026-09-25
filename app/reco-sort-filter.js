(function () {
  window._recoView = window._recoView || { q: '', cat: '', sort: 'date', dir: 'asc' };

  function catsFrom(rows) {
    var set = {};
    (rows || []).forEach(function (t) {
      var c = String(t.category || '').trim();
      if (c) set[c] = true;
    });
    return Object.keys(set).sort();
  }
  function matchText(t, m) {
    if (!m || !m.candidate) return '';
    var c = m.candidate;
    return [c.type, c.ref, c.id].filter(Boolean).join(' ');
  }
  function val(t, m, field) {
    if (field === 'date') return String(t.date || '');
    if (field === 'desc') return String(t.description || '').toLowerCase();
    if (field === 'amount') return Number(t.amount || 0);
    if (field === 'cat') return String(t.category || '').toLowerCase();
    if (field === 'match') return matchText(t, m).toLowerCase();
    if (field === 'conf') {
      var c = m && m.confidence;
      if (c == null) return -1;
      return Number(c) <= 1 ? Number(c) * 100 : Number(c);
    }
    return '';
  }
  function applyView() {
    if (!Array.isArray(window._recoTxns)) return;
    if (!window._recoBase || window._recoTxns.length > window._recoBase.t.length) {
      window._recoBase = {
        t: window._recoTxns.slice(),
        m: (window._recoMatches || []).slice()
      };
    }
    if (!window._recoTxns.length && window._recoBase && window._recoBase.t.length) {
      /* keep base unless session cleared to empty on purpose */
    }
    if (!window._recoTxns.length) {
      window._recoBase = { t: [], m: [] };
      return;
    }
    var v = window._recoView;
    var q = String(v.q || '').toLowerCase().trim();
    var pairs = window._recoBase.t.map(function (t, i) {
      return { t: t, m: window._recoBase.m[i], i: i };
    });
    if (v.cat) pairs = pairs.filter(function (p) { return String(p.t.category || '') === v.cat; });
    if (q) {
      pairs = pairs.filter(function (p) {
        var blob = [
          p.t.date, p.t.description, p.t.amount, p.t.category,
          matchText(p.t, p.m), val(p.t, p.m, 'conf')
        ].join(' ').toLowerCase();
        return blob.indexOf(q) !== -1;
      });
    }
    var dir = v.dir === 'desc' ? -1 : 1;
    var field = v.sort || 'date';
    pairs.sort(function (a, b) {
      var va = val(a.t, a.m, field), vb = val(b.t, b.m, field);
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb), undefined, { numeric: true }) * dir;
    });
    window._recoTxns = pairs.map(function (p) { return p.t; });
    window._recoMatches = pairs.map(function (p) { return p.m; });
  }
  function toolbarHtml() {
    var isBm = typeof APP !== 'undefined' && APP.language === 'bm';
    var v = window._recoView;
    var cats = catsFrom(window._recoBase && window._recoBase.t);
    var opt = function (value, label) {
      return '<option value="' + value + '"' + (v.sort === value ? ' selected' : '') + '>' + label + '</option>';
    };
    return '<div id="reco-view-bar" class="no-print" style="display:flex;flex-wrap:wrap;gap:8px;padding:0 0 10px">' +
      '<input id="reco-q" class="form-input" style="flex:1;min-width:160px" placeholder="' +
        (isBm ? 'Cari tarikh, keterangan, amaun…' : 'Search date, description, amount…') +
        '" value="' + String(v.q || '').replace(/"/g, '&quot;') + '">' +
      '<select id="reco-cat" class="form-select" style="width:auto;min-width:140px">' +
        '<option value="">' + (isBm ? 'Semua kategori' : 'All categories') + '</option>' +
        cats.map(function (c) {
          return '<option value="' + c.replace(/"/g, '&quot;') + '"' + (v.cat === c ? ' selected' : '') + '>' + c + '</option>';
        }).join('') +
      '</select>' +
      '<select id="reco-sort" class="form-select" style="width:auto">' +
        opt('date', isBm ? 'Tarikh' : 'Date') +
        opt('desc', isBm ? 'Keterangan' : 'Description') +
        opt('amount', isBm ? 'Amaun' : 'Amount') +
        opt('cat', isBm ? 'Kategori' : 'Category') +
        opt('match', isBm ? 'Padanan' : 'Match') +
        opt('conf', isBm ? 'Yakin' : 'Conf.') +
      '</select>' +
      '<select id="reco-dir" class="form-select" style="width:auto">' +
        '<option value="asc"' + (v.dir === 'asc' ? ' selected' : '') + '>' + (isBm ? 'Menaik' : 'Ascending') + '</option>' +
        '<option value="desc"' + (v.dir === 'desc' ? ' selected' : '') + '>' + (isBm ? 'Menurun' : 'Descending') + '</option>' +
      '</select></div>';
  }
  function bindBar() {
    var q = document.getElementById('reco-q');
    var cat = document.getElementById('reco-cat');
    var sort = document.getElementById('reco-sort');
    var dir = document.getElementById('reco-dir');
    function go() {
      window._recoView.q = q ? q.value : '';
      window._recoView.cat = cat ? cat.value : '';
      window._recoView.sort = sort ? sort.value : 'date';
      window._recoView.dir = dir ? dir.value : 'asc';
      if (typeof window._recoRenderResults === 'function') window._recoRenderResults();
    }
    if (q) q.oninput = function () { clearTimeout(window._recoQTimer); window._recoQTimer = setTimeout(go, 250); };
    if (cat) cat.onchange = go;
    if (sort) sort.onchange = go;
    if (dir) dir.onchange = go;
  }
  function injectBar() {
    var host = document.getElementById('reco-result');
    if (!host) return;
    var old = document.getElementById('reco-view-bar');
    if (old) old.remove();
    host.insertAdjacentHTML('afterbegin', toolbarHtml());
    bindBar();
  }
  function wrap() {
    var orig = window._recoRenderResults;
    if (typeof orig !== 'function' || orig._view) return;
    window._recoRenderResults = function () {
      if (!window._recoPainting) {
        window._recoPainting = true;
        try { applyView(); } catch (e) {}
      }
      var r = orig.apply(this, arguments);
      setTimeout(function () {
        injectBar();
        window._recoPainting = false;
      }, 0);
      return r;
    };
    window._recoRenderResults._view = true;
  }
  wrap();
  setTimeout(wrap, 400);
})();
