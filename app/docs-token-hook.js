(function () {
  function hook() {
    if (!window.google || !google.accounts || !google.accounts.oauth2) return;
    if (google.accounts.oauth2._docsHooked) return;
    var orig = google.accounts.oauth2.initTokenClient.bind(google.accounts.oauth2);
    google.accounts.oauth2.initTokenClient = function (cfg) {
      var userCb = cfg.callback;
      cfg.callback = function (resp) {
        if (resp && resp.access_token) window._docsAccessToken = resp.access_token;
        if (typeof userCb === 'function') userCb(resp);
      };
      return orig(cfg);
    };
    google.accounts.oauth2._docsHooked = true;
  }
  setInterval(hook, 250);
})();
