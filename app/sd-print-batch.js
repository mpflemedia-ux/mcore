/* Split Salary Disbursement print by payroll generated_at run. */
(function () {
  var GAP_MS = 30 * 60 * 1000;
  function ts(r) {
    var g = r && r.generated_at;
    var n = Date.parse(g || 0);
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
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function applyFilter(id) {
    var recs = window._sdRecords || [];
    var groups = clusters(recs);
    var map = {};
    groups.forEach(function (g) {
      g.items.forEach(function (it) { map[it.i] = g.id; });
    });
    var rows = document.querySelectorAll('.pdoc table tbody tr');
    var visible = [];
    rows.forEach(function (tr, i) {
      var bid = map[i] || 'b0';
      tr.setAttribute('data-sd-batch', bid);
      var on = (!id || id === 'all' || bid === id);
      tr.style.display = on ? '' : 'none';
      if (on && recs[i]) visible.push(recs[i]);
    });
    var n = visible.length;
    var sumSal = visible.reduce(function (s, r) { return s + Number(r.basic_salary || 0); }, 0);
    var sumNet = visible.reduce(function (s, r) { return s + Number(r.net_pay || 0); }, 0);
    document.querySelectorAll('.pdoc-sd-summary b, .pdoc-sd-summary span b').forEach(function () {});
    var empB = document.querySelector('.pdoc-sd-summary span b');
    if (empB && /Employees|Pekerja/i.test((empB.parentNode && empB.parentNode.textContent) || '')) empB.textContent = String(n);
    var banner = document.querySelector('.pdoc .pdoc-title-bar, .pdoc [class*="title"]');
    document.querySelectorAll('.pdoc span').forEach(function (sp) {
      var tx = sp.textContent || '';
      if (/\d+\s+(employees|pekerja)/i.test(tx)) {
        sp.textContent = tx.replace(/\d+\s+(employees|pekerja)/i, n + ' $1');
      }
    });
    var rm = (typeof formatRM === 'function') ? formatRM : function (x) { return x; };
    var tot = document.getElementById('sd-summary-total');
    if (tot) tot.textContent = rm(sumNet);
  }
  function mount() {
    var recs = window._sdRecords || [];
    if (!recs.length || !document.getElementById('sd-month')) return;
    var groups = clusters(recs);
    var header = document.querySelector('#main .page-header');
    if (!header) return;
    var old = document.getElementById('sd-batch-filter');
    if (old) old.remove();
    var wrap = document.createElement('label');
    wrap.id = 'sd-batch-filter';
    wrap.className = 'no-print';
    wrap.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:13px';
    var sel = document.createElement('select');
    sel.className = 'form-select';
    sel.style.minWidth = '220px';
    var opt0 = document.createElement('option');
    opt0.value = 'all';
    opt0.textContent = 'All runs (' + recs.length + ')';
    sel.appendChild(opt0);
    groups.forEach(function (g, i) {
      var o = document.createElement('option');
      o.value = g.id;
      o.textContent = 'Run ' + (i + 1) + ' · ' + fmt(g.tMin) + ' · ' + g.items.length + ' staff';
      sel.appendChild(o);
    });
    if (groups.length > 1) sel.value = groups[groups.length - 1].id;
    sel.onchange = function () { applyFilter(sel.value); };
    wrap.appendChild(document.createTextNode('Print batch'));
    wrap.appendChild(sel);
    header.appendChild(wrap);
    applyFilter(sel.value);
  }
  var orig = window.renderSalaryDisbursement;
  if (typeof orig === 'function') {
    window.renderSalaryDisbursement = async function () {
      var r = await orig.apply(this, arguments);
      setTimeout(mount, 0);
      return r;
    };
  }
  if (document.getElementById('sd-month')) setTimeout(mount, 50);
})();
