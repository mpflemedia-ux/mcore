/* Dark-theme readable Confirm/Extend probation dialog */
(function () {
  var css = document.getElementById('prb-dlg-css');
  if (!css) {
    css = document.createElement('style');
    css.id = 'prb-dlg-css';
    css.textContent =
      '[style*="z-index:3000"] > div{' +
      'background:var(--card,#1e293b)!important;' +
      'color:var(--text,#e5e7eb)!important;' +
      'border:1px solid var(--border,rgba(255,255,255,.12));}' +
      '[style*="z-index:3000"] h3,[style*="z-index:3000"] label,[style*="z-index:3000"] div{' +
      'color:inherit!important;}' +
      '#prb-reason,#prb-new-months{' +
      'background:var(--input-bg,rgba(0,0,0,.25))!important;' +
      'color:var(--text,#e5e7eb)!important;' +
      'border:1px solid var(--border,rgba(255,255,255,.16));}';
    document.head.appendChild(css);
  }
})();
