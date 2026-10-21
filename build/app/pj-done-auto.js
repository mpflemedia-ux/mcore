/* M-Core Projects: auto-Done heal. A task belongs in Done when (a) its progress is 100% (task progress = average of
   assignees in multi-assignee mode) or (b) its linked Service Request (project_tasks.linked_sr_id) is delivered/closed.
   On every board paint, open tasks that meet (a) or (b) are moved to Done (tenant-scoped, once per task per session),
   then the board repaints from the same state (filters kept). Skipped in PA view-only support sessions. */
(function () {
  if (window._pjDoneAuto) return; window._pjDoneAuto = 1;
  var DONE_SR = ['delivered', 'closed'], tried = {}, busy = false;
  function L(en, bm) { return window.APP && APP.language === 'bm' ? bm : en; }
  function tid() { return window.APP && APP.tenant && APP.tenant.id; }
  function ro() { try { return !!(window.PAE && PAE.viewOnly && PAE.viewOnly()); } catch (e) { return false; } }
  function full(k) { return Math.max(0, Math.min(100, Number(k.progress) || 0)) >= 100; }
  function srDone(ids) {
    if (!ids.length) return Promise.resolve({});
    return sb.from('service_requests').select('id,status').eq('tenant_id', tid()).in('id', ids).is('deleted_at', null).then(function (r) {
      var m = {}; if (r.error) return m;
      (r.data || []).forEach(function (x) { if (DONE_SR.indexOf(x.status) >= 0) m[String(x.id)] = 1; });
      return m;
    }, function () { return {}; });
  }
  function heal(st) {
    var t = tid(); if (busy || !t || ro() || !st || !st.tasks || !st.tasks.length) return;
    var open = st.tasks.filter(function (k) { return k && k.id && k.column_key !== 'done' && !k.deleted_at && !tried[k.id]; });
    if (!open.length) return;
    var sr = open.filter(function (k) { return k.linked_sr_id && !full(k); }).map(function (k) { return String(k.linked_sr_id); });
    busy = true;
    srDone(sr.filter(function (x, i) { return sr.indexOf(x) === i; }).slice(0, 200)).then(function (m) {
      var go = open.filter(function (k) { return full(k) || (k.linked_sr_id && m[String(k.linked_sr_id)]); });
      if (!go.length) return 0;
      var now = new Date().toISOString();
      return Promise.all(go.map(function (k) {
        tried[k.id] = 1;
        var bySr = !full(k);
        return sb.from('project_tasks').update({ column_key: 'done', progress: 100 }).eq('tenant_id', t).eq('id', k.id).neq('column_key', 'done').then(function (r) {
          if (r.error) { console.warn('[pj-done-auto]', r.error); return 0; }
          k.column_key = 'done'; k.progress = 100;
          if (bySr) sb.from('project_task_assignees').update({ progress: 100, done_at: now }).eq('tenant_id', t).eq('task_id', k.id).is('deleted_at', null).lt('progress', 100)
            .then(function (x) { if (x.error) console.warn('[pj-done-auto] assignees', x.error); }, function () {});
          return 1;
        }, function (e) { console.warn('[pj-done-auto]', e); return 0; });
      })).then(function (rs) { return rs.reduce(function (a, b) { return a + b; }, 0); });
    }).then(function (n) {
      busy = false; if (!n) return;
      if (typeof showToast === 'function') showToast(n + L(' task(s) moved to Done (100% or request closed)', ' task dipindah ke Siap (100% atau permohonan selesai)'), 'success');
      var q = document.getElementById('pj-q'); if (q && typeof q.oninput === 'function') q.oninput();
    }, function () { busy = false; });
  }
  window.PJDA = { heal: heal, DONE_SR: DONE_SR };
  var prev = window._pjAfterPaint;
  window._pjAfterPaint = function (st) {
    if (typeof prev === 'function') prev(st);
    try { heal(st); } catch (e) { console.warn('[pj-done-auto]', e); }
  };
})();
