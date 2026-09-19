(function () {
  function connectedText() {
    return APP.language === 'bm' ? 'Drive tersambung' : 'Drive connected';
  }
  function hookToast() {
    if (window._docsLabelHook || typeof window.showToast !== 'function') return;
    var orig = window.showToast;
    window.showToast = function (msg, type) {
      if (/Drive connected|Drive tersambung/i.test(String(msg || ''))) {
        window._docsDriveOk = true;
        paint();
      }
      return orig.apply(this, arguments);
    };
    window._docsLabelHook = true;
  }
  function paint() {
    if (!(window._docsDriveOk || window._docsAccessToken)) return;
    ['docs-drive-st', 'docs-drive-state'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.textContent = connectedText();
    });
  }
  setInterval(function () { hookToast(); paint(); }, 250);
})();
