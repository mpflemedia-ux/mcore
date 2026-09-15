/* CARD SHORTCUTS — Bookings */
(function () {
  function chipHtml(isBm) {
    return '<button type="button" class="btn btn-sm btn-outline" data-bk-sc="1" style="border:none;white-space:nowrap" onclick="_dbScrollToSec(\'db-sec-booking\')">' +
      '<i class="ti ti-calendar-plus"></i> ' + (isBm ? 'Tempahan' : 'Bookings') + '</button>';
  }
  function injectChip() {
    var bar = document.getElementById('db-shortcuts');
    if (!bar || bar.querySelector('[data-bk-sc]')) return;
    var row = bar.querySelector('div[style*="flex-wrap"]') || bar.lastElementChild;
    if (!row) return;
    var isBm = APP.language === 'bm';
    var plannerBtn = null;
    row.querySelectorAll('button').forEach(function (b) {
      var t = (b.textContent || '').trim().toLowerCase();
      if (t.indexOf('planner') >= 0 || t.indexOf('perancang') >= 0) plannerBtn = b;
    });
    var tmp = document.createElement('span');
    tmp.innerHTML = chipHtml(isBm);
    var btn = tmp.firstChild;
    if (plannerBtn && plannerBtn.nextSibling) plannerBtn.parentNode.insertBefore(btn, plannerBtn.nextSibling);
    else row.appendChild(btn);
  }
  function wrap() {
    var orig = window._dbShortcutsHtml;
    if (typeof orig === 'function' && !orig._bkScWrapped) {
      var w = function (isBm) {
        var html = orig.apply(this, arguments);
        if (html && html.indexOf('db-sec-booking') < 0) {
          html = html.replace(
            'onclick="_dbScrollToSec(\'db-sec-planner\')"',
            'onclick="_dbScrollToSec(\'db-sec-planner\')"></button>' + chipHtml(isBm).replace(/^<button[^>]*>/, '').replace('</button>', '') 
          );
        }
        return html;
      };
      /* safer: just inject after render */
      w = function (isBm) {
        var html = orig.apply(this, arguments);
        setTimeout(injectChip, 0);
        return html;
      };
      w._bkScWrapped = true;
      window._dbShortcutsHtml = w;
    }
    ['renderDashboard', 'loadDashboardData'].forEach(function (name) {
      var origD = window[name];
      if (typeof origD !== 'function' || origD._bkScWrapped) return;
      var wd = async function () {
        var r = await origD.apply(this, arguments);
        setTimeout(injectChip, 0);
        setTimeout(injectChip, 500);
        return r;
      };
      wd._bkScWrapped = true;
      window[name] = wd;
    });
  }
  function boot() { wrap(); injectChip(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setTimeout(boot, 400);
  setTimeout(injectChip, 1200);
})();
