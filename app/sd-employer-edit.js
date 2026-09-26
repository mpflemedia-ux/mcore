(function () {
  var KEYS = [
    'epf_employee', 'epf_employer', 'socso_employee', 'socso_employer',
    'eis_employee', 'eis_employer', 'pcb', 'zakat',
    'allowance_type_1', 'allowance_1', 'allowance_type_2', 'allowance_2',
    'allowance_type_3', 'allowance_3', 'advance',
    'deduction_type_1', 'deduction_1', 'deduction_type_2', 'deduction_2',
    'net_pay'
  ];

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

  function sumByPrefix(prefix, er) {
    var sel = er
      ? 'input[id^="' + prefix + '-er-"]'
      : 'input[id^="' + prefix + '-"]:not([id*="-er-"])';
    var t = 0;
    document.querySelectorAll(sel).forEach(function (el) {
      if (el.value === '' || el.value == null) return;
      var n = Number(el.value);
      if (Number.isFinite(n)) t += Math.max(0, n);
    });
    return t;
  }

  function paintTotals() {
    var epfEe = sumByPrefix('sd-epf', false);
    var epfEr = sumByPrefix('sd-epf', true);
    var socsoEe = sumByPrefix('sd-socso', false);
    var socsoEr = sumByPrefix('sd-socso', true);
    var eisEe = sumByPrefix('sd-eis', false);
    var eisEr = sumByPrefix('sd-eis', true);
    var pcb = 0, zakat = 0, net = 0;
    document.querySelectorAll('input[id^="sd-pcb-"]').forEach(function (el) {
      var n = Number(el.value); if (Number.isFinite(n)) pcb += Math.max(0, n);
    });
    document.querySelectorAll('input[id^="sd-zakat-"]').forEach(function (el) {
      var n = Number(el.value); if (Number.isFinite(n)) zakat += Math.max(0, n);
    });
    document.querySelectorAll('[id^="sd-net-"]').forEach(function (el) {
      var n = Number(String(el.textContent || '').replace(/[^0-9.-]/g, ''));
      if (Number.isFinite(n)) net += n;
    });
    var epf = epfEe + epfEr;
    var socso = socsoEe + socsoEr;
    var eis = eisEe + eisEr;
    var budget = net + epf + socso + eis + pcb + zakat;
    var fmt = typeof formatRM === 'function' ? formatRM : function (n) { return n; };
    var setTxt = function (id, txt) { var el = document.getElementById(id); if (el) el.textContent = txt; };
    var isBm = typeof APP !== 'undefined' && APP.language === 'bm';
    setTxt('sd-summary-epf', fmt(epf));
    setTxt('sd-grand-epf', fmt(epf));
    setTxt('sd-budget-epf', fmt(epf));
    setTxt('sd-summary-socso', fmt(socso));
    setTxt('sd-grand-socso', fmt(socso));
    setTxt('sd-budget-socso', fmt(socso));
    setTxt('sd-summary-eis', fmt(eis));
    setTxt('sd-grand-eis', fmt(eis));
    setTxt('sd-budget-eis', fmt(eis));
    setTxt('sd-summary-pcb', fmt(pcb));
    setTxt('sd-grand-pcb', fmt(pcb));
    setTxt('sd-budget-pcb', fmt(pcb));
    setTxt('sd-summary-zakat', fmt(zakat));
    setTxt('sd-grand-zakat', fmt(zakat));
    setTxt('sd-er-epf', fmt(epfEr));
    setTxt('sd-er-socso', fmt(socsoEr));
    setTxt('sd-er-eis', fmt(eisEr));
    setTxt('sd-er-total', (isBm ? 'Majikan' : 'Employer') + ' \u00b7 ' + fmt(epfEr + socsoEr + eisEr));
    setTxt('sd-summary-budget', fmt(budget));
    setTxt('sd-grand-budget', fmt(budget));
    setTxt('sd-budget-required', fmt(budget));
    setTxt('sd-sum-stat', fmt(epfEe + socsoEe + eisEe + pcb + zakat));
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
    if (typeof orig !== 'function' || orig._erEdit3) return;
    window._sdRecalc = function () {
      orig.apply(this, arguments);
      inject();
      paintTotals();
    };
    window._sdRecalc._erEdit3 = true;
  }

  function wrapSave() {
    var orig = window._sdSaveAll;
    if (typeof orig !== 'function' || orig._erEdit3) return;
    window._sdSaveAll = async function () {
      var isBm = typeof APP !== 'undefined' && APP.language === 'bm';
      if (!window.sb || !APP.tenant || !APP.tenant.id) {
        showToast(isBm ? 'Tiada tenant' : 'No tenant', 'error');
        return;
      }
      wrapValues();
      var rows = document.querySelectorAll('input[id^="sd-epf-"]:not([id*="-er-"])');
      var ok = 0, fail = 0, lastErr = '';
      for (var i = 0; i < rows.length; i++) {
        var id = String(rows[i].id).replace('sd-epf-', '');
        var raw = typeof window._sdRowValues === 'function' ? window._sdRowValues({ id: id }) : {};
        var payload = {};
        KEYS.forEach(function (k) {
          if (raw[k] !== undefined) payload[k] = raw[k];
        });
        var res = await sb.from('payroll_records').update(payload).eq('id', id).eq('tenant_id', APP.tenant.id).select('id');
        if (res.error) {
          fail++;
          lastErr = res.error.message || String(res.error);
        } else ok++;
      }
      var box = document.getElementById('sd-save-result');
      if (fail) {
        if (box) box.innerHTML = '<span style="color:var(--danger)">' + fail + ' fail: ' + lastErr + '</span>';
        showToast((isBm ? 'Save gagal: ' : 'Save failed: ') + lastErr, 'error');
      } else {
        if (box) box.innerHTML = '<span style="color:var(--success)">' + ok + (isBm ? ' rekod disimpan' : ' saved') + '</span>';
        showToast(isBm ? 'Penyaluran gaji disimpan' : 'Salary disbursement saved', 'success');
      }
    };
    window._sdSaveAll._erEdit3 = true;
  }

  function wrapRender() {
    var orig = window.renderSalaryDisbursement;
    if (typeof orig !== 'function' || orig._erEdit3) return;
    window.renderSalaryDisbursement = function () {
      var r = orig.apply(this, arguments);
      var go = function () { killFab(); wrapValues(); wrapRecalc(); wrapSave(); inject(); paintTotals(); };
      if (r && typeof r.then === 'function') r.then(function () { setTimeout(go, 50); setTimeout(go, 400); });
      else { setTimeout(go, 50); setTimeout(go, 400); }
      return r;
    };
    window.renderSalaryDisbursement._erEdit3 = true;
  }

  killFab();
  wrapRender();
  wrapValues();
  wrapRecalc();
  wrapSave();
  setTimeout(wrapRender, 400);
  setTimeout(function () { killFab(); inject(); paintTotals(); wrapSave(); }, 600);
})();
