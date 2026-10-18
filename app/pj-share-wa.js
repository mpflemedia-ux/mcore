/* M-Core Projects - Share public report via WhatsApp: extends pj-share-core.js's modal with a
   "Share via WhatsApp" button in the #pjs-wa-slot placeholder (window.PJS.fillWaSlot). Reuses the
   SAME template/recipient/preview sheet as task reminders (window.PJW.share, from pj-wa-core.js +
   pj-wa-sheet.js + pj-wa-pick.js) instead of a direct wa.me redirect, so admins get one consistent
   WhatsApp flow. Pre-selects the task assignee (task-scoped link) or the project's linked customer
   (whole-project client link) as the recipient when a phone number is on file; admin can still pick
   anyone else via Staff/Client/Other tabs. Logged on project_task_shares (template='report') like
   every other share, but excluded from the task-card "Shared Nx" badge (pj-wa-core.js/pj-wa-board.js)
   so it doesn't mix with reminder-share counts. Hidden entirely when the WA-share tables aren't
   migrated yet (window.PJW.ok === false), same as the rest of the WhatsApp feature. */
(function () {
  if (window._pjShareWa || !window.PJS) return; window._pjShareWa = 1;
  var t = PJS.t, esc = PJS.esc;

  function projStats(projectId) {
    var st = PJS._state || {};
    var rows = (st.tasks || []).filter(function (x) { return String(x.project_id) === String(projectId); });
    var total = rows.length, done = rows.filter(function (x) { return x.column_key === 'done'; }).length;
    var sum = rows.reduce(function (n, x) { return n + Math.max(0, Math.min(100, Number(x.progress) || 0)); }, 0);
    return { total: total, done: done, pct: total ? Math.round(sum / total) : 0 };
  }

  function msgText(W, proj, task, url, lang) {
    var L = function (en, bm) { return lang === 'bm' ? bm : en; };
    var co = (window.APP && APP.tenant && APP.tenant.name) || 'M-Core';
    var out;
    if (task) {
      out = ['*' + L('Task Report', 'Laporan Task') + ' · ' + co + '*', '', '*' + task.title + '*'];
      var who = W.empName(task.assignee_employee_id);
      if (who) out.push('👤 ' + L('Assignee', 'Ditugaskan kepada') + ': ' + who);
      out.push('📅 ' + L('Due', 'Tarikh akhir') + ': ' + (task.due_date ? W.dmy(task.due_date) : '-'));
      out.push('📌 ' + L('Status', 'Status') + ': ' + W.colName(task.column_key, lang === 'bm') + ' · ' + (Number(task.progress) || 0) + '%');
      if (task.is_important) out.push('⭐ ' + L('Important', 'Penting'));
      if (task.is_urgent) out.push('🔴 ' + L('Urgent', 'Segera'));
      if (W.late(task)) out.push('⚠️ ' + L('Overdue', 'Lewat') + ' ' + W.lateDays(task) + L(' day(s)', ' hari'));
    } else {
      var s = projStats(proj.id);
      out = ['*' + L('Project Report', 'Laporan Projek') + ' · ' + co + '*', '', '*' + proj.name + '*'];
      out.push('📊 ' + s.total + ' ' + L('task(s)', 'task') + ' · ' + s.done + ' ' + L('done', 'siap') + ' · ' + s.pct + '%');
    }
    out.push('', '🔗 ' + L('View report', 'Lihat laporan') + ': ' + url);
    out.push('📄 ' + L('Public link · view-only, no login needed', 'Link awam · paparan sahaja, tiada log masuk'));
    out.push('', '_' + L('Sent via M-Core', 'Dihantar melalui M-Core') + '_');
    return out.join('\n');
  }

  PJS.fillWaSlot = function (m, proj, task, url) {
    var slot = m.querySelector('#pjs-wa-slot'); if (!slot) return;
    var W = window.PJW;
    if (!W || W.ok === false) { slot.innerHTML = ''; return; }
    slot.innerHTML = '<div class="row" style="gap:8px;margin-bottom:10px"><button type="button" class="btn btn-outline" id="pjs-wa" style="color:#0F7A3F;border-color:#0F7A3F"><i class="ti ti-brand-whatsapp"></i> ' + esc(t('Share via WhatsApp', 'Kongsi melalui WhatsApp')) + '</button></div>';
    slot.querySelector('#pjs-wa').onclick = function () {
      W.probe().then(function (ok) {
        if (!ok) { if (typeof showToast === 'function') showToast(t('WhatsApp share is not set up yet', 'Share WhatsApp belum disediakan'), 'error'); return; }
        var o = { tpl: 'report', badge: t('Report', 'Laporan'), subtitle: task ? task.title : proj.name, text: function (lang) { return msgText(W, proj, task, url, lang); } };
        if (task) {
          o.tasks = [task]; o.kind = 'staff';
          var emp = W.emps.find(function (e) { return String(e.id) === String(task.assignee_employee_id); });
          if (emp && W.phone(emp.phone)) o.rid = emp.id;
        } else {
          o.projectId = proj.id;
          if (proj.kind === 'client' && proj.customer_id) {
            o.kind = 'client';
            var cust = W.custs.find(function (c) { return String(c.id) === String(proj.customer_id); });
            if (cust) o.rid = cust.id;
          } else {
            o.kind = 'staff';
          }
        }
        var pjs = document.getElementById('pjs-modal'); if (pjs) pjs.remove();
        W.share(o);
      });
    };
  };
})();
