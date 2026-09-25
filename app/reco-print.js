(function () {
  if (document.getElementById('reco-print-css')) return;
  var s = document.createElement('style');
  s.id = 'reco-print-css';
  s.textContent = '@media print{' +
    '#main > #reco-result, #reco-result, #reco-result .card{' +
      'break-inside:auto!important;page-break-inside:auto!important;' +
      'max-height:none!important;height:auto!important;overflow:visible!important;' +
    '}' +
    '#reco-result table{page-break-inside:auto!important;}' +
    '#reco-result tr{break-inside:avoid;page-break-inside:avoid;}' +
    '.acc-print-title{page-break-after:avoid!important;margin-bottom:8px!important;}' +
    '#support-banner,.support-banner{display:none!important;}' +
  '}';
  document.head.appendChild(s);
})();
