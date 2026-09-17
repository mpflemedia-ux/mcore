/* Dashboard layout: consistent 16px gaps; People+Tracker row; probation full-width below */
(function () {
  var GAP = '16px';
  function apply() {
    var dash = document.getElementById('dashboard-wrap');
    if (dash) {
      dash.style.display = 'flex';
      dash.style.flexDirection = 'column';
      dash.style.gap = GAP;
    }
    var ai = document.getElementById('db-sec-ai');
    if (ai) {
      var cards = ai.querySelectorAll(':scope > .db-card');
      cards.forEach(function (card) {
        if (card.querySelector('#db-marketing-out') || card.querySelector('#db-marketing-btn')) card.remove();
      });
      ai.style.display = 'grid';
      ai.style.gridTemplateColumns = '1fr 1fr';
      ai.style.gap = GAP;
      ai.style.alignItems = 'stretch';
      ai.style.margin = '0';
    }
    var row = document.querySelector('.db-people-row-2');
    if (row) {
      row.style.display = 'grid';
      row.style.gridTemplateColumns = 'minmax(220px, 0.85fr) minmax(0, 1.6fr)';
      row.style.gap = GAP;
      row.style.alignItems = 'stretch';
      row.style.width = '100%';
      row.style.margin = '0';
    }
    document.querySelectorAll('#dashboard-wrap .db-card').forEach(function (c) {
      c.style.margin = '0';
    });
    var pr = document.getElementById('db-sec-probation');
    if (pr && row && row.parentNode) {
      pr.style.width = '100%';
      pr.style.gridColumn = '1 / -1';
      pr.style.margin = '0';
      if (pr.parentNode !== row.parentNode || pr.previousElementSibling !== row) {
        row.parentNode.insertBefore(pr, row.nextSibling);
      }
    }
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
