/* Hide AI Marketing Ideas; keep Insight + Digest as a two-column row */
(function () {
  function apply() {
    var row = document.getElementById('db-sec-ai');
    if (!row) return;
    var cards = row.querySelectorAll(':scope > .db-card');
    cards.forEach(function (card) {
      if (card.querySelector('#db-marketing-out') || card.querySelector('#db-marketing-btn')) {
        card.remove();
      }
    });
    row.style.display = 'grid';
    row.style.gridTemplateColumns = '1fr 1fr';
    row.style.gap = '14px';
    row.style.alignItems = 'stretch';
    row.querySelectorAll(':scope > .db-card').forEach(function (card) {
      card.style.minHeight = '160px';
    });
  }
  function wrap() {
    ['loadDashboardData', 'renderDashboard', '_dbRenderDashboard'].forEach(function (name) {
      var orig = window[name];
      if (typeof orig !== 'function' || orig._aiLayWrapped) return;
      var wrapped = async function () {
        var r = await orig.apply(this, arguments);
        setTimeout(apply, 0);
        setTimeout(apply, 300);
        return r;
      };
      wrapped._aiLayWrapped = true;
      window[name] = wrapped;
    });
  }
  function boot() {
    wrap();
    apply();
    setTimeout(apply, 400);
    setTimeout(apply, 1200);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
