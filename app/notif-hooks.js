/* M-Core bell v2 — small wraps on existing flows. Each wrap is a no-op passthrough until notif_01 SQL has run. */
(function () {
  var NT = window.NT; if (!NT) return;
  var L = NT.L, sup = 0;
  function wrapFn(name, mk) { var o = window[name]; if (typeof o !== 'function' || o._nt) return; var w = mk(o); w._nt = 1; window[name] = w; }
  function strip(t) { var a = String(t || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean); return { t: String(a[0] || '').replace(/^M-Core · /, ''), b: a.slice(1).join(' · ') }; }
  function hook() {
    /* Telegram link banner is optional now (link from Settings) */
    wrapFn('_tgMaybeShowGate', function () { return function () { var g = document.getElementById('tg-force-gate'); if (g) g.remove(); }; });
    /* every "X saved / recorded" event -> Aktiviti (grouped, no badge); attendance exceptions -> Untuk Kau for HR */
    wrapFn('_tgActivity', function (o) { return function (key, text) {
      if (NT.on) {
        var s = strip(text);
        if (key === 'hr' && /^(Kehadiran|Attendance)$/.test(s.t) && /\b(late|absent|lewat|tidak hadir|absen)\b/i.test(s.b)) NT.notify({ kind: 'for_you', type: 'approval.attendance', title: L('Attendance exception', 'Pengecualian kehadiran'), body: s.b, roles: ['owner', 'admin', 'hr', 'manager'], link: { page: 'hr', params: { view: 'attendance' } } });
        else if (!/^(overdue|low_stock|sales_plan)$/.test(key)) NT.activity(key, s.t, s.b);
        sup++; return Promise.resolve(o.apply(this, arguments)).then(function (r) { sup--; return r; }, function () { sup--; });
      }
      return o.apply(this, arguments);
    }; });
    /* local bell rows (bookings, planner reminders) -> Untuk Kau for the current user */
    wrapFn('_notifPushBell', function (o) { return function (title, meta) {
      if (!NT.on) return o.apply(this, arguments);
      if (sup > 0) return;
      sb.from('notifications').insert({ tenant_id: NT.tid(), user_id: NT.uid(), title: String(title || '').slice(0, 200), body: String(meta || '').slice(0, 500), category: 'self', kind: 'for_you', type: 'assigned.reminder' }).then(function () { if (NT.refresh) NT.refresh(); }, function () {});
      try { if (NT.ch('assigned', 'p') && !NT.quiet()) _notifOsNotify(title, meta); } catch (e) {}
    }; });
    /* dashboard "insights refreshed" notices are dropped from the bell */
    wrapFn('_dbInsightPushNotif', function (o) { return function () { if (NT.on) return Promise.resolve(); return o.apply(this, arguments); }; });
    /* approval results -> requester (Untuk Kau) */
    wrapFn('_tgNotifyEmployee', function (o) { return function (empId, text) {
      var r = o.apply(this, arguments);
      if (NT.on && empId) { var s = strip(text), v = /Cuti|Leave/i.test(s.t) ? 'leave' : /Outstation/i.test(s.t) ? 'attendance' : /Pendahuluan|Advance/i.test(s.t) ? 'advance' : 'leave', ok = /dilulus|approved/i.test(s.t);
        NT.userForEmp(empId).then(function (u) { if (u) NT.notify({ users: [u], kind: 'for_you', type: 'approval.result', title: s.t, body: s.b, link: { page: 'hr', params: { view: v }, icon: ok ? 'ti-circle-check' : 'ti-circle-x' } }); }); }
      return r;
    }; });
    /* support access: tell the client owner when a platform admin enters */
    wrapFn('_enterSupportTenant', function (o) { return function (tid) {
      var r = o.apply(this, arguments);
      var n = 0, iv = setInterval(function () {
        if (++n > 90) { clearInterval(iv); return; }
        if (!NT.on || !NT.isPA() || !NT.same(NT.tid(), tid)) return; clearInterval(iv);
        NT.notify({ tenant_id: tid, roles: ['owner'], kind: 'for_you', type: 'sd.support', title: L('Support access started by M-Core team', 'Akses sokongan dimulakan oleh pasukan M-Core'), body: ((APP.user && (APP.user.name || APP.user.email)) || '') + ' · ' + new Date().toLocaleString(), link: { page: 'sd_access', params: {}, icon: 'ti-lifebuoy' } });
      }, 2000);
      return r;
    }; });
  }
  /* projects: assignment + comments/@mentions (called from tiny hooks in projects.js / pj-wa-activity.js) */
  NT.taskSaved = function (id, oldEmp, patch, projectId) {
    if (!NT.on || !patch || !patch.assignee_employee_id || NT.same(patch.assignee_employee_id, oldEmp || '')) return;
    NT.userForEmp(patch.assignee_employee_id).then(function (u) {
      if (u) NT.notify({ users: [u], kind: 'for_you', type: 'assigned.task', ref_table: 'project_tasks', ref_id: id, title: ((APP.user && APP.user.name) || 'M-Core') + L(' assigned you: ', ' tugaskan kau: ') + patch.title, body: patch.due_date ? L('Due ', 'Tarikh akhir ') + patch.due_date : '', link: { page: 'projects', params: { id: projectId } } });
    });
  };
  NT.taskComment = function (k, body) {
    if (!NT.on || !k) return; var who = (APP.user && APP.user.name) || 'M-Core', link = { page: 'projects', params: { id: k.project_id } };
    var toks = (String(body || '').match(/@([\w.\-]+)/g) || []).map(function (s) { return s.slice(1).toLowerCase(); });
    sb.from('user_profiles').select('id,full_name').eq('tenant_id', NT.tid()).then(function (r) {
      var ment = (r.data || []).filter(function (u) { var n = String(u.full_name || '').toLowerCase(); return toks.some(function (t) { return n === t || n.split(/\s+/)[0] === t; }); }).map(function (u) { return u.id; });
      if (ment.length) NT.notify({ users: ment, kind: 'for_you', type: 'assigned.mention', ref_table: 'project_tasks', ref_id: k.id, title: who + L(' mentioned you in a comment', ' sebut kau dalam komen'), body: '“' + String(body).slice(0, 140) + '”', link: Object.assign({ icon: 'ti-at' }, link), group_key: 'mention:' + k.id });
      if (k.assignee_employee_id) NT.userForEmp(k.assignee_employee_id).then(function (u) { if (u && ment.indexOf(u) < 0) NT.notify({ users: [u], kind: 'for_you', type: 'assigned.comment', ref_table: 'project_tasks', ref_id: k.id, title: who + L(' commented on ', ' komen pada ') + (k.title || 'task'), body: String(body || '').slice(0, 140), link: Object.assign({ icon: 'ti-message-circle' }, link), group_key: 'comment:' + k.id + ':' + NT.day() }); });
    });
  };
  hook(); document.addEventListener('DOMContentLoaded', hook); [1500, 4000, 9000].forEach(function (t) { setTimeout(hook, t); });
  /* probe once signed in so wraps switch on without opening the bell */
  var tries = 0, iv = setInterval(function () { if (NT.uid() && NT.tid()) { clearInterval(iv); NT.probe().then(function (on) { if (on && typeof loadNotifications === 'function') loadNotifications(); }); } else if (++tries > 60) clearInterval(iv); }, 1000);
})();
