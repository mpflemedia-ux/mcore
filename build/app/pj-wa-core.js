/* M-Core Projects - Share WhatsApp (Tier 1, wa.me) core: probe, data, permission, message builder, CSS.
   Hidden until project_task_shares + project_task_comments exist (42P01/PGRST205 => one console line, no UI). */
(function () {
  if (window.PJW) return;
  var W = window.PJW = { ok: null, shares: {}, emps: [], custs: [], sel: {}, selOn: false, daily: false };
  W.bm = function () { return window.APP && APP.language === 'bm'; };
  W.L = function (en, bm) { return W.bm() ? bm : en; };
  W.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); };
  W.same = function (a, b) { return String(a) === String(b); };
  W.tid = function () { return window.APP && APP.tenant && APP.tenant.id; };
  W.uid = function () { return window.APP && APP.user && APP.user.id; };
  W.me = function () { var u = (window.APP && APP.user) || {}; return String(u.full_name || u.name || (u.user_metadata && u.user_metadata.full_name) || u.email || '').slice(0, 200); };
  W.isTA = function () { try { return typeof isTenantAdmin === 'function' && !!isTenantAdmin(); } catch (e) { return false; } };
  W.toast = function (m, k) { if (typeof showToast === 'function') showToast(m, k || 'success'); };
  W.today = function (o) { var d = new Date(Date.now() + (o || 0) * 864e5); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  W.dmy = function (d) { var p = String(d || '').slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : ''; };
  W.dm = function (d) { return W.dmy(d).slice(0, 5); };
  W.late = function (k) { return k.due_date && String(k.due_date).slice(0, 10) < W.today() && k.column_key !== 'done'; };
  W.lateDays = function (k) { return Math.round((Date.parse(W.today()) - Date.parse(String(k.due_date).slice(0, 10))) / 864e5); };
  var missing = function (e) { return !!e && (e.code === '42P01' || e.code === 'PGRST205' || /does not exist|schema cache/i.test(e.message || '')); };
  var logged = false;
  W.probe = function () {
    if (W.ok != null) return Promise.resolve(W.ok);
    return Promise.all(['project_task_shares', 'project_task_comments'].map(function (t) { return sb.from(t).select('id', { head: true, count: 'exact' }).limit(1); })).then(function (r) {
      var e = r[0].error || r[1].error; W.ok = !e;
      if (e && !logged) { logged = true; console.info('[M-Core] Projects WhatsApp share hidden until SQL projects_wa_share_01.sql is run' + (missing(e) ? '' : ': ' + (e.message || e.code))); }
      return W.ok;
    }, function () { W.ok = false; return false; });
  };
  /* employee of the logged-in user (same rule as employee-probation.js: employees.email = login email) */
  W.myEmp = function () { var em = String((APP.user && APP.user.email) || '').toLowerCase(); return W.emps.find(function (e) { return em && String(e.email || '').toLowerCase() === em; }) || null; };
  W.canShare = function (k) { if (W.isTA()) return true; var m = W.myEmp(); return !!(k && m && W.same(k.assignee_employee_id, m.id)); };
  W.load = function (st) {
    var tid = W.tid(), ids = (st.tasks || []).map(function (k) { return k.id; });
    var a = sb.from('employees').select('id,name,nickname,phone,email').eq('tenant_id', tid).is('deleted_at', null).order('name');
    var b = sb.from('customers').select('id,name,phone').eq('tenant_id', tid).is('deleted_at', null).order('name').limit(500);
    var c = ids.length ? sb.from('project_task_shares').select('task_id,created_at').eq('tenant_id', tid).in('task_id', ids).neq('template', 'report').is('deleted_at', null) : Promise.resolve({ data: [] });
    return Promise.all([a, b, c]).then(function (r) {
      W.emps = r[0].data || []; W.custs = r[1].data || []; W.shares = {};
      (r[2].data || []).forEach(function (s) { var x = W.shares[s.task_id] || (W.shares[s.task_id] = { n: 0, last: '' }); x.n++; if (s.created_at > x.last) x.last = s.created_at; });
    });
  };
  W.phone = function (p) { var d = String(p || '').replace(/\D/g, ''); if (!d) return ''; if (d.charAt(0) === '0') d = '6' + d; return d.length >= 8 && d.length <= 15 ? d : ''; };
  W.waUrl = function (phone, text) { return 'https://wa.me/' + (phone || '') + '?text=' + encodeURIComponent(text); };
  W.taskUrl = function (k) { return location.origin + location.pathname.replace(/[^/]*$/, '') + '?pj_task=' + encodeURIComponent(k.id); };
  W.empName = function (id) { var e = W.emps.find(function (x) { return W.same(x.id, id); }); return e ? (e.nickname || e.name || '') : ''; };
  var COLS = { backlog: ['Backlog', 'Belakang'], progress: ['In Progress', 'Sedang Jalan'], review: ['Review', 'Semakan'], done: ['Done', 'Siap'] };
  W.colName = function (c, bm) { var x = COLS[c] || [c, c]; return bm ? x[1] : x[0]; };
  var DAYS = { en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], bm: ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'] };
  /* numbered short steps from task notes (max 4), staff recipients only; full notes never leave the app */
  W.steps = function (notes) { return String(notes || '').split('\n').map(function (s) { return s.trim(); }).filter(function (s) { return /^\d+[.)]\s+\S/.test(s); }).slice(0, 4).map(function (s) { return s.replace(/^(\d+)[.)]\s+/, '$1. ').slice(0, 90); }); };
  W.TPL = ['reminder', 'request_info', 'done', 'client'];
  W.tplName = function (k) { return { reminder: W.L('Reminder', 'Peringatan'), request_info: W.L('Request info', 'Minta maklumat'), done: W.L('Done', 'Siap'), client: W.L('For client', 'Untuk client') }[k]; };
  W.build = function (o) {
    var bm = o.lang === 'bm', T = function (en, ms) { return bm ? ms : en; }, k = o.task, co = (APP.tenant && APP.tenant.name) || 'M-Core';
    var due = k.due_date ? W.dmy(k.due_date) + ' (' + DAYS[bm ? 'bm' : 'en'][new Date(String(k.due_date).slice(0, 10) + 'T00:00:00').getDay()] + ')' : '-';
    var head = { reminder: T('Task Reminder', 'Peringatan Task'), request_info: T('Information Request', 'Permintaan Maklumat'), done: T('Task Completed', 'Task Selesai'), client: T('Progress Update', 'Makluman Kemajuan') }[o.tpl];
    var out = ['*' + head + ' · ' + co + '*', '', '*' + k.title + '*'];
    if (o.tpl === 'client') {
      out.push('📅 ' + T('Target date', 'Tarikh sasaran') + ': ' + due, '📌 Status: ' + (k.column_key === 'done' ? T('Completed', 'Selesai') : T('In progress', 'Dalam proses')));
      out.push('', T('We will update you on the next step. Thank you.', 'Kami akan maklumkan langkah seterusnya. Terima kasih.'));
    } else {
      var who = W.empName(k.assignee_employee_id);
      if (who) out.push('👤 Assignee: ' + who);
      out.push('📅 Due: ' + due, '📌 Status: ' + W.colName(k.column_key, bm) + ' · ' + (Number(k.progress) || 0) + '%');
      if (k.tag) out.push('🏷️ Tag: ' + k.tag);
      var st = o.kind === 'staff' && o.tpl !== 'done' ? W.steps(k.notes) : [];
      if (st.length) { out.push('', '*' + T('Short steps', 'Langkah ringkas') + ':*'); out.push.apply(out, st); }
      if (o.tpl === 'request_info') out.push('', T('Please reply with the information / documents needed for this task.', 'Mohon balas dengan maklumat / dokumen yang diperlukan untuk task ini.'));
      if (o.tpl === 'done') out.push('', T('This task is done. Thank you all.', 'Task ini sudah selesai. Terima kasih semua.'));
      out.push('', '🔗 ' + T('Open task', 'Buka task') + ': ' + W.taskUrl(k));
    }
    out.push('', '_' + T('Sent via M-Core', 'Dihantar melalui M-Core') + '_');
    return out.join('\n');
  };
  W.log = function (rows) {
    rows = rows.map(function (r) { return Object.assign({ tenant_id: W.tid(), created_by: W.uid(), created_by_name: W.me() }, r); });
    return sb.from('project_task_shares').insert(rows).then(function (x) {
      if (x.error) throw x.error;
      rows.forEach(function (r) { if (!r.task_id || r.template === 'report') return; var s = W.shares[r.task_id] || (W.shares[r.task_id] = { n: 0, last: '' }); s.n++; s.last = new Date().toISOString(); });
    });
  };
  W.open = function (url) { var w = window.open(url, '_blank', 'noopener'); if (!w) location.href = url; };
  W.bubble = function (txt) {
    var h = W.esc(txt).replace(/\*([^*\n]+)\*/g, '<b>*$1*</b>').replace(/(^|\n)_([^_\n]+)_/g, '$1<i style="opacity:.7">_$2_</i>').replace(/\n/g, '<br>');
    return '<div class="pjw-chat"><div class="pjw-bub">' + h + '</div></div>';
  };
})();
