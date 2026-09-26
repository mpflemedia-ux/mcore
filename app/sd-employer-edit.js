(function () {
  var STAT = ['epf_employee','epf_employer','socso_employee','socso_employer','eis_employee','eis_employer','pcb','zakat'];

  function val(id) {
    var el = document.getElementById(id);
    if (!el) return 0;
    if (el.value === '' || el.value == null) return 0;
    var n = Number(el.value);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }

  function setVal(id, n) {
    var el = document.getElementById(id);
    if (el) el.value = n == null ? '' : n;
  }

  function parseAmt(text, label) {
    var m = String(text || '').match(new RegExp(label + '[^0-9]*([0-9]+(?:\\.[0-9]+)?)', 'i'));
    return m ? Number(m[1]) : 0;
  }

  function killFab() {
    var fab = document.getElementById('sd-er-save-fab');
    if (fab && fab.parentNode) fab.parentNode.removeChild(fab);
  }

  function rowIds() {
    var ids = [];
    document.querySelectorAll('input[id^="sd-epf-"]:not([id*="-er-"])').forEach(function (el) {
      ids.push(String(el.id).replace('sd-epf-', ''));
    });
    return ids;
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

  function paintTotals() {
    var ids = rowIds();
    var epfEe = 0, epfEr = 0, socsoEe = 0, socsoEr = 0, eisEe = 0, eisEr = 0, pcb = 0, zakat = 0, net = 0;
    ids.forEach(function (id) {
      epfEe += val('sd-epf-' + id);
      epfEr += val('sd-epf-er-' + id);
      socsoEe += val('sd-socso-' + id);
      socsoEr += val('sd-socso-er-' + id);
      eisEe += val('sd-eis-' + id);
      eisEr += val('sd-eis-er-' + id);
      pcb += val('sd-pcb-' + id);
      zakat += val('sd-zakat-' + id);
      var netEl = document.getElementById('sd-net-' + id);
      if (netEl) {
        var n = Number(String(netEl.textContent || '').replace(/[^0-9.-]/g, ''));
        if (Number.isFinite(n)) net += n;
      }
    });
    var epf = epfEe + epfEr, socso = socsoEe + socsoEr, eis = eisEe + eisEr;
    var budget = net + epf + socso + eis + pcb + zakat;
    var fmt = typeof formatRM === 'function' ? formatRM : String;
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

  async function applyDbValues() {
    var ids = rowIds();
    if (!ids.length || !window.sb || !APP.tenant || !APP.tenant.id) return;
    var res = await sb.from('payroll_records')
      .select(STAT.concat(['id','net_pay']).join(','))
      .eq('tenant_id', APP.tenant.id)
      .in('id', ids);
    if (res.error || !res.data) return;
    res.data.forEach(function (row) {
      setVal('sd-epf-' + row.id, row.epf_employee);
      setVal('sd-socso-' + row.id, row.socso_employee);
      setVal('sd-eis-' + row.id, row.eis_employee);
      setVal('sd-pcb-' + row.id, row.pcb);
      setVal('sd-zakat-' + row.id, row.zakat);
      setVal('sd-epf-er-' + row.id, row.epf_employer);
      setVal('sd-socso-er-' + row.id, row.socso_employer);
      setVal('sd-eis-er-' + row.id, row.eis_employer);
    });
    if (typeof window._sdRecalc === 'function') window._sdRecalc();
    else paintTotals();
  }

  function wrapValues() {
    var orig = window._sdRowValues;
    if (typeof orig !== 'function' || orig._erEdit) return;
    window._sdRowValues = function (r) {
      var v = orig.call(this, r) || {};
      v.epf_employer = val('sd-epf-er-' + r.id);
      v.socso_employer = val('sd-socso-er-' + r.id);
      v.eis_employer = val('sd-eis-er-' + r.id);
      return v;
    };
    window._sdRowValues._erEdit = true;
  }

  function wrapRecalc() {
    var orig = window._sdRecalc;
    if (typeof orig !== 'function' || orig._erEdit6) return;
    window._sdRecalc = function () {
      orig.apply(this, arguments);
      inject();
      paintTotals();
    };
    window._sdRecalc._erEdit6 = true;
  }

  function wrapSave() {
    var orig = window._sdSaveAll;
    if (typeof orig !== 'function' || orig._erEdit6) return;
    window._sdSaveAll = async function () {
      wrapValues();
      await orig.apply(this, arguments);
    };
    window._sdSaveAll._erEdit6 = true;
  }

  function wrapRender() {
    var orig = window.renderSalaryDisbursement;
    if (typeof orig !== 'function' || orig._erEdit6) return;
    window.renderSalaryDisbursement = function () {
      var r = orig.apply(this, arguments);
      var go = function () {
        killFab(); wrapValues(); wrapRecalc(); wrapSave(); inject();
        applyDbValues().then(paintTotals);
      };
      if (r && typeof r.then === 'function') r.then(function () { setTimeout(go, 80); });
      else setTimeout(go, 80);
      return r;
    };
    window.renderSalaryDisbursement._erEdit6 = true;
  }

  killFab();
  wrapRender();
  wrapValues();
  wrapRecalc();
  wrapSave();
  setTimeout(wrapRender, 400);
  setTimeout(function () { killFab(); inject(); wrapSave(); paintTotals(); }, 600);
})();
