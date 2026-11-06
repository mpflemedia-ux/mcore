/* M-Core Projects: auto-Done heal. A task belongs in Done when (a) its progress is 100% (task progress = average of
   assignees in multi-assignee mode) or (b) EVERY Service Request raised from it (project_task_sr_links; falls back
   to the single project_tasks.linked_sr_id until that table exists) is delivered/closed. On every board paint, open
   tasks that meet (a) or (b) are moved to Done (tenant-scoped, once per task per session), then the board repaints
   from the same state (filters kept). Skipped in PA view-only support sessions. */
(function () {
  if (window._pjDoneAuto) return; window._pjDoneAuto = 1;
  var DONE_SR = ['delivered', 'closed'], tried = {}, busy = false, linksOk = null;
  function L(en, bm) { return window.APP && APP.language === 'bm' ? bm : en; }
  function tid() { return window.APP && APP.tenant && APP.tenant.id; }
  function ro() { try { return !!(window.PAE && PAE.viewOnly && PAE.viewOnly()); } catch (e) { return false; } }
  function full(k) { return Math.max(0, Math.min(100, Number(k.progress) || 0)) >= 100; }
  function probeLinks() {
    if (linksOk != null) return Promise.resolve(linksOk);
    return sb.from('project_task_sr_links').select('id', { head: true, count: 'exact' }).limit(1).then(function (r) { linksOk = !r.error; return linksOk; }, function () { linksOk = false; return false; });
  }
  /* taskId -> [sr_id,...]: from the link table when it exists, else each task's own single linked_sr_id */
  function taskSrMap(tasks) {
    return probeLinks().then(function (ok) {
      if (!ok) {
        var m = {}; tasks.forEach(function (k) { if (k.linked_sr_id) m[k.id] = [String(k.linked_sr_id)]; }); return m;
      }
      var ids = tasks.map(function (k) { return k.id; });
      return sb.from('project_task_sr_links').select('task_id,sr_id').eq('tenant_id', tid()).in('task_id', ids).is('deleted_at', null).then(function (r) {
        var m = {}; (r.data || []).forEach(function (x) { (m[x.task_id] = m[x.task_id] || []).push(String(x.sr_id)); }); return m;
      }, function () { return {}; });
    });
  }
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
    busy = true;
    taskSrMap(open.filter(function (k) { return !full(k); })).then(function (srByTask) {
      var allIds = [];
      Object.keys(srByTask).forEach(function (tk) { allIds = allIds.concat(srByTask[tk]); });
      return srDone(allIds.filter(function (x, i) { return allIds.indexOf(x) === i; }).slice(0, 200)).then(function (m) {
        return { srByTask: srByTask, m: m };
      });
    }).then(function (res) {
      var go = open.filter(function (k) {
        if (full(k)) return true;
        var srs = res.srByTask[k.id];
        return srs && srs.length && srs.every(function (id) { return res.m[id]; });
      });
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
