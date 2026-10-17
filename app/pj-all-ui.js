/* M-Core Projects All-projects - UI: mobile compact selector + ⋯ menu, project pills, summary strip, New Task project picker. */
(function () {
  var A = window.PJA; if (!A || A.ui) return;
  function closeMenus() { document.querySelectorAll('.pja-menu.on').forEach(function (m) { m.classList.remove('on'); }); }
  document.addEventListener('click', function (e) { if (!e.target.closest('.pja-more-wrap')) closeMenus(); });

  function buildBar(st) {
    var wrap = document.querySelector('#main .pj-wrap'); if (!wrap) return;
    wrap.classList.add('pja-compact');
    var side = wrap.querySelector('.pj-side'); if (!side) return;
    var old = side.querySelector('.pja-bar'); if (old) old.remove();
    var opts = '';
    if (!st.showArchived) opts += '<option value="' + A.ALL + '"' + (A.isAll(st) ? ' selected' : '') + '>' + A.esc(A.L('All projects', 'Semua projek')) + '</option>';
    (st.projects || []).forEach(function (p) {
      opts += '<option value="' + A.esc(p.id) + '"' + (A.same(p.id, st.projectId) ? ' selected' : '') + '>' + A.esc(p.name) + '</option>';
    });
    var cur = A.isAll(st) ? null : A.projOf(st, st.projectId);
    var bar = document.createElement('div'); bar.className = 'pja-bar';
    bar.innerHTML = '<select id="pja-sel" aria-label="' + A.esc(A.L('Project', 'Projek')) + '">' + opts + '</select>' +
      '<div class="pja-more-wrap">' +
      '<button type="button" class="pja-more" id="pja-more" aria-haspopup="true" aria-expanded="false" aria-label="' + A.esc(A.L('More', 'Lagi')) + '">' +
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg></button>' +
      '<div class="pja-menu" id="pja-menu" role="menu">' +
        '<button type="button" data-pja="new">' + A.esc(A.L('New project', 'Projek baru')) + '</button>' +
        '<button type="button" data-pja="arch-view">' + A.esc(st.showArchived ? A.L('Show active', 'Tunjuk aktif') : A.L('Show archive', 'Tunjuk arkib')) + '</button>' +
        (cur ? '<button type="button" data-pja="edit">' + A.esc(A.L('Edit project', 'Ubah projek')) + '</button>' +
          '<button type="button" data-pja="arch">' + A.esc(st.showArchived ? A.L('Restore', 'Pulih') : A.L('Archive', 'Arkib')) + '</button>' +
          '<button type="button" class="danger" data-pja="del">' + A.esc(A.L('Delete project', 'Padam projek')) + '</button>' : '') +
      '</div></div>';
    side.insertBefore(bar, side.firstChild);
    document.getElementById('pja-sel').onchange = function () {
      var v = this.value, btn = side.querySelector('button[data-proj="' + v + '"]');
      if (btn) btn.click();
      else { st.projectId = v; if (typeof renderProjects === 'function') renderProjects({ id: v }); }
    };
    document.getElementById('pja-more').onclick = function (e) { e.stopPropagation(); var m = document.getElementById('pja-menu'); m.classList.toggle('on'); this.setAttribute('aria-expanded', m.classList.contains('on')); };
    bar.querySelectorAll('[data-pja]').forEach(function (b) {
      b.onclick = function (e) {
        e.stopPropagation(); closeMenus();
        var act = b.getAttribute('data-pja');
        if (act === 'new') { var n = document.getElementById('pj-new'); if (n) n.click(); return; }
        if (act === 'arch-view') { var a = document.getElementById('pj-arch-view'); if (a) a.click(); return; }
        if (!cur) return;
        var map = { edit: '[data-proj-edit="' + cur.id + '"]', del: '[data-proj-del="' + cur.id + '"]', arch: st.showArchived ? '[data-proj-restore="' + cur.id + '"]' : '[data-proj-arch="' + cur.id + '"]' };
        var x = side.querySelector(map[act]); if (x) x.click();
      };
    });
  }

  function pills(st) {
    if (!A.isAll(st)) return;
    var main = document.getElementById('main'); if (!main) return;
    var by = {}, idx = {};
    (st.tasks || []).forEach(function (k) { by[k.id] = k; });
    (st.projects || []).forEach(function (p, i) { idx[p.id] = i; });
    main.querySelectorAll('.pj-card[data-id]').forEach(function (el) {
      if (el.querySelector('.pja-pill')) return;
      var k = by[el.getAttribute('data-id')]; if (!k) return;
      var p = A.projOf(st, k.project_id); if (!p) return;
      var col = A.colorOf(st, k.project_id, idx[k.project_id] || 0);
      var title = el.querySelector('.pj-card-title');
      var html = '<span class="pja-pill" title="' + A.esc(p.name) + '"><i style="background:' + A.esc(col) + '"></i>' + A.esc(p.name) + '</span>';
      if (title) title.insertAdjacentHTML('afterend', html); else el.insertAdjacentHTML('afterbegin', html);
    });
  }

  A.sumUi = function (st) {
    var main = document.getElementById('main'); if (!main) return;
    var old = main.querySelector('.pja-sum'); if (old) old.remove();
    if (!(A.isAll(st) || A.hasFilt())) return;
    var list = A.visible(st);
    if (window.PJM && PJM.ok2) {
      list = list.filter(function (k) {
        if (PJM.mine && PJM.meId && !PJM.has(k, PJM.meId)) return false;
        if (PJM.af && !PJM.has(k, PJM.af)) return false;
        return true;
      });
    }
    var s = A.summary(list), host = main.querySelector('.pj-tabs'); if (!host) return;
    var ps = A.projStats ? A.projStats(st.projects || [], st.tasks || [], st.employees || []) : null;
    var cell = function (label, n, late) { return '<div' + (late ? ' class="late"' : '') + '><small>' + A.esc(label) + '</small><b>' + n + '</b></div>'; };
    var row = '';
    if (ps && A.isAll(st)) {
      row = cell(A.L('Projects', 'Projek'), ps.projects) +
        cell(A.L('Active', 'Aktif'), ps.active) +
        cell(A.L('Done', 'Siap'), ps.done) +
        cell(A.L('Empty', 'Kosong'), ps.empty) +
        cell(A.L('Late projects', 'Projek lewat'), ps.late, true) +
        cell(A.L('Client', 'Klien'), ps.client) +
        cell(A.L('Internal', 'Dalaman'), ps.internal);
    }
    row += cell(A.L('Total', 'Jumlah'), s.total) +
      cell(A.L('Overdue', 'Lewat'), s.overdue, true) +
      cell(A.L('Done this week', 'Siap minggu ni'), s.doneW) +
      cell(A.L('Est. hours', 'Anggaran jam'), s.hours + 'h');
    var meta = '';
    if (ps && A.isAll(st)) {
      var named = ps.load.filter(function (x) { return x.id; }).slice(0, 3);
      var none = ps.load.filter(function (x) { return !x.id; })[0];
      var bits = named.map(function (x) { return A.esc(x.name || '—') + ' ' + x.n; });
      if (none) bits.push(A.esc(A.L('Unassigned', 'Tiada assignee')) + ' ' + none.n);
      meta = '<div class="pja-sum2">' + A.esc(A.L('Quiet 7 days', 'Senyap 7 hari')) + ': <b>' + ps.silent + '</b>' +
        (bits.length ? ' · ' + A.esc(A.L('Load', 'Beban')) + ': ' + bits.join(' · ') : '') + '</div>';
    }
    host.insertAdjacentHTML('afterend', '<div class="pja-sum" role="status">' + row + '</div>' + meta);
  };

  function openPick(st, cb) {
    var old = document.getElementById('pja-pick'); if (old) old.remove();
    var opts = (st.projects || []).map(function (p) { return '<option value="' + A.esc(p.id) + '">' + A.esc(p.name) + '</option>'; }).join('');
    var el = document.createElement('div'); el.id = 'pja-pick'; el.className = 'pja-sheet';
    el.innerHTML = '<div class="pja-panel"><h3>' + A.esc(A.L('Choose project', 'Pilih projek')) + '</h3>' +
      '<div class="pja-sec"><select id="pja-pick-sel">' + opts + '</select></div>' +
      '<div class="pja-actions"><button type="button" class="btn btn-sm btn-outline" data-x>' + A.esc(A.L('Cancel', 'Batal')) + '</button>' +
      '<button type="button" class="btn btn-sm btn-primary" data-ok>' + A.esc(A.L('Continue', 'Teruskan')) + '</button></div></div>';
    document.body.appendChild(el);
    el.querySelector('[data-x]').onclick = function () { el.remove(); };
    el.onclick = function (e) { if (e.target === el) el.remove(); };
    el.querySelector('[data-ok]').onclick = function () { var v = document.getElementById('pja-pick-sel').value; el.remove(); if (v) cb(v); };
  }

  function wireAdd(st) {
    if (!A.isAll(st)) return;
    var main = document.getElementById('main'); if (!main) return;
    function intercept(el, col) {
      if (!el || el._pja) return; el._pja = 1;
      el.addEventListener('click', function (e) {
        if (el._pjaSkip) { el._pjaSkip = 0; return; }
        e.stopImmediatePropagation(); e.preventDefault();
        openPick(st, function (pid) {
          window._pjaAddPid = pid;
          el._pjaSkip = 1;
          el.click();
        });
      }, true);
    }
    intercept(document.getElementById('pj-task'), 'backlog');
    main.querySelectorAll('[data-add]').forEach(function (btn) { intercept(btn, btn.getAttribute('data-add')); });
  }

  A.ui = function (st) {
    if (!document.querySelector('#main .pj-wrap')) return;
    buildBar(st); pills(st); wireAdd(st);
  };
})();
