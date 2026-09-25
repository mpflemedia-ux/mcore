(function () {
  var old = document.getElementById('reco-print-css');
  if (old) old.remove();
  var s = document.createElement('style');
  s.id = 'reco-print-css';
  s.textContent =
    '@media print{' +
    '@page{size:A4 landscape;margin:8mm;}' +
    '#main > #reco-result,#reco-result,#reco-result .card{' +
      'break-inside:auto!important;page-break-inside:auto!important;' +
      'max-height:none!important;height:auto!important;overflow:visible!important;' +
    '}' +
    '.acc-print-title{page-break-after:avoid!important;margin-bottom:6px!important;}' +
    '#support-banner,.support-banner{display:none!important;}' +
    '#reco-result table{width:100%!important;max-width:100%!important;' +
      'table-layout:fixed!important;font-size:8.5px!important;border-collapse:collapse!important;}' +
    '#reco-result th,#reco-result td{white-space:normal!important;word-break:break-word!important;' +
      'padding:2px 4px!important;vertical-align:top!important;max-width:none!important;}' +
    '#reco-result th:nth-child(1),#reco-result td:nth-child(1){width:10%;white-space:nowrap!important;}' +
    '#reco-result th:nth-child(2),#reco-result td:nth-child(2){width:28%;}' +
    '#reco-result th:nth-child(3),#reco-result td:nth-child(3){width:12%;white-space:nowrap!important;text-align:right;}' +
    '#reco-result th:nth-child(4),#reco-result td:nth-child(4){width:14%;}' +
    '#reco-result th:nth-child(5),#reco-result td:nth-child(5){width:28%;}' +
    '#reco-result th:nth-child(6),#reco-result td:nth-child(6){width:8%;white-space:nowrap!important;}' +
    '#reco-result th:nth-child(7),#reco-result td:nth-child(7){display:none!important;}' +
    '#reco-result select{border:none!important;background:transparent!important;appearance:none;padding:0!important;font-size:8.5px!important;}' +
    '#reco-result button{display:none!important;}' +
    '}';
  document.head.appendChild(s);
})();
