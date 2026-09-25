(function () {
  function wrap() {
    var orig = window._dbFillCardInsights;
    if (typeof orig !== 'function' || orig._instantFb) return;
    window._dbFillCardInsights = async function (ctx) {
      var isBm = typeof APP !== 'undefined' && APP.language === 'bm';
      var merged = Object.assign({}, window._dbInsightCtx || {}, ctx || {});
      var map = [
        ['db-ai-growth', 'growth'],
        ['db-ai-status', 'status'],
        ['db-ai-zone', 'zone'],
        ['db-ai-health', 'health'],
        ['db-ai-pnl', 'pnl'],
        ['db-ai-attendance', 'attendance'],
        ['db-ai-topsp', 'topsp'],
        ['db-ai-topreferral', 'topreferral'],
        ['db-ai-devroadmap', 'devroadmap'],
        ['db-ai-content', 'content']
      ];
      map.forEach(function (pair) {
        var el = document.getElementById(pair[0]);
        if (!el || typeof _dbInsightFallbackBody !== 'function') return;
        try {
          var body = _dbInsightFallbackBody(pair[1], merged, isBm);
          el.innerHTML = '<span class="db-ai-tag">AI</span><div>' +
            String(body || '').replace(/</g, '&lt;') + '</div>';
        } catch (e) {}
      });
      try { return await orig.apply(this, arguments); } catch (e2) { return; }
    };
    window._dbFillCardInsights._instantFb = true;
  }
  wrap();
  setTimeout(wrap, 400);
})();
