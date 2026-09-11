/* Salary Disbursement — print by generated_at run. */
(function () {
  var GAP_MS = 30 * 60 * 1000;
  var lastN = -1;
  function ts(r) {
    var n = Date.parse((r && r.generated_at) || 0);
    return isNaN(n) ? 0 : n;
  }
  function clusters(recs) {
    var items = (recs || []).map(function (r, i) { return { r: r, i: i, t: ts(r) }; });
    items.sort(function (a, b) { return a.t - b.t; });
    var groups = [];
    items.forEach(function (it) {
      var last = groups[groups.length - 1];
      if (!last || it.t - last.tMax > GAP_MS) {
        groups.push({ id: 'b' + groups.length, tMin: it.t, tMax: it.t, items: [it] });
      } else {
        last.items.push(it);
        if (it.t > last.tMax) last.tMax = it.t;
      }
    });
    return groups;
  }
  function fmt(t) {
    if (!t) return '-';
    var d = new Date(t);
    var p = function (n) { return String(n).padStart(2, '0'); };
    return p(d.getDate()) + '/' + p(d.getMonth() + 1) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function applyFilter(id) {
    var recs = window._sdRecords || [];
    var groups = clusters(recs);
    var map = {};
    groups.forEach(function (g) {
      g.items.forEach(function (it) { map[it.i] = g.id; });
    });
    document.querySelectorAll('.pdoc table tbody tr').forEach(function (tr, i) {
      var bid = map[i] || 'b0';
      tr.setAttribute('data-sd-batch', bid);
      tr.style.display = (!id || id === 'all' || bid === id) ? '' : 'none';
    });
    var visible = recs.filter(function (r, i) {
      return !id || id === 'all' || map[i] === id;
    });
    var n = visible.length;
    var first = document.querySelector('.pdoc-sd-summary span b');
    if (first) first.textContent = String(n);
    var tot = document.getElementById('sd-summary-total');
    if (tot && typeof formatRM === 'function') {
      tot.textContent = formatRM(visible.reduce(function (s, r) { return s + Number(r.net_pay || 0); }, 0));
    }
    document.querySelectorAll('.pdoc span').forEach(function (sp) {
      var tx = sp.textContent || '';
      if (/\d+\s+(employees|pekerja)/i.test(tx)) {
        sp.textContent = tx.replace(/\d+\s+(employees|pekerja)/i, n + ' $1');
      }
    });
  }
  function fillSelect(sel, recs) {
    var groups = clusters(recs);
    var keep = sel.value || 'all';
    sel.innerHTML = '';
    var o0 = document.createElement('option');
    o0.value = 'all';
    o0.textContent = 'All runs (' + recs.length + ' staff)';
    sel.appendChild(o0);
    groups.forEach(function (g, i) {
      var o = document.createElement('option');
      o.value = g.id;
      o.textContent = 'Run ' + (i + 1) + ' · ' + fmt(g.tMin) + ' · ' + g.items.length + ' staff';
      sel.appendChild(o);
    });
    if ([].some.call(sel.options, function (o) { return o.value === keep; })) sel.value = keep;
    else sel.value = 'all';
  }
  function mount() {
    var monthEl = document.getElementById('sd-month');
    if (!monthEl) { lastN = -1; return; }
    var recs = window._sdRecords || [];
    var wrap = document.getElementById('sd-batch-filter');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'sd-batch-filter';
      wrap.className = 'no-print';
      wrap.style.cssText = 'margin:12px 0 0;display:flex;flex-direction:column;gap:4px';
      var lab = document.createElement('label');
      lab.className = 'form-label';
      lab.textContent = 'Print batch';
      var sel = document.createElement('select');
      sel.className = 'form-select';
      sel.onchange = function () { applyFilter(sel.value); };
      wrap.appendChild(lab);
      wrap.appendChild(sel);
      var box = monthEl.parentNode && monthEl.parentNode.parentNode;
      if (box && box.parentNode) box.parentNode.insertBefore(wrap, box.nextSibling);
      else monthEl.parentNode.appendChild(wrap);
    }
    if (recs.length !== lastN) {
      lastN = recs.length;
      fillSelect(wrap.querySelector('select'), recs);
      applyFilter(wrap.querySelector('select').value);
    }
  }
  var orig = window.renderSalaryDisbursement;
  if (typeof orig === 'function') {
    window.renderSalaryDisbursement = async function () {
      lastN = -1;
      var r = await orig.apply(this, arguments);
      setTimeout(mount, 40);
      return r;
    };
  }
  setInterval(mount, 700);
})();
