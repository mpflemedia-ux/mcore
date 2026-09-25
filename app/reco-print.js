(function () {
  var old = document.getElementById('reco-print-css');
  if (old) old.remove();
  var s = document.createElement('style');
  s.id = 'reco-print-css';
  s.textContent =
    '@media print{' +
    '@page{size:A4 portrait;margin:10mm;}' +
    '#main > #reco-result,#reco-result,#reco-result .card{' +
      'break-inside:auto!important;page-break-inside:auto!important;' +
      'max-height:none!important;height:auto!important;overflow:visible!important;' +
    '}' +
    '.acc-print-title{page-break-after:avoid!important;margin-bottom:8px!important;}' +
    '#support-banner,.support-banner{display:none!important;}' +
    '#reco-result table{width:100%!important;max-width:100%!important;' +
      'table-layout:fixed!important;font-size:9px!important;border-collapse:collapse!important;}' +
    '#reco-result th,#reco-result td{white-space:normal!important;word-break:break-word!important;' +
      'padding:3px 5px!important;vertical-align:top!important;max-width:none!important;}' +
    '#reco-result th:nth-child(1),#reco-result td:nth-child(1){width:14%;white-space:nowrap!important;}' +
    '#reco-result th:nth-child(2),#reco-result td:nth-child(2){width:48%;}' +
    '#reco-result th:nth-child(3),#reco-result td:nth-child(3){width:18%;white-space:nowrap!important;text-align:right;}' +
    '#reco-result th:nth-child(4),#reco-result td:nth-child(4){width:20%;}' +
    '#reco-result th:nth-child(n+5),#reco-result td:nth-child(n+5){display:none!important;}' +
    '#reco-result select,#reco-result button{border:none!important;background:transparent!important;appearance:none;padding:0!important;}' +
    '}';
  document.head.appendChild(s);
})();
