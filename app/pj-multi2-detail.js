/* M-Core Projects phase 2 - task Detail: per-person progress (own row, or any row for tenant owner/admin), estimated hours,
   task progress = average of assignees (written into the existing progress field before projects.js saveTask), schedule clash confirm. */
(function () {
  var M = window.PJM; if (!M || M.detail2) return;
  function nm(st, id) { var e = (st.employees || []).filter(function (x) { return M.same(x.id, id); })[0]; return e ? (e.nickname || e.name || '') : ''; }
  function pv(k, id) { var r = M.pp[k.id + '|' + id]; return Math.max(0, Math.min(100, Number(r ? r.progress : k.progress) || 0)); }
  M.detail2 = function (st, el, k) {
    var det = el.querySelector('details.pj-detail'), as = det && det.querySelector('.pjm-as'); if (!as || det.querySelector('.pjm2-pp')) return;
    var ls = M.list(k), me = M.meId, adm = M.isTA();
    var prog = det.querySelector('input[data-f="progress"]');
    if (ls.length && prog) { prog.readOnly = true; prog.value = avg(det, k, ls.map(function (a) { return String(a.employee_id); })); prog.insertAdjacentHTML('afterend', '<small class="pjm-hint">' + M.esc(M.L('Average of assignees (set each person below)', 'Purata semua assignee (isi setiap orang di bawah)')) + '</small>'); }
    if (ls.length) {
      var h = '<div class="pjm2-pp"><div class="pjm-lbl">' + M.esc(M.L('Progress by person', 'Kemajuan ikut orang')) + '</div>' + ls.map(function (a) {
        var id = String(a.employee_id), v = pv(k, id), can = adm || (me && M.same(me, id));
        return '<div class="pjm2-row"><span class="pjm2-nm">' + (a.is_owner ? '<i class="ti ti-star-filled" aria-label="Owner"></i> ' : '') + M.esc(nm(st, id) || '?') + '</span><span class="pjm2-bar" role="progressbar" aria-valuenow="' + v + '" aria-valuemin="0" aria-valuemax="100"><i style="width:' + v + '%"></i></span>' +
          (can ? '<input type="number" min="0" max="100" step="5" inputmode="numeric" data-pp="' + M.esc(id) + '" value="' + v + '" aria-label="' + M.esc(M.L('Progress % for ', 'Kemajuan % untuk ') + nm(st, id)) + '"><button type="button" class="pjm2-done" data-ppd="' + M.esc(id) + '" aria-label="' + M.esc(M.L('Mark my part done', 'Tanda bahagian siap')) + '" title="' + M.esc(M.L('Done', 'Siap')) + '"><i class="ti ti-check"></i></button>' : '<b class="pjm2-v">' + v + '%</b>') + '</div>';
      }).join('') + '<small class="pjm-hint">' + M.esc(M.L('New assignees start at 0% after Save.', 'Assignee baharu bermula 0% selepas Simpan.')) + '</small></div>';
      as.insertAdjacentHTML('afterend', h);
      var pp = det.querySelector('.pjm2-pp');
      var sync = function (inp) { var v = Math.max(0, Math.min(100, Number(inp.value) || 0)), b = inp.parentNode.querySelector('.pjm2-bar'); b.setAttribute('aria-valuenow', v); b.firstChild.style.width = v + '%'; if (prog) prog.value = avg(det, k, ls.map(function (a) { return String(a.employee_id); })); };
      pp.querySelectorAll('[data-pp]').forEach(function (i) { i.oninput = function () { sync(i); }; });
      pp.querySelectorAll('[data-ppd]').forEach(function (b) { b.onclick = function () { var i = pp.querySelector('[data-pp="' + b.getAttribute('data-ppd') + '"]'); i.value = 100; sync(i); }; });
    }
    var due = det.querySelector('input[data-f="due_date"]'), lab = due && due.closest('label');
    if (lab) lab.insertAdjacentHTML('afterend', '<label>' + M.esc(M.L('Estimated hours (optional)', 'Anggaran jam kerja (pilihan)')) + '<input type="number" min="0.25" max="999" step="0.25" inputmode="decimal" data-pjm2="est" value="' + (k.est_hours != null ? M.esc(k.est_hours) : '') + '" placeholder="' + M.esc(M.L('e.g. 2', 'cth. 2')) + '"></label>');
  };
  function avg(det, k, ids) {
    if (!ids.length) return 0;
    return Math.round(ids.reduce(function (s, id) { var i = det.querySelector('[data-pp="' + id + '"]'); return s + (i ? Math.max(0, Math.min(100, Number(i.value) || 0)) : pv(k, id)); }, 0) / ids.length);
  }
  M.patchX = M.patchX || []; M.pre = M.pre || []; M.post = M.post || [];
  M.patchX.push(function (det) { if (!M.ok2) return null; var e = det.querySelector('[data-pjm2="est"]'); var v = e && e.value !== '' ? Math.round(Number(e.value) * 100) / 100 : null; return { est_hours: v > 0 ? Math.min(999, v) : null }; });
  /* after link rows are written: per-person rows + task progress = average (saveTask then writes progress/column as today) */
  M.post.push(function (st, det, k, pick) {
    if (!M.ok2 || !pick.length) return null;
    var tid = M.tid();
    return sb.from('project_task_assignees').select('id,employee_id,progress,done_at').eq('tenant_id', tid).eq('task_id', k.id).is('deleted_at', null).then(function (r) {
      if (r.error) throw r.error;
      var now = new Date().toISOString(), ops = [];
      (r.data || []).forEach(function (a) {
        var i = det.querySelector('[data-pp="' + a.employee_id + '"]'); if (!i) return;
        var v = Math.max(0, Math.min(100, Math.round(Number(i.value) || 0))); if (v === Number(a.progress || 0)) return;
        ops.push(sb.from('project_task_assignees').update({ progress: v, done_at: v >= 100 ? (a.done_at || now) : null }).eq('tenant_id', tid).eq('id', a.id));
      });
      return Promise.all(ops).then(function (x) {
        x.forEach(function (y) { if (y.error) throw y.error; });
        var p = det.querySelector('input[data-f="progress"]'); if (p) p.value = avg(det, k, pick);
      });
    });
  });
  /* schedule clash: window = [start date+time | due - est hours, due date+time] */
  function win(sd, stt, dd, dt, est) {
    if (!dd || !dt) return null; var end = new Date(String(dd).slice(0, 10) + 'T' + M.hm(dt) + ':00'), s = null;
    if (sd && stt) s = new Date(String(sd).slice(0, 10) + 'T' + M.hm(stt) + ':00'); else if (est > 0) s = new Date(end - est * 36e5);
    return s && s < end ? [s, end] : null;
  }
  function fm(d) { return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + ' ' + M.hm(d.toTimeString()); }
  M.pre.push(function (st, det, k, pick, own, patch) {
    if (!M.ok2 || !pick.length) return true;
    var v = function (f) { var x = det.querySelector('input[data-f="' + f + '"]'); return x ? x.value : ''; };
    var w = win(v('start_date'), patch.start_time, v('due_date'), patch.due_time, Number(patch.est_hours) || 0); if (!w) return true;
    var tid = M.tid();
    return sb.from('project_task_assignees').select('task_id,employee_id').eq('tenant_id', tid).in('employee_id', pick).is('deleted_at', null).neq('task_id', k.id).limit(500).then(function (a) {
      var rows = (a.data || []).filter(function (x) { return !M.same(x.task_id, k.id); }), ids = []; rows.forEach(function (x) { if (ids.indexOf(x.task_id) < 0) ids.push(x.task_id); });
      if (!ids.length) return true;
      return sb.from('project_tasks').select('id,title,column_key,start_date,start_time,due_date,due_time,est_hours').eq('tenant_id', tid).in('id', ids).is('deleted_at', null).neq('column_key', 'done').then(function (r) {
        var hit = [];
        (r.data || []).forEach(function (t) {
          if (t.column_key === 'done') return; var o = win(t.start_date, t.start_time, t.due_date, t.due_time, Number(t.est_hours) || 0);
          if (!o || !(o[0] < w[1] && w[0] < o[1])) return;
          rows.filter(function (x) { return M.same(x.task_id, t.id); }).forEach(function (x) { hit.push('• ' + nm(st, x.employee_id) + ': ' + t.title + ' (' + fm(o[0]) + ' – ' + fm(o[1]) + ')'); });
        });
        if (!hit.length) return true;
        return window.confirm(M.L('Schedule clash: these assignees already have open tasks at this time:\n', 'Jadual bertindih: assignee ini sudah ada task aktif pada masa yang sama:\n') + hit.slice(0, 8).join('\n') + M.L('\n\nSave anyway?', '\n\nSimpan juga?'));
      });
    });
  });
})();
