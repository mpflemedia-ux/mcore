/* Salary-statement payslip. Only real employee/payroll fields. Empty stays empty. */
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
  function kv(label, value) {
    var v = dash(value);
    return '<div class="ps-kv"><span class="ps-k">' + esc(label) + '</span><span class="ps-c">:</span><span class="ps-v">' + esc(v) + '</span></div>';
  }
  if (!document.getElementById('ps-stmt-css')) {
    var st = document.createElement('style');
    st.id = 'ps-stmt-css';
    st.textContent =
      '.ps-stmt{max-width:980px!important;background:#fff;color:#111;font-family:Arial,Helvetica,sans-serif;font-size:11.5px;line-height:1.35}' +
      '.ps-stmt .ps-top{display:flex;justify-content:space-between;font-size:12px;font-weight:700}' +
      '.ps-stmt .ps-co{text-align:center;font-size:18px;font-weight:800;letter-spacing:.06em;margin:10px 0 16px;text-transform:uppercase}' +
      '.ps-stmt .ps-meta{display:grid;grid-template-columns:1.4fr 1.1fr 1.2fr;gap:2px 18px;align-items:start}' +
      '.ps-stmt .ps-kv{display:grid;grid-template-columns:auto 8px 1fr;gap:4px;align-items:start}' +
      '.ps-stmt .ps-k{white-space:nowrap}' +
      '.ps-stmt .ps-v{font-weight:400}' +
      '.ps-stmt .ps-rule{border:0;border-top:1.4px solid #111;margin:12px 0}' +
      '.ps-stmt .ps-cols{display:grid;grid-template-columns:1fr 1fr;gap:0 36px;min-height:220px}' +
      '.ps-stmt .ps-h{display:flex;justify-content:space-between;font-size:11.5px;font-weight:700;margin-bottom:8px}' +
      '.ps-stmt .ps-tbl{width:100%;border-collapse:collapse;font-size:11.5px}' +
      '.ps-stmt .ps-tbl td{padding:3px 0;vertical-align:top}' +
      '.ps-stmt .ps-tbl td:last-child{text-align:right;white-space:nowrap;padding-left:16px}' +
      '.ps-stmt .ps-tot td{font-weight:700;padding-top:10px}' +
      '.ps-stmt .ps-foot{display:grid;grid-template-columns:1fr 1.5fr;gap:8px 28px;padding-top:4px}' +
      '.ps-stmt .ps-foot h4{margin:0 0 8px;font-size:11.5px;font-weight:700}' +
      '.ps-stmt .ps-pay{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;margin-top:10px}' +
      '.ps-stmt .ps-pay b{font-size:12px}' +
      '@media print{.ps-stmt{max-width:100%!important}}';
    document.head.appendChild(st);
  }
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
      '<div class="pdoc ps-stmt" style="--pdoc-accent:#111;margin:0 auto 28px;padding:16px 22px 20px;page-break-inside:avoid">' +
      '<div class="ps-top"><div>' + (isBm ? 'Penyata Gaji' : 'Salary Statement') + '</div><div>' + (isBm ? 'SULIT' : 'PRIVATE &amp; CONFIDENTIAL') + '</div></div>' +
      '<div class="ps-co">' + esc(co) + '</div>' +
      '<div class="ps-meta">' +
        kv(isBm ? 'Nama Pekerja' : 'Employee Name', emp.name) +
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
