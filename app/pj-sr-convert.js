/* M-Core Projects -> Service Request convert: "Request from M-Core" button in Task Detail (tenant's own
   Projects board, subscribed tenants only -- Service Desk module + active paid contract). AI picks the
   service code(s) only (never a title/description); the request text, checklist, last comments, project/
   entity name and due date are built deterministically from the task itself, never by AI, and never
   silently fall back to a guessed service -- on AI failure/empty pick the wizard opens with no service
   preselected so the person picks it. A task may raise more than one Service Request (project_task_sr_links);
   task_snapshot keeps the exact checklist/notes/attachments a request was raised from. Degrades silently
   (old single linked_sr_id flow only) until supabase/migrations/20261106140000_pj_sr_workthread_01.sql runs.
   Hook: window._pjAfterPaint(state), same mechanism pj-wa-board.js already uses -- chained, not overwritten. */
(function () {
  if (window._pjSrConvert) return; window._pjSrConvert = 1;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function isBm() { return window.APP && APP.language === 'bm'; }
  function L(en, bm) { return isBm() ? bm : en; }
  function tid() { return window.APP && APP.tenant && APP.tenant.id; }
  function toast(msg, kind) { if (typeof showToast === 'function') showToast(esc(msg), kind || 'success'); else if (window.SD && SD.toast) SD.toast(msg, kind); }
  function fmtDate(d) { if (!d) return ''; try { return new Date(d).toLocaleDateString(isBm() ? 'ms-MY' : 'en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch (e) { return String(d); } }
  var EMPTY_NOTES = ['To do:\n\nIn progress:\n\nDone:\n', 'Perlu buat:\n\nSedang buat:\n\nSudah siap:\n'];

  function priorityFor(task) {
    var imp = !!task.is_important, urg = !!task.is_urgent;
    if (imp && urg) return 'urgent';
    if (urg) return 'high';
    if (imp) return 'normal';
    return 'low';
  }

  var elig = null; /* cached per session: {ok, c} or null = not checked yet */
  function eligible() {
    if (elig) return Promise.resolve(elig);
    if (typeof SD === 'undefined' || !SD.probe || !window.APP || !APP.tenant) return Promise.resolve({ ok: false, c: null });
    return SD.probe().then(function (h) {
      if (!h.desk) { elig = { ok: false, c: null }; return elig; }
      return SD.myContract(APP.tenant.id).then(function (c) {
        elig = { ok: SD.usable(c), c: c };
        return elig;
      });
    }).catch(function () { return { ok: false, c: null }; });
  }

  /* ---- project_task_sr_links: feature-detect + per-paint cache, same pattern as pj-checklist.js PJC ---- */
  var LNK = { ok: null, items: {} };
  LNK.probe = function () {
    if (LNK.ok != null) return Promise.resolve(LNK.ok);
    if (!window.sb || !tid()) return Promise.resolve(false);
    return sb.from('project_task_sr_links').select('id', { head: true, count: 'exact' }).limit(1).then(function (r) {
      LNK.ok = !r.error; if (!LNK.ok) console.info('[M-Core] Projects<->SR links hidden until SQL pj_sr_workthread_01.sql is run'); return LNK.ok;
    }, function () { LNK.ok = false; return false; });
  };
  /* Same shared-state race as pj-checklist.js's C.load (see its comment) -- build into a local
     object, only publish to LNK.items if this is still the latest call once it resolves. */
  var lnkLoadTok = 0;
  LNK.load = function (st) {
    var ids = (st.tasks || []).map(function (k) { return k.id; });
    var mine = ++lnkLoadTok, local = {};
    if (!ids.length) { if (mine === lnkLoadTok) LNK.items = local; return Promise.resolve(); }
    var parts = []; for (var i = 0; i < ids.length; i += 150) parts.push(ids.slice(i, i + 150));
    return Promise.all(parts.map(function (p) {
      return sb.from('project_task_sr_links').select('task_id,sr_id,service_requests(ref_no,status)').eq('tenant_id', tid()).in('task_id', p).is('deleted_at', null).limit(3000);
    })).then(function (rs) {
      rs.forEach(function (r) { (r.data || []).forEach(function (x) { (local[x.task_id] = local[x.task_id] || []).push({ sr_id: x.sr_id, ref_no: x.service_requests && x.service_requests.ref_no, status: x.service_requests && x.service_requests.status }); }); });
      if (mine === lnkLoadTok) LNK.items = local;
    }, function () {});
  };

  /* ---- deterministic context + description (never AI) ---- */
  function lastComments(taskId) {
    return sb.from('project_task_comments').select('body,created_by_name,created_at').eq('tenant_id', tid()).eq('task_id', taskId).is('deleted_at', null).not('body', 'is', null)
      .order('created_at', { ascending: false }).limit(3).then(function (r) { return r.error ? [] : (r.data || []); }, function () { return []; });
  }
  function checklistFor(taskId) {
    var cached = window.PJC && PJC.items && PJC.items[taskId];
    if (cached) return Promise.resolve(cached.map(function (x) { return { label: x.label, done: !!x.done }; }));
    return sb.from('project_task_checklist').select('label,done').eq('tenant_id', tid()).eq('task_id', taskId).is('deleted_at', null).order('sort_order').then(function (r) {
      return r.error ? [] : (r.data || []).map(function (x) { return { label: x.label, done: !!x.done }; });
    }, function () { return []; });
  }
  function dedupeChecklist(list) {
    var seen = {}, out = [];
    (list || []).forEach(function (x) {
      var k = String(x.label || '').trim().toLowerCase(); if (!k || seen[k]) return;
      seen[k] = 1; out.push(x);
    });
    return out;
  }
  function projectEntity(task) {
    return sb.from('project_tasks').select('project_id').eq('id', task.id).maybeSingle().then(function (t) {
      var pid = t.data && t.data.project_id; if (!pid) return { projectName: '', entityName: '' };
      return sb.from('projects').select('name,kind,customer_id').eq('id', pid).maybeSingle().then(function (p) {
        if (!p.data) return { projectName: '', entityName: '' };
        if (!p.data.customer_id) return { projectName: p.data.name || '', entityName: '' };
        return sb.from('customers').select('name').eq('id', p.data.customer_id).maybeSingle().then(function (c) {
          return { projectName: p.data.name || '', entityName: (c.data && c.data.name) || '' };
        });
      });
    }).catch(function () { return { projectName: '', entityName: '' }; });
  }
  function buildContext(task) {
    return Promise.all([checklistFor(task.id), lastComments(task.id), projectEntity(task)]).then(function (r) {
      var checklist = dedupeChecklist(r[0]), comments = r[1], pe = r[2];
      return {
        checklist: checklist, comments: comments, projectName: pe.projectName, entityName: pe.entityName,
        snapshot: { source_task_id: task.id, project_name: pe.projectName, entity_name: pe.entityName, requested_by: task.due_date || null, checklist: checklist },
      };
    });
  }
  function buildDescription(task, ctx) {
    var lines = [];
    var notes = String(task.notes || '').trim();
    var isTemplate = !notes || EMPTY_NOTES.some(function (t) { return notes === t.trim(); });
    if (!isTemplate) lines.push(L('Notes:', 'Nota:'), notes, '');
    if (ctx.checklist && ctx.checklist.length) {
      lines.push(L('Checklist:', 'Senarai semak:'));
      ctx.checklist.forEach(function (c) { lines.push((c.done ? '[x] ' : '[ ] ') + c.label); });
      lines.push('');
    }
    if (ctx.comments && ctx.comments.length) {
      lines.push(L('Recent updates:', 'Kemaskini terkini:'));
      ctx.comments.slice().reverse().forEach(function (c) { lines.push('- ' + (c.created_by_name || '-') + ' (' + fmtDate(c.created_at) + '): ' + String(c.body || '').replace(/\s+/g, ' ').slice(0, 300)); });
      lines.push('');
    }
    var meta = [];
    if (ctx.entityName) meta.push(L('Entity', 'Entiti') + ': ' + ctx.entityName);
    else if (ctx.projectName) meta.push(L('Project', 'Projek') + ': ' + ctx.projectName);
    if (task.due_date) meta.push(L('Requested by', 'Diminta sebelum') + ': ' + fmtDate(task.due_date));
    if (meta.length) lines.push(meta.join(' · '));
    var out = lines.join('\n').trim();
    return out || task.title;
  }

  /* ---- copy task attachments (project-comments) into the new SR (service-files) ---- */
  function taskAttachments(taskId) {
    return sb.from('project_task_comments').select('file_path,file_name').eq('tenant_id', tid()).eq('task_id', taskId).is('deleted_at', null).not('file_path', 'is', null).limit(50)
      .then(function (r) { return r.error ? [] : (r.data || []); }, function () { return []; });
  }
  function copyAttachments(task, r) {
    return taskAttachments(task.id).then(function (files) {
      if (!files.length) return;
      return files.reduce(function (chain, f) {
        return chain.then(function () {
          return sb.storage.from('project-comments').download(f.file_path).then(function (dl) {
            if (dl.error || !dl.data) return;
            var name = (window.SD && SD.safeName) ? SD.safeName(f.file_name) : String(f.file_name || 'file').replace(/[^\w.\-]+/g, '_').slice(-80);
            var path = r.tenant_id + '/service-requests/' + r.id + '/' + Date.now() + '-' + name;
            return sb.storage.from('service-files').upload(path, dl.data, { upsert: false }).then(function (u) {
              if (u.error) return;
              return sb.from('service_request_events').insert({ tenant_id: r.tenant_id, request_id: r.id, type: 'attachment', actor_id: (window.APP && APP.user && APP.user.id) || null, body: f.file_name, file_path: path, file_name: f.file_name, meta: { name: f.file_name, from_task: task.id } });
            });
          }).catch(function () {});
        });
      }, Promise.resolve());
    });
  }

  function linkTaskToSr(task, r, ctx) {
    var t = tid(), now = { updated_at: new Date().toISOString() };
    return LNK.probe().then(function (ok) {
      var steps = [];
      if (ok) {
        steps.push(sb.from('project_task_sr_links').insert({ tenant_id: t, task_id: task.id, sr_id: r.id }));
        steps.push(sb.from('service_requests').update({ task_snapshot: ctx.snapshot }).eq('id', r.id));
      }
      if (!task.linked_sr_id) {
        task.linked_sr_id = r.id;
        steps.push(sb.from('project_tasks').update(Object.assign({ linked_sr_id: r.id, column_key: Number(task.progress) >= 100 ? 'done' : 'review' }, now)).eq('tenant_id', t).eq('id', task.id));
      }
      var who = (window.APP.user && (APP.user.full_name || APP.user.name)) || '';
      steps.push(sb.from('project_task_comments').insert({ tenant_id: t, task_id: task.id, body: L('Converted to Service Request ', 'Ditukar kepada Permohonan Servis ') + r.ref_no, created_by: APP.user.id, created_by_name: who }));
      return Promise.all(steps).then(function (rs) {
        var err = rs.find(function (x) { return x && x.error; });
        if (err) throw err.error;
      });
    });
  }

  function hasExistingLinks(taskId, task) {
    return LNK.probe().then(function (ok) {
      if (!ok) return task.linked_sr_id ? [{ sr_id: task.linked_sr_id, ref_no: null, status: null }] : [];
      if (LNK.items[taskId]) return LNK.items[taskId];
      return sb.from('project_task_sr_links').select('sr_id,service_requests(ref_no,status)').eq('tenant_id', tid()).eq('task_id', taskId).is('deleted_at', null).then(function (r) {
        return r.error ? [] : (r.data || []).map(function (x) { return { sr_id: x.sr_id, ref_no: x.service_requests && x.service_requests.ref_no, status: x.service_requests && x.service_requests.status }; });
      }, function () { return []; });
    });
  }

  function openViewPicker(list) {
    if (list.length === 1) { SD.go('servis_saya', { id: list[0].sr_id }); return; }
    var old = document.getElementById('pjsr-pick'); if (old) old.remove();
    var html = '<div class="modal-overlay active" id="pjsr-pick"><div class="modal-box" style="max-width:420px">' +
      '<div class="modal-box-header"><i class="ti ti-headset"></i> ' + esc(L('Linked requests', 'Permohonan berkaitan')) + '</div>' +
      '<div class="modal-box-body">' + list.map(function (x) {
        return '<button type="button" class="btn btn-outline" data-pjsr-pick="' + esc(x.sr_id) + '" style="width:100%;justify-content:space-between;margin-bottom:8px"><span>' + esc(x.ref_no || x.sr_id) + '</span>' + (x.status && window.SD && SD.st ? SD.st(x.status) : '') + '</button>';
      }).join('') + '</div><div class="modal-box-footer"><button class="btn btn-outline" id="pjsr-pick-close">' + esc(L('Close', 'Tutup')) + '</button></div></div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
    var modal = document.getElementById('pjsr-pick');
    modal.querySelector('#pjsr-pick-close').onclick = function () { modal.remove(); };
    modal.querySelectorAll('[data-pjsr-pick]').forEach(function (b) { b.onclick = function () { modal.remove(); SD.go('servis_saya', { id: b.dataset.pjsrPick }); }; });
  }

  function btnHtml(hasLinks) {
    var btn = hasLinks
      ? '<button type="button" class="btn btn-sm btn-outline" style="width:100%;justify-content:center" data-pjsr-view><i class="ti ti-headset"></i> ' + L('View Request', 'Lihat Permohonan') + '</button>'
      : '<button type="button" class="btn btn-sm btn-outline" style="width:100%;justify-content:center" data-pjsr-go><i class="ti ti-send"></i> ' + L('Request from M-Core', 'Minta daripada M-Core') + '</button>';
    return '<div class="pjsr-row" style="margin-top:8px">' + btn + '</div>';
  }

  function convert(task, btn) {
    var busyHtml = '<div class="spinner" style="display:inline-block;width:14px;height:14px"></div> ' + L('Preparing…', 'Sedang sedia…');
    var restore = function () { btn.disabled = false; btn.innerHTML = '<i class="ti ti-send"></i> ' + L('Request from M-Core', 'Minta daripada M-Core'); };
    btn.disabled = true; btn.innerHTML = busyHtml;
    eligible().then(function (e) {
      var c = e.c;
      return hasExistingLinks(task.id, task).then(function (existing) {
        if (existing.length) { restore(); openViewPicker(existing); return; }
        return SD.catalog().then(function (cat) {
          SD.catalogList = cat;
          var services = (cat || []).filter(function (x) { return (c.services || []).indexOf(x.code) >= 0; });
          return Promise.all([
            _invokeAiProxy({
              action: 'suggest_service_request', language: APP.language,
              task_title: task.title, task_notes: task.notes || '', task_tag: task.tag || '',
              services: services.map(function (x) { return { code: x.code, name_en: x.name_en, name_bm: x.name_bm }; }),
            }).catch(function () { return { data: null, error: true }; }),
            buildContext(task),
          ]).then(function (res) {
            var ai = res[0], ctx = res[1];
            var payload = (ai && ai.data && ai.data.success) ? ai.data.data : null;
            var validCodes = services.map(function (x) { return x.code; });
            var svcs = (payload && Array.isArray(payload.service_codes) ? payload.service_codes : []).filter(function (code) { return validCodes.indexOf(code) >= 0; });
            if (!services.length) { restore(); toast(L('No contracted service available to request against.', 'Tiada servis dalam kontrak untuk dimohon.'), 'error'); return; }
            var desc = buildDescription(task, ctx);
            var pri = priorityFor(task);
            var prefill = { svcs: svcs, svc: svcs[0] || '', title: task.title, desc: desc, pri: pri, c: { title: task.title, desc: desc, pri: pri } };
            SD.taskSrLinkCallback = function (r) {
              if (!r || !r.id) return;
              linkTaskToSr(task, r, ctx).catch(function (err) { toast(L('Could not link the task to ', 'Gagal pautkan task ke ') + r.ref_no + (err && err.message ? ': ' + err.message : ''), 'error'); });
              copyAttachments(task, r).catch(function (err) { console.warn('[pj-sr-convert] attachment copy failed', err); toast(L('A task attachment could not be copied to ', 'Satu lampiran task gagal disalin ke ') + r.ref_no, 'error'); });
            };
            restore();
            SD.go('servis_saya', { new: 1, prefill: prefill });
          });
        });
      });
    }).catch(function (e) { restore(); toast((e && e.message) || 'Error', 'error'); });
  }

  function badgeHtml(list) {
    if (!list || !list.length) return '';
    var allDone = list.every(function (x) { return x.status === 'delivered' || x.status === 'closed'; });
    return '<span class="pjsr-badge" style="display:inline-flex;align-items:center;gap:4px;margin-top:6px;margin-right:6px;font-size:11.5px;font-weight:600;color:' + (allDone ? 'var(--success)' : 'var(--text-2)') + '"><i class="ti ti-headset" style="font-size:14px"></i> ' + (list.length > 1 ? list.length + 'x ' : '') + L('M-Core request', 'Permohonan M-Core') + '</span>';
  }

  function decorate(st) {
    var main = document.getElementById('main'); if (!main || !main.querySelector('.pj-wrap')) return;
    eligible().then(function (e) {
      if (!e.ok) return;
      return LNK.probe().then(function (ok) { return ok ? LNK.load(st) : Promise.resolve(); }).then(function () {
        var byId = {}; (st.tasks || []).forEach(function (k) { byId[k.id] = k; });
        main.querySelectorAll('.pj-card[data-id]').forEach(function (card) {
          var task = byId[card.getAttribute('data-id')]; if (!task) return;
          var links = LNK.ok ? (LNK.items[task.id] || []) : (task.linked_sr_id ? [{ sr_id: task.linked_sr_id, ref_no: null, status: null }] : []);
          var old = card.querySelector('.pjsr-badge'); if (old) old.remove();
          var bar = card.querySelector('.pj-bar'); if (bar && links.length) bar.insertAdjacentHTML('beforebegin', badgeHtml(links));
          var row = card.querySelector('.pj-row'); if (!row) return;
          var existingRow = card.querySelector('.pjsr-row'); if (existingRow) existingRow.remove();
          row.insertAdjacentHTML('afterend', btnHtml(links.length > 0));
        });
        main.querySelectorAll('[data-pjsr-go]').forEach(function (b) {
          if (b._pjsrWired) return; b._pjsrWired = 1;
          b.onclick = function (ev) { ev.stopPropagation(); var card = b.closest('.pj-card[data-id]'); var task = card && (st.tasks || []).find(function (k) { return String(k.id) === card.getAttribute('data-id'); }); if (task) convert(task, b); };
        });
        main.querySelectorAll('[data-pjsr-view]').forEach(function (b) {
          if (b._pjsrWired) return; b._pjsrWired = 1;
          b.onclick = function (ev) {
            ev.stopPropagation(); var card = b.closest('.pj-card[data-id]'); var task = card && (st.tasks || []).find(function (k) { return String(k.id) === card.getAttribute('data-id'); });
            if (task) hasExistingLinks(task.id, task).then(openViewPicker);
          };
        });
      });
    });
  }

  var prevAfterPaint = window._pjAfterPaint;
  window._pjAfterPaint = function (st) {
    if (typeof prevAfterPaint === 'function') prevAfterPaint(st);
    decorate(st);
  };
})();
