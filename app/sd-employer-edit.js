(function () {
  function num(id, fallback) {
    if (typeof window._sdInputNum === 'function') return window._sdInputNum(id, fallback);
    var el = document.getElementById(id);
    if (!el || el.value === '' || el.value == null) return Number(fallback || 0);
    var n = Number(el.value);
    return isNaN(n) ? Number(fallback || 0) : n;
  }

  function parseAmt(text, label) {
    var re = new RegExp(label + '[^0-9]*([0-9]+(?:\.[0-9]+)?)', 'i');
    var m = String(text || '').match(re);
    return m ? Number(m[1]) : 0;
  }

  function inject() {
    var notes = document.querySelectorAll('.pdoc-sd-employer-note');
    if (!notes.length) return;
    var isBm = typeof APP !== 'undefined' && APP.language === 'bm';
    notes.forEach(function (el) {
      if (!el || el.getAttribute('data-er-edit') === '1') return;
      var wrap = el.closest('td') || el.parentElement;
      var epfInp = wrap && wrap.querySelector('input[id^="sd-epf-"]:not([id*="-er-"])');
      var id = epfInp && String(epfInp.id).replace('sd-epf-', '');
      if (!id) return;
      var src = el.textContent || '';
      var epfEr = parseAmt(src, 'EPF');
      var socsoEr = parseAmt(src, 'SOCSO');
      var eisEr = parseAmt(src, 'EIS');
      el.setAttribute('data-er-edit', '1');
      el.innerHTML =
        '<div class="pdoc-sd-line"><label>' + (isBm ? 'EPF Mjkn' : 'Er EPF') + '</label>' +
        '<input type="number" step="0.01" min="0" class="form-input no-print" id="sd-epf-er-' + id + '" value="' + epfEr + '" oninput="_sdRecalc()"></div>' +
        '<div class="pdoc-sd-line"><label>' + (isBm ? 'SOCSO Mjkn' : 'Er SOCSO') + '</label>' +
        '<input type="number" step="0.01" min="0" class="form-input no-print" id="sd-socso-er-' + id + '" value="' + socsoEr + '" oninput="_sdRecalc()"></div>' +
        '<div class="pdoc-sd-line"><label>' + (isBm ? 'EIS Mjkn' : 'Er EIS') + '</label>' +
        '<input type="number" step="0.01" min="0" class="form-input no-print" id="sd-eis-er-' + id + '" value="' + eisEr + '" oninput="_sdRecalc()"></div>';
    });
    wrapValues();
    wrapRecalc();
  }

  function wrapValues() {
    var orig = window._sdRowValues;
    if (typeof orig !== 'function' || orig._erEdit) return;
    window._sdRowValues = function (r) {
      var v = orig.call(this, r) || {};
      v.epf_employer = num('sd-epf-er-' + r.id, r.epf_employer);
      v.socso_employer = num('sd-socso-er-' + r.id, r.socso_employer);
      v.eis_employer = num('sd-eis-er-' + r.id, r.eis_employer);
      return v;
    };
    window._sdRowValues._erEdit = true;
  }

  function wrapRecalc() {
    var orig = window._sdRecalc;
    if (typeof orig !== 'function' || orig._erEdit) return;
    window._sdRecalc = function () {
      orig.apply(this, arguments);
      inject();
    };
    window._sdRecalc._erEdit = true;
  }

  function wrapRender() {
    var orig = window.renderSalaryDisbursement;
    if (typeof orig !== 'function' || orig._erEdit) return;
    window.renderSalaryDisbursement = function () {
      var r = orig.apply(this, arguments);
      var go = function () { wrapValues(); wrapRecalc(); inject(); };
      if (r && typeof r.then === 'function') r.then(function () { setTimeout(go, 50); setTimeout(go, 400); });
      else { setTimeout(go, 50); setTimeout(go, 400); }
      return r;
    };
    window.renderSalaryDisbursement._erEdit = true;
  }

  wrapRender();
  wrapValues();
  wrapRecalc();
  setTimeout(wrapRender, 400);
  setTimeout(inject, 200);
  setTimeout(inject, 800);
  setTimeout(inject, 1600);
  document.addEventListener('click', function () { setTimeout(inject, 300); });
})();
