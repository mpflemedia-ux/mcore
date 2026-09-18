/* Dashboard layout: 16px gaps desktop; stack full-width on phone */
(function () {
  var GAP = '16px';
  function isPhone() { return window.matchMedia('(max-width: 900px)').matches; }
  function apply() {
    var phone = isPhone();
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
      ai.style.gridTemplateColumns = phone ? '1fr' : '1fr 1fr';
      ai.style.gap = GAP;
      ai.style.alignItems = 'stretch';
      ai.style.margin = '0';
    }
    var row = document.querySelector('.db-people-row-2');
    if (row) {
      row.style.display = 'grid';
      row.style.gridTemplateColumns = phone ? '1fr' : 'minmax(220px, 0.85fr) minmax(0, 1.6fr)';
      row.style.gap = GAP;
      row.style.alignItems = 'stretch';
      row.style.width = '100%';
      row.style.margin = '0';
    }
    document.querySelectorAll('#dashboard-wrap .db-card').forEach(function (c) {
      c.style.margin = '0';
      c.style.minWidth = '0';
      c.style.maxWidth = '100%';
    });
    var tracker = document.getElementById('db-att-tracker');
    var tCard = tracker && tracker.closest('.db-card');
    if (tCard) {
      tCard.style.minWidth = '0';
      tCard.style.overflow = 'hidden';
    }
    if (tracker) {
      tracker.style.maxWidth = '100%';
      tracker.style.overflowX = 'auto';
      tracker.style.webkitOverflowScrolling = 'touch';
    }
    var legend = tCard && tCard.querySelector('[class*="legend"], .db-att-legend');
    if (!legend && tCard) {
      var nodes = tCard.querySelectorAll('div');
      nodes.forEach(function (n) {
        if (/Present|Annual Leave|Outstation/i.test(n.textContent || '') && n.children.length > 4) {
          n.style.display = 'flex';
          n.style.flexWrap = 'wrap';
          n.style.gap = '6px 10px';
          n.style.fontSize = '11px';
        }
      });
    }
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
  window.addEventListener('resize', apply);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
