/* M-Core Service Desk - request detail (client + admin): header, deliverables, timeline, comments, internal notes, actions. */
(function () {
  var SD = window.SD; if (!SD || SD._detail) return; SD._detail = 1;
  /* escape, then link http(s) URLs (new tab, noopener); trailing punctuation stays text */
  SD.lnk = function (v) { return SD.esc(v).replace(/https?:\/\/[^\s<]+/g, function (u) { var t = (u.match(/[.,!?)\]]+$/) || [''])[0]; u = u.slice(0, u.length - t.length); return '<a href="' + u + '" target="_blank" rel="noopener noreferrer" style="color:var(--primary);text-decoration:underline">' + u + '</a>' + t; }); };
  var EVI = { status: 'ti-arrows-exchange', comment: 'ti-message', attachment: 'ti-paperclip', support_access: 'ti-shield-lock', internal_note: 'ti-lock', wa_notified: 'ti-brand-whatsapp' };
  var PRI = { low: ['Low', 'Rendah'], normal: ['Normal', 'biasa'], high: ['High', 'tinggi'], urgent: ['Urgent', 'segera'] };
  function load(id) {
    return Promise.all([sb.from('service_requests').select('*').eq('id', id).maybeSingle(), sb.from('service_request_events').select('*').eq('request_id', id).order('created_at', { ascending: false })])
      .then(function (r) { if (r[0].error) throw r[0].error; if (!r[0].data) throw new Error(SD.L('Request not found', 'Permohonan tidak dijumpai')); return { r: r[0].data, ev: r[1].data || [] }; });
  }
  function evText(e) {
    var x = SD.evTextX ? SD.evTextX(e) : ''; if (x) return x;
    if (e.type === 'status') return '<b>' + SD.esc(SD.stLabel(e.to_status)) + '</b>';
    if (e.type === 'attachment') return '<b>' + SD.L((e.meta || {}).deliverable ? 'Deliverable uploaded' : 'File attached', (e.meta || {}).deliverable ? 'Hasil kerja dimuat naik' : 'Fail dilampirkan') + '</b>';
    if (e.type === 'support_access') return '<b>' + SD.L('Support access ', 'Akses sokongan ') + ((e.meta || {}).action === 'end' ? SD.L('ended', 'tamat') : SD.L('started', 'bermula')) + '</b>';
    if (e.type === 'internal_note') return '<b>' + SD.L('Internal note (staff only)', 'Nota dalaman (staf sahaja)') + '</b>';
    return '<b>' + SD.L('Comment', 'Komen') + '</b>';
  }
  /* same rule as sd-result: ticket's contract paid, or an active paid contract today; FREE… counts as paid */
  function paidFor(r) {
    return sb.from('service_contracts').select('id,payment_status,invoice_ref,status,start_date,end_date').eq('tenant_id', r.tenant_id).is('deleted_at', null).then(function (x) {
      var t = SD.today(), ok = function (c) { return c.payment_status === 'paid' || /^FREE/i.test(c.invoice_ref || ''); };
      return (x.data || []).some(function (c) { return ok(c) && (SD.same(c.id, r.contract_id) || (c.status === 'active' && (!c.start_date || c.start_date <= t) && (!c.end_date || t <= c.end_date))); });
    });
  }
  /* form_data (answers to service_catalog.form_fields) -- labelled using the catalog's field
     definitions when available (SD.catalogList, loaded by SD.catalog() in SD.detail below). */
  function formDataHtml(r) {
    var data = r.form_data || {}, keys = Object.keys(data).filter(function (k) { return data[k]; });
    if (!keys.length) return '';
    var def = (SD.catalogList || []).find(function (x) { return x.code === r.service_code; });
    var fields = (def && def.form_fields) || [];
    var label = function (k) { var f = fields.find(function (x) { return x.key === k; }); return f ? SD.L(f.label_en, f.label_bm) : k; };
    return '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">' +
      keys.map(function (k) { return '<div><div class="cob-xs">' + SD.esc(label(k)) + '</div><b style="font-size:13px;overflow-wrap:anywhere">' + SD.esc(data[k]) + '</b></div>'; }).join('') + '</div>';
  }
  SD.detail = function (id, admin) {
    return Promise.all([load(id), SD.catalog()]).then(function (x) {
      var r = x[0].r, ev = x[0].ev;
      return Promise.all([SD.names(ev.map(function (e) { return e.actor_id; }).concat([r.assigned_to])), admin ? Promise.resolve(null) : paidFor(r), admin ? sb.from('tenants').select('name').eq('id', r.tenant_id).maybeSingle() : null])
        .then(function (y) { paint(r, ev, y[0], y[1], admin, y[2] && y[2].data ? y[2].data.name : ''); });
    });
  };
  function paint(r, ev, names, c, admin, tname) {
    var m = SD.main(); if (!m) return;
    SD.title(r.ref_no);
    var paid = admin || c === true;
    /* Draf AI card (platform admin only): latest ai_draft internal_note not yet promoted to a
       deliverable attachment. "Hantar" copies the same file_path into a real deliverable event
       + SD.setStatus(delivered); "Minta semula" is a plain internal_note the agent reads on its
       next queue() pass (see sd-agent/handler.ts redoRequested). */
    var drafts = admin ? ev.filter(function (e) { return e.type === 'internal_note' && (e.meta || {}).ai_draft; }).sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); }) : [];
    var latestDraft = drafts[0] || null;
    var draftPromoted = latestDraft && ev.some(function (e) { return e.type === 'attachment' && e.file_path === latestDraft.file_path && (e.meta || {}).deliverable; });
    var draftCard = (latestDraft && !draftPromoted) ? '<div class="cob-card" style="padding:16px;margin-bottom:12px;border-left:3px solid var(--primary)">' +
      '<div class="row" style="justify-content:space-between;align-items:flex-start;gap:8px"><b style="font-size:15px"><i class="ti ti-sparkles"></i> ' + SD.L('AI Draft', 'Draf AI') + '</b><span class="cob-xs" style="white-space:nowrap">v' + ((latestDraft.meta || {}).version || 1) + '</span></div>' +
      '<div class="cob-sm" style="margin-top:4px;overflow-wrap:anywhere">' + SD.esc(latestDraft.file_name || '') + '</div>' +
      (latestDraft.body ? '<p class="cob-xs" style="white-space:pre-wrap;margin-top:6px;overflow-wrap:anywhere">' + SD.lnk(latestDraft.body) + '</p>' : '') +
      '<div class="row" style="gap:8px;margin-top:10px;flex-wrap:wrap"><button class="btn btn-outline btn-sm" id="sd-draft-view"><i class="ti ti-eye"></i> ' + SD.L('View', 'Lihat') + '</button>' +
      '<button class="btn btn-success btn-sm" id="sd-draft-send"><i class="ti ti-send"></i> ' + SD.L('Send to client', 'Hantar ke client') + '</button>' +
      '<button class="btn btn-outline btn-sm" id="sd-draft-again"><i class="ti ti-refresh"></i> ' + SD.L('Request redo', 'Minta semula') + '</button></div></div>' : '';
    var files = ev.filter(function (e) { return e.type === 'attachment' && e.file_path; });
    var dels = files.filter(function (e) { return (e.meta || {}).deliverable; }), atts = files.filter(function (e) { return !(e.meta || {}).deliverable; });
    var due = SD.due(r), who = function (id) { return names[id] || (admin ? '' : 'M-Core'); };
    var fileRow = function (e) {
      return '<div class="sd-file"><i class="ti ti-file-text" style="font-size:22px;color:var(--danger)"></i><div class="grow" style="min-width:0"><b class="cob-ell" title="' + SD.esc(e.body) + '">' + SD.esc(e.body || e.file_path.split('/').pop()) + '</b><div class="cob-xs">' + SD.size((e.meta || {}).size) + ' · ' + SD.dt(e.created_at) + '</div></div>' +
        '<button class="btn btn-outline btn-icon" data-dl="' + SD.esc(e.file_path) + '" style="width:40px;height:40px"' + (paid ? '' : ' disabled title="' + SD.L('Available after full payment', 'Tersedia selepas bayaran penuh') + '"') + '><i class="ti ti-download"></i></button></div>';
    };
    var back = admin ? "openPage('admin',{view:'sd_desk'})" : "openPage('servis_saya')";
    var acts = '';
    if (admin) {
      acts = (SD.TR[r.status] || []).filter(function (t) { return t !== 'cancelled'; }).map(function (t) { return '<button class="btn ' + (t === 'delivered' ? 'btn-success' : t === 'out_of_scope' ? 'btn-outline' : 'btn-primary') + '" data-to="' + t + '"><i class="ti ' + SD.ST[t][1] + '"></i> ' + SD.esc(SD.stLabel(t)) + '</button>'; }).join('') +
        (!r.assigned_to || !SD.same(r.assigned_to, SD.uid()) ? '<button class="btn btn-outline" id="sd-mine"><i class="ti ti-user-check"></i> ' + SD.L('Assign to me', 'Tugaskan kepada saya') + '</button>' : '') +
        (r.linked_task_id ? '<button class="btn btn-outline" id="sd-view-task"><i class="ti ti-subtask"></i> ' + SD.L('View Task', 'Lihat Tugasan') + '</button>' : '<button class="btn btn-outline" id="sd-sync-task"><i class="ti ti-rocket"></i> ' + SD.L('Create Project Task', 'Cipta Tugasan Projek') + '</button>');
    } else if (r.status === 'delivered') acts = '<button class="btn btn-outline" data-to="revision"><i class="ti ti-arrow-back-up"></i> ' + SD.L('Request revision', 'Minta revisi') + '</button><button class="btn btn-success" data-to="closed"><i class="ti ti-check"></i> ' + SD.L('Looks good', 'Nampak OK') + '</button>';
    else if (r.status === 'submitted') acts = '<button class="btn btn-outline" data-to="cancelled" style="color:var(--danger)"><i class="ti ti-x"></i> ' + SD.L('Cancel request', 'Batal permohonan') + '</button>';
    var open = SD.OPEN.indexOf(r.status) >= 0;
    m.innerHTML = '<div class="cob-root" style="max-width:860px">' +
      '<button class="btn btn-sm btn-outline" onclick="' + back + '" style="margin-bottom:12px"><i class="ti ti-arrow-left"></i> ' + SD.L('Back', 'Kembali') + '</button>' +
      '<div class="cob-card" style="padding:16px;margin-bottom:12px;min-width:0"><div class="row" style="gap:6px;flex-wrap:wrap">' + SD.st(r.status) + SD.slaChip(r) + '<span class="sd-ref" style="margin-left:auto">' + SD.esc(r.ref_no) + '</span></div>' +
      '<div style="font-weight:700;font-size:18px;margin-top:8px;overflow-wrap:anywhere">' + SD.esc(r.title) + '</div><div class="cob-sm">' + SD.esc(SD.svcName(r.service_code)) + ' · ' + SD.L('Priority ', 'Keutamaan ') + SD.L.apply(null, PRI[r.priority] || PRI.normal) + (tname ? ' · ' + SD.esc(tname) : '') + '</div>' +
      (r.description ? '<p class="cob-sm" style="white-space:pre-wrap;margin:10px 0 0;overflow-wrap:anywhere;word-break:break-word;min-width:0">' + SD.lnk(r.description) + '</p>' : '') +
      formDataHtml(r) +
      '<div class="row" style="justify-content:space-between;margin-top:12px;padding-top:10px;border-top:1px solid var(--border);font-size:13px"><span class="cob-sm">' + SD.L('SLA due', 'Tarikh akhir SLA') + '</span><b>' + (due ? SD.dt(due) : '—') + '</b></div>' +
      (admin ? '<div class="row cob-xs" style="margin-top:6px"><span class="grow">' + SD.L('Assigned to', 'Ditugaskan kepada') + '</span><b>' + SD.esc(r.assigned_to ? (names[r.assigned_to] || '—') : SD.L('Unassigned', 'Belum ditugaskan')) + '</b></div>' : '') + '</div>' +
      '<div class="cob-card" style="padding:16px;margin-bottom:12px"><b style="font-size:15px">' + SD.L('Deliverables', 'Hasil kerja') + '</b>' + (paid ? '' : '<div class="cob-banner warn" style="margin-top:8px"><i class="ti ti-lock"></i><div>' + SD.L('Downloads are released after full payment.', 'Muat turun dibuka selepas bayaran penuh.') + '</div></div>') +
      (dels.length ? dels.map(fileRow).join('') : '<div class="cob-xs" style="padding:10px 0">' + SD.L('Nothing delivered yet.', 'Belum ada hasil kerja.') + '</div>') +
      (atts.length ? '<div class="cob-xs" style="margin-top:10px;font-weight:700">' + SD.L('Attachments', 'Lampiran') + '</div>' + atts.map(fileRow).join('') : '') + '</div>' +
      draftCard +
      (open ? '<div class="cob-card" style="padding:16px;margin-bottom:12px"><textarea class="form-input" data-no-titlecase="1" id="sd-cm" rows="3" placeholder="' + SD.L('Write a comment…', 'Tulis komen…') + '"></textarea><div class="row" style="gap:8px;margin-top:8px;flex-wrap:wrap">' +
        '<input type="file" id="sd-cf" class="form-input" multiple style="flex:1;min-width:180px">' + (admin ? '<label class="cob-xs row" style="gap:6px"><input type="checkbox" id="sd-int"> ' + SD.L('Internal note (staff only)', 'Nota dalaman (staf sahaja)') + '</label><label class="cob-xs row" style="gap:6px"><input type="checkbox" id="sd-dv" checked> ' + SD.L('File is a deliverable', 'Fail ialah hasil kerja') + '</label>' : '') +
        '<button class="btn btn-primary" id="sd-send"><i class="ti ti-send"></i> ' + SD.L('Send', 'Hantar') + '</button></div></div>' : '') +
      '<div class="cob-card" style="padding:16px;margin-bottom:12px"><b style="font-size:15px">' + SD.L('Timeline', 'Garis masa') + '</b><div class="sd-tl" style="margin-top:8px">' + ev.map(function (e) {
        return '<div class="sd-ev' + (e.type === 'internal_note' ? ' int' : '') + '"><i class="ti ' + (e.type === 'status' ? (SD.ST[e.to_status] || [0, 'ti-point'])[1] : EVI[e.type] || 'ti-point') + '"></i><div class="grow" style="min-width:0">' + evText(e) + (e.body ? '<div style="font-size:13px;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;min-width:0">' + SD.lnk(e.body) + '</div>' : '') + '<div class="cob-xs">' + SD.dt(e.created_at) + (who(e.actor_id) ? ' · ' + SD.esc(who(e.actor_id)) : '') + '</div></div></div>';
      }).join('') + '</div></div>' +
      (r.status === 'delivered' && !admin ? '<div class="cob-xs" style="text-align:center;margin-bottom:10px">' + SD.L('Closed automatically 7 days after delivery if there is no feedback.', 'Ditutup automatik 7 hari selepas dihantar jika tiada maklum balas.') + '</div>' : '') +
      (acts ? '<div class="sd-acts" style="margin-bottom:24px">' + acts + '</div>' : '') + '</div>';
    if (SD.waInject) SD.waInject(m, r, ev, admin);
    var reload = function () { return SD.detail(r.id, admin); };
    m.querySelectorAll('[data-dl]').forEach(function (b) { b.onclick = function () { SD.download(b.dataset.dl); }; });
    m.querySelectorAll('[data-to]').forEach(function (b) {
      b.onclick = function () {
        var to = b.dataset.to, txt = (document.getElementById('sd-cm') || {}).value || '';
        if ((to === 'revision' || to === 'waiting_client' || to === 'out_of_scope') && !txt.trim()) { SD.toast(SD.L('Write the reason in the comment box first', 'Tulis sebab dalam kotak komen dahulu'), 'error'); var cm = document.getElementById('sd-cm'); if (cm) cm.focus(); return; }
        b.disabled = true;
        var pre = to === 'triaged' && !r.assigned_to ? sb.from('service_requests').update({ assigned_to: SD.uid() }).eq('id', r.id).then(function () { r.assigned_to = SD.uid(); }) : Promise.resolve();
        pre.then(function () { return SD.setStatus(r, to, txt.trim() || null, !admin); }).then(function () {
          SD.toast(SD.stLabel(to), 'success');
          if (admin && r.linked_task_id && (to === 'delivered' || to === 'closed') && SD.suggestDone) SD.suggestDone(r);
          return reload();
        }).catch(function (e) { b.disabled = false; SD.toast(SD.err(e), 'error'); });
      };
    });
    var dv = m.querySelector('#sd-draft-view'); if (dv) dv.onclick = function () { SD.download(latestDraft.file_path); };
    var ds = m.querySelector('#sd-draft-send'); if (ds) ds.onclick = function () {
      ds.disabled = true;
      SD.event(r, 'attachment', { file_path: latestDraft.file_path, body: latestDraft.file_name, meta: { name: latestDraft.file_name, deliverable: true } })
        .then(function () { return SD.setStatus(r, 'delivered', null, false); })
        .then(function () { SD.toast(SD.L('Sent to client', 'Dihantar kepada client'), 'success'); reload(); })
        .catch(function (e) { ds.disabled = false; SD.toast(SD.err(e), 'error'); });
    };
    var da = m.querySelector('#sd-draft-again'); if (da) da.onclick = function () {
      var note = prompt(SD.L('What should the agent fix?', 'Apa yang perlu diperbetulkan oleh agent?'));
      if (!note || !note.trim()) return;
      da.disabled = true;
      SD.event(r, 'internal_note', { body: note.trim() })
        .then(function () { SD.toast(SD.L('Noted — the agent will see this next run', 'Dicatat — agent akan lihat pada larian seterusnya'), 'success'); reload(); })
        .catch(function (e) { da.disabled = false; SD.toast(SD.err(e), 'error'); });
    };
    var mine = m.querySelector('#sd-mine'); if (mine) mine.onclick = function () {
      sb.from('service_requests').update({ assigned_to: SD.uid(), updated_at: new Date().toISOString() }).eq('id', r.id).then(function (x) { if (x.error) return SD.toast(SD.err(x.error), 'error'); reload(); });
    };
    var viewTask = m.querySelector('#sd-view-task'); if (viewTask) viewTask.onclick = function () { SD.taskView(r.linked_task_id); };
    var syncTask = m.querySelector('#sd-sync-task'); if (syncTask) syncTask.onclick = function () {
      syncTask.disabled = true; syncTask.innerHTML = '<div class="spinner"></div> ' + SD.L('Preparing…', 'Sedang sedia…');
      SD.taskSync(r).catch(function (e) { SD.toast(SD.err(e), 'error'); }).finally(function () {
        syncTask.disabled = false; syncTask.innerHTML = '<i class="ti ti-rocket"></i> ' + SD.L('Create Project Task', 'Cipta Tugasan Projek');
      });
    };
    var send = m.querySelector('#sd-send'); if (send) send.onclick = function () {
      var t = document.getElementById('sd-cm').value.trim(), files = Array.prototype.slice.call(document.getElementById('sd-cf').files || []), int = admin && document.getElementById('sd-int').checked;
      if (!t && !files.length) return;
      send.disabled = true;
      var p = t ? SD.event(r, int ? 'internal_note' : 'comment', { body: t }) : Promise.resolve();
      p.then(function () {
        if (int || !files.length) return null;
        var dv = admin && document.getElementById('sd-dv').checked;
        /* sequential, not Promise.all -- each SD.upload() inserts its own attachment event, so
           uploading one at a time keeps the timeline in the same order the files were picked. */
        return files.reduce(function (chain, file) { return chain.then(function () { return SD.upload(r, file, dv); }); }, Promise.resolve());
      })
        .then(function () {
          if (!int) {
            var body = t || (files.length === 1 ? files[0].name : files.length + ' ' + SD.L('files', 'fail'));
            SD.bellFor(r, r.ref_no + ': ' + SD.L('new message', 'mesej baharu'), body, 'sd.message');
          }
          return reload();
        })
        .catch(function (e) { send.disabled = false; SD.toast(SD.err(e), 'error'); });
    };
  }
})();
