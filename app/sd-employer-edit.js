(function () {
  function liveNum(id) {
    var el = document.getElementById(id);
    if (!el) return null;
    if (el.value === '' || el.value == null) return 0;
    var n = Number(el.value);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }

  function parseAmt(text, label) {
    var m = String(text || '').match(new RegExp(label + '[^0-9]*([0-9]+(?:\\.[0-9]+)?)', 'i'));
    return m ? Number(m[1]) : 0;
  }

  function killFab() {
    var fab = document.getElementById('sd-er-save-fab');
    if (fab && fab.parentNode) fab.parentNode.removeChild(fab);
  }

  function inject() {
    killFab();
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
      el.setAttribute('data-er-edit', '1');
      el.innerHTML =
        '<div class="pdoc-sd-line"><label>' + (isBm ? 'EPF Mjkn' : 'Er EPF') + '</label>' +
        '<input type="number" step="0.01" min="0" class="form-input no-print" id="sd-epf-er-' + id + '" value="' + parseAmt(src, 'EPF') + '" oninput="_sdRecalc()"></div>' +
        '<div class="pdoc-sd-line"><label>' + (isBm ? 'SOCSO Mjkn' : 'Er SOCSO') + '</label>' +
        '<input type="number" step="0.01" min="0" class="form-input no-print" id="sd-socso-er-' + id + '" value="' + parseAmt(src, 'SOCSO') + '" oninput="_sdRecalc()"></div>' +
        '<div class="pdoc-sd-line"><label>' + (isBm ? 'EIS Mjkn' : 'Er EIS') + '</label>' +
        '<input type="number" step="0.01" min="0" class="form-input no-print" id="sd-eis-er-' + id + '" value="' + parseAmt(src, 'EIS') + '" oninput="_sdRecalc()"></div>';
    });
  }

  function wrapValues() {
    var orig = window._sdRowValues;
    if (typeof orig !== 'function' || orig._erEdit) return;
    window._sdRowValues = function (r) {
      var v = orig.call(this, r) || {};
      var epfEr = liveNum('sd-epf-er-' + r.id);
      var socsoEr = liveNum('sd-socso-er-' + r.id);
      var eisEr = liveNum('sd-eis-er-' + r.id);
      if (epfEr !== null) v.epf_employer = epfEr;
      if (socsoEr !== null) v.socso_employer = socsoEr;
      if (eisEr !== null) v.eis_employer = eisEr;
      return v;
    };
    window._sdRowValues._erEdit = true;
  }

  function wrapRecalc() {
    var orig = window._sdRecalc;
    if (typeof orig !== 'function' || orig._erEdit5) return;
    window._sdRecalc = function () {
      orig.apply(this, arguments);
      inject();
    };
    window._sdRecalc._erEdit5 = true;
  }

  function wrapSave() {
    var orig = window._sdSaveAll;
    if (typeof orig !== 'function' || orig._erEdit5) return;
    window._sdSaveAll = async function () {
      wrapValues();
      var isBm = typeof APP !== 'undefined' && APP.language === 'bm';
      try {
        await orig.apply(this, arguments);
      } catch (e) {
        showToast((isBm ? 'Save gagal: ' : 'Save failed: ') + (e.message || e), 'error');
      }
    };
    window._sdSaveAll._erEdit5 = true;
  }

  function wrapRender() {
    var orig = window.renderSalaryDisbursement;
    if (typeof orig !== 'function' || orig._erEdit5) return;
    window.renderSalaryDisbursement = function () {
      var r = orig.apply(this, arguments);
      var go = function () { killFab(); wrapValues(); wrapRecalc(); wrapSave(); inject(); };
      if (r && typeof r.then === 'function') r.then(function () { setTimeout(go, 50); setTimeout(go, 400); });
      else { setTimeout(go, 50); setTimeout(go, 400); }
      return r;
    };
    window.renderSalaryDisbursement._erEdit5 = true;
  }

  killFab();
  wrapRender();
  wrapValues();
  wrapRecalc();
  wrapSave();
  setTimeout(wrapRender, 400);
  setTimeout(function () { killFab(); inject(); wrapSave(); }, 600);
})();
