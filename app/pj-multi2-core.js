/* M-Core Projects phase 2 - core: probe (pj_multi_02.sql), per-person progress + est_hours load, "My tasks" filter, Matrix assignee filter = any assignee.
   Filters are additive: projects.js state.assignee stays '' and non-matching cards/rows are hidden in the DOM after each paint. */
(function () {
  var M = window.PJM; if (!M || M.ok2 !== undefined) return;
  M.ok2 = null; M.pp = {}; M.mine = false; M.af = '';
  M.probe2 = function () {
    if (M.ok2 != null) return Promise.resolve(M.ok2);
    return M.probe().then(function (ok) {
      if (!ok) return (M.ok2 = false);
      return Promise.all([sb.from('project_task_assignees').select('id,progress,done_at').limit(1), sb.from('project_tasks').select('id,est_hours').limit(1)]).then(function (r) {
        M.ok2 = !r[0].error && !r[1].error; if (!M.ok2) console.info('[M-Core] Projects phase 2 hidden until SQL pj_multi_02.sql is run'); return M.ok2;
      }, function () { return (M.ok2 = false); });
    });
  };
  M.isTA = function () { try { return typeof isTenantAdmin === 'function' && !!isTenantAdmin(); } catch (e) { return false; } };
  M.load2 = function (st) {
    var ids = (st.tasks || []).map(function (k) { return k.id; }); if (!ids.length) return Promise.resolve();
    return Promise.all([
      sb.from('project_task_assignees').select('id,task_id,employee_id,progress,done_at').eq('tenant_id', M.tid()).in('task_id', ids).is('deleted_at', null),
      sb.from('project_tasks').select('id,est_hours').eq('tenant_id', M.tid()).in('id', ids)
    ]).then(function (r) {
      M.pp = {}; (r[0].data || []).forEach(function (a) { M.pp[a.task_id + '|' + a.employee_id] = a; });
      var ex = {}; (r[1].data || []).forEach(function (x) { ex[x.id] = x; });
      (st.tasks || []).forEach(function (k) { k.est_hours = ex[k.id] && ex[k.id].est_hours != null ? Number(ex[k.id].est_hours) : null; });
    });
  };
  M.has = function (k, emp) { return M.list(k).some(function (a) { return M.same(a.employee_id, emp); }); };
  function vis(st) { /* same rule as projects.js visibleTasks() with state.assignee '' */
    var q = String(st.filter || '').trim().toLowerCase();
    return (st.tasks || []).filter(function (k) { if (q && String(k.title || '').toLowerCase().indexOf(q) < 0 && String(k.tag || '').toLowerCase().indexOf(q) < 0) return false; return !(st.group && k.tag !== st.group); });
  }
  function apply(st, me) {
    var main = document.getElementById('main'); if (!main) return;
    var ok = function (k) { return k && (!M.mine || (me && M.has(k, me))) && (!M.af || M.has(k, M.af)); }, by = {};
    (st.tasks || []).forEach(function (k) { by[k.id] = k; });
    main.querySelectorAll('.pj-card[data-id], .pj-mcard[data-id], .pj-tlcard[data-id]').forEach(function (n) { n.classList.toggle('pjm2-off', !ok(by[n.getAttribute('data-id')])); });
    main.querySelectorAll('.pj-col').forEach(function (c) { var s = c.querySelector('header span'); if (s) s.textContent = c.querySelectorAll('.pj-card:not(.pjm2-off)').length; });
    if (st.tab === 'list') { var v = vis(st); main.querySelectorAll('.pj-table tbody tr').forEach(function (tr, i) { if (v[i]) tr.classList.toggle('pjm2-off', !ok(v[i])); }); }
    var box = main.querySelector('.pj-tabs'), old = main.querySelector('.pjm2-ban'); if (old) old.remove();
    if (M.mine && box) {
      var n = vis(st).filter(ok).length;
      box.insertAdjacentHTML('afterend', '<div class="pjm2-ban" role="status"><i class="ti ti-user-check"></i><span>' + M.esc(M.L('My tasks', 'Task aku')) + ' · ' + n + (me ? '' : ' · ' + M.esc(M.L('your login email is not linked to a staff record', 'emel login kau belum dipadankan dengan rekod staf'))) + '</span><button type="button" class="btn btn-sm btn-outline" data-pjm2-clr>' + M.esc(M.L('Show all', 'Tunjuk semua')) + '</button></div>');
      main.querySelector('[data-pjm2-clr]').onclick = function () { M.mine = false; rerun(st); };
    }
  }
  function rerun(st) { var b = document.querySelector('#main [data-tab="' + (st.tab || 'board') + '"]'); if (b) b.click(); }
  function tools(st, me) {
    var main = document.getElementById('main'), box = main && main.querySelector('.pj-tools'); if (!box || document.getElementById('pjm2-mine')) return;
    box.insertAdjacentHTML('beforeend', '<button type="button" class="btn btn-sm btn-outline' + (M.mine ? ' pjm2-on' : '') + '" id="pjm2-mine" aria-pressed="' + M.mine + '"><i class="ti ti-user-check"></i> ' + M.esc(M.L('My tasks', 'Task aku')) + '</button>');
    document.getElementById('pjm2-mine').onclick = function () { M.mine = !M.mine; rerun(st); };
    var sel = document.getElementById('pj-assignee');
    if (sel) { if (M.af) sel.value = M.af; sel.onchange = function () { M.af = sel.value; st.assignee = ''; rerun(st); }; }
    if (M.workTool) M.workTool(main, st);
  }
  M.decorate2 = function (st) {
    var main = document.getElementById('main'); if (!main) return Promise.resolve();
    var by = {}; (st.tasks || []).forEach(function (k) { by[k.id] = k; });
    main.querySelectorAll('.pj-card[data-id]').forEach(function (el) { var k = by[el.getAttribute('data-id')]; if (k && M.detail2) M.detail2(st, el, k); });
    return (M.myEmp ? M.myEmp() : Promise.resolve(null)).then(function (me) { M.meId = me; tools(st, me); apply(st, me); if (M.workPaint) M.workPaint(main, st); });
  };
  function hook() {
    var prev = window._pjAfterPaint; if (!prev || prev._pjm2) return;
    var fn = function (st) {
      var r = prev(st);
      return Promise.resolve(r).then(function () { return M.ok ? M.probe2() : false; }).then(function (ok) { return ok ? M.load2(st).then(function () { return M.decorate2(st); }) : null; }).catch(function (e) { console.warn('pjm2', e); });
    };
    fn._pjm = 1; fn._pjm2 = 1; window._pjAfterPaint = fn;
  }
  hook(); document.addEventListener('DOMContentLoaded', hook);
  var rp = window.renderProjects;
  if (typeof rp === 'function' && !rp._pjm2) { var w = function () { M.af = ''; return rp.apply(this, arguments); }; w._pjm2 = 1; window.renderProjects = w; }
})();
