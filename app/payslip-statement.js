/* Print/preview payslip layout — 2-col salary statement (Mayangs-style). */
(function () {
  function esc(s) {
    if (typeof _aiEscapeHtml === 'function') return _aiEscapeHtml(s);
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function amt(n) {
    if (n == null || n === '' || isNaN(Number(n))) return '-';
    var s = (typeof formatRM === 'function') ? formatRM(n) : Number(n).toFixed(2);
    return String(s).replace(/^RM\s*/i, '').trim();
  }
  function monthLbl(rec, isBm) {
    if (typeof _pdocMonthYearLabel === 'function') return _pdocMonthYearLabel(rec.month, rec.year, isBm);
    return (rec.month || '') + ' ' + String(rec.year || '').slice(2);
  }
  if (!document.getElementById('ps-stmt-css')) {
    var st = document.createElement('style');
    st.id = 'ps-stmt-css';
    st.textContent =
      '.ps-stmt{max-width:920px!important;background:#fff;color:#111;font-family:Arial,Helvetica,sans-serif}' +
      '.ps-stmt .ps-top{display:flex;justify-content:space-between;align-items:flex-start;font-size:12px;font-weight:700;letter-spacing:.02em}' +
      '.ps-stmt .ps-co{text-align:center;font-size:20px;font-weight:800;letter-spacing:.04em;margin:6px 0 14px;text-transform:uppercase}' +
      '.ps-stmt .ps-meta{display:grid;grid-template-columns:1.3fr 1fr 1.2fr;gap:8px 16px;font-size:12px;margin-bottom:10px}' +
      '.ps-stmt .ps-meta b{font-weight:700}' +
      '.ps-stmt .ps-rule{border:0;border-top:1.5px solid #111;margin:8px 0 12px}' +
      '.ps-stmt .ps-cols{display:grid;grid-template-columns:1fr 1fr;gap:0 28px}' +
      '.ps-stmt .ps-h{display:flex;justify-content:space-between;font-size:12px;font-weight:700;margin-bottom:6px}' +
      '.ps-stmt .ps-tbl{width:100%;border-collapse:collapse;font-size:12px}' +
      '.ps-stmt .ps-tbl td{padding:3px 0;vertical-align:top}' +
      '.ps-stmt .ps-tbl td:last-child{text-align:right;white-space:nowrap;padding-left:12px}' +
      '.ps-stmt .ps-tot td{font-weight:700;padding-top:8px}' +
      '.ps-stmt .ps-foot{display:grid;grid-template-columns:1fr 1.4fr;gap:16px 24px;margin-top:28px;padding-top:10px;border-top:1.5px solid #111;font-size:12px}' +
      '.ps-stmt .ps-foot h4{margin:0 0 6px;font-size:12px}' +
      '.ps-stmt .ps-payline{display:flex;justify-content:space-between;gap:8px;align-items:flex-end}' +
      '@media print{.ps-stmt{max-width:100%!important;box-shadow:none}}';
    document.head.appendChild(st);
  }
  window._pdocPayslipHtml = function (rec, tn, t, isBm, accent) {
    t = t || {};
    var earnRows = [{ label: t.basic || (isBm ? 'Gaji Pokok' : 'Basic Salary'), amount: rec.basic_salary }];
    try {
      [[rec.allowance_type_1, rec.allowance_1], [rec.allowance_type_2, rec.allowance_2], [rec.allowance_type_3, rec.allowance_3]].forEach(function (pair) {
        if (Number(pair[1]) > 0) {
          var lab = (typeof _sdTypeLabel === 'function' && typeof SD_ALLOWANCE_TYPES !== 'undefined')
            ? _sdTypeLabel(SD_ALLOWANCE_TYPES, pair[0]) : (pair[0] || (isBm ? 'Elaun' : 'Allowance'));
          earnRows.push({ label: lab, amount: pair[1] });
        }
      });
    } catch (e) {}
    if (Number(rec.commission) > 0) earnRows.push({ label: isBm ? 'Komisen Jualan' : 'Overtime / Commission', amount: rec.commission });
    var totalEarnings = Number(rec.basic_salary || 0) + Number(rec.allowance_1 || 0) + Number(rec.allowance_2 || 0) + Number(rec.allowance_3 || 0) + Number(rec.commission || 0);
    var dedRows = [];
    if (Number(rec.epf_employee) > 0) dedRows.push({ label: isBm ? 'KWSP (Pekerja)' : 'Employee EPF (KWSP)', amount: rec.epf_employee });
    if (Number(rec.socso_employee) > 0) dedRows.push({ label: isBm ? 'SOCSO (Pekerja)' : 'Employee SOCSO (PERKESO)', amount: rec.socso_employee });
    if (Number(rec.eis_employee) > 0) dedRows.push({ label: isBm ? 'EIS (Pekerja)' : 'Employee EIS (SIP)', amount: rec.eis_employee });
    if (Number(rec.pcb) > 0) dedRows.push({ label: t.pcb || 'PCB', amount: rec.pcb });
    if (Number(rec.zakat) > 0) dedRows.push({ label: isBm ? 'Zakat (PZB)' : 'Zakat (PZB)', amount: rec.zakat });
    if (Number(rec.advance) > 0) dedRows.push({ label: t.advance || (isBm ? 'Pendahuluan' : 'Advanced'), amount: rec.advance });
    try {
      [[rec.deduction_type_1, rec.deduction_1], [rec.deduction_type_2, rec.deduction_2]].forEach(function (pair) {
        if (Number(pair[1]) > 0) {
          var lab = (typeof _sdTypeLabel === 'function' && typeof SD_DEDUCTION_TYPES !== 'undefined')
            ? _sdTypeLabel(SD_DEDUCTION_TYPES, pair[0]) : (pair[0] || (isBm ? 'Potongan' : 'Deduction'));
          dedRows.push({ label: lab, amount: pair[1] });
        }
      });
    } catch (e) {}
    var totalDeductions = dedRows.reduce(function (s, r) { return s + Number(r.amount || 0); }, 0);
    var emp = rec.employees || {};
    var co = (tn && (tn.name || tn.company_name)) || (window.APP && APP.tenant && APP.tenant.name) || '';
    var ic = emp.ic_no || emp.nric || '';
    var empNo = emp.staff_no || emp.employee_no || emp.code || '';
    var area = emp.position || emp.work_base || '';
    var bankName = (emp.bank_name || '').trim();
    var bankAcc = (emp.bank_account_no || '').trim();
    function rows(list) {
      return list.map(function (r) {
        return '<tr><td>' + esc(r.label) + '</td><td>' + amt(r.amount) + '</td></tr>';
      }).join('');
    }
    return (
      '<div class="pdoc ps-stmt" style="--pdoc-accent:#111;margin:0 auto 28px;padding:18px 22px;page-break-inside:avoid">' +
      '<div class="ps-top"><div>' + (isBm ? 'Penyata Gaji' : 'Salary Statement') + '</div><div>' + (isBm ? 'SULIT' : 'PRIVATE &amp; CONFIDENTIAL') + '</div></div>' +
      '<div class="ps-co">' + esc(co) + '</div>' +
      '<div class="ps-meta">' +
        '<div>' + (isBm ? 'Nama Pekerja' : 'Employee Name') + ' : <b>' + esc(emp.name || '-') + '</b></div>' +
        '<div>' + (isBm ? 'No. Pekerja' : 'Employee Number') + ' : <b>' + esc(empNo || '—') + '</b>' +
          (area ? '<div style="margin-top:4px">' + (isBm ? 'Jawatan' : 'Pers Subarea') + ' : ' + esc(area) + '</div>' : '') +
        '</div>' +
        '<div>' + (isBm ? 'No. KP / Pasport' : 'Identity Card/Passport') + ' : <b>' + esc(ic || '—') + '</b>' +
          '<div style="margin-top:4px">' + (isBm ? 'Bulan' : 'Month') + ' : <b>' + esc(monthLbl(rec, isBm)) + '</b></div>' +
        '</div>' +
      '</div>' +
      '<hr class="ps-rule">' +
      '<div class="ps-cols">' +
        '<div><div class="ps-h"><span>' + (isBm ? 'Gaji &amp; Elaun' : 'Salary &amp; Allowance') + '</span><span>' + (isBm ? 'Jumlah (RM)' : 'Total (RM)') + '</span></div>' +
          '<table class="ps-tbl"><tbody>' + rows(earnRows) +
          '<tr class="ps-tot"><td>' + (isBm ? 'Jumlah Pendapatan' : 'Total Income') + '</td><td>' + amt(totalEarnings) + '</td></tr>' +
          '</tbody></table></div>' +
        '<div><div class="ps-h"><span>' + (isBm ? 'Potongan' : 'Deductions') + '</span><span>' + (isBm ? 'Jumlah (RM)' : 'Total (RM)') + '</span></div>' +
          '<table class="ps-tbl"><tbody>' + (dedRows.length ? rows(dedRows) : '<tr><td colspan="2">' + (isBm ? 'Tiada potongan' : '-') + '</td></tr>') +
          '<tr class="ps-tot"><td>' + (isBm ? 'Jumlah Potongan' : 'Total Deduction') + '</td><td>' + amt(totalDeductions) + '</td></tr>' +
          '</tbody></table></div>' +
      '</div>' +
      '<div class="ps-foot">' +
        '<div><h4>' + (isBm ? 'Caruman Majikan' : 'Employer Contribution') + '</h4>' +
          '<table class="ps-tbl"><tbody>' +
          '<tr><td>' + (isBm ? 'KWSP (Majikan)' : 'Employer EPF (KWSP)') + '</td><td>' + amt(rec.epf_employer || 0) + '</td></tr>' +
          '<tr><td>' + (isBm ? 'SOCSO (Majikan)' : 'Employer SOCSO (PERKESO)') + '</td><td>' + amt(rec.socso_employer || 0) + '</td></tr>' +
          '<tr><td>' + (isBm ? 'EIS (Majikan)' : 'Employer EIS (SIP)') + '</td><td>' + amt(rec.eis_employer || 0) + '</td></tr>' +
          '</tbody></table></div>' +
        '<div><h4>' + (isBm ? 'Butiran Bayaran' : 'Details of Payment') + '</h4>' +
          '<div class="ps-payline"><span>' + (isBm ? 'Jumlah dikredit ke akaun bank' : 'Amount credited to Bank Account') + '</span></div>' +
          '<div class="ps-payline" style="margin-top:8px"><span>' + esc(bankName || '—') + ' &nbsp; ' + esc(bankAcc || '—') + '</span><b>' + amt(rec.net_pay) + '</b></div>' +
        '</div>' +
      '</div>' +
      '</div>'
    );
  };
})();
