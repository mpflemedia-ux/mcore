/* M-Core Projects All-projects - Group by Project / Assignee: rebuild board columns by moving existing cards (keeps multi decorations).
   Drag-to-reassign is NOT enabled (no drag infra in projects.js) — columns are read-only groupings. */
(function () {
  var A = window.PJA; if (!A || A.groupUi) return;

  function nick(st, id) {
    if (!id) return A.L('Unassigned', 'Tiada assignee');
    var e = (st.employees || []).filter(function (x) { return A.same(x.id, id); })[0];
    return e ? (e.nickname || e.name || '') : '?';
  }

  function rebuild(st, mode) {
    var main = document.getElementById('main'); if (!main || st.tab !== 'board') return;
    var board = main.querySelector('.pj-board'); if (!board) return;
    if (board.getAttribute('data-pja-g') === mode) {
      /* already built this paint cycle — still re-count */
      return;
    }
    var cards = [].slice.call(board.querySelectorAll('.pj-card'));
    var by = {}; (st.tasks || []).forEach(function (k) { by[k.id] = k; });
    var cols = [], map = {};
    function ensure(key, title, color) {
      if (map[key]) return map[key];
      var sec = document.createElement('section');
      sec.className = 'pj-col'; sec.setAttribute('data-pja-col', key);
      sec.innerHTML = '<header class="pja-col-h">' + (color ? '<i class="dot" style="background:' + A.esc(color) + '"></i>' : '') + '<b>' + A.esc(title) + '</b><span>0</span></header>';
      map[key] = sec; cols.push(sec); return sec;
    }
    if (mode === 'project') {
      (st.projects || []).forEach(function (p, i) { ensure(String(p.id), p.name, A.colorOf(st, p.id, i)); });
      cards.forEach(function (card) {
        var k = by[card.getAttribute('data-id')]; if (!k) return;
        ensure(String(k.project_id), A.L('Other', 'Lain'), 'var(--text-3)').appendChild(card);
      });
    } else if (mode === 'assignee') {
      var seen = {};
      cards.forEach(function (card) {
        var k = by[card.getAttribute('data-id')]; if (!k) return;
        var ids = A.assigneesOf(k);
        if (!ids.length) { ensure('__none__', A.L('Unassigned', 'Tiada assignee')).appendChild(card); return; }
        /* put card in first assignee column; clone not used (one DOM node) */
        var id = ids[0];
        if (!seen[id]) { seen[id] = 1; ensure(String(id), nick(st, id)); }
        ensure(String(id), nick(st, id)).appendChild(card);
        ids.slice(1).forEach(function (x) { if (!seen[x]) { seen[x] = 1; ensure(String(x), nick(st, x)); } });
      });
      /* ensure unassigned exists if empty board */
      if (!cols.length) ensure('__none__', A.L('Unassigned', 'Tiada assignee'));
    }
    /* Sort columns by title, Unassigned last */
    cols.sort(function (a, b) {
      var ka = a.getAttribute('data-pja-col'), kb = b.getAttribute('data-pja-col');
      if (ka === '__none__') return 1; if (kb === '__none__') return -1;
      return (a.querySelector('b').textContent || '').localeCompare(b.querySelector('b').textContent || '');
    });
    board.innerHTML = '';
    cols.forEach(function (c) {
      var n = c.querySelectorAll('.pj-card:not(.pja-off):not(.pjm2-off)').length;
      var s = c.querySelector('header span'); if (s) s.textContent = n;
      board.appendChild(c);
    });
    board.setAttribute('data-pja-g', mode);
  }

  A.groupUi = function (st) {
    var main = document.getElementById('main'); if (!main) return;
    if (!A.groupBy || st.tab !== 'board') {
      var b = main.querySelector('.pj-board[data-pja-g]');
      if (b) b.removeAttribute('data-pja-g');
      return;
    }
    rebuild(st, A.groupBy);
  };
})();
