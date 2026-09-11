(function(){
  if (location.search.indexOf('public_apply=') === -1) return;
  var css = document.createElement('style');
  css.id = 'pub-apply-scroll-css';
  css.textContent = [
    'html,body{overflow-y:auto!important;height:auto!important;max-height:none!important;position:static!important}',
    '#shell,#auth-page{display:none!important}',
    '#pub-apply-root{position:fixed!important;inset:0!important;overflow-y:auto!important;-webkit-overflow-scrolling:touch!important;z-index:2147483646!important;padding:12px 12px 96px!important;background:#0f172a}'
  ].join('\n');
  document.documentElement.appendChild(css);
  document.documentElement.setAttribute('style','overflow-y:auto;height:auto');
})();
