/* Hide floating home / chat / scroll-up on print — all printed docs */
(function () {
  if (document.getElementById('print-hide-fabs-css')) return;
  var css = document.createElement('style');
  css.id = 'print-hide-fabs-css';
  css.textContent = '@media print{' +
    '#ai-chat-fab,#scroll-top-btn,#dash-home-fab,#ai-chat,#ai-chat-panel,' +
    '.toast-container,#toast-container,.toast,' +
    '#notif-dropdown,#notif-panel{display:none!important;visibility:hidden!important}' +
    '}';
  document.head.appendChild(css);
  function hideNow() {
    ['ai-chat-fab','scroll-top-btn','dash-home-fab','ai-chat'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.classList.add('no-print');
    });
  }
  hideNow();
  window.addEventListener('beforeprint', hideNow);
})();
