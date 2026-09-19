(function () {
  var css = '#main .card,#docs-log,#docs-result,#docs-cid,#docs-root,#docs-name,#docs-folder{overflow-wrap:anywhere;word-break:break-word;white-space:normal}' +
    '#docs-log>div{display:block;margin-bottom:8px;line-height:1.35}';
  if (document.getElementById('docs-wrap-css')) return;
  var s = document.createElement('style');
  s.id = 'docs-wrap-css';
  s.textContent = css;
  document.head.appendChild(s);
})();
