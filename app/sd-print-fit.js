(function () {
  function css() {
    var old = document.getElementById('sd-print-fit-css');
    if (old) old.remove();
    var s = document.createElement('style');
    s.id = 'sd-print-fit-css';
    s.textContent =
      '@media print{' +
      '@page{size:A4 portrait;margin:8mm;}' +
      'html,body{width:auto!important;height:auto!important;min-height:0!important;' +
        'overflow:visible!important;background:#fff!important;}' +
      '#app,#shell,#shell.active,#main-area,#main{' +
        'height:auto!important;max-height:none!important;min-height:0!important;' +
        'overflow:visible!important;position:static!important;display:block!important;}' +
      '#support-tenant-banner,.support-banner,#sd-er-save-fab,.no-print,' +
      '.fab-home,.fab-up,.chat-fab{display:none!important;}' +
      '.pdoc,.pdoc-sd-chunk,.pdoc-sd-closing{' +
        'width:194mm!important;max-width:194mm!important;margin:0 auto!important;' +
        'box-shadow:none!important;border:none!important;overflow:visible!important;' +
        'height:auto!important;max-height:none!important;min-height:0!important;}' +
      '.pdoc-header{padding:4px 6px!important;}' +
      '.pdoc-title-bar{padding:3px 6px!important;font-size:10px!important;}' +
      '.pdoc-sd-meta,.pdoc-sd-summary{padding:2px 6px!important;font-size:7.5px!important;}' +
      '.pdoc-sd-scroll{overflow:visible!important;height:auto!important;max-height:none!important;}' +
      '.pdoc-sd-chunk-break{page-break-after:auto!important;break-after:auto!important;}' +
      '.pdoc-sd-chunk{display:block!important;page-break-inside:auto!important;}' +
      /* Drop screen syncCols px so print uses % below (~194mm usable) */
      '.pdoc-sd-table{width:100%!important;max-width:100%!important;min-width:0!important;' +
        'table-layout:fixed!important;font-size:7px!important;border-collapse:collapse!important;}' +
      '.pdoc-sd-table th,.pdoc-sd-table td{' +
        'padding:2px 2px!important;font-size:7px!important;line-height:1.2!important;' +
        'white-space:normal!important;word-break:break-word!important;overflow:visible!important;' +
        'vertical-align:top!important;min-width:0!important;max-width:none!important;}' +
      /* Content-biased print cols: shrink NO/Bank/Account; room for Payee/Allow/Stat/Ded/Net */
      '.pdoc-sd-table th:nth-child(1),.pdoc-sd-table td:nth-child(1){width:3%!important;}' +
      '.pdoc-sd-table th:nth-child(2),.pdoc-sd-table td:nth-child(2){width:16%!important;}' +
      '.pdoc-sd-table th:nth-child(3),.pdoc-sd-table td:nth-child(3){width:8%!important;}' +
      '.pdoc-sd-table th:nth-child(4),.pdoc-sd-table td:nth-child(4){width:9%!important;}' +
      '.pdoc-sd-table th:nth-child(5),.pdoc-sd-table td:nth-child(5){width:8%!important;}' +
      '.pdoc-sd-table th:nth-child(6),.pdoc-sd-table td:nth-child(6){width:18%!important;}' +
      '.pdoc-sd-table th:nth-child(7),.pdoc-sd-table td:nth-child(7){width:17%!important;}' +
      '.pdoc-sd-table th:nth-child(8),.pdoc-sd-table td:nth-child(8){width:12%!important;}' +
      '.pdoc-sd-table th:nth-child(9),.pdoc-sd-table td:nth-child(9){width:9%!important;}' +
      '.pdoc-sd-table tr{page-break-inside:auto!important;break-inside:auto!important;}' +
      '.pdoc-sd-table thead{display:table-header-group!important;}' +
      '.pdoc-sd-payee{font-size:7.5px!important;white-space:normal!important;line-height:1.2!important;}' +
      '.pdoc-sd-bank{font-size:6.5px!important;}' +
      '.pdoc-sd-basic,.pdoc-sd-net{font-size:7.5px!important;white-space:nowrap!important;}' +
      '.pdoc-sd-stack{gap:1px!important;}' +
      '.pdoc-sd-line{gap:2px!important;flex-wrap:nowrap!important;}' +
      '.pdoc-sd-line label{min-width:28px!important;font-size:6.5px!important;}' +
      '.pdoc-sd-print-line{font-size:6.5px!important;line-height:1.15!important;}' +
      '.pdoc-sd-print-dense{display:block!important;font-size:6.5px!important;line-height:1.2!important;color:#334155!important;}' +
      '.pdoc-sd-print-dense strong{color:#0F172A!important;}' +
      '.pdoc-sd-employer-note,.pdoc-sd-employer-print{display:block!important;font-size:6px!important;line-height:1.15!important;margin-top:1px!important;padding-top:1px!important;}' +
      '.pdoc-sd-line-print-hide{display:none!important;}' +
      '.pdoc-sd-line .form-select,.pdoc-sd-line .form-input,.pdoc-sd-er-edit{display:none!important;}' +
      '.pdoc-sd-sum-table{width:100%!important;table-layout:fixed!important;font-size:7px!important;}' +
      '.pdoc-sd-sum-table th,.pdoc-sd-sum-table td{padding:2px 3px!important;font-size:7px!important;}' +
      '.pdoc-sd-closing{page-break-before:auto!important;break-before:auto!important;}' +
      '.pdoc-sd-sig-print,.pdoc-sig-print-table{font-size:7px!important;margin-top:4px!important;}' +
      '}';
    document.head.appendChild(s);
  }

  /** Clear syncCols screen px from .pdoc-sd-table so print % CSS wins. */
  function stripInlineColWidths() {
    document.querySelectorAll('.pdoc-sd-table').forEach(function (table) {
      table.style.width = '';
      table.style.minWidth = '';
      table.style.maxWidth = '';
      table.querySelectorAll('th,td').forEach(function (cell) {
        cell.style.width = '';
        cell.style.minWidth = '';
        cell.style.maxWidth = '';
      });
    });
  }

  function isEmptyPrintText(t) {
    t = String(t || '').replace(/\u00a0/g, ' ').trim();
    return !t || t === '-' || t === '\u2014' || t === '0' || t === '0.00' || t === 'RM0.00' || t === 'RM 0.00';
  }

  function hideEmptyLines() {
    document.querySelectorAll('.pdoc-sd-table .pdoc-sd-line').forEach(function (line) {
      if (line.classList.contains('no-print')) return;
      var span = line.querySelector('.pdoc-sd-print-line, .pdoc-sd-print-dense');
      var label = line.querySelector('label');
      var empty;
      if (span) empty = isEmptyPrintText(span.textContent) && !(span.innerHTML || '').replace(/<[^>]+>/g, '').trim();
      else empty = true;
      if (span && !empty) empty = isEmptyPrintText((span.textContent || '').trim());
      line.classList.toggle('pdoc-sd-line-print-hide', !!empty);
      if (label) label.classList.toggle('no-print', !!empty);
    });
  }

  function refreshDense() {
    if (!window._sdRecords || !Array.isArray(window._sdRecords)) return;
    var getV = typeof window._sdRowValues === 'function' ? window._sdRowValues : null;
    var allowLine = function (type, amt) {
      if (!(Number(amt) > 0)) return '';
      if (typeof window._sdPrintType === 'function' && typeof window._sdPrintAmt === 'function') {
        return window._sdPrintType(window.SD_ALLOWANCE_TYPES || [], type, amt) + ': <strong>' + window._sdPrintAmt(amt) + '</strong>';
      }
      return String(amt);
    };
    var dedLine = function (type, amt) {
      if (!(Number(amt) > 0)) return '';
      if (typeof window._sdPrintType === 'function' && typeof window._sdPrintAmt === 'function') {
        return window._sdPrintType(window.SD_DEDUCTION_TYPES || [], type, amt) + ': <strong>' + window._sdPrintAmt(amt) + '</strong>';
      }
      return String(amt);
    };
    var amt = function (n) {
      return typeof window._sdPrintAmt === 'function' ? window._sdPrintAmt(n) : (Number(n) > 0 ? String(n) : '-');
    };
    window._sdRecords.forEach(function (r) {
      var v = getV ? getV(r) : r;
      var parts = [];
      var a1 = allowLine(v.allowance_type_1, v.allowance_1);
      var a2 = allowLine(v.allowance_type_2, v.allowance_2);
      var a3 = allowLine(v.allowance_type_3, v.allowance_3);
      if (a1) parts.push(a1);
      if (a2) parts.push(a2);
      if (a3) parts.push(a3);
      if (Number(v.commission || r.commission || 0) > 0) {
        parts.push('Commission: <strong>' + amt(v.commission || r.commission) + '</strong>');
      }
      var allowEl = document.getElementById('sd-print-allow-dense-' + r.id);
      if (allowEl) allowEl.innerHTML = parts.join(' \u00b7 ');

      var stat = [];
      [['EPF', v.epf_employee], ['SOCSO', v.socso_employee], ['EIS', v.eis_employee], ['PCB', v.pcb], ['Zakat', v.zakat]].forEach(function (pair) {
        if (Number(pair[1]) > 0) stat.push(pair[0] + ' <strong>' + amt(pair[1]) + '</strong>');
      });
      var statEl = document.getElementById('sd-print-stat-dense-' + r.id);
      if (statEl) statEl.innerHTML = stat.join(' \u00b7 ');

      var ded = [];
      if (Number(v.advance) > 0) ded.push('Adv. <strong>' + amt(v.advance) + '</strong>');
      var d1 = dedLine(v.deduction_type_1, v.deduction_1);
      var d2 = dedLine(v.deduction_type_2, v.deduction_2);
      if (d1) ded.push(d1);
      if (d2) ded.push(d2);
      var dedEl = document.getElementById('sd-print-ded-dense-' + r.id);
      if (dedEl) dedEl.innerHTML = ded.join(' \u00b7 ');
    });
  }

  function forcePortrait() {
    if (typeof window._pdocSetPageOrientation === 'function') {
      window._pdocSetPageOrientation('portrait', 8);
    }
    stripInlineColWidths();
    css();
    refreshDense();
    hideEmptyLines();
  }

  function wrapPrep() {
    var orig = window._sdPreparePrint;
    if (typeof orig !== 'function' || orig._a4p) return;
    window._sdPreparePrint = function () {
      var r = orig.apply(this, arguments);
      forcePortrait();
      return r;
    };
    window._sdPreparePrint._a4p = true;
  }

  function wrapOrient() {
    var orig = window._pdocSetPageOrientation;
    if (typeof orig !== 'function' || orig._sdA4p) return;
    window._pdocSetPageOrientation = function (orientation, mm) {
      if (document.querySelector('.pdoc-sd-table')) {
        return orig.call(this, 'portrait', mm != null ? mm : 8);
      }
      return orig.apply(this, arguments);
    };
    window._pdocSetPageOrientation._sdA4p = true;
  }

  css();
  wrapPrep();
  wrapOrient();
  setTimeout(function () { wrapPrep(); wrapOrient(); css(); }, 500);
})();
