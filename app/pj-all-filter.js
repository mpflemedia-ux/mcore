/* M-Core Projects All-projects - Filter & Sort bottom sheet, active chips, saved filters, CSV export. */
(function () {
  var A = window.PJA; if (!A || A.filterUi) return;
  var COLS = [
    { key: 'backlog', en: 'Backlog', bm: 'Belakang' },
    { key: 'progress', en: 'In Progress', bm: 'Sedang Jalan' },
    { key: 'review', en: 'Review', bm: 'Semakan' },
    { key: 'done', en: 'Done', bm: 'Siap' }
  ];
  var SORTS = [
    ['due', 'Due nearest', 'Due paling dekat'],
    ['priority', 'Priority', 'Priority'],
    ['progress', 'Progress %', 'Kemajuan %'],
    ['hours', 'Est. hours', 'Anggaran jam'],
    ['updated', 'Recently updated', 'Baru dikemas kini']
  ];
  var DUES = [
    ['', 'Any due', 'Semua due'],
    ['overdue', 'Overdue', 'Lewat'],
    ['today', 'Today', 'Hari ni'],
    ['week', 'This week', 'Minggu ni']
  ];
  var GROUPS = [
    ['', 'Status columns', 'Lajur status'],
    ['project', 'Group by project', 'Kumpul ikut projek'],
    ['assignee', 'Group by assignee', 'Kumpul ikut assignee']
  ];

  function nick(st, id) {
    var e = (st.employees || []).filter(function (x) { return A.same(x.id, id); })[0];
    return e ? (e.nickname || e.name || '') : id;
  }
  function toggle(arr, v) {
    v = String(v); var i = arr.indexOf(v);
    if (i >= 0) arr.splice(i, 1); else arr.push(v);
  }
  function chips(st) {
    var main = document.getElementById('main'); if (!main) return;
    var old = main.querySelector('.pja-chips'); if (old) old.remove();
    var f = A.f || A.def(), bits = [];
    f.assignees.forEach(function (id) { bits.push(['a', id, nick(st, id)]); });
    f.projects.forEach(function (id) { var p = A.projOf(st, id); bits.push(['p', id, p ? p.name : id]); });
    f.status.forEach(function (k) { var c = COLS.filter(function (x) { return x.key === k; })[0]; bits.push(['s', k, c ? A.L(c.en, c.bm) : k]); });
    f.tags.forEach(function (t) { bits.push(['t', t, t]); });
    if (f.due) { var d = DUES.filter(function (x) { return x[0] === f.due; })[0]; bits.push(['d', f.due, d ? A.L(d[1], d[2]) : f.due]); }
    if (f.sort && f.sort !== 'due') { var s = SORTS.filter(function (x) { return x[0] === f.sort; })[0]; bits.push(['o', f.sort, s ? A.L(s[1], s[2]) : f.sort]); }
    if (A.groupBy) { var g = GROUPS.filter(function (x) { return x[0] === A.groupBy; })[0]; bits.push(['g', A.groupBy, g ? A.L(g[1], g[2]) : A.groupBy]); }
    if (!bits.length) return;
    var host = main.querySelector('.pja-sum') || main.querySelector('.pj-tabs'); if (!host) return;
    var html = '<div class="pja-chips">' + bits.map(function (b) {
      return '<span class="pja-chip">' + A.esc(b[2]) + '<button type="button" data-rm="' + b[0] + '" data-v="' + A.esc(b[1]) + '" aria-label="' + A.esc(A.L('Remove', 'Buang')) + '"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></span>';
    }).join('') + '<button type="button" class="btn btn-sm btn-outline" data-pja-clr>' + A.esc(A.L('Clear', 'Kosongkan')) + '</button></div>';
    if (host.classList.contains('pja-sum')) host.insertAdjacentHTML('afterend', html);
    else host.insertAdjacentHTML('afterend', html);
    main.querySelectorAll('.pja-chips [data-rm]').forEach(function (btn) {
      btn.onclick = function () {
        var k = btn.getAttribute('data-rm'), v = btn.getAttribute('data-v');
        if (k === 'a') A.f.assignees = A.f.assignees.filter(function (x) { return !A.same(x, v); });
        else if (k === 'p') A.f.projects = A.f.projects.filter(function (x) { return !A.same(x, v); });
        else if (k === 's') A.f.status = A.f.status.filter(function (x) { return x !== v; });
        else if (k === 't') A.f.tags = A.f.tags.filter(function (x) { return x !== v; });
        else if (k === 'd') A.f.due = '';
        else if (k === 'o') A.f.sort = 'due';
        else if (k === 'g') A.groupBy = '';
        A.persist(); A.rerun(st);
      };
    });
    var clr = main.querySelector('[data-pja-clr]');
    if (clr) clr.onclick = function () { A.f = A.def(); A.groupBy = ''; A.persist(); A.rerun(st); };
  }

  function openSheet(st) {
    A.closeSheet(document.getElementById('pja-sheet'));
    A.load();
    var f = A.f, tags = [];
    (st.tasks || []).forEach(function (k) { if (k.tag && tags.indexOf(k.tag) < 0) tags.push(k.tag); });
    function opt(list, key, label) {
      var on = list.indexOf(String(key)) >= 0 ? ' on' : '';
      return '<label class="' + on.trim() + '"><input type="checkbox" data-k="' + A.esc(key) + '"' + (on ? ' checked' : '') + '> ' + A.esc(label) + '</label>';
    }
    var el = document.createElement('div'); el.id = 'pja-sheet'; el.className = 'pja-sheet';
    el.innerHTML = '<div class="pja-panel" role="dialog" aria-modal="true"><div class="pja-panel-body"><h3>' + A.esc(A.L('Filter & Sort', 'Tapis & Susun')) + '</h3>' +
      '<div class="pja-sec"><b>' + A.esc(A.L('Assignee', 'Assignee')) + '</b><div class="pja-opts" data-g="assignees">' +
      (st.employees || []).map(function (e) { return opt(f.assignees, e.id, e.nickname || e.name); }).join('') + '</div></div>' +
      (A.isAll(st) ? '<div class="pja-sec"><b>' + A.esc(A.L('Project', 'Projek')) + '</b><div class="pja-opts" data-g="projects">' +
        (st.projects || []).map(function (p) { return opt(f.projects, p.id, p.name); }).join('') + '</div></div>' : '') +
      '<div class="pja-sec"><b>' + A.esc(A.L('Status', 'Status')) + '</b><div class="pja-opts" data-g="status">' +
      COLS.map(function (c) { return opt(f.status, c.key, A.L(c.en, c.bm)); }).join('') + '</div></div>' +
      '<div class="pja-sec"><b>' + A.esc(A.L('Tag', 'Tag')) + '</b><div class="pja-opts" data-g="tags">' +
      tags.map(function (t) { return opt(f.tags, t, t); }).join('') + '</div></div>' +
      '<div class="pja-sec"><b>' + A.esc(A.L('Due', 'Due')) + '</b><select data-due>' + DUES.map(function (d) { return '<option value="' + d[0] + '"' + (f.due === d[0] ? ' selected' : '') + '>' + A.esc(A.L(d[1], d[2])) + '</option>'; }).join('') + '</select></div>' +
      '<div class="pja-sec"><b>' + A.esc(A.L('Sort', 'Susun')) + '</b><select data-sort>' + SORTS.map(function (d) { return '<option value="' + d[0] + '"' + (f.sort === d[0] ? ' selected' : '') + '>' + A.esc(A.L(d[1], d[2])) + '</option>'; }).join('') + '</select></div>' +
      '<div class="pja-sec"><b>' + A.esc(A.L('Board columns', 'Lajur papan')) + '</b><select data-grp>' + GROUPS.map(function (d) { return '<option value="' + d[0] + '"' + (A.groupBy === d[0] ? ' selected' : '') + '>' + A.esc(A.L(d[1], d[2])) + '</option>'; }).join('') + '</select></div>' +
      '<div class="pja-sec"><b>' + A.esc(A.L('Saved filters', 'Tapisan tersimpan')) + '</b><div class="pja-saved"></div>' +
      '<div class="pja-save-row"><input type="text" id="pja-save-name" placeholder="' + A.esc(A.L('Name this filter', 'Nama tapisan ini')) + '" autocomplete="off">' +
      '<button type="button" class="btn btn-sm btn-primary" data-save>' + A.esc(A.L('Save', 'Simpan')) + '</button></div></div></div>' +
      '<div class="pja-panel-foot"><div class="pja-actions">' +
      '<button type="button" class="btn btn-sm btn-outline" data-export>' + A.esc(A.L('Export CSV', 'Export CSV')) + '</button>' +
      '<button type="button" class="btn btn-sm btn-outline" data-x>' + A.esc(A.L('Cancel', 'Batal')) + '</button>' +
      '<button type="button" class="btn btn-sm btn-primary" data-ok>' + A.esc(A.L('Apply', 'Guna')) + '</button></div></div></div>';
    document.body.appendChild(el);
    document.body.classList.add('pja-sheet-open');
    el.querySelectorAll('.pja-opts').forEach(function (box) {
      box.querySelectorAll('label').forEach(function (lab) {
        lab.onclick = function (e) {
          e.preventDefault();
          var inp = lab.querySelector('input'), g = box.getAttribute('data-g');
          toggle(f[g], inp.getAttribute('data-k'));
          lab.classList.toggle('on', f[g].indexOf(String(inp.getAttribute('data-k'))) >= 0);
          inp.checked = lab.classList.contains('on');
        };
      });
    });
    el.querySelector('[data-x]').onclick = function () { A.closeSheet(el); };
    el.onclick = function (e) { if (e.target === el) A.closeSheet(el); };
    el.querySelector('[data-ok]').onclick = function () { A.syncSheet(el, f); A.f = f; A.persist(); A.closeSheet(el); A.rerun(st); };
    el.querySelector('[data-save]').onclick = function () {
      var name = String((document.getElementById('pja-save-name') || {}).value || '').trim();
      if (!name) {
        if (typeof showToast === 'function') showToast(A.L('Enter a name for this filter', 'Isi nama untuk tapisan ini'), 'error');
        var inp = document.getElementById('pja-save-name'); if (inp) inp.focus();
        return;
      }
      A.syncSheet(el, f);
      A.saved = A.saved.filter(function (s) { return s.name !== name; });
      A.saved.unshift({ name: name, f: JSON.parse(JSON.stringify(f)), groupBy: A.groupBy });
      A.saved = A.saved.slice(0, 8); A.persist();
      if (typeof showToast === 'function') showToast(A.L('Filter saved', 'Tapisan disimpan'), 'success');
      var inp = document.getElementById('pja-save-name'); if (inp) inp.value = '';
      A.paintSaved(el, st);
    };
    A.paintSaved(el, st);
    el.querySelector('[data-export]').onclick = function () { A.syncSheet(el, f); A.f = f; exportCsv(st); };
    var nameInp = document.getElementById('pja-save-name');
    if (nameInp) nameInp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); el.querySelector('[data-save]').click(); } });
  }

  function exportCsv(st) {
    var list = A.sortList(A.visible(st));
    var head = ['title', 'project', 'status', 'tag', 'assignee', 'due', 'progress', 'est_hours'];
    var rows = list.map(function (k) {
      var p = A.projOf(st, k.project_id);
      var who = A.assigneesOf(k).map(function (id) { return nick(st, id); }).join('; ');
      return [k.title, p ? p.name : '', k.column_key, k.tag || '', who, k.due_date ? String(k.due_date).slice(0, 10) : '', k.progress || 0, k.est_hours || ''].map(function (v) {
        var s = String(v == null ? '' : v); return /["\n,]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(',');
    });
    var blob = new Blob([[head.join(',')].concat(rows).join('\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'projects-tasks.csv'; a.click(); URL.revokeObjectURL(a.href);
  }

  A.filterUi = function (st) {
    var main = document.getElementById('main'); if (!main) return;
    var box = main.querySelector('.pj-tools'); if (!box) return;
    if (!document.getElementById('pja-fs')) {
      var extra = document.createElement('span'); extra.className = 'pja-tools-extra';
      extra.innerHTML = '<button type="button" class="btn btn-sm btn-outline' + (A.hasFilt() ? ' pja-on' : '') + '" id="pja-fs"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="vertical-align:-2px" aria-hidden="true"><path d="M4 5h16M7 12h10M10 19h4"/></svg> ' + A.esc(A.L('Filter & Sort', 'Tapis & Susun')) + '</button>';
      box.appendChild(extra);
      document.getElementById('pja-fs').onclick = function () { openSheet(st); };
    } else {
      document.getElementById('pja-fs').classList.toggle('pja-on', A.hasFilt());
      document.getElementById('pja-fs').onclick = function () { openSheet(st); };
    }
    chips(st);
  };
})();
