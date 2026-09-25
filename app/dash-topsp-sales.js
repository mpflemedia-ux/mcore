(function () {
  function ymRange(y, m) {
    var from = y + '-' + String(m).padStart(2, '0') + '-01';
    var last = new Date(y, m, 0).getDate();
    var to = y + '-' + String(m).padStart(2, '0') + '-' + String(last).padStart(2, '0');
    return { from: from, to: to };
  }
  function dispName(e) {
    var n = (e && (e.nickname || e.name)) || '';
    return String(n).trim() || '—';
  }
  async function salesByEmp(from, to) {
    var map = {};
    var tid = APP.tenant && APP.tenant.id;
    if (!tid) return map;
    try {
      var inv = await sb.from('invoices')
        .select('sales_person_id,total,status,issue_date')
        .eq('tenant_id', tid).is('deleted_at', null)
        .eq('status', 'paid')
        .gte('issue_date', from).lte('issue_date', to);
      (inv.data || []).forEach(function (r) {
        if (!r.sales_person_id) return;
        map[r.sales_person_id] = (map[r.sales_person_id] || 0) + Number(r.total || 0);
      });
    } catch (e) {}
    try {
      var pos = await sb.from('pos_transactions')
        .select('sales_person_id,total,status,created_at')
        .eq('tenant_id', tid)
        .gte('created_at', from + 'T00:00:00')
        .lte('created_at', to + 'T23:59:59');
      (pos.data || []).forEach(function (r) {
        if (!r.sales_person_id) return;
        var st = String(r.status || '').toLowerCase();
        if (st && st !== 'paid' && st !== 'completed' && st !== 'done') return;
        map[r.sales_person_id] = (map[r.sales_person_id] || 0) + Number(r.total || 0);
      });
    } catch (e2) {}
    return map;
  }
  window._dbRenderTopSalesPerson = async function () {
    var isBm = APP.language === 'bm';
    var canvas = document.getElementById('db-topsp-chart');
    var fallback = document.getElementById('db-topsp-fallback');
    var moveWrap = document.getElementById('db-topsp-move');
    var foot = document.querySelector('#db-sec-topsp .db-card-foot');
    if (foot) foot.textContent = isBm ? 'Top 5 mengikut jualan tempoh semasa · komisen ditunjukkan' : 'Top 5 by sales this period · commission shown';
    if (moveWrap) moveWrap.innerHTML = '';
    if (!canvas || typeof Chart === 'undefined') {
      if (fallback) fallback.style.display = 'block';
      return;
    }
    var now = new Date();
    var curMonth = now.getMonth() + 1, curYear = now.getFullYear();
    var prevMonth = curMonth === 1 ? 12 : curMonth - 1;
    var prevYear = curMonth === 1 ? curYear - 1 : curYear;
    var curR = ymRange(curYear, curMonth);
    var prevR = ymRange(prevYear, prevMonth);
    var emps = (typeof _scLoadEmployees === 'function') ? await _scLoadEmployees() : [];
    if (typeof _dbDestroy === 'function') _dbDestroy('topSP', canvas);
    var showEmpty = function () {
      if (fallback) {
        fallback.style.display = 'block';
        fallback.textContent = isBm ? 'Tiada jualan bertag salesperson tempoh ini' : 'No tagged salesperson sales this period';
      }
      window._dbInsightCtx = Object.assign({}, window._dbInsightCtx || {}, { topsp: null });
    };
    if (!emps || !emps.length) { showEmpty(); return; }
    var extra = {};
    try {
      var q = await sb.from('employees').select('id,name,nickname').eq('tenant_id', APP.tenant.id).is('deleted_at', null);
      (q.data || []).forEach(function (e) { extra[e.id] = e; });
    } catch (e3) {}
    var salesCur = await salesByEmp(curR.from, curR.to);
    var salesPrev = await salesByEmp(prevR.from, prevR.to);
    var rows = await Promise.all(emps.map(async function (e) {
      var comm = 0;
      try {
        if (typeof _scCommissionTotal === 'function') {
          var r = await _scCommissionTotal(e.id, curMonth, curYear, 'earned');
          comm = Number(r && r.total || 0);
        }
      } catch (e4) {}
      var meta = extra[e.id] || e;
      return { id: e.id, name: dispName(meta), sales: Number(salesCur[e.id] || 0), comm: comm };
    }));
    var curRanked = rows.filter(function (r) { return r.sales > 0 || r.comm > 0; }).sort(function (a, b) {
      if (b.sales !== a.sales) return b.sales - a.sales;
      return b.comm - a.comm;
    });
    if (!curRanked.length) { showEmpty(); return; }
    if (fallback) { fallback.style.display = 'none'; fallback.textContent = ''; }
    var prevRanked = emps.map(function (e) {
      return { id: e.id, sales: Number(salesPrev[e.id] || 0) };
    }).filter(function (r) { return r.sales > 0; }).sort(function (a, b) { return b.sales - a.sales; });
    var prevRankById = {};
    prevRanked.forEach(function (r, i) { prevRankById[r.id] = i; });
    var top = curRanked.slice(0, 5);
    var labels = top.map(function (r) {
      return (r.name.length > 16 ? r.name.slice(0, 14) + '…' : r.name);
    }).reverse();
    var data = top.map(function (r) { return Math.round(r.sales * 100) / 100; }).reverse();
    var commByLabel = {};
    top.forEach(function (r) {
      var lab = r.name.length > 16 ? r.name.slice(0, 14) + '…' : r.name;
      commByLabel[lab] = r.comm;
    });
    var primary = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#0E7490';
    var tick = (typeof _dbChartTickColor === 'function') ? _dbChartTickColor() : '#94a3b8';
    window._dbCharts = window._dbCharts || {};
    window._dbCharts.topSP = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{ label: isBm ? 'Jualan' : 'Sales', data: data, backgroundColor: primary, borderRadius: 6, maxBarThickness: 22 }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (x) {
                var v = Number(x.raw || 0);
                var lab = x.label;
                var c = Number(commByLabel[lab] || 0);
                var rm = function (n) { return typeof formatRM === 'function' ? formatRM(n) : ('RM ' + n.toFixed(2)); };
                return (isBm ? 'Jualan: ' : 'Sales: ') + rm(v) + ' · ' + (isBm ? 'Komisen: ' : 'Commission: ') + rm(c);
              }
            }
          }
        },
        scales: {
          x: { ticks: { color: tick, font: { size: 10 }, callback: function (v) { return v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v; } }, grid: { color: 'rgba(148,163,184,.12)' } },
          y: { ticks: { color: tick, font: { size: 11, weight: '600' } }, grid: { display: false } }
        }
      }
    });
    if (moveWrap) {
      moveWrap.innerHTML = top.map(function (r, curRank) {
        var hasPrev = Object.prototype.hasOwnProperty.call(prevRankById, r.id);
        var prevRank = hasPrev ? prevRankById[r.id] : null;
        var cls, icon, label;
        if (!hasPrev) { cls = 'neutral'; icon = 'ti-sparkles'; label = isBm ? 'BAHARU' : 'NEW'; }
        else if (curRank < prevRank) { cls = 'up'; icon = 'ti-trending-up'; label = '+' + (prevRank - curRank); }
        else if (curRank > prevRank) { cls = 'down'; icon = 'ti-trending-down'; label = '-' + (curRank - prevRank); }
        else { cls = 'neutral'; icon = 'ti-minus'; label = isBm ? 'Sama' : 'Same'; }
        var shortName = r.name.length > 12 ? r.name.slice(0, 10) + '…' : r.name;
        return '<span class="db-kpi-pill ' + cls + '" style="font-size:10px"><i class="ti ' + icon + '"></i> ' +
          (typeof _aiEscapeHtml === 'function' ? _aiEscapeHtml(shortName) : shortName) + ' ' + label + '</span>';
      }).join('');
    }
    var leader = top[0];
    window._dbInsightCtx = Object.assign({}, window._dbInsightCtx || {}, {
      topsp: {
        name: leader.name,
        sales: leader.sales,
        commission: leader.comm,
        period: isBm ? 'bulan ini' : 'this month'
      }
    });
  };
})();
