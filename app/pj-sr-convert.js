/* M-Core Projects -> Service Request convert: "Request from M-Core" button in Task Detail (tenant's own
   Projects board, subscribed tenants only -- Service Desk module + active paid contract). AI drafts the
   New Request wizard's service pick + title + details (best-effort, never blocks); due date, assignee and
   priority are filled deterministically, never by AI. Hook: window._pjAfterPaint(state), same mechanism
   pj-wa-board.js already uses -- chained here, not overwritten, so that board's own injection keeps working. */
(function () {
  if (window._pjSrConvert) return; window._pjSrConvert = 1;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function isBm() { return window.APP && APP.language === 'bm'; }
  function L(en, bm) { return isBm() ? bm : en; }
  function toast(msg, kind) { if (typeof showToast === 'function') showToast(msg, kind || 'success'); else if (window.SD && SD.toast) SD.toast(msg, kind); }

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

  function btnHtml(task) {
    var btn = task.linked_sr_id
      ? '<button type="button" class="btn btn-sm btn-outline" style="width:100%;justify-content:center" data-pjsr-view="' + esc(task.id) + '"><i class="ti ti-headset"></i> ' + L('View Request', 'Lihat Permohonan') + '</button>'
      : '<button type="button" class="btn btn-sm btn-outline" style="width:100%;justify-content:center" data-pjsr-go="' + esc(task.id) + '"><i class="ti ti-send"></i> ' + L('Request from M-Core', 'Minta daripada M-Core') + '</button>';
    return '<div class="pjsr-row" style="margin-top:8px">' + btn + '</div>';
  }

  function convert(task, btn) {
    var busyHtml = '<div class="spinner" style="display:inline-block;width:14px;height:14px"></div> ' + L('Preparing…', 'Sedang sedia…');
    var restore = function () { btn.disabled = false; btn.innerHTML = '<i class="ti ti-send"></i> ' + L('Request from M-Core', 'Minta daripada M-Core'); };
    btn.disabled = true; btn.innerHTML = busyHtml;
    eligible().then(function (e) {
      var c = e.c;
      return SD.catalog().then(function (cat) {
        SD.catalogList = cat;
        var services = (cat || []).filter(function (x) { return (c.services || []).indexOf(x.code) >= 0; });
        return _invokeAiProxy({
          action: 'suggest_service_request', language: APP.language,
          task_title: task.title, task_notes: task.notes || '', task_tag: task.tag || '',
          services: services.map(function (x) { return { code: x.code, name_en: x.name_en, name_bm: x.name_bm }; }),
        }).catch(function () { return { data: null, error: true }; }).then(function (ai) {
          var payload = (ai && ai.data && ai.data.success) ? ai.data.data : null;
          var svcs = (payload && Array.isArray(payload.service_codes) && payload.service_codes.length) ? payload.service_codes : (services[0] ? [services[0].code] : []);
          if (!svcs.length) { restore(); toast(L('No contracted service available to request against.', 'Tiada servis dalam kontrak untuk dimohon.'), 'error'); return; }
          var title = (payload && payload.title) || task.title;
          var details = (payload && payload.details) || task.notes || '';
          var pri = priorityFor(task);
          var prefill = { svcs: svcs, svc: svcs[0], title: title, desc: details, pri: pri, c: { title: title, desc: details, pri: pri } };
          var linked = false;
          SD.taskSrLinkCallback = function (r) {
            if (linked || !r || !r.id) return; linked = true;
            sb.from('project_tasks').update({ linked_sr_id: r.id, column_key: 'review' }).eq('tenant_id', APP.tenant.id).eq('id', task.id)
              .then(function (x) { if (x.error) console.warn('[pj-sr-convert] link task failed', x.error); }, function (e2) { console.warn('[pj-sr-convert] link task failed', e2); });
            var who = (window.APP.user && (APP.user.full_name || APP.user.name)) || '';
            sb.from('project_task_comments').insert({ tenant_id: APP.tenant.id, task_id: task.id, body: L('Converted to Service Request ', 'Ditukar kepada Permohonan Servis ') + r.ref_no, created_by: APP.user.id, created_by_name: who })
              .then(function (x) { if (x.error) console.warn('[pj-sr-convert] activity note failed', x.error); }, function (e2) { console.warn('[pj-sr-convert] activity note failed', e2); });
          };
          restore();
          SD.go('servis_saya', { new: 1, prefill: prefill });
        });
      });
    }).catch(function (e) { restore(); toast((e && e.message) || 'Error', 'error'); });
  }

  function decorate(st) {
    var main = document.getElementById('main'); if (!main || !main.querySelector('.pj-wrap')) return;
    eligible().then(function (e) {
      if (!e.ok) return;
      var byId = {}; (st.tasks || []).forEach(function (k) { byId[k.id] = k; });
      main.querySelectorAll('.pj-card[data-id]').forEach(function (card) {
        var task = byId[card.getAttribute('data-id')]; if (!task) return;
        var row = card.querySelector('.pj-row'); if (!row || card.querySelector('.pjsr-row')) return;
        row.insertAdjacentHTML('afterend', btnHtml(task));
      });
      main.querySelectorAll('[data-pjsr-go]').forEach(function (b) {
        if (b._pjsrWired) return; b._pjsrWired = 1;
        b.onclick = function (ev) { ev.stopPropagation(); var task = (st.tasks || []).find(function (k) { return String(k.id) === b.dataset.pjsrGo; }); if (task) convert(task, b); };
      });
      main.querySelectorAll('[data-pjsr-view]').forEach(function (b) {
        if (b._pjsrWired) return; b._pjsrWired = 1;
        b.onclick = function (ev) { ev.stopPropagation(); var task = (st.tasks || []).find(function (k) { return String(k.id) === b.dataset.pjsrView; }); if (task && task.linked_sr_id) SD.go('servis_saya', { id: task.linked_sr_id }); };
      });
    });
  }

  var prevAfterPaint = window._pjAfterPaint;
  window._pjAfterPaint = function (st) {
    if (typeof prevAfterPaint === 'function') prevAfterPaint(st);
    decorate(st);
  };
})();
