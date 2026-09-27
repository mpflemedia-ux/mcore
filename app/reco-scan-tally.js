(function () {
  var KEY = 'mcore_reco_stmt_totals';
  function loadStmt() {
    try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (e) { return null; }
  }
  function saveStmt(o) {
    try { sessionStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {}
  }
  function parseAmt(s) {
    var t = String(s || '').replace(/RM\s*/i, '').replace(/,/g, '').trim();
    var n = parseFloat(t);
    return isNaN(n) ? 0 : n;
  }
  function money(n) {
    return 'RM ' + Number(n || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function sums() {
    var inn = 0, out = 0, n = 0;
    var cells = document.querySelectorAll('#reco-result table tbody tr td:nth-child(3)');
    if (cells.length) {
      cells.forEach(function (td) {
        var a = parseAmt(td.textContent);
        n += 1;
        if (a >= 0) inn += a; else out += Math.abs(a);
      });
      return { inn: inn, out: out, net: inn - out, n: n };
    }
    var ta = document.getElementById('reco-csv-text');
    var text = ta && ta.value || '';
    text.split(/\r?\n/).forEach(function (line) {
      var p = line.split(',');
      if (p.length < 3) return;
      var a = parseAmt(p[p.length - 1]);
      if (!a && p.length >= 3) a = parseAmt(p[2]);
      if (!a) return;
      n += 1;
      if (a >= 0) inn += a; else out += Math.abs(a);
    });
    return { inn: inn, out: out, net: inn - out, n: n };
  }
  function paint() {
    var host = document.getElementById('reco-result');
    if (!host) return;
    var old = document.getElementById('reco-live-tally');
    if (old) old.remove();
    var s = sums();
    var lastStmt = loadStmt();
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
      var icon = ok == null ? '' : ok ? ' \u2713' : ' \u26a0';
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
      s.n + (isBm ? ' baris dijumlah. Bandingkan dengan Jumlah Kredit/Debit PDF.' : ' lines summed. Compare to Total Credit/Debit on the PDF.') +
      '</div>';
    host.insertBefore(box, host.firstChild);
  }
  function hookTally() {
    var orig = window._recoRenderPdfTally;
    if (typeof orig !== 'function' || orig._liveTally2) return;
    window._recoRenderPdfTally = function (isBm, sumDebit, sumCredit, stmtTotalDebit, stmtTotalCredit) {
      saveStmt({ out: stmtTotalDebit, in: stmtTotalCredit });
      var r = orig.apply(this, arguments);
      setTimeout(paint, 40);
      return r;
    };
    window._recoRenderPdfTally._liveTally2 = true;
  }
  function hookRender() {
    var orig = window._recoRenderResults;
    if (typeof orig !== 'function' || orig._liveTally2) return;
    window._recoRenderResults = function () {
      var r = orig.apply(this, arguments);
      setTimeout(paint, 30);
      setTimeout(paint, 200);
      return r;
    };
    window._recoRenderResults._liveTally2 = true;
  }
  function hookClear() {
    var orig = window._recoClearSession;
    if (typeof orig !== 'function' || orig._liveTally2) return;
    window._recoClearSession = function () {
      try { sessionStorage.removeItem(KEY); } catch (e) {}
      return orig.apply(this, arguments);
    };
    window._recoClearSession._liveTally2 = true;
  }
  function boot() { hookTally(); hookRender(); hookClear(); paint(); }
  boot();
  setTimeout(boot, 400);
  setInterval(function () {
    if (document.getElementById('reco-result')) paint();
  }, 1500);
})();
