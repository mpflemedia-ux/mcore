(function () {
  var lastStmt = null;

  function money(n) {
    var v = Number(n || 0);
    return 'RM ' + v.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function sums() {
    var rows = window._recoTxns || [];
    var inn = 0, out = 0;
    rows.forEach(function (t) {
      var a = Number(t.amount || 0);
      if (a >= 0) inn += a; else out += Math.abs(a);
    });
    return { inn: inn, out: out, net: inn - out, n: rows.length };
  }

  function paint() {
    var host = document.getElementById('reco-result');
    if (!host) return;
    var old = document.getElementById('reco-live-tally');
    if (old) old.remove();
    var s = sums();
    if (!s.n && !lastStmt) return;
    var isBm = window.APP && APP.language === 'bm';
    var stmtIn = lastStmt && lastStmt.in;
    var stmtOut = lastStmt && lastStmt.out;
    var tol = 0.05;
    function row(label, got, stmt) {
      var ok = stmt == null || stmt === 'conflict' ? null : Math.abs(got - Number(stmt)) <= tol;
      var color = ok == null ? 'var(--text-2)' : ok ? 'var(--success)' : 'var(--danger)';
      var vs = stmt == null || stmt === 'conflict'
        ? ''
        : ' <span style="color:var(--text-3);font-weight:400">' + (isBm ? 'vs penyata ' : 'vs statement ') + money(stmt) + '</span>';
      var icon = ok == null ? '' : ok ? ' ✓' : ' ⚠';
      return '<div style="display:flex;justify-content:space-between;gap:12px;padding:3px 0;font-size:12px">' +
        '<span style="color:var(--text-3)">' + label + '</span>' +
        '<span style="font-variant-numeric:tabular-nums;color:' + color + '">' + money(got) + icon + vs + '</span></div>';
    }
    var mismatch = (stmtIn != null && stmtIn !== 'conflict' && Math.abs(s.inn - Number(stmtIn)) > tol) ||
      (stmtOut != null && stmtOut !== 'conflict' && Math.abs(s.out - Number(stmtOut)) > tol);
    var box = document.createElement('div');
    box.id = 'reco-live-tally';
    box.className = 'card';
    box.style.cssText = 'padding:10px 14px;margin-bottom:10px;border:1px solid ' +
      (mismatch ? 'var(--danger)' : 'var(--border)');
    box.innerHTML =
      '<div style="font-size:12px;font-weight:600;margin-bottom:4px">' +
      (isBm ? 'Jumlah imbasan vs penyata' : 'Scan totals vs statement') + '</div>' +
      row(isBm ? 'Masuk (IN)' : 'Total IN', s.inn, stmtIn) +
      row(isBm ? 'Keluar (OUT)' : 'Total OUT', s.out, stmtOut) +
      row(isBm ? 'Bersih' : 'Net', s.net, null) +
      '<div style="font-size:11px;color:var(--text-3);margin-top:4px">' +
      (isBm
        ? 'Bandingkan IN/OUT dengan Jumlah Kredit/Debit pada PDF penyata.'
        : 'Compare IN/OUT to Total Credit/Debit printed on the bank PDF.') +
      '</div>';
    host.insertBefore(box, host.firstChild);
  }

  function hookTally() {
    var orig = window._recoRenderPdfTally;
    if (typeof orig !== 'function' || orig._liveTally) return;
    window._recoRenderPdfTally = function (isBm, sumDebit, sumCredit, stmtTotalDebit, stmtTotalCredit) {
      lastStmt = { out: stmtTotalDebit, in: stmtTotalCredit };
      var r = orig.apply(this, arguments);
      setTimeout(paint, 30);
      return r;
    };
    window._recoRenderPdfTally._liveTally = true;
  }
  function hookRender() {
    var orig = window._recoRenderResults;
    if (typeof orig !== 'function' || orig._liveTally) return;
    window._recoRenderResults = function () {
      var r = orig.apply(this, arguments);
      setTimeout(paint, 20);
      return r;
    };
    window._recoRenderResults._liveTally = true;
  }
  function hookClear() {
    var orig = window._recoClearSession;
    if (typeof orig !== 'function' || orig._liveTally) return;
    window._recoClearSession = function () {
      lastStmt = null;
      return orig.apply(this, arguments);
    };
    window._recoClearSession._liveTally = true;
  }
  function boot() { hookTally(); hookRender(); hookClear(); paint(); }
  boot();
  setTimeout(boot, 400);
})();
