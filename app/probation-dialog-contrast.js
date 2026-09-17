/* Force readable dark-mode colors on probation dialog */
(function () {
  function paint(box) {
    if (!box) return;
    box.style.background = '#1e293b';
    box.style.color = '#f1f5f9';
    box.style.border = '1px solid #334155';
    box.style.boxShadow = '0 20px 40px rgba(0,0,0,.45)';
    var h = box.querySelector('h3');
    if (h) { h.style.color = '#f8fafc'; h.style.opacity = '1'; }
    box.querySelectorAll('label,div').forEach(function (el) {
      if (el === box) return;
      if (el.querySelector('button')) return;
      el.style.color = '#e2e8f0';
    });
    ['prb-reason', 'prb-new-months'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.style.background = '#0f172a';
      el.style.color = '#f8fafc';
      el.style.border = '1px solid #475569';
      el.style.caretColor = '#f8fafc';
    });
    var cancel = box.querySelector('#prb-cancel');
    if (cancel) { cancel.style.color = '#e2e8f0'; cancel.style.borderColor = '#64748b'; }
  }
  function scan() {
    document.querySelectorAll('body > div').forEach(function (wrap) {
      if ((wrap.style.zIndex === '3000' || wrap.style.cssText.indexOf('z-index:3000') >= 0) && wrap.querySelector('#prb-reason')) {
        paint(wrap.firstElementChild);
      }
    });
  }
  setInterval(scan, 300);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan);
  else scan();
})();
