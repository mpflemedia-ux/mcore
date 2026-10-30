/* Salary Disbursement — print by generated_at run. v4
   v4: read the payroll rows from the `let _sdRecords` binding in index.html (it is NOT a window
   property, so window._sdRecords was always undefined -> "All runs (0 staff)" and "0 employees").
   Rows are matched by record id (sd-epf-<id>), never by table index; with no records nothing is
   hidden, so the cards (which follow tr.style.display) can never all disappear. EN/BM labels. */
(function () {
  var lastRecs = null;
  function L(en, ms) { var bm = false; try { bm = APP.language === 'bm'; } catch (e) {} return bm ? ms : en; }
  function sdRecs() {
    var r = null;
    try { r = (typeof _sdRecords !== 'undefined') ? _sdRecords : null; } catch (e) { r = null; }
    r = r || window._sdRecords;
    return Array.isArray(r) ? r : [];
  }
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
    var recs = sdRecs();
    if (!recs.length) return; // no data: never hide rows / rewrite counts
    var groups = clusters(recs);
    var bidOf = {};
    groups.forEach(function (g) { g.items.forEach(function (it) { if (it.r) bidOf[it.r.id] = g.id; }); });
    var all = !id || id === 'all';
    recs.forEach(function (r) {
      var inp = r && document.getElementById('sd-epf-' + r.id);
      var tr = inp && inp.closest('tr');
      if (!tr) return;
      var bid = bidOf[r.id] || 'b0';
      tr.setAttribute('data-sd-batch', bid);
      tr.style.display = (all || bid === id) ? '' : 'none';
    });
    var visible = recs.filter(function (r) { return all || bidOf[r.id] === id; });
    var n = visible.length;
    var first = document.querySelector('.pdoc-sd-summary span b');
    if (first) first.textContent = String(n);
    var tot = document.getElementById('sd-summary-total');
    if (tot && typeof formatRM === 'function') {
      tot.textContent = formatRM(visible.reduce(function (s, r) { return s + Number(r.net_pay || 0); }, 0));
    }
    document.querySelectorAll('#sd-pdoc span').forEach(function (sp) {
      [].forEach.call(sp.childNodes, function (nd) { // text nodes only: keep <b>SD-…</b>
        if (nd.nodeType !== 3) return;
        var tx = nd.nodeValue || '';
        if (/\d+\s+(employees|pekerja)/i.test(tx)) nd.nodeValue = tx.replace(/\d+\s+(employees|pekerja)/i, n + ' $1');
      });
    });
  }
  function fillSelect(sel, recs) {
    var groups = clusters(recs);
    var keep = sel.value || 'all';
    sel.innerHTML = '';
    var o0 = document.createElement('option');
    o0.value = 'all';
    o0.textContent = L('All runs', 'Semua larian') + ' (' + recs.length + ' ' + L('staff', 'staf') + ')';
    sel.appendChild(o0);
    groups.forEach(function (g, i) {
      var o = document.createElement('option');
      o.value = g.id;
      o.textContent = L('Run', 'Larian') + ' ' + (i + 1) + ' · ' + fmt(g.tMin) + ' · ' + g.items.length + ' ' + L('staff', 'staf');
      sel.appendChild(o);
    });
    if ([].some.call(sel.options, function (o) { return o.value === keep; })) sel.value = keep;
    else sel.value = 'all';
  }
  function mount() {
    var monthEl = document.getElementById('sd-month');
    if (!monthEl) { lastN = -1; lastRecs = null; return; }
    var recs = sdRecs();
    var wrap = document.getElementById('sd-batch-filter');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'sd-batch-filter';
      wrap.className = 'no-print';
      wrap.style.cssText = 'margin:12px 0 0;display:flex;flex-direction:column;gap:4px';
      var lab = document.createElement('label');
      lab.className = 'form-label';
      lab.textContent = L('Print batch', 'Kumpulan cetak');
      var sel = document.createElement('select');
      sel.className = 'form-select';
      sel.onchange = function () { applyFilter(sel.value); };
      wrap.appendChild(lab);
      wrap.appendChild(sel);
      var box = monthEl.parentNode && monthEl.parentNode.parentNode;
      if (box && box.parentNode) box.parentNode.insertBefore(wrap, box.nextSibling);
      else monthEl.parentNode.appendChild(wrap);
    }
    if (recs.length !== lastN || recs !== lastRecs) {
      lastN = recs.length; lastRecs = recs;
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
