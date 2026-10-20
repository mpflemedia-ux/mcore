/* M-Core Service Desk -> Project Task sync (platform_admin only): "Create Project Task" on a
   service request finds/creates the client's mirrored CRM customer + project in MP Workspace,
   drafts the task content via ai-proxy (best-effort), fills the deterministic fields, shows a
   review modal, then saves and links back via service_requests.linked_task_id. */
(function () {
  var SD = window.SD; if (!SD || SD._taskSync) return; SD._taskSync = 1;

  function platformTenantId() {
    return sb.rpc('get_platform_home_tenant_id').then(function (x) {
      if (x.error) throw x.error;
      if (!x.data) throw new Error(SD.L('Platform home tenant (MP Workspace) not found', 'Tenant platform (MP Workspace) tidak dijumpai'));
      return x.data;
    });
  }

  /* Historical average completion time (hours) for past delivered/closed tickets of this service_code.
     null when there is no usable history — never a guessed number. */
  function historicalAvgHours(serviceCode, excludeId) {
    if (!serviceCode) return Promise.resolve(null);
    return sb.from('service_requests').select('created_at,delivered_at,closed_at')
      .eq('service_code', serviceCode).is('deleted_at', null).in('status', ['delivered', 'closed'])
      .neq('id', excludeId).limit(200)
      .then(function (x) {
        var rows = (x.data || []).map(function (r) {
          var end = r.closed_at || r.delivered_at;
          if (!end || !r.created_at) return null;
          var h = (new Date(end).getTime() - new Date(r.created_at).getTime()) / 36e5;
          return (h > 0 && h < 2000) ? h : null;
        }).filter(function (h) { return h != null; });
        if (!rows.length) return null;
        return rows.reduce(function (a, b) { return a + b; }, 0) / rows.length;
      });
  }

  /* Deterministic assignee match: employees.email = the assigned admin's login email (same rule
     already used for Projects WhatsApp share, see projects_wa_share_01.sql). Never AI-guessed;
     null when there is no matching employee in MP Workspace. */
  function findAssigneeEmployeeId(tenantId, userId) {
    if (!userId) return Promise.resolve(null);
    return sb.from('user_profiles').select('email').eq('id', userId).maybeSingle().then(function (p) {
      var email = ((p.data && p.data.email) || '').toLowerCase();
      if (!email) return null;
      return sb.from('employees').select('id,email').eq('tenant_id', tenantId).is('deleted_at', null).then(function (e) {
        var match = (e.data || []).find(function (row) { return (row.email || '').toLowerCase() === email; });
        return match ? match.id : null;
      });
    });
  }

  /* kind='client': reuse the project already linked to this customer, else create one.
     kind='internal': reuse ANY existing internal project (oldest), else create one — avoids
     spawning a new "Internal" project every time if it was ever renamed. */
  function findOrCreateProject(tenantId, kind, customerId, name) {
    var q = sb.from('projects').select('id').eq('tenant_id', tenantId).eq('kind', kind).is('deleted_at', null).order('created_at', { ascending: true }).limit(1);
    if (kind === 'client') q = q.eq('customer_id', customerId);
    return q.maybeSingle().then(function (x) {
      if (x.data) return x.data.id;
      return sb.from('projects').insert({ tenant_id: tenantId, kind: kind, customer_id: kind === 'client' ? customerId : null, name: name })
        .select('id').single().then(function (y) { if (y.error) throw y.error; return y.data.id; });
    });
  }

  /* "View Task" — same deep-link mechanism Projects' own Today/overdue card uses. */
  SD.taskView = function (taskId) {
    sb.from('project_tasks').select('project_id').eq('id', taskId).maybeSingle().then(function (x) {
      if (!x.data) { SD.toast(SD.L('Task not found (may have been deleted)', 'Tugasan tidak dijumpai (mungkin dipadam)'), 'error'); return; }
      window._pjOpenTask = taskId;
      openPage('projects', { id: x.data.project_id });
    });
  };

  SD.taskSync = function (r) {
    if (r.linked_task_id) { SD.taskView(r.linked_task_id); return Promise.resolve(); }
    var ctx = {};
    return platformTenantId().then(function (pid) {
      ctx.platformId = pid;
      ctx.isInternal = SD.same(r.tenant_id, pid);
      return Promise.all([
        ctx.isInternal ? Promise.resolve(null) : sb.rpc('sync_tenant_as_platform_customer', { p_tenant_id: r.tenant_id }),
        historicalAvgHours(r.service_code, r.id),
        findAssigneeEmployeeId(pid, r.assigned_to),
        ctx.isInternal ? Promise.resolve(null) : sb.from('tenants').select('name').eq('id', r.tenant_id).maybeSingle(),
      ]);
    }).then(function (x) {
      ctx.customerId = x[0] && x[0].data ? x[0].data : null;
      ctx.avgHours = x[1];
      ctx.employeeId = x[2];
      ctx.custName = (x[3] && x[3].data && x[3].data.name) || '';
      if (!ctx.isInternal && !ctx.customerId) {
        throw new Error(SD.L('Could not find or create the client record (tenant may have been deleted) — cannot sync.', 'Tidak dapat cari/cipta rekod klien (tenant mungkin telah dipadam) — tidak boleh sync.'));
      }
      return _invokeAiProxy({
        action: 'draft_project_task', language: APP.language,
        title: r.title, description: r.description || '', service_name: SD.svcName(r.service_code),
        priority: r.priority, avg_hours: ctx.avgHours,
      }).catch(function () { return { data: null, error: true }; });
    }).then(function (ai) {
      ctx.draft = (ai && ai.data && ai.data.title) ? ai.data : null;
      return openReviewModal(r, ctx);
    });
  };

  function openReviewModal(r, ctx) {
    return new Promise(function (resolve) {
      /* +8h shift then read UTC getters — same GMT+8 "local calendar fields" idiom used elsewhere
         in the app (eg. sd-pub-base.js dt()), so the date/time shown here matches the SLA due date
         actually displayed to the admin regardless of the admin's own browser timezone. */
      var due = SD.due(r), kl = due ? new Date(due.getTime() + 288e5) : null;
      var pad = function (n) { return String(n).padStart(2, '0'); };
      var dueDate = kl ? kl.getUTCFullYear() + '-' + pad(kl.getUTCMonth() + 1) + '-' + pad(kl.getUTCDate()) : '';
      var dueTime = kl ? pad(kl.getUTCHours()) + ':' + pad(kl.getUTCMinutes()) : '';
      var title = (ctx.draft && ctx.draft.title) || r.title;
      var notes = (ctx.draft && ctx.draft.notes) || (r.description || '');
      var tag = (ctx.draft && ctx.draft.tag) || r.service_code || '';
      var estHours = (ctx.draft && typeof ctx.draft.est_hours === 'number' && ctx.draft.est_hours > 0) ? ctx.draft.est_hours : (ctx.avgHours || '');
      var isImportant = r.priority === 'urgent' || r.priority === 'high';
      var isUrgent = r.priority === 'urgent';
      var old = document.getElementById('sd-sync-modal'); if (old) old.remove();
      var html = '<div class="modal-overlay active" id="sd-sync-modal"><div class="modal-box" style="max-width:560px">' +
        '<div class="modal-box-header"><i class="ti ti-rocket"></i> ' + SD.L('Create Project Task', 'Cipta Tugasan Projek') + '</div>' +
        '<div class="modal-box-body">' +
        (ctx.draft ? '' : '<div class="cob-banner warn"><i class="ti ti-alert-triangle"></i><div>' + SD.L('AI draft unavailable — using the raw request title/description. You can edit everything below.', 'Draf AI tidak tersedia — guna tajuk/keterangan asal. Anda boleh edit semua di bawah.') + '</div></div>') +
        '<div class="form-group"><label class="form-label">' + SD.L('Project', 'Projek') + '</label><div class="form-input" style="background:var(--bg)">' + (ctx.isInternal ? SD.L('Internal', 'Dalaman') : SD.esc(ctx.custName || '—')) + '</div></div>' +
        '<div class="form-group"><label class="form-label">' + SD.L('Title', 'Tajuk') + '</label><input class="form-input" id="sts-title" value="' + SD.esc(title) + '"></div>' +
        '<div class="form-group"><label class="form-label">' + SD.L('Tag', 'Tag') + '</label><input class="form-input" id="sts-tag" value="' + SD.esc(tag) + '"></div>' +
        '<div class="row" style="gap:10px;flex-wrap:wrap"><div class="form-group" style="flex:1;min-width:140px"><label class="form-label">' + SD.L('Due date', 'Tarikh akhir') + '</label><input type="date" class="form-input" id="sts-due-date" value="' + dueDate + '"></div>' +
        '<div class="form-group" style="flex:1;min-width:120px"><label class="form-label">' + SD.L('Due time', 'Masa akhir') + '</label><input type="time" class="form-input" id="sts-due-time" value="' + dueTime + '"></div></div>' +
        '<div class="form-group"><label class="form-label">' + SD.L('Estimated hours (optional)', 'Anggaran jam (opsyenal)') + '</label><input type="number" min="0" step="0.5" class="form-input" id="sts-hours" value="' + SD.esc(estHours) + '"></div>' +
        '<div class="form-group"><label class="form-label">' + SD.L('Notes', 'Nota') + '</label><textarea class="form-input" data-no-titlecase="1" id="sts-notes" rows="5">' + SD.esc(notes) + '</textarea></div>' +
        '<div class="row" style="gap:16px;flex-wrap:wrap"><label class="cob-xs row" style="gap:6px"><input type="checkbox" id="sts-imp"' + (isImportant ? ' checked' : '') + '> ' + SD.L('Important', 'Penting') + '</label>' +
        '<label class="cob-xs row" style="gap:6px"><input type="checkbox" id="sts-urg"' + (isUrgent ? ' checked' : '') + '> ' + SD.L('Urgent', 'Segera') + '</label></div>' +
        '<div class="cob-xs">' + SD.L('Assignee', 'Penerima tugas') + ': <b>' + (ctx.employeeId ? SD.L('matched from this ticket’s assignee', 'dipadankan daripada penerima tiket ini') : SD.L('none (no matching employee email in MP Workspace)', 'tiada (tiada e-mel pekerja sepadan di MP Workspace)')) + '</b></div>' +
        '</div><div class="modal-box-footer"><button class="btn btn-outline" id="sts-cancel">' + SD.L('Cancel', 'Batal') + '</button><button class="btn btn-primary" id="sts-save"><i class="ti ti-check"></i> ' + SD.L('Save', 'Simpan') + '</button></div>' +
        '</div></div>';
      document.body.insertAdjacentHTML('beforeend', html);
      var modal = document.getElementById('sd-sync-modal');
      modal.querySelector('#sts-cancel').onclick = function () { modal.remove(); resolve(); };
      modal.querySelector('#sts-save').onclick = function () {
        var saveBtn = modal.querySelector('#sts-save'); saveBtn.disabled = true; saveBtn.innerHTML = '<div class="spinner"></div> ' + SD.L('Saving…', 'Sedang simpan…');
        var fields = {
          title: modal.querySelector('#sts-title').value.trim() || r.title,
          tag: modal.querySelector('#sts-tag').value.trim() || null,
          notes: modal.querySelector('#sts-notes').value.trim() || null,
          due_date: modal.querySelector('#sts-due-date').value || null,
          due_time: modal.querySelector('#sts-due-time').value || null,
          est_hours: modal.querySelector('#sts-hours').value ? Number(modal.querySelector('#sts-hours').value) : null,
          is_important: modal.querySelector('#sts-imp').checked,
          is_urgent: modal.querySelector('#sts-urg').checked,
        };
        saveTask(r, ctx, fields).then(function () { modal.remove(); resolve(); }).catch(function (e) {
          saveBtn.disabled = false; saveBtn.innerHTML = '<i class="ti ti-check"></i> ' + SD.L('Save', 'Simpan'); SD.toast(SD.err(e), 'error');
        });
      };
    });
  }

  function saveTask(r, ctx, f) {
    var projectName = ctx.isInternal ? SD.L('Internal', 'Dalaman') : (ctx.custName || r.ref_no);
    return findOrCreateProject(ctx.platformId, ctx.isInternal ? 'internal' : 'client', ctx.customerId, projectName).then(function (projectId) {
      return sb.from('project_tasks').insert({
        tenant_id: ctx.platformId, project_id: projectId, title: f.title, tag: f.tag, notes: f.notes,
        due_date: f.due_date, due_time: f.due_time, est_hours: f.est_hours,
        is_important: f.is_important, is_urgent: f.is_urgent,
        assignee_employee_id: ctx.employeeId || null, column_key: 'backlog',
      }).select('id').single().then(function (t) {
        if (t.error) throw t.error;
        var taskId = t.data.id;
        var ownerRow = ctx.employeeId
          ? sb.from('project_task_assignees').insert({ tenant_id: ctx.platformId, task_id: taskId, employee_id: ctx.employeeId, is_owner: true }).then(function (a) { if (a.error) throw a.error; })
          : Promise.resolve();
        return ownerRow.then(function () {
          return sb.from('service_requests').update({ linked_task_id: taskId, updated_at: new Date().toISOString() }).eq('id', r.id);
        }).then(function (u) {
          if (u.error) throw u.error;
          r.linked_task_id = taskId;
          auditLog('sr_project_task_sync', 'service_requests', r.id);
          SD.toast(SD.L('Project task created', 'Tugasan projek dicipta'), 'success');
          return SD.detail(r.id, true);
        });
      });
    });
  }

  /* Suggestion only (never automatic) — offered right after an admin moves the SR to
     Delivered/Closed when a linked task exists and is not yet marked Done. */
  SD.suggestDone = function (r) {
    sb.from('project_tasks').select('id,column_key').eq('id', r.linked_task_id).maybeSingle().then(function (x) {
      if (!x.data || x.data.column_key === 'done') return;
      var old = document.getElementById('sd-done-modal'); if (old) old.remove();
      var html = '<div class="modal-overlay active" id="sd-done-modal"><div class="modal-box" style="max-width:420px">' +
        '<div class="modal-box-header"><i class="ti ti-circle-check"></i> ' + SD.L('Mark linked task Done too?', 'Tandakan tugasan berkaitan Selesai juga?') + '</div>' +
        '<div class="modal-box-body"><div class="cob-sm">' + SD.L('This service request has a linked project task that is not yet marked Done.', 'Permohonan servis ini mempunyai tugasan projek berkaitan yang belum ditanda Selesai.') + '</div></div>' +
        '<div class="modal-box-footer"><button class="btn btn-outline" id="sdd-no">' + SD.L('Not now', 'Bukan sekarang') + '</button><button class="btn btn-primary" id="sdd-yes">' + SD.L('Yes, mark Done', 'Ya, tanda Selesai') + '</button></div></div></div>';
      document.body.insertAdjacentHTML('beforeend', html);
      var modal = document.getElementById('sd-done-modal');
      modal.querySelector('#sdd-no').onclick = function () { modal.remove(); };
      modal.querySelector('#sdd-yes').onclick = function () {
        var now = new Date().toISOString();
        Promise.all([
          sb.from('project_tasks').update({ column_key: 'done', progress: 100 }).eq('id', r.linked_task_id),
          sb.from('project_task_assignees').update({ progress: 100, done_at: now }).eq('task_id', r.linked_task_id).is('deleted_at', null),
        ]).then(function (x) {
          modal.remove();
          if (x[0].error) { SD.toast(SD.err(x[0].error), 'error'); return; }
          SD.toast(SD.L('Task marked Done', 'Tugasan ditanda Selesai'), 'success');
        });
      };
    });
  };
})();
