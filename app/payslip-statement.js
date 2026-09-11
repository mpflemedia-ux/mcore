/* Reverted: do not override _pdocPayslipHtml. Original stacked payslip in index.html. */
(function () {
  try {
    if (window._pdocPayslipHtmlOrig) window._pdocPayslipHtml = window._pdocPayslipHtmlOrig;
  } catch (e) {}
})();
