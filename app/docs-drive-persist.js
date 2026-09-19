(function () {
  if (!window._docsToastHooked && typeof window.showToast === 'function') {
    var orig = window.showToast;
    window.showToast = function (msg, type) {
      if (/Drive connected|Drive tersambung/i.test(String(msg || ''))) window._docsDriveOk = true;
      return orig.apply(this, arguments);
    };
    window._docsToastHooked = true;
  }
  function mark() {
    var st = document.getElementById('docs-drive-st');
    if (!st) return;
    if (window._docsAccessToken || window._docsDriveOk) {
      st.textContent = APP.language === 'bm' ? 'Drive tersambung' : 'Drive connected';
    }
  }
  setInterval(mark, 600);
})();
