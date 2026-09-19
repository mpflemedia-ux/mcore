(function () {
  function mark() {
    var st = document.getElementById('docs-drive-st');
    if (!st) return;
    var ok = !!window._docsAccessToken;
    st.textContent = ok
      ? (APP.language === 'bm' ? 'Drive tersambung' : 'Drive connected')
      : (APP.language === 'bm' ? 'Drive belum sambung' : 'Drive not connected');
  }
  setInterval(mark, 1000);
})();
