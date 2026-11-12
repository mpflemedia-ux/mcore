/* M-Core My Work (top of Planner): one list per person - own project tasks (Planner rows mirrored per ASSIGNEE by DB triggers,
   supabase/migrations/20261112041500_mywork_project_planner.sql), manual todos, bookings and pending approvals (NT.loadLive, cat approval).
   Tabs Today / Overdue / This week / Done (+ Team for owner / admin / platform admin / task PIC). Complete = the DB marks this
   assignee's part done (trigger), Snooze = RPC mywork_snooze, Open = the original item. Planner wraps: calendar names per assignee,
   project rows open the task, Repeat + Until on manual todos. Hidden (Planner unchanged) until the SQL has run (probe). */
(function () {
  if (window.MW) return;
  var MW = window.MW = { on: null, tab: 'today', rows: [], appr: [], team: null, pic: null, busy: false };
  function bm() { return window.APP && APP.language === 'bm'; }
  function L(en, ms) { return bm() ? ms : en; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function same(a, b) { return String(a) === String(b); }
  function tid() { return window.APP && APP.tenant && APP.tenant.id; }
  function uid() { return window.APP && APP.user && APP.user.id; }
  function toast(m, k) { if (typeof showToast === 'function') showToast(esc(m), k || 'success'); }
  function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function dkey(ts) { if (!ts) return ''; var d = new Date(ts); return isNaN(d.getTime()) ? '' : ymd(d); }
  function dmy(key) { var p = String(key || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : ''; }
  function hm(ts) { try { return new Date(ts).toLocaleTimeString('en-MY', { hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase(); } catch (e) { return ''; } }
  function allowed() { try { return typeof canAccess !== 'function' || canAccess('planner'); } catch (e) { return false; } }
  function adm() { try { return (typeof isTenantAdmin === 'function' && isTenantAdmin()) || (typeof isPlatformAdmin === 'function' && isPlatformAdmin()); } catch (e) { return false; } }
  function errText(e) {
    var m = String((e && (e.message || e)) || '');
    if (/mw_not_assignee/.test(m)) return L('Only the assignee or the task PIC can do this', 'Hanya assignee atau PIC task boleh buat ini');
    if (/mw_not_found/.test(m)) return L('This item was changed. Refreshed.', 'Item ini telah berubah. Dimuat semula.');
    return m;
  }

  /* ---- probe: the SQL adds platform_activities.project_employee_id ---- */
  MW.probe = function () {
    if (MW.on != null || !window.sb || !tid()) return Promise.resolve(!!MW.on);
    if (MW._p) return MW._p;
    MW._p = sb.from('platform_activities').select('id,project_employee_id,recur_rule').eq('tenant_id', tid()).limit(1).then(function (r) {
      MW.on = !r.error; if (!MW.on) console.info('[M-Core] My Work hidden until SQL 20261112041500_mywork_project_planner.sql is run'); return MW.on;
    }, function () { MW.on = false; return false; });
    return MW._p;
  };

  function weekEnd(today) { var d = new Date(today + 'T00:00:00'), wd = d.getDay() || 7; d.setDate(d.getDate() + (7 - wd)); return ymd(d); }
  function bucket(it, today, wEnd) {
    if (it.kind === 'appr') return it.late ? 'overdue' : 'today';
    if (it.status === 'done') return 'done';
    if (!it.day) return 'today';
    if (it.day < today) return 'overdue';
    if (it.day === today) return 'today';
    if (it.day <= wEnd) return 'week';
    return '';
  }

  MW.load = async function () {
    var t = tid(), me = uid(); if (!t || !me) return;
    var since = new Date(Date.now() - 14 * 864e5).toISOString();
    var r = await sb.from('platform_activities').select('*').eq('tenant_id', t).eq('owner_user_id', me).is('deleted_at', null)
      .neq('activity_type', 'event').or('status.eq.open,and(status.eq.done,updated_at.gte.' + since + ')').order('due_at', { ascending: true, nullsFirst: false }).limit(500);
    if (r.error) throw r.error;
    var rows = r.data || [], tids = [];
    rows.forEach(function (x) { if (x.project_task_id && tids.indexOf(x.project_task_id) < 0) tids.push(x.project_task_id); });
    var task = {}, proj = {}, chk = {};
    if (tids.length) {
      var k = await sb.from('project_tasks').select('id,project_id,title,column_key,progress').eq('tenant_id', t).in('id', tids);
      (k.data || []).forEach(function (x) { task[x.id] = x; });
      var pids = []; Object.keys(task).forEach(function (id) { var p = task[id].project_id; if (p && pids.indexOf(p) < 0) pids.push(p); });
      if (pids.length) { var p = await sb.from('projects').select('id,name').eq('tenant_id', t).in('id', pids); (p.data || []).forEach(function (x) { proj[x.id] = x.name; }); }
      var c = await sb.from('project_task_checklist').select('task_id,done').eq('tenant_id', t).in('task_id', tids).is('deleted_at', null);
      if (!c.error) (c.data || []).forEach(function (x) { var o = chk[x.task_id] || (chk[x.task_id] = { d: 0, n: 0 }); o.n++; if (x.done) o.d++; });
    }
    MW.rows = rows.map(function (x) {
      var ts = x.due_at || x.starts_at, k = x.project_task_id && task[x.project_task_id], bk = String(x.notes || '').match(/^booking:([0-9a-f-]{36})/i);
      return { kind: k ? 'task' : bk ? 'booking' : 'todo', id: x.id, title: x.title, status: x.status, ts: ts, day: dkey(ts), type: x.activity_type,
        task: k || null, project: k ? (proj[k.project_id] || '') : '', chk: k ? chk[k.id] : null, bkid: bk ? bk[1] : null, recur: x.recur_rule || '', row: x };
    });
    MW.appr = [];
    try {
      if (window.NT && typeof NT.loadLive === 'function') {
        var live = await NT.loadLive();
        MW.appr = (live || []).filter(function (i) { return i && i.cat === 'approval' && i.go; }).map(function (i) { return { kind: 'appr', id: i.key, title: i.title, meta: i.meta, late: !!i.late, go: i.go, ts: i.ts }; });
      }
    } catch (e) { MW.appr = []; }
  };

  MW.loadTeam = async function () {
    var t = tid(), me = uid(), today = ymd(new Date());
    var scope = null;
    if (!adm()) {
      var emp = window.PJM && PJM.myEmp ? await PJM.myEmp().catch(function () { return null; }) : null; if (!emp) return [];
      var k = await sb.from('project_tasks').select('id').eq('tenant_id', t).eq('assignee_employee_id', emp).is('deleted_at', null).neq('column_key', 'done').limit(1000);
      scope = (k.data || []).map(function (x) { return String(x.id); }); if (!scope.length) return [];
    }
    var r = await sb.from('platform_activities').select('owner_user_id,status,due_at,starts_at,project_task_id').eq('tenant_id', t).is('deleted_at', null).eq('status', 'open').neq('activity_type', 'event').limit(5000);
    if (r.error) throw r.error;
    var by = {};
    (r.data || []).forEach(function (x) {
      if (scope && !(x.project_task_id && scope.indexOf(String(x.project_task_id)) >= 0)) return;
      var o = by[x.owner_user_id] || (by[x.owner_user_id] = { uid: x.owner_user_id, open: 0, late: 0 });
      o.open++; var d = dkey(x.due_at || x.starts_at); if (d && d < today) o.late++;
    });
    var ids = Object.keys(by); if (!ids.length) return [];
    var u = await sb.from('user_profiles').select('id,full_name').eq('tenant_id', t).in('id', ids);
    var nm = {}; (u.data || []).forEach(function (x) { nm[x.id] = x.full_name || ''; });
    return ids.map(function (id) { var o = by[id]; o.name = nm[id] || '—'; o.me = same(id, me); return o; })
      .sort(function (a, b) { return b.late - a.late || b.open - a.open || a.name.localeCompare(b.name); });
  };
  MW.isPic = async function () {
    if (adm()) return true; if (MW.pic != null) return MW.pic;
    var emp = window.PJM && PJM.myEmp ? await PJM.myEmp().catch(function () { return null; }) : null;
    if (!emp) return (MW.pic = false);
    var k = await sb.from('project_tasks').select('id').eq('tenant_id', tid()).eq('assignee_employee_id', emp).is('deleted_at', null).neq('column_key', 'done').limit(1);
    return (MW.pic = !k.error && !!(k.data && k.data.length));
  };

  function css() {
    if (document.getElementById('mw-css')) return;
    var s = document.createElement('style'); s.id = 'mw-css';
    s.textContent = '.mw{background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:14px;color:var(--text);max-width:100%;box-sizing:border-box;overflow:hidden}' +
      '.mw-head{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:10px}.mw-head b{font-size:15px;display:flex;align-items:center;gap:6px}.mw-head b i{color:var(--primary)}' +
      '.mw-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}.mw-tabs button{white-space:nowrap;border:1px solid var(--border);background:var(--bg);color:var(--text-2);border-radius:99px;padding:6px 12px;font-size:13px;min-height:36px;cursor:pointer}' +
      '.mw-tabs button.on{background:var(--primary);border-color:var(--primary);color:var(--on-primary,#fff)}.mw-tabs button span{font-weight:700;margin-left:4px}' +
      '.mw-list{display:flex;flex-direction:column;gap:8px;max-height:min(70vh,640px);overflow-y:auto;-webkit-overflow-scrolling:touch}' +
      '.mw-card{border:1px solid var(--border);border-radius:10px;padding:10px;background:var(--bg);display:flex;flex-direction:column;gap:6px;min-width:0}' +
      '.mw-card.late{border-left:3px solid var(--danger)}.mw-top{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;min-width:0}' +
      '.mw-src{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;padding:2px 8px;border-radius:99px;background:var(--primary-light);color:var(--primary);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.mw-when{font-size:12px;color:var(--text-3);white-space:nowrap}.mw-when.late{color:var(--danger);font-weight:600}' +
      '.mw-title{font-size:14px;font-weight:600;line-height:1.35;word-break:break-word;color:var(--text)}.mw-meta{font-size:12px;color:var(--text-2);display:flex;gap:10px;flex-wrap:wrap}' +
      '.mw-acts{display:flex;gap:6px;flex-wrap:wrap}.mw-acts .btn{white-space:nowrap;min-height:36px}' +
      '.mw-empty{padding:18px 8px;text-align:center;color:var(--text-3);font-size:13px}' +
      '.mw-team{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}.mw-team b{font-size:14px;min-width:0;word-break:break-word}.mw-nums{display:flex;gap:6px;flex-wrap:wrap}' +
      '.mw-num{font-size:12px;white-space:nowrap;border:1px solid var(--border);border-radius:99px;padding:2px 8px;color:var(--text-2)}.mw-num.late{border-color:var(--danger);color:var(--danger);font-weight:600}' +
      '#pl-recur-row .form-group{min-width:0}.mw-hint{display:block;font-size:11px;color:var(--text-3);margin:-6px 0 10px}';
    document.head.appendChild(s);
  }

  function src(it) {
    if (it.kind === 'task') return '<span class="mw-src" title="' + esc(it.project) + '"><i class="ti ti-folder"></i> ' + esc(it.project || L('Project', 'Projek')) + '</span>';
    if (it.kind === 'booking') return '<span class="mw-src"><i class="ti ti-calendar-event"></i> ' + esc(L('Booking', 'Tempahan')) + '</span>';
    if (it.kind === 'appr') return '<span class="mw-src"><i class="ti ti-circle-check"></i> ' + esc(L('Approval', 'Kelulusan')) + '</span>';
    var ty = { appointment: L('Appointment', 'Janji temu'), reminder: L('Reminder', 'Peringatan'), follow_up: L('Follow-up', 'Susulan') }[it.type] || L('Todo', 'Todo');
    return '<span class="mw-src"><i class="ti ti-checkbox"></i> ' + esc(ty) + '</span>';
  }
  function when(it, today) {
    if (it.kind === 'appr') return '<span class="mw-when' + (it.late ? ' late' : '') + '">' + esc(it.late ? L('Waiting over 1 day', 'Menunggu lebih 1 hari') : L('Waiting for you', 'Menunggu kau')) + '</span>';
    if (!it.day) return '<span class="mw-when">' + esc(L('No date', 'Tiada tarikh')) + '</span>';
    var late = it.status === 'open' && it.day < today, n = late ? Math.round((new Date(today + 'T00:00:00') - new Date(it.day + 'T00:00:00')) / 864e5) : 0;
    var d = it.day === today ? L('Today', 'Hari ini') : dmy(it.day);
    return '<span class="mw-when' + (late ? ' late' : '') + '">' + esc(d + ' · ' + hm(it.ts) + (late ? ' · ' + L('Overdue ' + n + (n === 1 ? ' day' : ' days'), 'Lewat ' + n + ' hari') : '')) + '</span>';
  }
  var REP = { daily: ['Repeats daily', 'Berulang setiap hari'], weekdays: ['Repeats every weekday', 'Berulang setiap hari bekerja'], weekly: ['Repeats weekly', 'Berulang setiap minggu'], monthly: ['Repeats monthly', 'Berulang setiap bulan'] };
  function card(it, today) {
    var late = it.kind === 'appr' ? it.late : (it.status === 'open' && it.day && it.day < today);
    var meta = [];
    if (it.kind === 'appr' && it.meta) meta.push(esc(it.meta));
    if (it.chk && it.chk.n) meta.push('<span><i class="ti ti-list-check"></i> ' + esc(L('Checklist ', 'Senarai semak ') + it.chk.d + '/' + it.chk.n) + '</span>');
    if (it.recur && REP[it.recur]) meta.push('<span><i class="ti ti-repeat"></i> ' + esc(L(REP[it.recur][0], REP[it.recur][1])) + '</span>');
    var a = [];
    if (it.kind === 'appr') a.push('<button type="button" class="btn btn-sm btn-primary" data-mw-go="' + esc(it.id) + '"><i class="ti ti-eye"></i> ' + esc(L('Review', 'Semak')) + '</button>');
    else {
      if (it.status === 'open') a.push('<button type="button" class="btn btn-sm btn-primary" data-mw-done="' + esc(it.id) + '"><i class="ti ti-check"></i> ' + esc(it.kind === 'task' ? L('Complete my part', 'Siap bahagian aku') : L('Complete', 'Selesai')) + '</button>');
      if (it.status === 'open' && (MW.tab === 'today' || MW.tab === 'overdue') && it.kind !== 'booking') {
        a.push('<button type="button" class="btn btn-sm btn-outline" data-mw-snz="1" data-id="' + esc(it.id) + '" title="' + esc(L('Snooze to tomorrow', 'Tunda ke esok')) + '"><i class="ti ti-clock-pause"></i> ' + esc(L('Tomorrow', 'Esok')) + '</button>');
        a.push('<button type="button" class="btn btn-sm btn-outline" data-mw-snz="7" data-id="' + esc(it.id) + '" title="' + esc(L('Snooze one week', 'Tunda seminggu')) + '"><i class="ti ti-calendar-plus"></i> ' + esc(L('Next week', 'Minggu depan')) + '</button>');
      }
      a.push('<button type="button" class="btn btn-sm btn-outline" data-mw-open="' + esc(it.id) + '"><i class="ti ti-external-link"></i> ' + esc(L('Open', 'Buka')) + '</button>');
    }
    return '<article class="mw-card' + (late ? ' late' : '') + '"><div class="mw-top">' + src(it) + when(it, today) + '</div><div class="mw-title">' + esc(it.title) + '</div>' +
      (meta.length ? '<div class="mw-meta">' + meta.join('') + '</div>' : '') + '<div class="mw-acts">' + a.join('') + '</div></article>';
  }

  MW.paint = function () {
    var box = document.getElementById('mw-box'); if (!box) return;
    var today = ymd(new Date()), wEnd = weekEnd(today), groups = { today: [], overdue: [], week: [], done: [] };
    MW.rows.concat(MW.appr).forEach(function (it) { var b = bucket(it, today, wEnd); if (b && groups[b]) groups[b].push(it); });
    groups.overdue.sort(function (a, b) { return String(a.day || '').localeCompare(String(b.day || '')); });
    groups.done.sort(function (a, b) { return String((b.row && b.row.updated_at) || '').localeCompare(String((a.row && a.row.updated_at) || '')); });
    var tabs = [['today', L('Today', 'Hari ini')], ['overdue', L('Overdue', 'Lewat')], ['week', L('This week', 'Minggu ini')], ['done', L('Done', 'Siap')]];
    if (MW.showTeam) tabs.push(['team', L('Team', 'Pasukan')]);
    if (!tabs.some(function (x) { return x[0] === MW.tab; })) MW.tab = 'today';
    var body;
    if (MW.tab === 'team') {
      body = MW.team == null ? '<div class="mw-empty"><div class="spinner dark" style="margin:0 auto"></div></div>'
        : (MW.team.length ? MW.team.map(function (p) {
          return '<article class="mw-card' + (p.late ? ' late' : '') + '"><div class="mw-team"><b>' + esc(p.name) + (p.me ? ' · ' + esc(L('you', 'kau')) : '') + '</b><div class="mw-nums"><span class="mw-num">' + esc(L('Open ', 'Terbuka ') + p.open) + '</span><span class="mw-num' + (p.late ? ' late' : '') + '">' + esc(L('Overdue ', 'Lewat ') + p.late) + '</span></div></div></article>';
        }).join('') : '<div class="mw-empty">' + esc(L('Nobody has open work', 'Tiada kerja terbuka')) + '</div>');
    } else {
      var list = groups[MW.tab] || [];
      var empty = { today: L('Nothing due today', 'Tiada kerja hari ini'), overdue: L('Nothing overdue', 'Tiada kerja lewat'), week: L('Nothing else this week', 'Tiada kerja lain minggu ini'), done: L('Nothing done in the last 14 days', 'Tiada kerja siap dalam 14 hari lepas') }[MW.tab];
      body = list.length ? list.map(function (it) { return card(it, today); }).join('') : '<div class="mw-empty">' + esc(empty) + '</div>';
    }
    box.innerHTML = '<div class="mw-head"><b><i class="ti ti-briefcase"></i> ' + esc(L('My Work', 'Kerja Saya')) + '</b></div>' +
      '<div class="mw-tabs" role="tablist">' + tabs.map(function (x) {
        var n = x[0] === 'team' ? '' : '<span>' + (groups[x[0]] || []).length + '</span>';
        return '<button type="button" role="tab" aria-selected="' + (MW.tab === x[0]) + '" data-mw-tab="' + x[0] + '"' + (MW.tab === x[0] ? ' class="on"' : '') + '>' + esc(x[1]) + n + '</button>';
      }).join('') + '</div><div class="mw-list">' + body + '</div>';
    bind(box);
  };

  function find(id) { var all = MW.rows.concat(MW.appr); for (var i = 0; i < all.length; i++) if (same(all[i].id, id)) return all[i]; return null; }
  function openItem(it) {
    if (!it) return;
    if (it.kind === 'appr') { openPage(it.go[0], it.go[1] || {}); return; }
    if (it.kind === 'task' && it.task) { window._pjOpenTask = it.task.id; openPage('projects', { id: it.task.project_id }); return; }
    if (it.kind === 'booking' && it.bkid) { openPage('dashboard', { bkid: it.bkid }); return; }
    if (typeof MW.origOpen === 'function') MW.origOpen(it.id);
  }
  function relist() { try { if (typeof _plannerLoadList === 'function' && document.getElementById('planner-list')) _plannerLoadList(window._plannerT); } catch (e) {} }
  function bind(box) {
    box.querySelectorAll('[data-mw-tab]').forEach(function (b) { b.onclick = function () {
      MW.tab = b.getAttribute('data-mw-tab'); MW.paint();
      if (MW.tab === 'team' && MW.team == null) MW.loadTeam().then(function (x) { MW.team = x; }, function (e) { MW.team = []; toast(errText(e), 'error'); }).then(MW.paint);
    }; });
    box.querySelectorAll('[data-mw-go],[data-mw-open]').forEach(function (b) { b.onclick = function () { openItem(find(b.getAttribute('data-mw-go') || b.getAttribute('data-mw-open'))); }; });
    box.querySelectorAll('[data-mw-done]').forEach(function (b) { b.onclick = async function () {
      var it = find(b.getAttribute('data-mw-done')); if (!it || b.disabled) return; b.disabled = true;
      var r = await sb.from('platform_activities').update({ status: 'done', updated_at: new Date().toISOString() }).eq('id', it.id).eq('tenant_id', tid()).eq('owner_user_id', uid());
      if (r.error) { b.disabled = false; toast(errText(r.error), 'error'); return; }
      toast(it.kind === 'task' ? L('Your part is done. The PIC has been told.', 'Bahagian kau siap. PIC dah dimaklumkan.') : L('Marked done', 'Ditanda selesai'));
      await MW.refresh(); relist();
    }; });
    box.querySelectorAll('[data-mw-snz]').forEach(function (b) { b.onclick = async function () {
      if (b.disabled) return; b.disabled = true;
      var days = Number(b.getAttribute('data-mw-snz')), r = await sb.rpc('mywork_snooze', { p_id: b.getAttribute('data-id'), p_days: days });
      if (r.error) { b.disabled = false; toast(errText(r.error), 'error'); if (/mw_not_found/.test(r.error.message || '')) MW.refresh(); return; }
      toast(L('Moved to ', 'Dipindah ke ') + dmy(r.data && r.data.due));
      await MW.refresh(); relist();
    }; });
  }
  MW.refresh = async function () {
    if (!document.getElementById('mw-box')) return;
    try { await MW.load(); } catch (e) { console.warn('mywork', e); }
    MW.team = null; MW.paint();
  };
  MW.mount = async function (params) {
    if (!allowed() || !(await MW.probe())) return;
    var main = document.getElementById('main'), anchor = document.getElementById('pl-filter-status');
    if (!main || !anchor || document.getElementById('mw-box')) return;
    if (params && params.mw) MW.tab = String(params.mw);
    css();
    var box = document.createElement('section'); box.id = 'mw-box'; box.className = 'mw';
    box.innerHTML = '<div class="mw-empty"><div class="spinner dark" style="margin:0 auto"></div></div>';
    anchor.parentNode.parentNode.insertBefore(box, anchor.parentNode);
    MW.showTeam = await MW.isPic().catch(function () { return false; });
    await MW.refresh();
  };

  /* ---- Planner wraps ---- */
  function wrap() {
    if (typeof window.renderPlanner !== 'function' || typeof window._plannerOpenForm !== 'function') return false;
    if (!window.renderPlanner._mw) {
      var rp = window.renderPlanner;
      var fn = async function (params) { try { await MW.probe(); } catch (e) {} var r = await rp.apply(this, arguments); try { await MW.mount(params); } catch (e) { console.warn('mywork', e); } return r; };
      fn._mw = 1; window.renderPlanner = fn;
    }
    if (!window._plannerResolveAssignees._mw) {
      var ra = window._plannerResolveAssignees;
      var rf = async function (rows) {
        await ra.apply(this, arguments);
        if (!MW.on || !rows || !rows.length) return;
        var ids = rows.filter(function (r) { return r.project_task_id && r.id && String(r.id).indexOf(':') < 0; }).map(function (r) { return r.id; }); if (!ids.length) return;
        try {
          var x = await sb.from('platform_activities').select('id,project_employee_id').eq('tenant_id', tid()).in('id', ids.slice(0, 500));
          var em = {}, eids = []; (x.data || []).forEach(function (a) { if (a.project_employee_id) { em[a.id] = a.project_employee_id; if (eids.indexOf(a.project_employee_id) < 0) eids.push(a.project_employee_id); } });
          if (!eids.length) return;
          var e = await sb.from('employees').select('id,name,nickname').eq('tenant_id', tid()).in('id', eids);
          var nm = {}; (e.data || []).forEach(function (a) { nm[a.id] = a.nickname || a.name || ''; });
          rows.forEach(function (r) { var id = em[r.id]; if (id) { r._assigneeKey = 'e:' + id; r._assigneeName = nm[id] || r._assigneeName; } });
        } catch (er) { console.warn('mywork names', er); }
      };
      rf._mw = 1; window._plannerResolveAssignees = rf;
    }
    if (!window._plannerOpenForm._mw) {
      var of = window._plannerOpenForm; MW.origOpen = of;
      var off = async function (id) {
        var s = String(id || '');
        if (MW.on && s && s.indexOf(':') < 0) {
          var row = (window._plannerRows || []).concat(window._plannerCalRows || []).filter(function (r) { return same(r.id, s); })[0];
          if (row && row.project_task_id) {
            var k = await sb.from('project_tasks').select('id,project_id').eq('id', row.project_task_id).eq('tenant_id', tid()).is('deleted_at', null).maybeSingle();
            if (k.data) { window._pjOpenTask = k.data.id; openPage('projects', { id: k.data.project_id }); return; }
          }
        }
        var r = await of.apply(this, arguments);
        try { await repeatFields(s); } catch (e) { console.warn('mywork repeat', e); }
        return r;
      };
      off._mw = 1; off._pjm = of._pjm; window._plannerOpenForm = off;
    }
    return true;
  }
  /* Repeat + Until on manual todos (saved by _plannerSave through window._plannerPayloadExtra) */
  async function repeatFields(id) {
    if (!MW.on) return;
    var notes = document.getElementById('pl-notes'), grp = notes && notes.closest('.form-group'); if (!grp) return;
    if (!document.getElementById('pl-recur')) {
      var opts = [['', L('No repeat', 'Tiada ulangan')], ['daily', L('Every day', 'Setiap hari')], ['weekdays', L('Every weekday (Mon-Fri)', 'Setiap hari bekerja (Isn-Jum)')], ['weekly', L('Every week', 'Setiap minggu')], ['monthly', L('Every month, same day', 'Setiap bulan, hari yang sama')]];
      grp.insertAdjacentHTML('afterend', '<div class="form-row" id="pl-recur-row"><div class="form-group"><label class="form-label" for="pl-recur">' + esc(L('Repeat', 'Ulang')) + '</label><select id="pl-recur" class="form-input">' +
        opts.map(function (o) { return '<option value="' + o[0] + '">' + esc(o[1]) + '</option>'; }).join('') + '</select></div>' +
        '<div class="form-group"><label class="form-label" for="pl-recur-until">' + esc(L('Until (optional)', 'Sehingga (pilihan)')) + '</label><input type="date" id="pl-recur-until" class="form-input"></div></div>' +
        '<small class="mw-hint">' + esc(L('The next one is created when this is completed or its due date passes. Needs a due or start time.', 'Yang seterusnya dibuat bila ini siap atau tarikh akhirnya lepas. Perlu tarikh akhir atau masa mula.')) + '</small>');
    }
    css();
    var sel = document.getElementById('pl-recur'), un = document.getElementById('pl-recur-until');
    sel.value = ''; un.value = '';
    if (id) {
      var r = await sb.from('platform_activities').select('id,recur_rule,recur_until').eq('id', id).eq('tenant_id', tid()).maybeSingle();
      if (r.data) { sel.value = r.data.recur_rule || ''; un.value = r.data.recur_until ? String(r.data.recur_until).slice(0, 10) : ''; }
    }
  }
  window._plannerPayloadExtra = function () {
    var sel = document.getElementById('pl-recur'); if (!MW.on || !sel) return {};
    var rule = sel.value || null, un = document.getElementById('pl-recur-until');
    if (rule && !document.getElementById('pl-due').value && !document.getElementById('pl-start').value) toast(L('Set a due or start time so it can repeat', 'Isi tarikh akhir atau masa mula supaya boleh berulang'), 'warning');
    return { recur_rule: rule, recur_until: rule && un && un.value ? un.value : null };
  };
  if (!wrap()) { var n = 0, iv = setInterval(function () { if (wrap() || ++n > 30) clearInterval(iv); }, 1000); }
})();
