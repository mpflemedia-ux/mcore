/* M-Core Projects - Share THIS task only: small share icon on every task card (board/list/matrix,
   any project incl. "All projects" view). Opens the same modal as pj-share-core.js's toolbar
   button, scoped to this one task (task_id set). Separate hook slot in the window._pjAfterPaint
   chain so it still runs if pj-share-core.js (whole-project button) is ever removed/reordered. */
(function () {
  if (window._pjShareTasks || !window.PJS) return; window._pjShareTasks = 1;
  function t(en, ms) { return window.APP && APP.language === 'bm' ? ms : en; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&', '<': '<', '>': '>', '"': '"', "'": '&#39;' }[c]; }); }

  function decorate(st) {
    var main = document.getElementById('main'); if (!main || !PJS.can || !PJS.can()) return;
    var byId = {}; (st.tasks || []).forEach(function (k) { byId[k.id] = k; });
    main.querySelectorAll('.pj-card[data-id]').forEach(function (card) {
      if (card.querySelector('.pjs-tbtn')) return;
      var k = byId[card.getAttribute('data-id')]; if (!k) return;
      var anchor = card.querySelector('.pj-pct') || card.querySelector('.pj-card-meta');
      var html = '<div class="pjs-tfoot"><button type="button" class="pjs-tbtn" data-pjs-task="' + esc(k.id) + '" title="' + esc(t('Share this task', 'Kongsi task ini')) + '"><i class="ti ti-share"></i></button></div>';
      if (anchor) anchor.insertAdjacentHTML('afterend', html); else card.insertAdjacentHTML('beforeend', html);
    });
    main.querySelectorAll('[data-pjs-task]').forEach(function (b) {
      b.onclick = function (e) {
        e.stopPropagation();
        var k = byId[b.getAttribute('data-pjs-task')]; if (!k) return;
        var proj = (st.projects || st.allProjects || []).find(function (p) { return String(p.id) === String(k.project_id); });
        if (proj) PJS.openModal(proj, k);
      };
    });
  }

  var css = '.pjs-tfoot{margin-top:6px}.pjs-tbtn{display:inline-flex;align-items:center;justify-content:center;min-width:30px;min-height:30px;border:1px solid var(--border);color:var(--text-2);background:transparent;border-radius:8px;cursor:pointer}.pjs-tbtn .ti{font-size:15px}';
  var styleEl = document.createElement('style'); styleEl.id = 'pjs-tasks-css'; styleEl.textContent = css; document.head.appendChild(styleEl);

  function hook() {
    var prev = window._pjAfterPaint; if (prev && prev._pjst) return;
    var fn = function (st) {
      var r; try { r = typeof prev === 'function' ? prev(st) : null; } catch (e) { console.warn('pjst', e); }
      return Promise.resolve(r).then(function () { try { decorate(st); } catch (e) { console.warn('pjst', e); } });
    };
    fn._pjm = prev && prev._pjm; fn._pjm2 = prev && prev._pjm2; fn._pja = prev && prev._pja; fn._pjs = prev && prev._pjs; fn._pjst = 1;
    window._pjAfterPaint = fn;
  }
  hook(); document.addEventListener('DOMContentLoaded', hook);
})();
