/* Scroll Staff Attendance Tracker so today is first day after Staff column */
(function () {
  function scrollToday() {
    var wrap = document.getElementById('db-att-tracker');
    if (!wrap) return;
    var today = new Date().getDate();
    var monthEl = document.getElementById('db-att-month');
    var yearEl = document.getElementById('db-att-year');
    var now = new Date();
    if (monthEl && Number(monthEl.value) !== now.getMonth() + 1) return;
    if (yearEl && Number(yearEl.value) !== now.getFullYear()) return;
    var th = wrap.querySelector('th[data-day="' + today + '"]');
    var nameTh = wrap.querySelector('thead th');
    if (!th || !nameTh) return;
    var left = th.offsetLeft - nameTh.offsetWidth - 6;
    wrap.scrollLeft = Math.max(0, left);
    th.style.color = 'var(--primary)';
    th.style.fontWeight = '700';
  }
  function wrapLoad() {
    var orig = window._dbLoadAttTracker;
    if (typeof orig !== 'function' || orig._todayScroll) return;
    window._dbLoadAttTracker = async function () {
      var r = await orig.apply(this, arguments);
      setTimeout(scrollToday, 50);
      setTimeout(scrollToday, 250);
      setTimeout(scrollToday, 700);
      return r;
    };
    window._dbLoadAttTracker._todayScroll = true;
  }
  function boot() {
    wrapLoad();
    scrollToday();
  }
  setInterval(wrapLoad, 1000);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
