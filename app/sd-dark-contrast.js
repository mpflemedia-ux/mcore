(function () {
  var old = document.getElementById('sd-dark-contrast-css');
  if (old) old.remove();
  var s = document.createElement('style');
  s.id = 'sd-dark-contrast-css';
  s.textContent =
    '[data-theme="dark"] .card-title,' +
    '[data-theme="dark"] .card-header,' +
    'body.dark .card-title,' +
    'body.dark .card-header{' +
      'color:var(--text,#E7E9EB)!important;' +
    '}' +
    '[data-theme="dark"] .card-header,' +
    'body.dark .card-header{border-bottom-color:rgba(255,255,255,.12)!important;}';
  document.head.appendChild(s);
})();
