(function () {
  var KEY = 'mcore_reco_stmt_totals';
  var pinnedHtml = '';

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

  function pinBanner() {
    var el = document.getElementById('reco-pdf-tally');
    if (el && el.innerHTML && el.innerHTML.trim()) pinnedHtml = el.innerHTML;
  }
  function restoreBanner() {
    var el = document.getElementById('reco-pdf-tally');
    if (!el) return;
    if ((!el.innerHTML || !el.innerHTML.trim()) && pinnedHtml) el.innerHTML = pinnedHtml;
  }
  function stripTextareaClear() {
    var ta = document.getElementById('reco-csv-text');
    if (!ta) return;
    ta.removeAttribute('oninput');
    ta.oninput = null;
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
    restoreBanner();
    stripTextareaClear();
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
    var conflict = stmtIn === 'conflict' || stmtOut === 'conflict';
    var tol = 0.05;
    function row(label, got, stmt) {
      if (stmt === 'conflict') {
        return '<div style="display:flex;justify-content:space-between;gap:12px;padding:3px 0;font-size:12px">' +
          '<span style="color:var(--text-3)">' + label + '</span>' +
          '<span style="color:var(--warning)">' + money(got) + ' ⚠ ' +
          (isBm ? 'muka PDF tak sama' : 'pages disagree') + '</span></div>';
      }
      var ok = stmt == null ? null : Math.abs(got - Number(stmt)) <= tol;
      var color = ok == null ? 'var(--text-2)' : ok ? 'var(--success)' : 'var(--danger)';
      var vs = stmt == null ? '' : ' <span style="color:var(--text-3);font-weight:400">' +
        (isBm ? 'vs penyata ' : 'vs statement ') + money(stmt) + '</span>';
      var icon = ok == null ? '' : ok ? ' \u2713' : ' \u26a0';
      return '<div style="display:flex;justify-content:space-between;gap:12px;padding:3px 0;font-size:12px">' +
        '<span style="color:var(--text-3)">' + label + '</span>' +
        '<span style="font-variant-numeric:tabular-nums;color:' + color + '">' + money(got) + icon + vs + '</span></div>';
    }
    var box = document.createElement('div');
    box.id = 'reco-live-tally';
    box.className = 'card';
    box.style.cssText = 'padding:10px 14px;margin-bottom:10px;border:1px solid ' +
      (conflict ? 'var(--warning)' : 'var(--border)');
    box.innerHTML =
      '<div style="font-size:12px;font-weight:600;margin-bottom:4px">' +
      (isBm ? 'Jumlah imbasan vs penyata' : 'Scan totals vs statement') + '</div>' +
      row(isBm ? 'Masuk (IN)' : 'Total IN', s.inn, stmtIn) +
      row(isBm ? 'Keluar (OUT)' : 'Total OUT', s.out, stmtOut) +
      row(isBm ? 'Bersih' : 'Net', s.net, null) +
      '<div style="font-size:11px;color:var(--text-3);margin-top:4px">' +
      (conflict
        ? (isBm ? 'Footer setiap muka PDF berbeza. Guna jumlah baris di atas, banding manual dengan Jumlah Kredit/Debit pada penyata.' : 'Each PDF page printed a different footer total. Use the line sums above and compare manually to the statement.')
        : (s.n + (isBm ? ' baris dijumlah.' : ' lines summed.'))) +
      '</div>';
    host.insertBefore(box, host.firstChild);
  }

  function hookTally() {
    var orig = window._recoRenderPdfTally;
    if (typeof orig !== 'function' || orig._keepBanner) return;
    window._recoRenderPdfTally = function (isBm, sumDebit, sumCredit, stmtTotalDebit, stmtTotalCredit) {
      saveStmt({ out: stmtTotalDebit, in: stmtTotalCredit });
      var r = orig.apply(this, arguments);
      setTimeout(function () { pinBanner(); paint(); }, 40);
      return r;
    };
    window._recoRenderPdfTally._keepBanner = true;
  }
  function hookRender() {
    var orig = window._recoRenderResults;
    if (typeof orig !== 'function' || orig._keepBanner) return;
    window._recoRenderResults = function () {
      var r = orig.apply(this, arguments);
      setTimeout(paint, 30);
      return r;
    };
    window._recoRenderResults._keepBanner = true;
  }
  function hookClearBanner() {
    var orig = window._recoClearPdfTallyBanner;
    if (typeof orig !== 'function' || orig._keepBanner) return;
    window._recoClearPdfTallyBanner = function () {
      pinBanner();
      /* keep banner while reviewing / importing same scan */
    };
    window._recoClearPdfTallyBanner._keepBanner = true;
  }
  function hookClearSession() {
    var orig = window._recoClearSession;
    if (typeof orig !== 'function' || orig._keepBanner) return;
    window._recoClearSession = function () {
      pinnedHtml = '';
      try { sessionStorage.removeItem(KEY); } catch (e) {}
      return orig.apply(this, arguments);
    };
    window._recoClearSession._keepBanner = true;
  }
  function boot() {
    hookTally(); hookRender(); hookClearBanner(); hookClearSession();
    stripTextareaClear(); pinBanner(); paint();
  }
  boot();
  setTimeout(boot, 400);
})();
