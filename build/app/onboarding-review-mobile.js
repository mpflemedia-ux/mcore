/* M-Core Onboarding Checklist - platform admin review on phones/tablets (<=900px, where .cob-g3 stacks to one column):
   tap a queue row -> full-screen detail (document, changes, decision, audit) with Back to the queue at the same scroll position.
   After Approve / Reject / Not applicable the refreshed queue is shown. Desktop split layout untouched (all rules inside the media query). v1 */
(function () {
  var C = window.COB; if (!C || C._rvm) return; C._rvm = 1;
  var L = C.L, MQ = window.matchMedia('(max-width:900px)'), M = { open: null, y: 0, enter: false };
  var css = document.createElement('style'); css.id = 'cob-rvm-css';
  css.textContent = '.cob-rvm-bar{display:none}' +
    '@media(max-width:900px){' +
    '.cob-rvm-list .cob-g3>:not(.cob-rvq),.cob-rvm-list>.cob-aud{display:none!important}' +
    '.cob-rvm-det>.cob-head,.cob-rvm-det .cob-rvq{display:none!important}' +
    '.cob-rvm-det .cob-rvm-bar{display:flex;align-items:center;gap:8px;position:sticky;top:0;z-index:5;margin:0 0 12px;padding:8px 0;background:var(--bg)}' +
    '.cob-rvm-bar .header-btn{width:44px;height:44px;flex:0 0 auto}.cob-rvm-bar .grow{min-width:0}' +
    '.cob-rvm-det .cob-doc:not(:has(iframe,img)){min-height:140px}' +
    '.cob-q:focus-visible{outline:2px solid var(--primary);outline-offset:-2px}}';
  (document.head || document.documentElement).appendChild(css);
  function sc() { var n = document.getElementById('main'); while (n && n !== document.body) { var o = getComputedStyle(n).overflowY; if (/(auto|scroll)/.test(o) && n.scrollHeight > n.clientHeight) return n; n = n.parentElement; } return document.scrollingElement || document.documentElement; }
  function rows(root) { return [].slice.call(root.querySelectorAll('.cob-q[data-s]')); }
  function apply() {
    var m = document.getElementById('main'), root = m && m.querySelector('.cob-root'), g = root && root.querySelector('.cob-g3');
    if (APP.currentPage !== 'cob_admin' || !g || !root.querySelector('.cob-q, .cob-g3 .cob-card')) return;
    var q = g.firstElementChild; if (q) q.classList.add('cob-rvq');
    var ids = rows(root).map(function (r) { return r.dataset.s; }), back = false;
    if (M.open && (ids.indexOf(M.open) < 0 || !root.querySelector('.cob-dec'))) { M.open = null; back = true; } /* decided -> refreshed queue */
    var on = root.querySelector('.cob-q.on'); if (M.open && on && on.dataset.s !== M.open) M.open = on.dataset.s;
    root.classList.toggle('cob-rvm-det', !!M.open); root.classList.toggle('cob-rvm-list', !M.open);
    if (M.open) {
      var it = on ? on.querySelector('.cob-sm') : null, bar = document.createElement('div'); bar.className = 'cob-rvm-bar';
      bar.innerHTML = '<button type="button" class="header-btn" data-rvm="back" aria-label="' + L('Back to review queue', 'Kembali ke barisan semakan') + '"><i class="ti ti-arrow-left"></i></button><div class="grow"><div class="cob-xs">' + L('Review queue', 'Barisan semakan') + ' · ' + (ids.indexOf(M.open) + 1) + '/' + ids.length + '</div><b class="cob-ell" style="display:block;font-size:14px"></b></div>';
      bar.querySelector('b').textContent = it ? it.textContent.trim() : '';
      root.insertBefore(bar, root.firstChild);
      if (M.enter && MQ.matches) sc().scrollTop = 0;
    } else if (MQ.matches) rows(root).forEach(function (r) { r.classList.remove('on'); });
    M.enter = false;
    if (MQ.matches && back) setTimeout(function () { sc().scrollTop = M.y; }, 0);
  }
  var orig = C.reviewView;
  C.reviewView = function (p) {
    if (!p || !('sub' in p)) M.open = null; /* fresh entry from the dashboard / filter reset */
    var r = orig.apply(this, arguments); return r && r.then ? r.then(function (v) { try { apply(); } catch (e) { console.warn('cob-rvm', e); } return v; }) : r;
  };
  document.addEventListener('click', function (e) {
    if (APP.currentPage !== 'cob_admin') return;
    var b = e.target.closest && e.target.closest('[data-rvm="back"]');
    if (b) { var root = b.closest('.cob-root'); M.open = null; root.classList.remove('cob-rvm-det'); root.classList.add('cob-rvm-list'); b.parentNode.remove(); setTimeout(function () { sc().scrollTop = M.y; }, 0); return; }
    var r = e.target.closest && e.target.closest('.cob-q[data-s]');
    if (r && MQ.matches) { M.y = sc().scrollTop; M.open = r.dataset.s; M.enter = true; }
  }, true);
  window.addEventListener('keydown', function (e) { /* L/T/N shortcuts only while the detail is visible */
    if (MQ.matches && /^[ltn]$/i.test(e.key || '') && document.querySelector('.cob-rvm-list .cob-dec')) e.stopPropagation();
  }, true);
  document.addEventListener('keydown', function (e) {
    var r = e.target && e.target.classList && e.target.classList.contains('cob-q') && e.target.dataset.s ? e.target : null;
    if (r && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); r.click(); }
  });
})();
