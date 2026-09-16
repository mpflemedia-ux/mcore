/* PV / PVD print: wrap long description onto new lines */
(function () {
  function apply() {
    document.querySelectorAll('.pdoc').forEach(function (doc) {
      var txt = doc.textContent || '';
      if (!/payment voucher|baucar bayaran/i.test(txt)) return;
      doc.querySelectorAll('td').forEach(function (td) {
        var prev = (td.previousElementSibling && td.previousElementSibling.textContent) || '';
        if (!/keterangan|description/i.test(prev)) return;
        td.style.whiteSpace = 'pre-wrap';
        td.style.wordBreak = 'break-word';
        td.style.overflowWrap = 'anywhere';
        td.style.lineHeight = '1.45';
      });
    });
  }
  function boot() {
    apply();
    setTimeout(apply, 300);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setInterval(apply, 800);
})();
