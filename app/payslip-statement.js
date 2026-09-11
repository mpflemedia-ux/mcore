/* Salary-statement payslip. Landscape print, centered. Empty fields stay empty. */
(function () {
  function esc(s) {
    if (typeof _aiEscapeHtml === 'function') return _aiEscapeHtml(s);
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function dash(v) {
    v = String(v == null ? '' : v).trim();
    return v || '';
  }
  function amt(n) {
    if (n == null || n === '' || isNaN(Number(n))) return '';
    var s = (typeof formatRM === 'function') ? formatRM(n) : Number(n).toFixed(2);
    return String(s).replace(/^RM\s*/i, '').trim();
  }
  function monthLbl(rec) {
    var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    var m = Number(rec.month);
    var y = String(rec.year || '');
    var name = (m >= 1 && m <= 12) ? months[m - 1] : '';
    return (name + ' ' + y.slice(-2)).trim();
  }
  function kv(label, value, extra) {
    var v = dash(value);
    return '<div class="ps-kv' + (extra ? ' ' + extra : '') + '"><span class="ps-k">' + esc(label) + '</span><span class="ps-c">:</span><span class="ps-v">' + esc(v) + '</span></div>';
  }
  var st = document.getElementById('ps-stmt-css');
  if (!st) { st = document.createElement('style'); st.id = 'ps-stmt-css'; document.head.appendChild(st); }
  st.textContent =
    '@page{size:A4 landscape;margin:10mm}' +
    '.ps-stmt{width:100%;max-width:1100px!important;margin:0 auto 24px!important;background:#fff;color:#111;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.4;box-sizing:border-box}' +
    '.ps-stmt .ps-top{display:flex;justify-content:space-between;font-size:12px;font-weight:700}' +
    '.ps-stmt .ps-co{text-align:center;font-size:20px;font-weight:800;letter-spacing:.08em;margin:8px 0 14px;text-transform:uppercase}' +
    '.ps-stmt .ps-meta{display:grid;grid-template-columns:1.6fr 1.1fr 1.2fr;gap:4px 24px;align-items:start}' +
    '.ps-stmt .ps-kv{display:grid;grid-template-columns:auto 8px minmax(0,1fr);gap:6px;align-items:baseline}' +
    '.ps-stmt .ps-k{white-space:nowrap}' +
    '.ps-stmt .ps-v{font-weight:400}' +
    '.ps-stmt .ps-name .ps-v{white-space:nowrap}' +
    '.ps-stmt .ps-rule{border:0;border-top:1.4px solid #111;margin:12px 0}' +
    '.ps-stmt .ps-cols{display:grid;grid-template-columns:1fr 1fr;gap:0 48px;min-height:160px}' +
    '.ps-stmt .ps-h{display:flex;justify-content:space-between;font-weight:700;margin-bottom:8px}' +
    '.ps-stmt .ps-tbl{width:100%;border-collapse:collapse}' +
    '.ps-stmt .ps-tbl td{padding:3px 0;vertical-align:top}' +
    '.ps-stmt .ps-tbl td:last-child{text-align:right;white-space:nowrap;padding-left:16px}' +
    '.ps-stmt .ps-tot td{font-weight:700;padding-top:10px}' +
    '.ps-stmt .ps-foot{display:grid;grid-template-columns:1fr 1.4fr;gap:8px 36px}' +
    '.ps-stmt .ps-foot h4{margin:0 0 8px;font-size:12px;font-weight:700}' +
    '.ps-stmt .ps-pay{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;margin-top:10px}' +
    '@media print{' +
      'html,body{width:100%!important;background:#fff!important}' +
      '.ps-stmt{max-width:none!important;width:100%!important;margin:0 auto!important;padding:8px 16px!important}' +
      '#shell .sidebar,#shell .topbar,.fab-stack,nav,header,.no-print{display:none!important}' +
    '}';
  window._pdocPayslipHtml = function (rec, tn, t, isBm) {
    t = t || {};
    var earnRows = [{ label: isBm ? 'Gaji Pokok' : 'Basic Salary', amount: rec.basic_salary }];
    try {
      [[rec.allowance_type_1, rec.allowance_1], [rec.allowance_type_2, rec.allowance_2], [rec.allowance_type_3, rec.allowance_3]].forEach(function (pair) {
        if (Number(pair[1]) > 0) {
          var lab = (typeof _sdTypeLabel === 'function' && typeof SD_ALLOWANCE_TYPES !== 'undefined')
            ? _sdTypeLabel(SD_ALLOWANCE_TYPES, pair[0]) : String(pair[0] || '');
          if (lab) earnRows.push({ label: lab, amount: pair[1] });
        }
      });
    } catch (e) {}
    if (Number(rec.commission) > 0) earnRows.push({ label: isBm ? 'Komisen' : 'Commission', amount: rec.commission });
    var totalEarnings = Number(rec.basic_salary || 0) + Number(rec.allowance_1 || 0) + Number(rec.allowance_2 || 0) + Number(rec.allowance_3 || 0) + Number(rec.commission || 0);
    var dedRows = [];
    if (Number(rec.epf_employee) > 0) dedRows.push({ label: isBm ? 'KWSP (Pekerja)' : 'Employee EPF (KWSP)', amount: rec.epf_employee });
    if (Number(rec.socso_employee) > 0) dedRows.push({ label: isBm ? 'SOCSO (Pekerja)' : 'Employee SOCSO (PERKESO)', amount: rec.socso_employee });
    if (Number(rec.eis_employee) > 0) dedRows.push({ label: isBm ? 'EIS (Pekerja)' : 'Employee EIS (SIP)', amount: rec.eis_employee });
    if (Number(rec.pcb) > 0) dedRows.push({ label: t.pcb || 'PCB', amount: rec.pcb });
    if (Number(rec.zakat) > 0) dedRows.push({ label: 'Zakat (PZB)', amount: rec.zakat });
    if (Number(rec.advance) > 0) dedRows.push({ label: t.advance || (isBm ? 'Pendahuluan' : 'Advanced'), amount: rec.advance });
    try {
      [[rec.deduction_type_1, rec.deduction_1], [rec.deduction_type_2, rec.deduction_2]].forEach(function (pair) {
        if (Number(pair[1]) > 0) {
          var lab = (typeof _sdTypeLabel === 'function' && typeof SD_DEDUCTION_TYPES !== 'undefined')
            ? _sdTypeLabel(SD_DEDUCTION_TYPES, pair[0]) : String(pair[0] || '');
          if (lab) dedRows.push({ label: lab, amount: pair[1] });
        }
      });
    } catch (e) {}
    var totalDeductions = dedRows.reduce(function (s, r) { return s + Number(r.amount || 0); }, 0);
    var emp = rec.employees || {};
    var co = (tn && (tn.name || tn.company_name)) || (window.APP && APP.tenant && APP.tenant.name) || '';
    var ic = dash(emp.ic_no);
    var empNo = dash(emp.staff_no || emp.employee_no || emp.code);
    var area = dash(emp.work_location || emp.branch || emp.location);
    var bankName = dash(emp.bank_name);
    var bankAcc = dash(emp.bank_account_no);
    function rows(list) {
      return list.map(function (r) {
        return '<tr><td>' + esc(r.label) + '</td><td>' + amt(r.amount) + '</td></tr>';
      }).join('');
    }
    return (
      '<div class="pdoc ps-stmt" style="--pdoc-accent:#111;page-break-inside:avoid">' +
      '<div class="ps-top"><div>' + (isBm ? 'Penyata Gaji' : 'Salary Statement') + '</div><div>' + (isBm ? 'SULIT' : 'PRIVATE &amp; CONFIDENTIAL') + '</div></div>' +
      '<div class="ps-co">' + esc(co) + '</div>' +
      '<div class="ps-meta">' +
        kv(isBm ? 'Nama Pekerja' : 'Employee Name', emp.name, 'ps-name') +
        '<div>' + kv(isBm ? 'No. Pekerja' : 'Employee Number', empNo) + kv(isBm ? 'Lokasi' : 'Pers Subarea', area) + '</div>' +
        '<div>' + kv(isBm ? 'No. KP / Pasport' : 'Identity Card/Passport', ic) + kv(isBm ? 'Bulan' : 'Month', monthLbl(rec)) + '</div>' +
      '</div>' +
      '<hr class="ps-rule">' +
      '<div class="ps-cols">' +
        '<div><div class="ps-h"><span>' + (isBm ? 'Gaji &amp; Elaun' : 'Salary &amp; Allowance') + '</span><span>' + (isBm ? 'Jumlah (RM)' : 'Total (RM)') + '</span></div>' +
          '<table class="ps-tbl"><tbody>' + rows(earnRows) +
          '<tr class="ps-tot"><td>' + (isBm ? 'Jumlah Pendapatan' : 'Total Income') + '</td><td>' + amt(totalEarnings) + '</td></tr>' +
          '</tbody></table></div>' +
        '<div><div class="ps-h"><span>' + (isBm ? 'Potongan' : 'Deductions') + '</span><span>' + (isBm ? 'Jumlah (RM)' : 'Total (RM)') + '</span></div>' +
          '<table class="ps-tbl"><tbody>' + rows(dedRows) +
          '<tr class="ps-tot"><td>' + (isBm ? 'Jumlah Potongan' : 'Total Deduction') + '</td><td>' + amt(totalDeductions) + '</td></tr>' +
          '</tbody></table></div>' +
      '</div>' +
      '<hr class="ps-rule">' +
      '<div class="ps-foot">' +
        '<div><h4>' + (isBm ? 'Caruman Majikan' : 'Employer Contribution') + '</h4>' +
          '<table class="ps-tbl"><tbody>' +
          '<tr><td>' + (isBm ? 'KWSP (Majikan)' : 'Employer EPF (KWSP)') + '</td><td>' + amt(rec.epf_employer || 0) + '</td></tr>' +
          '<tr><td>' + (isBm ? 'SOCSO (Majikan)' : 'Employer SOCSO (PERKESO)') + '</td><td>' + amt(rec.socso_employer || 0) + '</td></tr>' +
          '<tr><td>' + (isBm ? 'EIS (Majikan)' : 'Employer EIS (SIP)') + '</td><td>' + amt(rec.eis_employer || 0) + '</td></tr>' +
          '</tbody></table></div>' +
        '<div><h4>' + (isBm ? 'Butiran Bayaran' : 'Details of Payment') + '</h4>' +
          '<div>' + (isBm ? 'Jumlah dikredit ke akaun bank' : 'Amount credited to Bank Account') + '</div>' +
          '<div class="ps-pay"><span>' + esc([bankName, bankAcc].filter(Boolean).join('  -  ')) + '</span><b>' + amt(rec.net_pay) + '</b></div>' +
        '</div>' +
      '</div>' +
      '</div>'
    );
  };
})();
