/* M-Core Projects phase 1 - "Today & overdue" card with due time + all assignees (copy of pj-wa-daily.js; only grouping, names, time label differ).
   Active only after pj_multi_01.sql (PJM.ok); otherwise the original pj-wa-daily.js card/text run unchanged. */
(function () {
  var W = window.PJW, M = window.PJM; if (!W || !M || !W.dailyCard || W._pjmDaily) return; W._pjmDaily = 1;
  var origCard = W.dailyCard, origText = W.dailyText, AS = {};
  var cache = null, lang = null;
  /* all assignees, owner first (falls back to assignee_employee_id) */
  function who(k) { var ls = (AS[k.id] || []).slice(), o = k.assignee_employee_id; if (o && !ls.some(function (x) { return M.same(x, o); })) ls.unshift(o); ls.sort(function (a, b) { return (M.same(b, o) ? 1 : 0) - (M.same(a, o) ? 1 : 0); }); return ls.map(W.empName).filter(Boolean).join(', '); }
  function tm(k) { return k.due_time ? ' ' + M.hm(k.due_time) : ''; }
  var text = function (rows, l) {
    var T = function (en, ms) { return l === 'bm' ? ms : en; }, co = (APP.tenant && APP.tenant.name) || 'M-Core';
    var days = { en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], bm: ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'] }[l][new Date().getDay()];
    var g = groups(rows), out = ['*' + T('Today & overdue tasks', 'Task hari ini & lewat') + ' · ' + co + '*', days + ' ' + W.dmy(W.today())];
    [['late', '⚠️ ' + T('Overdue', 'Lewat')], ['today', '📅 ' + T('Today', 'Hari ini')], ['tmr', '⏭️ ' + T('Tomorrow', 'Esok')]].forEach(function (x) {
      if (!g[x[0]].length) return;
      out.push('', '*' + x[1] + ' (' + g[x[0]].length + ')*');
      g[x[0]].forEach(function (k) { out.push('• ' + k.title + ' – ' + (who(k) || '-') + (x[0] === 'late' ? ' (' + W.dm(k.due_date) + tm(k) + ')' : tm(k) ? ' (' + tm(k).trim() + ')' : '')); });
    });
    if (!rows.length) out.push('', T('No tasks due. 👍', 'Tiada task perlu disiapkan. 👍'));
    out.push('_' + T('Sent via M-Core', 'Dihantar melalui M-Core') + '_');
    return out.join('\n');
  };
  function groups(rows) {
    var t = W.today(), tm = W.today(1), g = { late: [], today: [], tmr: [] };
    var now = new Date();
    rows.forEach(function (k) { var d = String(k.due_date).slice(0, 10), past = d === t && k.due_time && M.dueAt(k) < now; (d < t || past ? g.late : d === t ? g.today : d === tm ? g.tmr : []).push(k); });
    return g;
  }
  /* row tap -> same path as the ?pj_task= deep link: open the task's project with its Detail expanded, then scroll to it */
  function openTask(id, pid) {
    if (!id || !pid || typeof openPage !== 'function') return;
    var find = function (sel) { return Array.prototype.filter.call(document.querySelectorAll(sel), function (n) { return String(n.getAttribute('data-id')) === String(id); })[0]; };
    var old = find('.pj-card'); window._pjOpenTask = id; openPage('projects', { id: pid });
    var n = 0, clicked = 0, look = function () {
      var c = find('.pj-card');
      if (c && c !== old) { c.scrollIntoView({ block: 'center' }); c.style.outline = '2px solid var(--primary)'; c.style.outlineOffset = '2px'; setTimeout(function () { c.style.outline = ''; c.style.outlineOffset = ''; }, 1800); return; }
      var m = !clicked && find('.pj-mcard, .pj-tlcard'); if (m) { clicked = 1; m.click(); }
      if (++n < 40) setTimeout(look, 150);
    };
    setTimeout(look, 150);
  }
  var card = function (main, st) {
    var host = main.querySelector('.pj-tabs'); if (!host) return;
    var el = document.createElement('div'); el.className = 'cob-card pjw-inj'; el.style.cssText = 'padding:16px;margin:4px 0 8px';
    el.innerHTML = '<div class="page-loading" style="min-height:60px"><div class="spinner"></div></div>';
    host.insertAdjacentElement('afterend', el);
    lang = lang || (W.bm() ? 'bm' : 'en');
    var q = cache ? Promise.resolve(cache) : sb.from('project_tasks').select('id,project_id,title,column_key,assignee_employee_id,due_date,due_time,progress').eq('tenant_id', W.tid()).is('deleted_at', null).neq('column_key', 'done').lte('due_date', W.today(1)).order('due_date').limit(200)
      .then(function (r) { if (r.error) throw r.error; var rows = r.data || [], ids = rows.map(function (k) { return k.id; }); return (ids.length ? sb.from('project_task_assignees').select('task_id,employee_id').eq('tenant_id', W.tid()).in('task_id', ids).is('deleted_at', null) : Promise.resolve({ data: [] })).then(function (a) { AS = {}; (a.data || []).forEach(function (x) { (AS[x.task_id] = AS[x.task_id] || []).push(x.employee_id); }); cache = rows; setTimeout(function () { cache = null; }, 60000); return cache; }); });
    q.then(function (rows) {
      var g = groups(rows), pj = {}; (st.allProjects || st.projects || []).forEach(function (p) { pj[p.id] = p.name; });
      var kpi = function (n, l, c) { return '<div class="cob-card" style="padding:10px;text-align:center"><b style="font-size:20px;color:' + c + '">' + n + '</b><div class="cob-xs">' + l + '</div></div>'; };
      var row = function (k, c, lbl) { return '<div role="button" tabindex="0" data-pjt="' + W.esc(k.id) + '" data-pjp="' + W.esc(k.project_id) + '" aria-label="' + W.esc(W.L('Open task: ', 'Buka task: ') + k.title) + '" style="display:flex;gap:10px;align-items:center;min-height:40px;padding:9px 0;border-bottom:1px solid var(--border);cursor:pointer"><i style="width:8px;height:8px;border-radius:50%;background:' + c + ';flex:none"></i><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + W.esc(k.title) + '</div><div class="cob-xs" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + W.esc((who(k) || '-') + ' · ' + (pj[k.project_id] || '')) + '</div></div><span class="cob-xs" style="color:' + c + ';font-weight:700;white-space:nowrap">' + lbl + '</span></div>'; };
      var txt = text(rows, lang);
      el.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><div style="min-width:0"><b style="font-size:15px"><i class="ti ti-calendar-due"></i> ' + W.L('Today & overdue tasks', 'Task hari ini & lewat') + '</b><div class="cob-xs">' + W.dmy(W.today()) + ' · ' + W.L('all projects', 'semua projek') + '</div></div><div class="cob-seg" role="group" aria-label="Language"><button type="button" data-dl="en" class="' + (lang === 'en' ? 'on' : '') + '">EN</button><button type="button" data-dl="bm" class="' + (lang === 'bm' ? 'on' : '') + '">BM</button></div></div>' +
        '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0">' + kpi(g.late.length, W.L('Overdue', 'Lewat'), 'var(--danger)') + kpi(g.today.length, W.L('Today', 'Hari ini'), 'var(--warning)') + kpi(g.tmr.length, W.L('Tomorrow', 'Esok'), 'var(--primary)') + '</div>' +
        g.late.map(function (k) { return row(k, 'var(--danger)', W.lateDays(k) > 0 ? W.L('Overdue ', 'Lewat ') + W.lateDays(k) + W.L('d', 'h') : W.L('Overdue', 'Lewat') + tm(k)); }).join('') + g.today.map(function (k) { return row(k, 'var(--warning)', W.L('Today', 'Hari ini') + tm(k)); }).join('') + g.tmr.map(function (k) { return row(k, 'var(--primary)', W.L('Tomorrow', 'Esok')); }).join('') +
        '<div class="pjw-sec" style="margin-top:12px">' + W.L('PREVIEW', 'PRATONTON') + '</div>' + W.bubble(txt) +
        '<div class="pjw-row"><button type="button" class="btn btn-outline" data-dcp style="flex:0 0 auto"><i class="ti ti-copy"></i> ' + W.L('Copy', 'Salin') + '</button><button type="button" class="btn pjw-go" data-dgo><i class="ti ti-users-group"></i> ' + W.L('Send to group', 'Hantar ke group') + '</button></div>' +
        '<div class="cob-xs" style="text-align:center;margin-top:8px">' + W.L('wa.me without a number → choose your team group in WhatsApp', 'wa.me tanpa nombor → pilih group pasukan dalam WhatsApp') + '</div>';
      el.querySelectorAll('[data-dl]').forEach(function (b) { b.onclick = function () { lang = b.dataset.dl; el.remove(); card(main, st); }; });
      el.querySelectorAll('[data-pjt]').forEach(function (r) { r.onclick = function () { openTask(r.dataset.pjt, r.dataset.pjp); }; r.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openTask(r.dataset.pjt, r.dataset.pjp); } }; });
      el.querySelector('[data-dcp]').onclick = function () { try { navigator.clipboard.writeText(txt); W.toast(W.L('Copied', 'Disalin')); } catch (e) {} };
      el.querySelector('[data-dgo]').onclick = function () { W.open(W.waUrl('', txt)); W.log([{ template: 'daily', lang: lang, recipient_kind: 'other', message: txt }]).catch(function (e) { W.toast((e && e.message) || 'Error', 'error'); }); };
    }).catch(function (e) { el.innerHTML = '<div class="cob-xs" style="color:var(--danger)">' + W.esc((e && e.message) || 'Error') + '</div>'; });
  };
  M.openTask = openTask;
  W.dailyText = function (rows, l) { return M.ok ? text(rows, l) : origText(rows, l); };
  W.dailyCard = function (main, st) { return M.ok ? card(main, st) : origCard(main, st); };
})();
