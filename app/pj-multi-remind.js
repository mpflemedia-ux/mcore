/* M-Core Projects phase 1 - reminders + Planner.
   Reminders: there is no server cron in M-Core, so this runs in the browser of any assignee who has the app open (on load + every 5 min).
   The first client claims the reminder by stamping project_tasks.remind_sent_for (conditional update = dedupe), then writes one bell row per assignee.
   Planner: timed tasks are shown on each assignee's calendar (read-only chips that open the task). Hidden until pj_multi_01.sql (PJM.ok). */
(function () {
  var M = window.PJM; if (!M || M._rem) return; M._rem = 1;
  function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function remAt(k) { if (!k.due_date) return null; return new Date(String(k.due_date).slice(0, 10) + 'T' + (k.due_time ? M.hm(k.due_time) : '09:00') + ':00'); }
  M.myEmp = function () {
    var em = String((APP.user && APP.user.email) || '').toLowerCase(); if (!em) return Promise.resolve(null);
    if (M._me && M._me.em === em) return Promise.resolve(M._me.id);
    return sb.from('employees').select('id,email').eq('tenant_id', M.tid()).is('deleted_at', null).then(function (r) {
      var e = (r.data || []).filter(function (x) { return String(x.email || '').toLowerCase() === em; })[0]; M._me = { em: em, id: e ? e.id : null }; return M._me.id;
    });
  };
  /* user_profiles ids for employees (same match rule as NT.userForEmp: email, then full name) */
  function usersFor(empIds) {
    return Promise.all([sb.from('employees').select('id,name,email').eq('tenant_id', M.tid()).in('id', empIds), sb.from('user_profiles').select('id,email,full_name').eq('tenant_id', M.tid())]).then(function (r) {
      var us = r[1].data || [], out = [];
      (r[0].data || []).forEach(function (e) {
        var em = String(e.email || '').trim().toLowerCase(), n = String(e.name || '').trim().toLowerCase();
        var u = us.filter(function (x) { return em && String(x.email || '').toLowerCase() === em; })[0] || us.filter(function (x) { return n && String(x.full_name || '').trim().toLowerCase() === n; })[0];
        if (u && out.indexOf(u.id) < 0) out.push(u.id);
      });
      return out;
    });
  }
  var busy = false;
  M.checkReminders = function () {
    if (busy || !window.sb || !M.tid() || !(APP.user && APP.user.id)) return Promise.resolve(0);
    busy = true;
    return M.probe().then(function (ok) { return ok && window.NT && NT.probe ? NT.probe() : false; }).then(function (on) {
      if (!on) return 0;
      return M.myEmp().then(function (me) {
        if (!me) return 0;
        return sb.from('project_task_assignees').select('task_id').eq('tenant_id', M.tid()).eq('employee_id', me).is('deleted_at', null).limit(500).then(function (a) {
          var ids = (a.data || []).map(function (x) { return x.task_id; }); if (!ids.length) return 0;
          var now = new Date();
          return sb.from('project_tasks').select('id,project_id,title,column_key,assignee_employee_id,due_date,due_time,remind_before_min,remind_sent_for').eq('tenant_id', M.tid()).in('id', ids).is('deleted_at', null).neq('column_key', 'done')
            .gte('due_date', ymd(new Date(now - 864e5))).lte('due_date', ymd(new Date(+now + 2 * 864e5))).then(function (r) {
              var due = (r.data || []).filter(function (k) {
                var at = remAt(k); if (!k.remind_before_min || !at) return false;
                var fire = new Date(at - k.remind_before_min * 6e4);
                return now >= fire && now < at.getTime() + 6 * 36e5 && String(k.remind_sent_for || '') !== at.toISOString() && !(k.remind_sent_for && Date.parse(k.remind_sent_for) === at.getTime());
              });
              return due.reduce(function (p, k) { return p.then(function (n) { return fire(k).then(function (x) { return n + x; }); }); }, Promise.resolve(0));
            });
        });
      });
    }).catch(function (e) { console.warn('pjm remind', e); return 0; }).then(function (n) { busy = false; return n; });
  };
  function fire(k) {
    var at = remAt(k), iso = at.toISOString(), tid = M.tid();
    return sb.from('project_tasks').update({ remind_sent_for: iso }).eq('id', k.id).eq('tenant_id', tid).or('remind_sent_for.is.null,remind_sent_for.neq."' + iso + '"').select('id').then(function (c) {
      if (c.error || !c.data || !c.data.length) return 0;
      return sb.from('project_task_assignees').select('employee_id').eq('tenant_id', tid).eq('task_id', k.id).is('deleted_at', null).then(function (a) {
        var emps = (a.data || []).map(function (x) { return x.employee_id; }); if (k.assignee_employee_id && emps.indexOf(k.assignee_employee_id) < 0) emps.push(k.assignee_employee_id);
        return usersFor(emps);
      }).then(function (users) {
        if (!users.length) return 0;
        var when = M.L('Due ', 'Due ') + String(k.due_date).slice(8, 10) + '/' + String(k.due_date).slice(5, 7) + (k.due_time ? ' ' + M.hm(k.due_time) : '');
        var o = { title: M.L('Reminder: ', 'Peringatan: ') + String(k.title || 'Task').slice(0, 180), body: when, type: 'assigned.reminder', ref_table: 'project_tasks', ref_id: String(k.id), link: { page: 'projects', params: { id: k.project_id }, icon: 'ti-bell-ringing' }, group_key: 'pjrem:' + k.id + ':' + iso };
        var rows = users.map(function (u) { return { tenant_id: tid, user_id: u, actor_id: APP.user.id, title: o.title, body: o.body, category: 'assigned', kind: 'for_you', type: o.type, priority: 1, link: o.link, ref_table: o.ref_table, ref_id: o.ref_id, group_key: o.group_key }; });
        return sb.from('notifications').insert(rows).then(function (x) {
          if (x.error) return 0;
          try { if (NT.tgFan) NT.tgFan(tid, users, 'assigned', o); } catch (e) {}
          return rows.length;
        });
      });
    });
  }
  var started = 0;
  function start() { if (started) return; if (!(window.APP && APP.user && APP.user.id && M.tid())) return; started = 1; setTimeout(M.checkReminders, 4000); setInterval(M.checkReminders, 5 * 6e4); }
  var tries = 0, iv = setInterval(function () { start(); if (started || ++tries > 120) clearInterval(iv); }, 1000);
  document.addEventListener('visibilitychange', function () { if (started && document.visibilityState === 'visible') M.checkReminders(); });

  /* ---- Planner: one read-only chip per extra assignee for timed tasks; owner's synced activity row moved to the due time ---- */
  function wrapPlanner() {
    var orig = window._plannerLoadCalRows; if (typeof orig !== 'function' || orig._pjm) return !!(orig && orig._pjm);
    var fn = async function () {
      await orig.apply(this, arguments);
      try { if (await M.probe()) { if (await addRows()) { _plannerRenderAssigneeOptions(); _plannerRenderCalendar(); } } } catch (e) { console.warn('pjm planner', e); }
    };
    fn._pjm = 1; window._plannerLoadCalRows = fn;
    var open = window._plannerOpenForm;
    if (typeof open === 'function' && !open._pjm) { var of = function (id) { var s = String(id || ''); if (s.indexOf('pjm:') === 0 && M.openTask) { var p = s.split(':'); M.openTask(p[1], p[2]); return; } return open.apply(this, arguments); }; of._pjm = 1; window._plannerOpenForm = of; }
    return true;
  }
  async function addRows() {
    var p = String(window._plannerCalYm || '').split('-'); if (p.length < 2) return false;
    var y = +p[0], m = +p[1], from = ymd(new Date(y, m - 1, 1)), to = ymd(new Date(y, m, 0)), f = window._plannerFilter || {};
    if (f.type && f.type !== 'todo') return false;
    var r = await sb.from('project_tasks').select('id,project_id,title,column_key,progress,assignee_employee_id,due_date,due_time').eq('tenant_id', M.tid()).is('deleted_at', null).not('due_time', 'is', null).gte('due_date', from).lte('due_date', to).limit(500);
    var ks = (r.data || []).filter(function (k) { return k.due_time; }); if (!ks.length) return false;
    var a = await sb.from('project_task_assignees').select('task_id,employee_id').eq('tenant_id', M.tid()).in('task_id', ks.map(function (k) { return k.id; })).is('deleted_at', null);
    var by = {}; (a.data || []).forEach(function (x) { (by[x.task_id] = by[x.task_id] || []).push(x.employee_id); });
    var ids = []; Object.keys(by).forEach(function (t) { by[t].forEach(function (e) { if (ids.indexOf(e) < 0) ids.push(e); }); });
    var em = ids.length ? await sb.from('employees').select('id,name,nickname').eq('tenant_id', M.tid()).in('id', ids) : { data: [] };
    var name = {}; (em.data || []).forEach(function (e) { name[e.id] = e.nickname || e.name || ''; });
    var rows = window._plannerCalRows = (window._plannerCalRows || []).filter(function (x) { return !x._pjm; }), added = 0;
    ks.forEach(function (k) {
      var at = new Date(String(k.due_date).slice(0, 10) + 'T' + M.hm(k.due_time) + ':00').toISOString(), st = (k.column_key === 'done' || Number(k.progress) >= 100) ? 'done' : 'open';
      rows.forEach(function (x) { if (M.same(x.project_task_id, k.id)) { x.starts_at = at; x.due_at = at; } });
      if (f.status && f.status !== 'all' && f.status !== st) return;
      (by[k.id] || []).forEach(function (e) {
        if (rows.some(function (x) { return M.same(x.project_task_id, k.id) && x._assigneeKey === 'e:' + e; })) return;
        rows.push({ id: 'pjm:' + k.id + ':' + k.project_id, title: k.title + ' · ' + M.hm(k.due_time), activity_type: 'todo', status: st, starts_at: at, due_at: at, project_task_id: k.id, _assigneeKey: 'e:' + e, _assigneeName: name[e] || '', _pjm: 1 }); added++;
      });
    });
    return true;
  }
  if (!wrapPlanner()) { var n = 0, w = setInterval(function () { if (wrapPlanner() || ++n > 30) clearInterval(w); }, 1000); }
})();
