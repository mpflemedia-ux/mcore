/* M-Core Projects All-projects view - core: filter state (localStorage), match/sort/summary, decorate hook.
   No schema probe — works on existing projects/project_tasks. Hooks window._pjAfterPaint after multi2. */
(function () {
  if (window.PJA) return;
  var A = window.PJA = { ALL: '__all__', f: null, groupBy: '', saved: [] };
  A.bm = function () { return window.APP && APP.language === 'bm'; };
  A.L = function (en, bm) { return A.bm() ? bm : en; };
  A.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); };
  A.same = function (a, b) { return String(a) === String(b); };
  A.tid = function () { return window.APP && APP.tenant && APP.tenant.id; };
  A.uid = function () { try { return (APP.user && (APP.user.id || APP.user.user_id)) || (sb && sb.auth && '') || 'u'; } catch (e) { return 'u'; } };
  A.isAll = function (st) { return st && String(st.projectId) === A.ALL; };
  A.def = function () { return { assignees: [], projects: [], status: [], tags: [], due: '', sort: 'due', groupBy: '' }; };
  A.key = function () { return 'mcore_pja_' + A.tid() + '_' + A.uid(); };
  A.load = function () {
    try {
      var raw = localStorage.getItem(A.key());
      var o = raw ? JSON.parse(raw) : null;
      A.f = Object.assign(A.def(), (o && o.f) || {});
      A.groupBy = A.f.groupBy || '';
      A.saved = (o && o.saved) || [];
    } catch (e) { A.f = A.def(); A.saved = []; A.groupBy = ''; }
    return A.f;
  };
  A.persist = function () {
    try { A.f.groupBy = A.groupBy; localStorage.setItem(A.key(), JSON.stringify({ f: A.f, saved: A.saved })); } catch (e) {}
  };
  A.hasFilt = function () {
    var f = A.f || A.def();
    return !!(f.assignees.length || f.projects.length || f.status.length || f.tags.length || f.due || (f.sort && f.sort !== 'due') || A.groupBy);
  };
  A.assigneesOf = function (k) {
    if (window.PJM && PJM.ok && typeof PJM.list === 'function') {
      return PJM.list(k).map(function (a) { return String(a.employee_id); });
    }
    return k.assignee_employee_id ? [String(k.assignee_employee_id)] : [];
  };
  A.weekRange = function () {
    var d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    var e = new Date(d); e.setDate(d.getDate() + 6);
    function y(x) { return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); }
    return [y(d), y(e)];
  };
  A.match = function (k) {
    var f = A.f || A.def(); if (!k) return false;
    if (f.projects.length && f.projects.indexOf(String(k.project_id)) < 0) return false;
    if (f.status.length && f.status.indexOf(String(k.column_key || '')) < 0) return false;
    if (f.tags.length && f.tags.indexOf(String(k.tag || '')) < 0) return false;
    if (f.assignees.length) {
      var ids = A.assigneesOf(k), hit = f.assignees.some(function (a) { return ids.indexOf(String(a)) >= 0; });
      if (!hit) return false;
    }
    if (f.due) {
      var today = (function () { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })();
      var due = k.due_date ? String(k.due_date).slice(0, 10) : '';
      if (f.due === 'overdue') { if (!(due && due < today && k.column_key !== 'done')) return false; }
      else if (f.due === 'today') { if (due !== today) return false; }
      else if (f.due === 'week') { var w = A.weekRange(); if (!(due && due >= w[0] && due <= w[1])) return false; }
    }
    return true;
  };
  A.sortList = function (list) {
    var f = A.f || A.def(), s = f.sort || 'due', arr = list.slice();
    var pri = function (k) { return (k.is_important && k.is_urgent) ? 0 : k.is_important ? 1 : k.is_urgent ? 2 : 3; };
    arr.sort(function (a, b) {
      if (s === 'priority') return pri(a) - pri(b) || String(a.due_date || '9999').localeCompare(String(b.due_date || '9999'));
      if (s === 'progress') return (Number(b.progress) || 0) - (Number(a.progress) || 0);
      if (s === 'hours') return (Number(b.est_hours) || 0) - (Number(a.est_hours) || 0);
      if (s === 'updated') return String(b.created_at || '').localeCompare(String(a.created_at || ''));
      return String(a.due_date || '9999').localeCompare(String(b.due_date || '9999'));
    });
    return arr;
  };
  A.summary = function (list) {
    var today = (function () { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })();
    var w = A.weekRange(), total = list.length, overdue = 0, doneW = 0, hours = 0;
    list.forEach(function (k) {
      var due = k.due_date ? String(k.due_date).slice(0, 10) : '';
      if (due && due < today && k.column_key !== 'done') overdue++;
      if (k.column_key === 'done' && due && due >= w[0] && due <= w[1]) doneW++;
      hours += Number(k.est_hours) || 0;
    });
    return { total: total, overdue: overdue, doneW: doneW, hours: Math.round(hours * 10) / 10 };
  };
  A.todayYmd = function () { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  /* Project-level counts. Task filters do not change these. Silent = active project, newest task activity older than 7 days. */
  A.projStats = function (projects, tasks, employees) {
    var today = A.todayYmd();
    var cut = new Date(Date.now() - 7 * 86400000).toISOString();
    var by = {};
    (tasks || []).forEach(function (k) { var id = String(k.project_id); (by[id] = by[id] || []).push(k); });
    var s = { projects: 0, active: 0, done: 0, empty: 0, late: 0, client: 0, internal: 0, silent: 0, load: [] };
    var openBy = {};
    (projects || []).forEach(function (p) {
      s.projects++;
      if (p.kind === 'client') s.client++; else s.internal++;
      var mine = by[String(p.id)] || [];
      if (!mine.length) { s.empty++; return; }
      var open = mine.filter(function (k) { return k.column_key !== 'done'; });
      if (!open.length) s.done++; else s.active++;
      if (open.some(function (k) { var due = k.due_date ? String(k.due_date).slice(0, 10) : ''; return due && due < today; })) s.late++;
      if (open.length) {
        var last = '';
        mine.forEach(function (k) { var t = k.updated_at || k.created_at || ''; if (t > last) last = t; });
        if (last && last < cut) s.silent++;
      }
    });
    (tasks || []).forEach(function (k) {
      if (k.column_key === 'done') return;
      var id = k.assignee_employee_id ? String(k.assignee_employee_id) : '';
      openBy[id] = (openBy[id] || 0) + 1;
    });
    var names = {};
    (employees || []).forEach(function (e) { names[String(e.id)] = e.nickname || e.name || ''; });
    s.load = Object.keys(openBy).map(function (id) { return { id: id, n: openBy[id], name: id ? (names[id] || '') : '' }; })
      .sort(function (a, b) { return b.n - a.n; });
    return s;
  };
  A.visible = function (st) {
    var q = String(st.filter || '').trim().toLowerCase();
    return (st.tasks || []).filter(function (k) {
      if (q && String(k.title || '').toLowerCase().indexOf(q) < 0 && String(k.tag || '').toLowerCase().indexOf(q) < 0) return false;
      if (st.group && k.tag !== st.group) return false;
      return A.match(k);
    });
  };
  A.projOf = function (st, id) { return (st.projects || []).filter(function (p) { return A.same(p.id, id); })[0] || null; };
  A.colorOf = function (st, id, i) {
    var p = A.projOf(st, id); if (p && p.color) return p.color;
    var C = ['#0E7490', '#16A34A', '#D97706', '#7C3AED', '#DC2626', '#0891B2'];
    return C[(i || 0) % C.length];
  };
  A.applyHide = function (st) {
    var main = document.getElementById('main'); if (!main) return;
    var by = {}; (st.tasks || []).forEach(function (k) { by[k.id] = k; });
    var sorted = A.sortList(A.visible(st));
    var order = {}; sorted.forEach(function (k, i) { order[k.id] = i; });
    main.querySelectorAll('.pj-card[data-id], .pj-mcard[data-id], .pj-tlcard[data-id]').forEach(function (n) {
      var k = by[n.getAttribute('data-id')];
      n.classList.toggle('pja-off', !(k && A.match(k)));
    });
    if (st.tab === 'list') {
      var v = (st.tasks || []).filter(function (k) {
        var q = String(st.filter || '').trim().toLowerCase();
        if (q && String(k.title || '').toLowerCase().indexOf(q) < 0 && String(k.tag || '').toLowerCase().indexOf(q) < 0) return false;
        return !(st.group && k.tag !== st.group);
      });
      main.querySelectorAll('.pj-table tbody tr').forEach(function (tr, i) {
        if (v[i]) tr.classList.toggle('pja-off', !A.match(v[i]));
      });
    }
    main.querySelectorAll('.pj-col').forEach(function (c) {
      var cards = [].slice.call(c.querySelectorAll('.pj-card:not(.pja-off):not(.pjm2-off)'));
      cards.sort(function (a, b) { return (order[a.getAttribute('data-id')] || 0) - (order[b.getAttribute('data-id')] || 0); });
      var add = c.querySelector('.pj-add');
      cards.forEach(function (card) { c.insertBefore(card, add || null); });
      var s = c.querySelector('header span'); if (s) s.textContent = cards.length;
    });
  };
  A.rerun = function (st) {
    var b = document.querySelector('#main [data-tab="' + ((st && st.tab) || 'board') + '"]');
    if (b) b.click();
  };

  A.closeSheet = function (el) {
    document.body.classList.remove('pja-sheet-open');
    if (el && el.parentNode) el.remove();
    var x = document.getElementById('pja-sheet'); if (x) x.remove();
  };
  A.syncSheet = function (el, f) {
    if (!el || !f) return;
    var d = el.querySelector('[data-due]'), s = el.querySelector('[data-sort]'), g = el.querySelector('[data-grp]');
    if (d) f.due = d.value; if (s) f.sort = s.value; if (g) A.groupBy = g.value;
  };
  A.savedHtml = function () {
    if (!A.saved.length) return '<span class="cob-xs">' + A.esc(A.L('None yet', 'Belum ada')) + '</span>';
    return A.saved.map(function (s, i) {
      return '<span class="pja-saved-chip"><button type="button" data-load="' + i + '">' + A.esc(s.name) + '</button>' +
        '<button type="button" data-del="' + i + '" aria-label="' + A.esc(A.L('Delete', 'Padam')) + '"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></span>';
    }).join('');
  };
  A.paintSaved = function (el, st) {
    var box = el && el.querySelector('.pja-saved'); if (!box) return;
    box.innerHTML = A.savedHtml();
    box.querySelectorAll('[data-load]').forEach(function (b) {
      b.onclick = function () {
        var s = A.saved[Number(b.getAttribute('data-load'))]; if (!s) return;
        A.f = Object.assign(A.def(), s.f || {}); A.groupBy = s.groupBy || ''; A.persist();
        A.closeSheet(el); A.rerun(st);
      };
    });
    box.querySelectorAll('[data-del]').forEach(function (b) {
      b.onclick = function (e) {
        e.stopPropagation();
        A.saved.splice(Number(b.getAttribute('data-del')), 1); A.persist();
        if (typeof showToast === 'function') showToast(A.L('Filter deleted', 'Tapisan dipadam'), 'success');
        A.paintSaved(el, st);
      };
    });
  };

  A.decorate = function (st) {
    if (!A.f) A.load();
    if (A.ui) A.ui(st);
    if (A.filterUi) A.filterUi(st);
    if (A.groupUi) A.groupUi(st);
    A.applyHide(st);
    if (A.sumUi) A.sumUi(st);
  };
  function hook() {
    var prev = window._pjAfterPaint; if (prev && prev._pja) return;
    var fn = function (st) {
      try { if (A.ui) A.ui(st); } catch (e) { console.warn('pja', e); } /* compact picker at once; do not wait for the multi/WA chain (slow or failed loads left the old project list on mobile) */
      var r; try { r = typeof prev === 'function' ? prev(st) : null; } catch (e) { console.warn('pja', e); }
      return Promise.resolve(r).then(function () { A.decorate(st); }).catch(function (e) { console.warn('pja', e); });
    };
    fn._pjm = prev && prev._pjm; fn._pjm2 = prev && prev._pjm2; fn._pja = 1;
    window._pjAfterPaint = fn;
  }
  hook(); document.addEventListener('DOMContentLoaded', hook);
  var rp = window.renderProjects;
  if (typeof rp === 'function' && !rp._pja) {
    /* opening the module without a target project/task lands on All projects (Mike, 17 Oct); deep links pass params.id */
    var w = function (pr) { A.load(); var a = [].slice.call(arguments); if (!(pr && pr.id) && !window._pjOpenTask) a[0] = Object.assign({}, pr || {}, { id: A.ALL }); return rp.apply(this, a); };
    w._pja = 1; w._pjm2 = rp._pjm2; window.renderProjects = w;
  }
})();
