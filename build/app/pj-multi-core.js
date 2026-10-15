/* M-Core Projects phase 1 - multiple assignees (tick list + chips, star = Owner), optional start/due time, reminder option, card initials + due time.
   Hidden until pj_multi_01.sql runs (probe: project_task_assignees + project_tasks.due_time). Owner is written to project_tasks.assignee_employee_id
   through the existing hidden select, so every existing reader keeps working. Hook: wraps window._pjAfterPaint (pj-wa-board.js). */
(function () {
  if (window.PJM) return;
  var M = window.PJM = { ok: null, as: {}, ex: {} };
  M.bm = function () { return window.APP && APP.language === 'bm'; };
  M.L = function (en, bm) { return M.bm() ? bm : en; };
  M.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); };
  M.same = function (a, b) { return String(a) === String(b); };
  M.tid = function () { return window.APP && APP.tenant && APP.tenant.id; };
  M.hm = function (t) { return t ? String(t).slice(0, 5) : ''; };
  M.toast = function (m, k) { if (typeof showToast === 'function') showToast(m, k || 'success'); };
  /* due moment: due_date + due_time (no time = end of day, same as today's date-only rule) */
  M.dueAt = function (k) { if (!k || !k.due_date) return null; return new Date(String(k.due_date).slice(0, 10) + 'T' + (k.due_time ? M.hm(k.due_time) + ':00' : '23:59:59')); };
  M.probe = function () {
    if (M.ok != null) return Promise.resolve(M.ok);
    if (!window.sb || !M.tid()) return Promise.resolve(false);
    return Promise.all([sb.from('project_task_assignees').select('id', { head: true, count: 'exact' }).limit(1), sb.from('project_tasks').select('id,due_time,start_time,remind_before_min').limit(1)]).then(function (r) {
      var e = r[0].error || r[1].error; M.ok = !e;
      if (e) console.info('[M-Core] Projects multi-assignee/time hidden until SQL pj_multi_01.sql is run');
      return M.ok;
    }, function () { M.ok = false; return false; });
  };
  /* assignee list for a task: owner first; falls back to assignee_employee_id when no link rows (old data / other writers) */
  M.list = function (k) {
    var rows = (M.as[k.id] || []).slice(), own = k.assignee_employee_id;
    if (own && !rows.some(function (a) { return M.same(a.employee_id, own); })) rows.unshift({ employee_id: own, is_owner: true });
    rows.forEach(function (a) { a.is_owner = own ? M.same(a.employee_id, own) : !!a.is_owner; });
    return rows.sort(function (a, b) { return (b.is_owner ? 1 : 0) - (a.is_owner ? 1 : 0); });
  };
  M.load = function (st) {
    var ids = (st.tasks || []).map(function (k) { return k.id; }); if (!ids.length) return Promise.resolve();
    return Promise.all([
      sb.from('project_task_assignees').select('id,task_id,employee_id,is_owner').eq('tenant_id', M.tid()).in('task_id', ids).is('deleted_at', null),
      sb.from('project_tasks').select('id,start_time,due_time,remind_before_min,remind_sent_for').eq('tenant_id', M.tid()).in('id', ids)
    ]).then(function (r) {
      M.as = {}; (r[0].data || []).forEach(function (a) { (M.as[a.task_id] = M.as[a.task_id] || []).push(a); });
      var ex = {}; (r[1].data || []).forEach(function (x) { ex[x.id] = x; });
      (st.tasks || []).forEach(function (k) { var x = ex[k.id] || {}; k.start_time = x.start_time || null; k.due_time = x.due_time || null; k.remind_before_min = x.remind_before_min || null; k.remind_sent_for = x.remind_sent_for || null; });
    });
  };
  M.ini = function (e) { var n = String((e && (e.nickname || e.name)) || '?').trim(), p = n.split(/\s+/); return ((p[0] || '?').charAt(0) + (p[1] ? p[1].charAt(0) : (p[0] || '').charAt(1) || '')).toUpperCase(); };
  function emp(st, id) { return (st.employees || []).filter(function (e) { return M.same(e.id, id); })[0] || null; }
  function nm(e) { return e ? (e.nickname || e.name || '') : ''; }
  function card(st, el, k) {
    var meta = el.querySelector('.pj-card-meta'); if (!meta || meta.getAttribute('data-pjm')) return; meta.setAttribute('data-pjm', '1'); meta.classList.add('pjm-meta');
    var s = meta.children, ls = M.list(k);
    if (s[0] && ls.length) {
      var av = ls.slice(0, 3).map(function (a) { var e = emp(st, a.employee_id); return '<i class="pjm-av' + (a.is_owner ? ' own' : '') + '" title="' + M.esc(nm(e) + (a.is_owner ? ' · Owner' : '')) + '">' + M.esc(M.ini(e)) + '</i>'; }).join('');
      s[0].innerHTML = '<span class="pjm-avs" aria-label="' + M.esc(ls.map(function (a) { return nm(emp(st, a.employee_id)); }).join(', ')) + '">' + av + (ls.length > 3 ? '<i class="pjm-av more">+' + (ls.length - 3) + '</i>' : '') + '</span><span class="pjm-n">' + M.esc(nm(emp(st, ls[0].employee_id))) + (ls.length > 1 ? ' +' + (ls.length - 1) : '') + '</span>';
    }
    if (s[1] && k.due_time) s[1].insertAdjacentHTML('beforeend', ' <b class="pjm-tm"><i class="ti ti-clock"></i>' + M.esc(M.hm(k.due_time)) + '</b>');
  }
  M.decorate = function (st) {
    var main = document.getElementById('main'); if (!main || !main.querySelector('.pj-wrap') && !main.querySelector('.pj-board')) return;
    var by = {}; (st.tasks || []).forEach(function (k) { by[k.id] = k; });
    main.querySelectorAll('.pj-card[data-id]').forEach(function (el) { var k = by[el.getAttribute('data-id')]; if (!k) return; card(st, el, k); if (M.detail) M.detail(st, el, k); });
  };
  function hook() {
    var prev = window._pjAfterPaint; if (prev && prev._pjm) return;
    var fn = function (st) {
      var go = function () { if (typeof prev === 'function') { try { prev(st); } catch (e) { console.error(e); } } };
      if (!window.sb || !M.tid()) return go();
      M.probe().then(function (ok) { return ok ? M.load(st).then(function () { M.decorate(st); }) : null; }).catch(function (e) { console.warn('pjm', e); }).then(go);
    };
    fn._pjm = 1; window._pjAfterPaint = fn;
  }
  hook(); document.addEventListener('DOMContentLoaded', hook);
})();
