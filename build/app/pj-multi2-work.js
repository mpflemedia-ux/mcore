/* M-Core Projects phase 2 - "Workload / Beban kerja" panel (tenant owner/admin, all projects): estimated hours per staff for this week (Mon-Sun).
   A task counts in the week of its due date (start date if no due date); not Done; est_hours split evenly between its assignees. Over 40h = over capacity. */
(function () {
  var M = window.PJM; if (!M || M.workTool) return;
  var CAP = 40; M.workOn = false;
  function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function week() { var d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); var e = new Date(d); e.setDate(d.getDate() + 6); return [ymd(d), ymd(e)]; }
  M.workCalc = function (tasks, links) {
    var by = {}; (links || []).forEach(function (a) { (by[a.task_id] = by[a.task_id] || []).push(String(a.employee_id)); });
    var out = {};
    (tasks || []).forEach(function (k) {
      var h = Number(k.est_hours) || 0; if (h <= 0 || k.column_key === 'done') return;
      var ids = (by[k.id] || []).slice(); if (k.assignee_employee_id && ids.indexOf(String(k.assignee_employee_id)) < 0) ids.push(String(k.assignee_employee_id));
      if (!ids.length) return;
      ids.forEach(function (id) { var o = out[id] || (out[id] = { h: 0, n: 0 }); o.h += h / ids.length; o.n++; });
    });
    return out;
  };
  M.workTool = function (main, st) {
    if (!M.isTA()) return; var box = main.querySelector('.pj-tools'); if (!box || document.getElementById('pjm2-work')) return;
    box.insertAdjacentHTML('beforeend', '<button type="button" class="btn btn-sm btn-outline' + (M.workOn ? ' pjm2-on' : '') + '" id="pjm2-work" aria-pressed="' + M.workOn + '"><i class="ti ti-chart-bar"></i> ' + M.esc(M.L('Workload', 'Beban kerja')) + '</button>');
    document.getElementById('pjm2-work').onclick = function () { M.workOn = !M.workOn; this.classList.toggle('pjm2-on', M.workOn); this.setAttribute('aria-pressed', M.workOn); M.workPaint(main, st); };
  };
  M.workPaint = function (main, st) {
    var old = main.querySelector('.pjm2-work'); if (old) old.remove();
    if (!M.workOn || !M.isTA()) return;
    var host = main.querySelector('.pj-tabs'); if (!host) return;
    var el = document.createElement('div'); el.className = 'cob-card pjm2-work'; el.innerHTML = '<div class="page-loading" style="min-height:60px"><div class="spinner"></div></div>';
    host.insertAdjacentElement('afterend', el);
    var w = week(), tid = M.tid(), cols = 'id,title,column_key,assignee_employee_id,due_date,start_date,est_hours';
    Promise.all([
      sb.from('project_tasks').select(cols).eq('tenant_id', tid).is('deleted_at', null).neq('column_key', 'done').gte('due_date', w[0]).lte('due_date', w[1]).limit(1000),
      sb.from('project_tasks').select(cols).eq('tenant_id', tid).is('deleted_at', null).neq('column_key', 'done').is('due_date', null).gte('start_date', w[0]).lte('start_date', w[1]).limit(1000)
    ]).then(function (r) {
      if (r[0].error) throw r[0].error;
      var ks = (r[0].data || []).concat((r[1] && !r[1].error && r[1].data) || []).filter(function (k) { return Number(k.est_hours) > 0; });
      var ids = ks.map(function (k) { return k.id; });
      return (ids.length ? sb.from('project_task_assignees').select('task_id,employee_id').eq('tenant_id', tid).in('task_id', ids).is('deleted_at', null) : Promise.resolve({ data: [] })).then(function (a) { return M.workCalc(ks, a.data || []); });
    }).then(function (wl) {
      var name = function (id) { var e = (st.employees || []).filter(function (x) { return M.same(x.id, id); })[0]; return e ? (e.nickname || e.name || '') : '?'; };
      var rows = Object.keys(wl).map(function (id) { return { id: id, n: name(id), h: Math.round(wl[id].h * 10) / 10, c: wl[id].n }; }).sort(function (a, b) { return b.h - a.h; });
      var dm = function (d) { return d.slice(8, 10) + '/' + d.slice(5, 7); };
      el.innerHTML = '<div class="pjm2-wh"><div style="min-width:0"><b><i class="ti ti-chart-bar"></i> ' + M.esc(M.L('Workload this week', 'Beban kerja minggu ini')) + '</b><div class="cob-xs">' + dm(w[0]) + ' – ' + dm(w[1]) + ' · ' + M.esc(M.L('all projects · estimated hours, split evenly between assignees · capacity ', 'semua projek · anggaran jam, dibahagi sama rata antara assignee · kapasiti ')) + CAP + 'h</div></div></div>' +
        (rows.length ? rows.map(function (x) { var over = x.h > CAP, pct = Math.min(100, x.h / CAP * 100); return '<div class="pjm2-wr' + (over ? ' over' : '') + '"><span class="pjm2-nm">' + M.esc(x.n) + '</span><span class="pjm2-bar" role="progressbar" aria-valuenow="' + x.h + '" aria-valuemin="0" aria-valuemax="' + CAP + '"><i style="width:' + pct + '%"></i></span><b class="pjm2-v">' + x.h + 'h</b><small>' + x.c + ' task' + (over ? ' · <span class="pjm2-ovr"><i class="ti ti-alert-triangle"></i> ' + M.esc(M.L('Over capacity', 'Lebih kapasiti')) + '</span>' : '') + '</small></div>'; }).join('')
          : '<div class="cob-xs" style="padding:10px 0">' + M.esc(M.L('No tasks with estimated hours this week. Add hours in a task Detail.', 'Tiada task dengan anggaran jam minggu ini. Isi jam dalam Butiran task.')) + '</div>');
    }).catch(function (e) { el.innerHTML = '<div class="cob-xs" style="color:var(--danger)">' + M.esc((e && e.message) || 'Error') + '</div>'; });
  };
})();
