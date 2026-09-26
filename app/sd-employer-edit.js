(function () {
  function num(id, fallback) {
    if (typeof window._sdInputNum === 'function') return window._sdInputNum(id, fallback);
    var el = document.getElementById(id);
    if (!el || el.value === '' || el.value == null) return Number(fallback || 0);
    var n = Number(el.value);
    return isNaN(n) ? Number(fallback || 0) : n;
  }

  function inject() {
    var recs = window._sdRecords || [];
    var notes = document.querySelectorAll('.pdoc-sd-employer-note');
    if (!recs.length || !notes.length) return;
    var isBm = typeof APP !== 'undefined' && APP.language === 'bm';
    recs.forEach(function (r, i) {
      var el = notes[i];
      if (!el || el.getAttribute('data-er-edit') === '1') return;
      el.setAttribute('data-er-edit', '1');
      el.innerHTML =
        '<div class="pdoc-sd-line"><label>' + (isBm ? 'EPF Mjkn' : 'Er EPF') + '</label>' +
        '<input type="number" step="0.01" min="0" class="form-input no-print" id="sd-epf-er-' + r.id + '" value="' + Number(r.epf_employer || 0) + '" oninput="_sdRecalc()"></div>' +
        '<div class="pdoc-sd-line"><label>' + (isBm ? 'SOCSO Mjkn' : 'Er SOCSO') + '</label>' +
        '<input type="number" step="0.01" min="0" class="form-input no-print" id="sd-socso-er-' + r.id + '" value="' + Number(r.socso_employer || 0) + '" oninput="_sdRecalc()"></div>' +
        '<div class="pdoc-sd-line"><label>' + (isBm ? 'EIS Mjkn' : 'Er EIS') + '</label>' +
        '<input type="number" step="0.01" min="0" class="form-input no-print" id="sd-eis-er-' + r.id + '" value="' + Number(r.eis_employer || 0) + '" oninput="_sdRecalc()"></div>';
    });
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
      var recs = window._sdRecords || [];
      var sumEPF_er = 0, sumSOCSO_er = 0, sumEIS_er = 0, sumEPF_ee = 0, sumSOCSO_ee = 0, sumEIS_ee = 0, grand = 0, sumPCB = 0, sumZakat = 0;
      recs.forEach(function (r) {
        var v = window._sdRowValues(r);
        sumEPF_er += Number(v.epf_employer || 0);
        sumSOCSO_er += Number(v.socso_employer || 0);
        sumEIS_er += Number(v.eis_employer || 0);
        sumEPF_ee += Number(v.epf_employee || 0);
        sumSOCSO_ee += Number(v.socso_employee || 0);
        sumEIS_ee += Number(v.eis_employee || 0);
        sumPCB += Number(v.pcb || 0);
        sumZakat += Number(v.zakat || 0);
        grand += Number(v.net_pay || 0);
        if (typeof window._sdMarkAmended === 'function') {
          window._sdMarkAmended('sd-epf-er-' + r.id, r.epf_employer);
          window._sdMarkAmended('sd-socso-er-' + r.id, r.socso_employer);
          window._sdMarkAmended('sd-eis-er-' + r.id, r.eis_employer);
        }
      });
      var sumEmployer = sumEPF_er + sumSOCSO_er + sumEIS_er;
      var sumEPF = sumEPF_ee + sumEPF_er;
      var sumSOCSO = sumSOCSO_ee + sumSOCSO_er;
      var sumEIS = sumEIS_ee + sumEIS_er;
      var budget = grand + sumEPF + sumSOCSO + sumEIS + sumPCB + sumZakat;
      var fmt = typeof formatRM === 'function' ? formatRM : function (n) { return n; };
      var setTxt = function (id, txt) { var el = document.getElementById(id); if (el) el.textContent = txt; };
      var isBm = typeof APP !== 'undefined' && APP.language === 'bm';
      setTxt('sd-er-total', (isBm ? 'Majikan' : 'Employer') + ' · ' + fmt(sumEmployer));
      setTxt('sd-er-epf', fmt(sumEPF_er));
      setTxt('sd-er-socso', fmt(sumSOCSO_er));
      setTxt('sd-er-eis', fmt(sumEIS_er));
      setTxt('sd-summary-epf', fmt(sumEPF));
      setTxt('sd-summary-socso', fmt(sumSOCSO));
      setTxt('sd-summary-eis', fmt(sumEIS));
      setTxt('sd-grand-epf', fmt(sumEPF));
      setTxt('sd-grand-socso', fmt(sumSOCSO));
      setTxt('sd-grand-eis', fmt(sumEIS));
      setTxt('sd-summary-budget', fmt(budget));
      setTxt('sd-grand-budget', fmt(budget));
      setTxt('sd-budget-required', fmt(budget));
      setTxt('sd-budget-epf', fmt(sumEPF));
      setTxt('sd-budget-socso', fmt(sumSOCSO));
      setTxt('sd-budget-eis', fmt(sumEIS));
    };
    window._sdRecalc._erEdit = true;
  }

  function wrapRender() {
    var orig = window.renderSalaryDisbursement;
    if (typeof orig !== 'function' || orig._erEdit) return;
    window.renderSalaryDisbursement = function () {
      var r = orig.apply(this, arguments);
      var go = function () { wrapValues(); wrapRecalc(); inject(); };
      if (r && r.then) r.then(function () { setTimeout(go, 0); });
      else setTimeout(go, 0);
      return r;
    };
    window.renderSalaryDisbursement._erEdit = true;
  }

  wrapRender();
  wrapValues();
  wrapRecalc();
  setTimeout(wrapRender, 400);
  setTimeout(function () { inject(); }, 600);
})();
