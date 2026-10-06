/* Projects board — page render only. Called from openPage case 'projects'. */
(function () {
  var COLS = [
    { key: 'backlog', en: 'Backlog', bm: 'Belakang' },
    { key: 'progress', en: 'In Progress', bm: 'Sedang Jalan' },
    { key: 'review', en: 'Review', bm: 'Semakan' },
    { key: 'done', en: 'Done', bm: 'Siap' }
  ];
  var TAGS = ['Planning', 'Design', 'Development', 'Testing', 'Launch', 'Admin'];
  var COLORS = ['#0E7490', '#16A34A', '#D97706', '#7C3AED', '#DC2626', '#0891B2'];
  var state = { projects: [], tasks: [], employees: [], customers: [], files: [], projectId: null, tab: 'board', filter: '', group: '', assignee: '', sort: 'due', focus: '' };

  function bm() { return window.APP && APP.language === 'bm'; }
  function t(en, ms) { return bm() ? ms : en; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&', '<': '<', '>': '>', '"': '"', "'": '&#39;' }[c];
    });
  }
  function tid() { return APP && APP.tenant && APP.tenant.id; }
  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function fmt(d) {
    if (!d) return '';
    if (typeof formatDate === 'function') return formatDate(d);
    var p = String(d).slice(0, 10).split('-');
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : String(d);
  }
  function nick(e) {
    if (!e) return '';
    return e.nickname || e.name || '';
  }
  function empById(id) {
    return state.employees.find(function (e) { return String(e.id) === String(id); }) || null;
  }
  function custById(id) {
    return state.customers.find(function (c) { return String(c.id) === String(id); }) || null;
  }
  function currentProject() {
    return state.projects.find(function (p) { return String(p.id) === String(state.projectId); }) || null;
  }
  function visibleTasks() {
    var q = state.filter.trim().toLowerCase();
    return state.tasks.filter(function (task) {
      if (q && String(task.title || '').toLowerCase().indexOf(q) < 0 && String(task.tag || '').toLowerCase().indexOf(q) < 0) return false;
      if (state.group && task.tag !== state.group) return false;
      if (state.assignee && String(task.assignee_employee_id || '') !== String(state.assignee)) return false;
      return true;
    });
  }
  function stats(list) {
    var today = todayISO();
    var total = list.length;
    var progress = list.filter(function (x) { return x.column_key === 'progress'; }).length;
    var done = list.filter(function (x) { return x.column_key === 'done'; }).length;
    var overdue = list.filter(function (x) { return x.due_date && String(x.due_date).slice(0, 10) < today && x.column_key !== 'done'; }).length;
    var sum = list.reduce(function (n, x) { return n + Math.max(0, Math.min(100, Number(x.progress) || 0)); }, 0);
    var pct = total ? Math.round(sum / total) : 0;
    return { total: total, progress: progress, done: done, overdue: overdue, pct: pct };
  }

  async function loadAll() {
    var tenant = tid();
    if (!tenant) throw new Error(t('No tenant', 'Tiada tenant'));
    var proj = await sb.from('projects').select('id,name,kind,customer_id,color,created_at').eq('tenant_id', tenant).is('deleted_at', null).order('created_at');
    if (proj.error) throw proj.error;
    state.projects = proj.data || [];
    if (!state.projectId && state.projects[0]) state.projectId = state.projects[0].id;
    if (state.projectId && !state.projects.some(function (p) { return String(p.id) === String(state.projectId); })) state.projectId = state.projects[0] ? state.projects[0].id : null;
    var tasks = state.projectId
      ? await sb.from('project_tasks').select('id,project_id,title,column_key,tag,assignee_employee_id,start_date,due_date,progress,notes,sort_order,created_at,is_important,is_urgent').eq('tenant_id', tenant).eq('project_id', state.projectId).is('deleted_at', null).order('sort_order')
      : { data: [] };
    if (tasks.error) throw tasks.error;
    state.tasks = tasks.data || [];
    var em = await sb.from('employees').select('id,name,nickname').eq('tenant_id', tenant).is('deleted_at', null).order('name');
    state.employees = em.error ? [] : (em.data || []);
    var cu = await sb.from('customers').select('id,name').eq('tenant_id', tenant).is('deleted_at', null).order('name').limit(500);
    state.customers = cu.error ? [] : (cu.data || []);
  }

  function cardHtml(task) {
    var who = empById(task.assignee_employee_id);
    var pct = Math.max(0, Math.min(100, Number(task.progress) || 0));
    return '<article class="pj-card" draggable="true" data-id="' + esc(task.id) + '">' +
      '<div class="pj-card-title">' + esc(task.title) + '</div>' +
      (task.tag ? '<span class="pj-tag">' + esc(task.tag) + '</span>' : '') +
      '<div class="pj-card-meta"><span>' + esc(nick(who) || t('Unassigned', 'Tiada assignee')) + '</span><span>' + esc(fmt(task.due_date)) + '</span></div>' +
      '<div class="pj-bar"><i style="width:' + pct + '%"></i></div><div class="pj-pct">' + pct + '%</div>' +
      '<details class="pj-detail"' + (String(state.focus) === String(task.id) ? ' open' : '') + '><summary>' + esc(t('Detail', 'Butiran')) + '</summary>' +
      '<label>' + esc(t('Title', 'Tajuk')) + '<input data-f="title" value="' + esc(task.title) + '"></label>' +
      '<label>' + esc(t('Tag', 'Tag')) + '<select data-f="tag">' + TAGS.map(function (tag) { return '<option' + (task.tag === tag ? ' selected' : '') + '>' + esc(tag) + '</option>'; }).join('') + '</select></label>' +
      '<label>' + esc(t('Assignee', 'Assignee')) + '<select data-f="assignee_employee_id"><option value="">—</option>' + state.employees.map(function (e) { return '<option value="' + esc(e.id) + '"' + (String(e.id) === String(task.assignee_employee_id) ? ' selected' : '') + '>' + esc(nick(e)) + '</option>'; }).join('') + '</select></label>' +
      '<label>' + esc(t('Start', 'Mula')) + '<input data-f="start_date" type="date" value="' + esc(String(task.start_date || '').slice(0, 10)) + '"></label>' +
      '<label>' + esc(t('Due', 'Due')) + '<input data-f="due_date" type="date" value="' + esc(String(task.due_date || '').slice(0, 10)) + '"></label>' +
      '<label>' + esc(t('Progress', 'Kemajuan')) + '<input data-f="progress" type="number" min="0" max="100" value="' + pct + '"></label>' +
      '<label>' + esc(t('Matrix', 'Matrix')) + '<select data-f="matrix">' +
        '<option value="do"' + (quadOf(task) === 'do' ? ' selected' : '') + '>' + esc(t('Important + urgent', 'Penting + segera')) + '</option>' +
        '<option value="schedule"' + (quadOf(task) === 'schedule' ? ' selected' : '') + '>' + esc(t('Important only', 'Penting sahaja')) + '</option>' +
        '<option value="delegate"' + (quadOf(task) === 'delegate' ? ' selected' : '') + '>' + esc(t('Urgent only', 'Segera sahaja')) + '</option>' +
        '<option value="later"' + (quadOf(task) === 'later' ? ' selected' : '') + '>' + esc(t('Neither', 'Dua-dua tidak')) + '</option>' +
      '</select></label>' +
      '<label>' + esc(t('Notes', 'Nota')) + '<textarea data-f="notes">' + esc(task.notes || '') + '</textarea></label>' +
      '<div class="pj-row"><button type="button" class="btn btn-sm btn-primary" data-act="save">' + esc(t('Save', 'Simpan')) + '</button>' +
      '<button type="button" class="btn btn-sm btn-outline" data-act="del">' + esc(t('Delete', 'Padam')) + '</button></div></details></article>';
  }

  function boardHtml(list) {
    return '<div class="pj-board">' + COLS.map(function (col) {
      var rows = list.filter(function (task) { return task.column_key === col.key; });
      return '<section class="pj-col" data-col="' + col.key + '"><header><b>' + esc(t(col.en, col.bm)) + '</b><span>' + rows.length + '</span></header>' +
        rows.map(cardHtml).join('') +
        '<button type="button" class="pj-add" data-add="' + col.key + '">+ ' + esc(t('Add task', 'Tambah task')) + '</button></section>';
    }).join('') + '</div>';
  }

  function listHtml(list) {
    var head = '<tr><th>' + esc(t('Task', 'Task')) + '</th><th>' + esc(t('Column', 'Lajur')) + '</th><th>' + esc(t('Tag', 'Tag')) + '</th><th>' + esc(t('Assignee', 'Assignee')) + '</th><th>' + esc(t('Due', 'Due')) + '</th><th>%</th></tr>';
    var body = list.map(function (task) {
      var col = COLS.find(function (c) { return c.key === task.column_key; });
      return '<tr><td>' + esc(task.title) + '</td><td>' + esc(col ? t(col.en, col.bm) : task.column_key) + '</td><td>' + esc(task.tag || '') + '</td><td>' + esc(nick(empById(task.assignee_employee_id))) + '</td><td>' + esc(fmt(task.due_date)) + '</td><td>' + esc(task.progress || 0) + '</td></tr>';
    }).join('');
    return '<div class="pj-scroll"><table class="pj-table"><thead>' + head + '</thead><tbody>' + (body || '<tr><td colspan="6">' + esc(t('No tasks', 'Tiada task')) + '</td></tr>') + '</tbody></table></div>';
  }

  function timelineHtml(list) {
    var start = new Date();
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    var weeks = [];
    for (var i = 0; i < 8; i++) {
      var w = new Date(start.getTime());
      w.setDate(start.getDate() + i * 7);
      weeks.push(w);
    }
    var origin = weeks[0].getTime();
    var span = 56 * 86400000;
    function left(d) {
      if (!d) return 0;
      var n = new Date(String(d).slice(0, 10) + 'T00:00:00').getTime();
      return Math.max(0, Math.min(100, ((n - origin) / span) * 100));
    }
    var groups = TAGS.map(function (tag) {
      var rows = list.filter(function (task) { return (task.tag || 'Admin') === tag; });
      if (!rows.length) return '';
      return '<div class="pj-tg"><b>' + esc(tag) + '</b>' + rows.map(function (task) {
        var a = left(task.start_date || task.created_at);
        var b = left(task.due_date || task.start_date || task.created_at);
        if (b < a) b = a + 4;
        var w = Math.max(4, b - a);
        return '<div class="pj-trow"><span>' + esc(task.title) + '</span><div class="pj-track"><i style="left:' + a + '%;width:' + w + '%"></i></div></div>';
      }).join('') + '</div>';
    }).join('');
    return '<div class="pj-scroll"><div class="pj-tl"><div class="pj-weeks">' + weeks.map(function (w) { return '<span>' + esc(fmt(w.toISOString().slice(0, 10))) + '</span>'; }).join('') + '</div>' + (groups || '<p>' + esc(t('No tasks', 'Tiada task')) + '</p>') + '</div></div>';
  }

  function fileFolder() {
    return tid() + '/projects/' + state.projectId;
  }
  function filesHtml() {
    var proj = currentProject();
    if (!proj) return '<div class="pj-empty">' + esc(t('Create a project first', 'Buat projek dulu')) + '</div>';
    var rows = (state.files || []).map(function (f) {
      var href = f.url || '#';
      return '<div class="pj-file"><a href="' + esc(href) + '" target="_blank" rel="noopener">' + esc(f.name) + '</a><button type="button" data-file="' + esc(f.name) + '">' + esc(t('Delete', 'Padam')) + '</button></div>';
    }).join('');
    return '<div class="pj-files"><label class="btn btn-sm btn-primary">' + esc(t('Upload file', 'Muat naik fail')) +
      '<input id="pj-file" type="file" hidden></label>' +
      (rows || '<p class="pj-muted">' + esc(t('No files yet', 'Belum ada fail')) + '</p>') + '</div>';
  }


  function quadOf(task) {
    if (task.is_important && task.is_urgent) return 'do';
    if (task.is_important) return 'schedule';
    if (task.is_urgent) return 'delegate';
    return 'later';
  }
  function matrixHtml(list) {
    var quads = [
      { key: 'do', en: 'Do', bm: 'Buat' },
      { key: 'schedule', en: 'Schedule', bm: 'Jadual' },
      { key: 'delegate', en: 'Delegate', bm: 'Serah' },
      { key: 'later', en: 'Defer', bm: 'Tangguh' }
    ];
    var open = list.filter(function (task) { return task.column_key !== 'done'; });
    open.sort(function (a, b) {
      if (state.sort === 'title') return String(a.title).localeCompare(String(b.title));
      return String(a.due_date || '9999').localeCompare(String(b.due_date || '9999'));
    });
    var staff = '<option value="">' + esc(t('All staff', 'Semua staff')) + '</option>' + state.employees.map(function (e) {
      return '<option value="' + esc(e.id) + '"' + (String(state.assignee) === String(e.id) ? ' selected' : '') + '>' + esc(nick(e)) + '</option>';
    }).join('');
    var bars = '<div class="pj-tools"><select id="pj-assignee">' + staff + '</select><select id="pj-sort"><option value="due"' + (state.sort === 'due' ? ' selected' : '') + '>' + esc(t('Sort by due', 'Susun ikut due')) + '</option><option value="title"' + (state.sort === 'title' ? ' selected' : '') + '>' + esc(t('Sort by title', 'Susun ikut tajuk')) + '</option></select></div>';
    return bars + '<div class="pj-matrix">' + quads.map(function (q) {
      var rows = open.filter(function (task) { return quadOf(task) === q.key; }).map(function (task) {
        return '<button type="button" class="pj-mcard" data-id="' + esc(task.id) + '"><b>' + esc(task.title) + '</b><span>' + esc(nick(empById(task.assignee_employee_id)) || t('Unassigned', 'Tiada assignee')) + '</span><span>' + esc(fmt(task.due_date)) + '</span></button>';
      }).join('');
      return '<div class="pj-quad" data-quad="' + q.key + '"><b>' + esc(t(q.en, q.bm)) + '</b><div class="pj-quad-list">' + (rows || '<p class="pj-muted">' + esc(t('Empty', 'Kosong')) + '</p>') + '</div></div>';
    }).join('') + '</div>';
  }
  function pageHtml() {
    var proj = currentProject();
    var list = visibleTasks();
    var st = stats(state.tasks);
    var tab = state.tab;
    var body = tab === 'list' ? listHtml(list) : tab === 'timeline' ? timelineHtml(list) : tab === 'files' ? filesHtml() : tab === 'overview' ? overviewHtml(proj, st) : tab === 'matrix' ? matrixHtml(list) : boardHtml(list);
    return '<style>' + css() + '</style><div class="pj-wrap">' +
      '<aside class="pj-side"><div class="pj-side-h">' + esc(t('Projects', 'Projek')) + '<button type="button" id="pj-new" class="btn btn-sm btn-primary">+</button></div>' +
      state.projects.map(function (p, i) {
        var on = String(p.id) === String(state.projectId) ? ' on' : '';
        return '<button type="button" class="pj-proj' + on + '" data-proj="' + esc(p.id) + '"><i style="background:' + esc(p.color || COLORS[i % COLORS.length]) + '"></i><span>' + esc(p.name) + '</span><small>' + esc(p.kind === 'client' ? t('Client', 'Klien') : t('Internal', 'Dalaman')) + '</small></button>';
      }).join('') +
      (state.projects.length ? '' : '<p class="pj-muted">' + esc(t('No project yet', 'Belum ada projek')) + '</p>') +
      '</aside><section class="pj-main">' +
      '<header class="pj-top"><div><b>' + esc(proj ? proj.name : t('Projects', 'Projek')) + '</b>' +
      (proj && proj.kind === 'client' ? '<small>' + esc((custById(proj.customer_id) || {}).name || t('No customer', 'Tiada pelanggan')) + '</small>' : '<small>' + esc(t('Internal', 'Dalaman')) + '</small>') +
      '</div><div class="pj-tools"><input id="pj-q" placeholder="' + esc(t('Search tasks', 'Cari task')) + '" value="' + esc(state.filter) + '">' +
      '<select id="pj-g"><option value="">' + esc(t('Group by tag', 'Kumpul ikut tag')) + '</option>' + TAGS.map(function (tag) { return '<option' + (state.group === tag ? ' selected' : '') + '>' + esc(tag) + '</option>'; }).join('') + '</select>' +
      '<button type="button" id="pj-task" class="btn btn-sm btn-primary"' + (proj ? '' : ' disabled') + '>+ ' + esc(t('New Task', 'Task Baru')) + '</button></div></header>' +
      '<nav class="pj-tabs">' + ['board', 'matrix', 'timeline', 'list', 'files', 'overview'].map(function (key) {
        var labels = { board: [ 'Board', 'Papan' ], timeline: [ 'Timeline', 'Garis Masa' ], list: [ 'List', 'Senarai' ], files: [ 'Files', 'Fail' ], overview: [ 'Overview', 'Ringkasan' ], matrix: [ 'Matrix', 'Matrix' ] };
        return '<button type="button" data-tab="' + key + '"' + (tab === key ? ' class="on"' : '') + '>' + esc(t(labels[key][0], labels[key][1])) + '</button>';
      }).join('') + '</nav>' + body + statsHtml(st) + '</section></div>' + formHtml();
  }

  function overviewHtml(proj, st) {
    if (!proj) return '<div class="pj-empty">' + esc(t('Create a project first', 'Buat projek dulu')) + '</div>';
    return '<div class="pj-ov"><p><b>' + esc(t('Type', 'Jenis')) + '</b> ' + esc(proj.kind === 'client' ? t('Client', 'Klien') : t('Internal', 'Dalaman')) + '</p>' +
      '<p><b>' + esc(t('Tasks', 'Task')) + '</b> ' + st.total + '</p><p><b>' + esc(t('Done', 'Siap')) + '</b> ' + st.done + ' (' + st.pct + '%)</p>' +
      '<p><b>' + esc(t('Overdue', 'Lewat')) + '</b> ' + st.overdue + '</p></div>';
  }
  function statsHtml(st) {
    var cells = [
      [t('Total Tasks', 'Jumlah Task'), st.total],
      [t('In Progress', 'Sedang Jalan'), st.progress],
      [t('Completed', 'Siap'), st.done],
      [t('Overdue', 'Lewat'), st.overdue],
      [t('Progress', 'Kemajuan'), st.pct + '%']
    ];
    return '<div class="pj-stats">' + cells.map(function (c) { return '<div><small>' + esc(c[0]) + '</small><b>' + esc(c[1]) + '</b></div>'; }).join('') + '</div>';
  }
  function formHtml() {
    return '<div id="pj-modal" class="pj-modal" hidden><form id="pj-form"><h3>' + esc(t('New project', 'Projek baru')) + '</h3>' +
      '<label>' + esc(t('Name', 'Nama')) + '<input name="name" required></label>' +
      '<label>' + esc(t('Type', 'Jenis')) + '<select name="kind"><option value="internal">' + esc(t('Internal', 'Dalaman')) + '</option><option value="client">' + esc(t('Client', 'Klien')) + '</option></select></label>' +
      '<label>' + esc(t('Customer', 'Pelanggan')) + '<select name="customer_id"><option value="">—</option>' + state.customers.map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.name) + '</option>'; }).join('') + '</select></label>' +
      '<div class="pj-row"><button class="btn btn-sm btn-primary" type="submit">' + esc(t('Save', 'Simpan')) + '</button><button type="button" class="btn btn-sm btn-outline" id="pj-cancel">' + esc(t('Cancel', 'Batal')) + '</button></div></form></div>';
  }
  function css() {
    return '.pj-wrap{display:flex;gap:12px;min-height:calc(100dvh - 92px);align-items:stretch}' +
      '.pj-side{width:220px;flex:none;background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:10px;overflow:auto}' +
      '.pj-side-h,.pj-top,.pj-tools,.pj-row{display:flex;align-items:center;gap:8px}' +
      '.pj-side-h{justify-content:space-between;margin-bottom:8px}' +
      '.pj-proj{display:flex;gap:8px;align-items:center;width:100%;text-align:left;padding:8px;border-radius:8px;color:var(--text)}' +
      '.pj-proj.on{background:var(--primary-light)} .pj-proj i{width:8px;height:8px;border-radius:50%;flex:none}' +
      '.pj-proj small{margin-left:auto;color:var(--text-3);font-size:11px}' +
      '.pj-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:10px}' +
      '.pj-top{justify-content:space-between;gap:12px;flex-wrap:wrap} .pj-top small{display:block;color:var(--text-3)}' +
      '.pj-tools input,.pj-tools select,.pj-detail input,.pj-detail select,.pj-detail textarea,.pj-modal input,.pj-modal select{border:1px solid var(--border);background:var(--bg-card);color:var(--text);border-radius:8px;padding:6px 8px}' +
      '.pj-main{min-width:0;overflow-x:auto} .pj-top,.pj-tools,.pj-tabs{max-width:100%} .pj-tabs{display:flex;gap:12px;border-bottom:1px solid var(--border);overflow-x:auto;-webkit-overflow-scrolling:touch} .pj-tabs button{padding:8px 2px;color:var(--text-2);white-space:nowrap} .pj-tabs button.on{color:var(--primary);border-bottom:2px solid var(--primary)} .pj-matrix{display:grid;grid-template-columns:1fr;gap:10px} .pj-quad{border:1px solid var(--border);border-radius:12px;padding:10px;min-height:72px} .pj-quad>b{display:block;margin-bottom:6px} .pj-quad-list{max-height:220px;overflow-y:auto} .pj-mcard{display:flex;flex-direction:column;gap:2px;padding:8px;border:1px solid var(--border);border-radius:10px;margin-top:6px;width:100%;text-align:left;background:var(--bg-card);color:var(--text);cursor:pointer} .pj-mcard b{font-size:14px;line-height:1.35;word-break:break-word} .pj-mcard span{font-size:12px;color:var(--text-2)} @media(min-width:800px){.pj-matrix{grid-template-columns:1fr 1fr}}' +
      '.pj-board{display:flex;gap:10px;overflow-x:auto;padding-bottom:8px}' +
      '.pj-col{min-width:230px;flex:1;background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:8px}' +
      '.pj-col header{display:flex;justify-content:space-between;margin-bottom:8px}' +
      '.pj-card{background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:8px;margin-bottom:8px}' +
      '.pj-tag{display:inline-block;font-size:11px;padding:1px 6px;border-radius:99px;background:var(--primary-light);color:var(--primary-dark)}' +
      '.pj-card-meta{display:flex;justify-content:space-between;color:var(--text-2);font-size:12px;margin-top:6px}' +
      '.pj-bar{height:6px;background:var(--border);border-radius:99px;margin-top:6px;overflow:hidden} .pj-bar i{display:block;height:100%;background:var(--primary)} .pj-pct{font-size:11px;color:var(--text-3);text-align:right}' +
      '.pj-add{width:100%;color:var(--text-3);padding:8px}' +
      '.pj-detail{margin-top:6px} .pj-detail label{display:block;font-size:12px;margin-top:6px} .pj-detail input,.pj-detail select,.pj-detail textarea{width:100%;margin-top:2px}' +
      '.pj-stats{display:grid;grid-template-columns:repeat(5,minmax(90px,1fr));gap:8px} .pj-stats div{background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:10px} .pj-stats small{color:var(--text-3)} .pj-stats b{display:block;font-size:20px}' +
      '.pj-scroll{overflow-x:auto} .pj-table{width:100%;border-collapse:collapse} .pj-table th,.pj-table td{border-bottom:1px solid var(--border);padding:8px;text-align:left;white-space:nowrap}' +
      '.pj-tl{min-width:760px} .pj-weeks{display:grid;grid-template-columns:repeat(8,1fr);color:var(--text-3);font-size:11px;margin-bottom:8px}' +
      '.pj-trow{display:grid;grid-template-columns:180px 1fr;gap:8px;align-items:center;margin:4px 0} .pj-track{position:relative;height:14px;background:var(--border);border-radius:8px} .pj-track i{position:absolute;top:2px;bottom:2px;background:var(--primary);border-radius:6px}' +
      '.pj-empty,.pj-muted{color:var(--text-2);padding:16px} .pj-files{display:flex;flex-direction:column;gap:8px} .pj-file{display:flex;justify-content:space-between;gap:8px;align-items:center;background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:8px 10px} .pj-file a{color:var(--primary);word-break:break-all} .pj-modal{position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:40} .pj-modal[hidden]{display:none} .pj-modal form{background:var(--bg-card);color:var(--text);padding:16px;border-radius:12px;width:min(420px,92vw)} .pj-modal label{display:block;margin-top:8px} .pj-modal input,.pj-modal select{width:100%}' +
      '@media(max-width:800px){.pj-wrap{flex-direction:column}.pj-side{width:auto;max-height:160px}.pj-stats{grid-template-columns:repeat(2,1fr)}}';
  }

  function paint() {
    var main = document.getElementById('main');
    if (!main) return;
    main.innerHTML = pageHtml();
    bind();
  }
  function bind() {
    var main = document.getElementById('main');
    main.querySelectorAll('[data-proj]').forEach(function (btn) {
      btn.onclick = function () { state.projectId = btn.getAttribute('data-proj'); state.tab = 'board'; refresh(); };
    });
    main.querySelectorAll('[data-tab]').forEach(function (btn) {
      btn.onclick = function () { state.tab = btn.getAttribute('data-tab'); paint(); };
    });
    var assignee = document.getElementById('pj-assignee');
    if (assignee) assignee.onchange = function () { state.assignee = assignee.value; paint(); };
    var sort = document.getElementById('pj-sort');
    if (sort) sort.onchange = function () { state.sort = sort.value; paint(); };

    var q = document.getElementById('pj-q');
    if (q) q.oninput = function () { state.filter = q.value; paint(); q.focus(); };
    var g = document.getElementById('pj-g');
    if (g) g.onchange = function () { state.group = g.value; paint(); };
    var np = document.getElementById('pj-new');
    if (np) np.onclick = function () { document.getElementById('pj-modal').hidden = false; };
    var cancel = document.getElementById('pj-cancel');
    if (cancel) cancel.onclick = function () { document.getElementById('pj-modal').hidden = true; };
    var form = document.getElementById('pj-form');
    if (form) form.onsubmit = saveProject;
    var add = document.getElementById('pj-task');
    if (add) add.onclick = function () { addTask('backlog'); };
    main.querySelectorAll('[data-add]').forEach(function (btn) { btn.onclick = function () { addTask(btn.getAttribute('data-add')); }; });
    main.querySelectorAll('.pj-mcard').forEach(function (card) {
      card.onclick = function () {
        state.focus = card.getAttribute('data-id');
        state.tab = 'board';
        paint();
        var opened = document.querySelector('.pj-card[data-id="' + state.focus + '"]');
        if (opened) opened.scrollIntoView({ block: 'center' });
      };
    });
    main.querySelectorAll('.pj-card').forEach(function (card) {
      card.ondragstart = function (ev) { ev.dataTransfer.setData('text/plain', card.getAttribute('data-id')); };
      card.querySelector('[data-act="save"]').onclick = function (ev) { ev.preventDefault(); saveTask(card); };
      card.querySelector('[data-act="del"]').onclick = function (ev) { ev.preventDefault(); delTask(card.getAttribute('data-id')); };
    });
    main.querySelectorAll('.pj-col').forEach(function (col) {
      col.ondragover = function (ev) { ev.preventDefault(); };
      col.ondrop = function (ev) {
        ev.preventDefault();
        moveTask(ev.dataTransfer.getData('text/plain'), col.getAttribute('data-col'));
      };
    });
    var fileInput = document.getElementById('pj-file');
    if (fileInput) fileInput.onchange = function () { uploadFile(fileInput.files && fileInput.files[0]); };
    main.querySelectorAll('[data-file]').forEach(function (btn) {
      btn.onclick = function () { deleteFile(btn.getAttribute('data-file')); };
    });
  }

  async function loadFiles() {
    state.files = [];
    if (!state.projectId) return;
    var listed = await sb.storage.from('company-assets').list(fileFolder(), { limit: 100, sortBy: { column: 'name', order: 'asc' } });
    if (listed.error) throw listed.error;
    state.files = (listed.data || []).filter(function (f) { return f && f.name && f.name !== '.emptyFolderPlaceholder'; }).map(function (f) {
      var path = fileFolder() + '/' + f.name;
      var pub = sb.storage.from('company-assets').getPublicUrl(path);
      return { name: f.name, url: pub && pub.data ? pub.data.publicUrl : '' };
    });
  }
  async function setQuad(id, quad) {
    var patch = { is_important: quad === 'do' || quad === 'schedule', is_urgent: quad === 'do' || quad === 'delegate' };
    var up = await sb.from('project_tasks').update(patch).eq('id', id).eq('tenant_id', tid());
    if (up.error) { showToast(up.error.message, 'error'); return; }
    refresh();
  }
  async function refresh() {
    try { await loadAll(); await loadFiles(); paint(); }
    catch (err) {
      var main = document.getElementById('main');
      var msg = (err && err.message) || String(err);
      if (main) main.innerHTML = '<div class="card" style="padding:16px"><b>' + esc(t('Projects need the SQL migration', 'Projek perlukan migrasi SQL')) + '</b><p>' + esc(msg) + '</p></div>';
      if (typeof showToast === 'function') showToast(msg, 'error');
    }
  }
  async function saveProject(ev) {
    ev.preventDefault();
    var fd = new FormData(ev.target);
    var kind = fd.get('kind');
    var customer = fd.get('customer_id') || null;
    if (kind === 'client' && !customer) { showToast(t('Pick a customer', 'Pilih pelanggan'), 'error'); return; }
    var row = { tenant_id: tid(), name: String(fd.get('name') || '').trim(), kind: kind, customer_id: kind === 'client' ? customer : null, color: COLORS[state.projects.length % COLORS.length] };
    var ins = await sb.from('projects').insert(row).select('id').single();
    if (ins.error) { showToast(ins.error.message, 'error'); return; }
    state.projectId = ins.data.id;
    state.tab = 'board';
    refresh();
  }
  async function addTask(col) {
    if (!state.projectId) return;
    var title = window.prompt(t('Task title', 'Tajuk task'));
    if (!title) return;
    var ins = await sb.from('project_tasks').insert({ tenant_id: tid(), project_id: state.projectId, title: title.trim(), column_key: col || 'backlog', tag: 'Planning', progress: 0, sort_order: state.tasks.length + 1 }).select('id');
    if (ins.error) { showToast(ins.error.message, 'error'); return; }
    refresh();
  }
  async function saveTask(card) {
    var id = card.getAttribute('data-id');
    var val = function (name) { var el = card.querySelector('[data-f="' + name + '"]'); return el ? el.value : ''; };
    var patch = {
      title: val('title').trim(),
      tag: val('tag'),
      assignee_employee_id: val('assignee_employee_id') || null,
      start_date: val('start_date') || null,
      due_date: val('due_date') || null,
      progress: Math.max(0, Math.min(100, Number(val('progress')) || 0)),
      notes: val('notes'),
      is_important: val('matrix') === 'do' || val('matrix') === 'schedule',
      is_urgent: val('matrix') === 'do' || val('matrix') === 'delegate'
    };
    var up = await sb.from('project_tasks').update(patch).eq('id', id).eq('tenant_id', tid());
    if (up.error) { showToast(up.error.message, 'error'); return; }
    showToast(t('Saved', 'Disimpan'), 'success');
    refresh();
  }
  async function delTask(id) {
    var up = await sb.from('project_tasks').update({ deleted_at: new Date().toISOString() }).eq('id', id).eq('tenant_id', tid());
    if (up.error) { showToast(up.error.message, 'error'); return; }
    refresh();
  }
  async function moveTask(id, col) {
    if (!id || !col) return;
    var up = await sb.from('project_tasks').update({ column_key: col, progress: col === 'done' ? 100 : undefined }).eq('id', id).eq('tenant_id', tid());
    if (up.error) { showToast(up.error.message, 'error'); return; }
    refresh();
  }

  function safeName(name) {
    var clean = String(name || 'file').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
    return (Date.now() + '-' + (clean || 'file')).slice(0, 120);
  }
  async function uploadFile(file) {
    if (!file || !state.projectId) return;
    var path = fileFolder() + '/' + safeName(file.name);
    var up = await sb.storage.from('company-assets').upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
    if (up.error) { showToast(up.error.message, 'error'); return; }
    showToast(t('Uploaded', 'Dimuat naik'), 'success');
    state.tab = 'files';
    refresh();
  }
  async function deleteFile(name) {
    if (!name || !state.projectId) return;
    var gone = await sb.storage.from('company-assets').remove([fileFolder() + '/' + name]);
    if (gone.error) { showToast(gone.error.message, 'error'); return; }
    state.tab = 'files';
    refresh();
  }
  window.renderProjects = function (params) {
    if (typeof canAccess === 'function' && !canAccess('core')) {
      showToast(t('Access denied', 'Akses ditolak'), 'error');
      return;
    }
    if (params && params.id) state.projectId = params.id;
    refresh();
  };
})();
