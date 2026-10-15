/* M-Core Projects phase 1 - task Detail: assignee tick list + chips (star = Owner), optional start/due time, reminder option, save of link rows/times.
   Owner goes to the existing hidden select[data-f=assignee_employee_id] so projects.js saveTask() keeps writing assignee_employee_id. */
(function () {
  var M = window.PJM; if (!M || M.detail) return;
  function emp(st, id) { return (st.employees || []).filter(function (e) { return M.same(e.id, id); })[0] || null; }
  function nm(e) { return e ? (e.nickname || e.name || '') : ''; }
  var REM = [[0, 'None', 'Tiada'], [15, '15 min before', '15 minit sebelum'], [60, '1 hour before', '1 jam sebelum'], [1440, '1 day before', '1 hari sebelum']];
  M.detail = function (st, el, k) {
    var det = el.querySelector('details.pj-detail'), sel = det && det.querySelector('select[data-f="assignee_employee_id"]');
    if (!sel || det.querySelector('.pjm-as')) return;
    var lab = sel.closest('label'); lab.classList.add('pjm-hide');
    var pick = M.list(k).map(function (a) { return String(a.employee_id); });
    var own = pick[0] || '';
    var box = document.createElement('div'); box.className = 'pjm-as'; lab.insertAdjacentElement('afterend', box);
    function draw() {
      sel.value = own || '';
      var chips = pick.map(function (id) { var e = emp(st, id), o = M.same(id, own); return '<span class="pjm-chip' + (o ? ' own' : '') + '"><button type="button" class="pjm-star" data-own="' + M.esc(id) + '" aria-pressed="' + o + '" aria-label="' + M.esc(M.L('Make owner: ', 'Jadikan owner: ') + nm(e)) + '" title="' + M.esc(o ? M.L('Owner', 'Owner') : M.L('Make owner', 'Jadikan owner')) + '"><i class="ti ' + (o ? 'ti-star-filled' : 'ti-star') + '"></i></button><b>' + M.esc(nm(e) || '?') + '</b><button type="button" class="pjm-x" data-rm="' + M.esc(id) + '" aria-label="' + M.esc(M.L('Remove ', 'Buang ') + nm(e)) + '"><i class="ti ti-x"></i></button></span>'; }).join('');
      box.innerHTML = '<div class="pjm-lbl">' + M.esc(M.L('Assignees', 'Assignee')) + ' <small>' + M.esc(M.L('★ = Owner (closes the task)', '★ = Owner (bertanggungjawab tutup task)')) + '</small></div>' +
        '<div class="pjm-chips">' + (chips || '<small class="pjm-none">' + M.esc(M.L('No assignee yet', 'Belum ada assignee')) + '</small>') + '</div>' +
        '<div class="pjm-list" role="group" aria-label="' + M.esc(M.L('Pick assignees', 'Pilih assignee')) + '">' + (st.employees || []).map(function (e) { var on = pick.indexOf(String(e.id)) >= 0; return '<label class="pjm-opt"><input type="checkbox" data-pk="' + M.esc(e.id) + '"' + (on ? ' checked' : '') + '><span>' + M.esc(nm(e)) + '</span></label>'; }).join('') + '</div>';
      box.querySelectorAll('[data-pk]').forEach(function (c) { c.onchange = function () { var id = c.getAttribute('data-pk'); if (c.checked) { if (pick.indexOf(id) < 0) pick.push(id); if (!own) own = id; } else { pick = pick.filter(function (x) { return x !== id; }); if (own === id) own = pick[0] || ''; } draw(); }; });
      box.querySelectorAll('[data-own]').forEach(function (b) { b.onclick = function () { own = b.getAttribute('data-own'); draw(); }; });
      box.querySelectorAll('[data-rm]').forEach(function (b) { b.onclick = function () { var id = b.getAttribute('data-rm'); pick = pick.filter(function (x) { return x !== id; }); if (own === id) own = pick[0] || ''; draw(); }; });
    }
    draw();
    ['start', 'due'].forEach(function (f) {
      var d = det.querySelector('input[data-f="' + f + '_date"]'); if (!d) return;
      var w = document.createElement('span'); w.className = 'pjm-dt'; d.parentNode.insertBefore(w, d); w.appendChild(d);
      w.insertAdjacentHTML('beforeend', '<input type="time" data-pjm="' + f + '_time" aria-label="' + M.esc(f === 'start' ? M.L('Start time (optional)', 'Masa mula (pilihan)') : M.L('Due time (optional)', 'Masa due (pilihan)')) + '" value="' + M.esc(M.hm(k[f + '_time'])) + '">');
    });
    var dueLab = det.querySelector('input[data-f="due_date"]'); dueLab = dueLab && dueLab.closest('label');
    if (dueLab) dueLab.insertAdjacentHTML('afterend', '<label>' + M.esc(M.L('Reminder', 'Peringatan')) + '<select data-pjm="remind">' + REM.map(function (r) { return '<option value="' + r[0] + '"' + (Number(k.remind_before_min || 0) === r[0] ? ' selected' : '') + '>' + M.esc(M.L(r[1], r[2])) + '</option>'; }).join('') + '</select><small class="pjm-hint">' + M.esc(M.L('Bell to all assignees. No due time = 9:00 AM on the due date.', 'Notifikasi kepada semua assignee. Tiada masa due = 9:00 pagi pada tarikh due.')) + '</small></label>');
    var btn = det.querySelector('[data-act="save"]');
    el.addEventListener('click', function (ev) {
      if (!btn || !(ev.target === btn || btn.contains(ev.target)) || btn._pjmGo) return;
      ev.stopPropagation(); ev.preventDefault();
      save(st, det, k, pick.slice(), own).then(function (ok) { if (!ok) return; btn._pjmGo = 1; try { btn.onclick({ preventDefault: function () {} }); } finally { btn._pjmGo = 0; } });
    }, true);
  };
  function save(st, det, k, pick, own) {
    var v = function (n) { var x = det.querySelector('[data-pjm="' + n + '"]'); return x ? x.value : ''; }, tid = M.tid();
    var due = (det.querySelector('input[data-f="due_date"]') || {}).value || '';
    var rem = Number(v('remind')) || null;
    var patch = { start_time: v('start_time') || null, due_time: v('due_time') || null, remind_before_min: rem };
    if (due !== String(k.due_date || '').slice(0, 10) || M.hm(patch.due_time) !== M.hm(k.due_time) || rem !== (k.remind_before_min || null)) patch.remind_sent_for = null;
    (M.patchX || []).forEach(function (f) { try { Object.assign(patch, f(det, k) || {}); } catch (e) {} });
    var cur = (M.as[k.id] || []), now = new Date().toISOString(), ops = [];
    var gone = cur.filter(function (a) { return pick.indexOf(String(a.employee_id)) < 0; }).map(function (a) { return a.id; });
    var add = pick.filter(function (id) { return !cur.some(function (a) { return M.same(a.employee_id, id); }); });
    var pre = (M.pre || []).reduce(function (p, f) { return p.then(function (go) { return go && f(st, det, k, pick, own, patch); }); }, Promise.resolve(true));
    return pre.then(function (go) { if (!go) throw { quiet: 1 }; return sb.from('project_tasks').update(patch).eq('id', k.id).eq('tenant_id', tid); }).then(function (r) {
      if (r.error) throw r.error;
      if (gone.length) ops.push(sb.from('project_task_assignees').update({ deleted_at: now, is_owner: false }).eq('tenant_id', tid).in('id', gone));
      return Promise.all(ops);
    }).then(function (rs) {
      rs.forEach(function (x) { if (x.error) throw x.error; });
      var stale = cur.filter(function (a) { return a.is_owner && !M.same(a.employee_id, own) && gone.indexOf(a.id) < 0; }).map(function (a) { return a.id; });
      return stale.length ? sb.from('project_task_assignees').update({ is_owner: false }).eq('tenant_id', tid).in('id', stale) : { error: null };
    }).then(function (x) {
      if (x.error) throw x.error;
      return add.length ? sb.from('project_task_assignees').insert(add.map(function (id) { return { tenant_id: tid, task_id: k.id, employee_id: id, is_owner: M.same(id, own) }; })) : { error: null };
    }).then(function (x) {
      if (x.error) throw x.error;
      var o = cur.filter(function (a) { return M.same(a.employee_id, own) && !a.is_owner; })[0];
      return o ? sb.from('project_task_assignees').update({ is_owner: true }).eq('tenant_id', tid).eq('id', o.id) : { error: null };
    }).then(function (x) {
      if (x.error) throw x.error;
      notifyAdded(k, add.filter(function (id) { return !M.same(id, own); }), det);
      return (M.post || []).reduce(function (p, f) { return p.then(function () { return f(st, det, k, pick, own); }); }, Promise.resolve());
    }).then(function () { return true; }).catch(function (e) { if (!(e && e.quiet)) M.toast((e && e.message) || 'Error', 'error'); return false; });
  }
  /* owner change is already notified by NT.taskSaved (projects.js); this covers added helpers */
  function notifyAdded(k, ids, det) {
    var NT = window.NT; if (!NT || !NT.on || !ids.length || !NT.userForEmp) return;
    var title = ((det.querySelector('input[data-f="title"]') || {}).value || k.title || 'Task');
    ids.forEach(function (id) { NT.userForEmp(id).then(function (u) { if (u) NT.notify({ users: [u], kind: 'for_you', type: 'assigned.task', ref_table: 'project_tasks', ref_id: k.id, title: ((APP.user && APP.user.name) || 'M-Core') + M.L(' added you to: ', ' tambah kau dalam: ') + title, body: '', link: { page: 'projects', params: { id: k.project_id } } }); }); });
  }
})();
