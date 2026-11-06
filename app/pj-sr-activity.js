/* M-Core Projects - Task Detail read-only "M-Core" section: shows the tenant's own Service Request(s)
   raised from this task (status, admin comments incl. "waiting on you" questions, checklist ticks posted
   back from the admin's mirrored task, deliverable files) with a deep link into My Services. Read-only --
   never writes anything here; the reverse progress flow is posted by pj-checklist.js on the admin side.
   Sibling box to pj-wa-activity.js's .pjw-act, same open-on-toggle trigger pj-wa-board.js already uses.
   Degrades silently until Service Desk + supabase/migrations/20261106140000_pj_sr_workthread_01.sql are live. */
(function () {
  if (window._pjSrActivity) return; window._pjSrActivity = 1;

  function bm() { return window.APP && APP.language === 'bm'; }
  function L(en, ms) { return bm() ? ms : en; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function tid() { return window.APP && APP.tenant && APP.tenant.id; }
  function when(d) { var x = new Date(d); return x.toLocaleDateString(bm() ? 'ms-MY' : 'en-GB', { day: 'numeric', month: 'short' }) + ', ' + x.toLocaleTimeString(bm() ? 'ms-MY' : 'en-GB', { hour: 'numeric', minute: '2-digit' }); }
  function stLabel(s) { return (window.SD && SD.stLabel) ? SD.stLabel(s) : s; }
  function goSr(id) { if (window.SD && SD.go) SD.go('servis_saya', { id: id }); else if (typeof openPage === 'function') openPage('servis_saya', { id: id }); }

  var linksOk = null;
  function probeLinks() {
    if (linksOk != null) return Promise.resolve(linksOk);
    if (!window.sb) return Promise.resolve(false);
    return sb.from('project_task_sr_links').select('id', { head: true, count: 'exact' }).limit(1).then(function (r) { linksOk = !r.error; return linksOk; }, function () { linksOk = false; return false; });
  }
  function srIdsFor(task) {
    return probeLinks().then(function (ok) {
      if (!ok) return task.linked_sr_id ? [String(task.linked_sr_id)] : [];
      return sb.from('project_task_sr_links').select('sr_id').eq('tenant_id', tid()).eq('task_id', task.id).is('deleted_at', null).then(function (r) {
        return r.error ? [] : (r.data || []).map(function (x) { return String(x.sr_id); });
      }, function () { return []; });
    });
  }

  var evIcon = { status: 'ti-arrows-exchange', comment: 'ti-message-2', attachment: 'ti-paperclip' };
  function evRow(e, ref) {
    var txt;
    if (e.type === 'status') txt = '<b>' + esc(ref) + '</b>: ' + esc(stLabel(e.to_status));
    else if (e.type === 'attachment') txt = ((e.meta || {}).deliverable ? L('Deliverable uploaded', 'Hasil kerja dimuat naik') : L('File attached', 'Fail dilampirkan')) + ': <b>' + esc(e.file_name || e.body || '') + '</b>';
    else txt = esc(e.body || '');
    /* status events carry the admin's note (eg. the question when moving to "Waiting on you")
       in e.body separately from the to_status label above -- must show both, not just the status. */
    var noteLine = (e.type !== 'comment' && e.body) ? '<div style="font-size:13px;margin-top:4px;padding:6px 8px;border-left:3px solid var(--primary);background:var(--bg);border-radius:6px;white-space:pre-wrap;overflow-wrap:anywhere">' + esc(e.body) + '</div>' : '';
    var dl = (e.type === 'attachment' && e.file_path) ? '<button type="button" class="btn btn-sm btn-outline" data-pjsr-dl="' + esc(e.file_path) + '" style="margin-top:4px;min-height:32px"><i class="ti ti-download"></i> ' + L('Download', 'Muat turun') + '</button>' : '';
    return '<div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)"><span style="width:26px;height:26px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;background:var(--bg);border:1px solid var(--border)"><i class="ti ' + (evIcon[e.type] || 'ti-point') + '" style="font-size:14px;color:var(--primary)"></i></span><div style="flex:1;min-width:0"><div style="font-size:13px;overflow-wrap:anywhere">' + txt + '</div>' + noteLine + '<div class="cob-xs">' + when(e.created_at) + '</div>' + dl + '</div></div>';
  }

  function loadSr(id) {
    return Promise.all([
      sb.from('service_requests').select('id,ref_no,status,title').eq('id', id).maybeSingle(),
      sb.from('service_request_events').select('type,to_status,body,file_path,file_name,meta,created_at').eq('request_id', id).neq('type', 'internal_note').order('created_at', { ascending: false }).limit(15),
    ]).then(function (r) { return { r: r[0].data, ev: r[1].data || [] }; });
  }

  function render(det, task) {
    var box = det.querySelector('.pjsr-act');
    if (!box) { box = document.createElement('div'); box.className = 'pjsr-act pjsr-inj'; box.style.cssText = 'margin-top:12px;border-top:1px solid var(--border);padding-top:10px'; det.appendChild(box); }
    if (box.dataset.busy) return; box.dataset.busy = '1';
    srIdsFor(task).then(function (ids) {
      if (!ids.length) { box.remove(); return; }
      return Promise.all(ids.map(loadSr)).then(function (list) {
        list = list.filter(function (x) { return x.r; });
        if (!list.length) { box.remove(); return; }
        box.innerHTML = '<b style="font-size:14px"><i class="ti ti-headset"></i> ' + L('M-Core', 'M-Core') + '</b>' +
          list.map(function (x) {
            return '<div style="margin-top:8px"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><button type="button" class="btn btn-sm btn-outline" data-pjsr-open="' + esc(x.r.id) + '" style="min-height:32px"><i class="ti ti-external-link"></i> ' + esc(x.r.ref_no) + '</button>' + (window.SD && SD.st ? SD.st(x.r.status) : esc(stLabel(x.r.status))) + '</div>' +
              (x.ev.length ? x.ev.map(function (e) { return evRow(e, x.r.ref_no); }).join('') : '<div class="cob-xs" style="padding:8px 0">' + L('No updates yet', 'Belum ada kemaskini') + '</div>') + '</div>';
          }).join('');
        box.querySelectorAll('[data-pjsr-open]').forEach(function (b) { b.onclick = function () { goSr(b.dataset.pjsrOpen); }; });
        box.querySelectorAll('[data-pjsr-dl]').forEach(function (b) { b.onclick = function () { if (window.SD && SD.download) SD.download(b.dataset.pjsrDl); }; });
      });
    }).catch(function (e) { box.innerHTML = '<div class="cob-xs" style="color:var(--danger)">' + esc((e && e.message) || 'Error') + '</div>'; }).then(function () { delete box.dataset.busy; });
  }

  function decorate(st) {
    var main = document.getElementById('main'); if (!main || !main.querySelector('.pj-wrap')) return;
    probeLinks().then(function () {
      var byId = {}; (st.tasks || []).forEach(function (k) { byId[k.id] = k; });
      main.querySelectorAll('.pj-card[data-id]').forEach(function (card) {
        var task = byId[card.getAttribute('data-id')]; if (!task) return;
        var det = card.querySelector('details.pj-detail'); if (!det || det._pjsrWired) return;
        det._pjsrWired = 1;
        var go = function () { if (det.open) render(det, task); };
        det.addEventListener('toggle', go); go();
      });
    });
  }

  var prev = window._pjAfterPaint;
  window._pjAfterPaint = function (st) {
    if (typeof prev === 'function') prev(st);
    decorate(st);
  };
})();
