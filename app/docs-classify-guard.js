(function () {
  var _apply;
  setInterval(function () {
    /* keyword overlay must not overwrite AI result */
    if (window._docsAiClass && window._docsAiClass.folder) {
      window._docsSkipKeyword = true;
    } else {
      window._docsSkipKeyword = false;
    }
  }, 200);
})();
