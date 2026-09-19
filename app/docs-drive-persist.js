(function () {
  var CID = '490414473408-0gb8sv4d1s51rvorepp7bna1j7igenj7.apps.googleusercontent.com';
  var KEY = 'mcore_docs_drive_ok';
  var trying = false;

  function mark(ok) {
    var st = document.getElementById('docs-drive-st');
    if (st) st.textContent = ok
      ? (APP.language === 'bm' ? 'Drive tersambung' : 'Drive connected')
      : (APP.language === 'bm' ? 'Drive belum sambung' : 'Drive not connected');
  }

  function loadGis() {
    return new Promise(function (resolve, reject) {
      if (window.google && google.accounts && google.accounts.oauth2) return resolve();
      var s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function silent() {
    if (trying) return;
    if (!document.getElementById('docs-connect')) return;
    if (window._docsAccessToken) { mark(true); return; }
    if (sessionStorage.getItem(KEY) !== '1') return;
    trying = true;
    try {
      await loadGis();
      var client = google.accounts.oauth2.initTokenClient({
        client_id: CID,
        scope: 'https://www.googleapis.com/auth/drive',
        callback: function (resp) {
          trying = false;
          if (resp && resp.access_token) {
            window._docsAccessToken = resp.access_token;
            sessionStorage.setItem(KEY, '1');
            mark(true);
          } else {
            mark(false);
          }
        }
      });
      client.requestAccessToken({ prompt: '' });
    } catch (e) {
      trying = false;
    }
  }

  document.addEventListener('click', function (e) {
    if (e.target && (e.target.id === 'docs-connect' || (e.target.closest && e.target.closest('#docs-connect')))) {
      sessionStorage.setItem(KEY, '1');
    }
  }, true);

  setInterval(function () {
    if (window._docsAccessToken) {
      sessionStorage.setItem(KEY, '1');
      mark(true);
    } else {
      silent();
    }
  }, 800);
})();
