/* M-Core Learning Center v2 (phase 1): ordering fallback (order_index|sort_order|step_no), role map for new chapters,
   search, "Start here" path, per-step images (lazy, tap-to-zoom), "Not clear? Ask" -> Service Desk new request.
   Overrides the inline renderers in index.html; new columns/rows simply do not show until lc_01/lc_02 SQL is run. */
(function () {
  if (window.LC) return;
  var LC = window.LC = { cache: null };
  var STARTER = ['fd1def1e-7cd0-4376-a28a-d4946d4a79c1', 'd3dd46d6-1cb1-4a6f-a0dd-d8942037b1d5', '39ca223f-ff89-4072-a2c0-f6b81a23c19b', '28c2b0a4-e59b-452a-a2e8-bfc07162bad0', 'c628287f-77b5-4886-a40e-62d2f55ebf08', '6594f8f5-af72-42c4-a80b-75b3d19a13bd'];
  LC.PAGES = { register: 'dashboard', dashboard: 'dashboard', crm: 'crm', sales: 'sales', pos: 'pos', inventory: 'inventory', purchasing: 'purchasing', production: 'production', logistics: 'logistics', hr: 'hr', applicants: 'applicants', accounting: 'accounting', vouchers: 'vouchers', reports: 'reports',
    sd_client: 'servis_saya', sd_admin: 'admin', onboarding: 'client_onboarding', planner: 'planner', projects: 'projects', sales_plan: 'sales_plan', sales_commission: 'sales_commission', sales_academy: 'sales_academy', shifts: 'shifts', expense_claims: 'expense_claims', core_nav: 'dashboard', settings: 'settings' };
  var ICON = { sd_client: 'ti-headset', sd_admin: 'ti-headset', onboarding: 'ti-checklist', core_nav: 'ti-layout-sidebar', settings: 'ti-settings' };
  var isBm = function () { return window.APP && APP.language === 'bm'; };
  var L = function (en, bm) { return isBm() ? bm : en; };
  var esc = function (s) { return window._aiEscapeHtml ? _aiEscapeHtml(s == null ? '' : String(s)) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); };
  var tx = function (o, k) { return o ? (isBm() ? (o[k + '_bm'] || o[k + '_en']) : (o[k + '_en'] || o[k + '_bm'])) || '' : ''; };
  LC.sort = function (a, keys) { var k = function (r) { for (var i = 0; i < keys.length; i++) if (r[keys[i]] != null && r[keys[i]] !== '') return Number(r[keys[i]]); return 1e9; }; return (a || []).slice().sort(function (x, y) { return k(x) - k(y); }); };
  var ok = function (r) { return r && !r.deleted_at; };
  var nav = function (p) { return typeof NAV_ITEMS !== 'undefined' && NAV_ITEMS.find(function (n) { return n.id === p; }); };
  var isPA = function () { return typeof isPlatformAdmin === 'function' && isPlatformAdmin(); };
  var safe = function (f) { try { return !!f(); } catch (e) { return false; } };
  var origCan = window._learningCanAccessChapter;
  LC.can = function (k) {
    if (k === 'sd_admin') return isPA();
    if (k === 'sd_client') return safe(function () { return SD && SD.has && SD.has.desk && (!SD.isTA || SD.isTA()); }) || isPA();
    if (k === 'onboarding') return !!document.querySelector('[data-page="client_onboarding"]') || isPA();
    if (k === 'core_nav' || k === 'settings') return true;
    if (['planner', 'projects', 'sales_plan', 'sales_commission', 'sales_academy', 'shifts', 'expense_claims'].indexOf(k) >= 0) {
      var n = nav(k); return safe(function () { return n ? (!n.module || canAccess(n.module)) : !!document.querySelector('[data-page="' + k + '"]'); });
    }
    return origCan ? safe(function () { return origCan(k); }) : true;
  };
  window._learningCanAccessChapter = LC.can;
  LC.icon = function (k) { var n = nav(LC.PAGES[k] || k); return ICON[k] || (k === 'register' ? 'ti-rocket' : n ? n.icon : 'ti-book-2'); };
  LC.load = async function (force) {
    if (LC.cache && !force && Date.now() - LC.cache.t < (LC.cache.error ? 600000 : 120000)) return LC.cache;
    var r = await Promise.all([sb.from('learning_chapters').select('*'), sb.from('learning_lessons').select('*'), sb.from('learning_steps').select('*'),
      sb.from('user_learning_progress').select('lesson_id,completed_at').eq('user_id', APP.user.id)]);
    if (r[0].error) return (LC.cache = { t: Date.now(), error: r[0].error });
    var c = { t: Date.now(), ch: LC.sort((r[0].data || []).filter(ok), ['order_index', 'sort_order']), ls: LC.sort((r[1].data || []).filter(ok), ['order_index', 'sort_order']),
      st: LC.sort((r[2].data || []).filter(ok), ['order_index', 'step_no']), done: new Set((r[3].data || []).map(function (p) { return String(p.lesson_id); })) };
    c.ch = c.ch.filter(function (x) { return LC.can(x.module_key); });
    var vis = new Set(c.ch.map(function (x) { return String(x.id); }));
    c.ls = c.ls.filter(function (l) { return vis.has(String(l.chapter_id)); });
    return (LC.cache = c);
  };
  LC.lessonsOf = function (c, id) { return c.ls.filter(function (l) { return String(l.chapter_id) === String(id); }); };
  LC.stepsOf = function (c, id) { return c.st.filter(function (s) { return String(s.lesson_id) === String(id); }); };
  LC.chOf = function (c, l) { return c.ch.find(function (x) { return String(x.id) === String(l.chapter_id); }); };
  var main = function () { return document.getElementById('main'); };
  var spin = '<div class="empty-state" style="padding:60px"><div class="spinner"></div></div>';
  var back = function (on, t) { return '<div style="font-size:13px;color:var(--text-3);margin-top:2px;cursor:pointer" onclick="' + on + '">← ' + t + '</div>'; };
  var lessonRow = function (c, l, sub) {
    var d = c.done.has(String(l.id));
    return '<div class="lc-row" onclick="openPage(\'learning\',{view:\'lesson\',id:\'' + esc(l.id) + '\'})"><i class="ti ' + (d ? 'ti-circle-check-filled' : 'ti-circle') + '" style="font-size:18px;color:' + (d ? 'var(--success)' : 'var(--text-3)') + '"></i><div style="min-width:0"><div style="font-weight:600;font-size:13px">' + esc(tx(l, 'title')) + '</div>' + (sub ? '<div class="lc-sub">' + esc(sub) + '</div>' : '') + '</div></div>';
  };
  LC.list = async function () {
    main().innerHTML = '<div class="page-header"><div><div class="page-title">' + L('Learning Center', 'Pusat Pembelajaran') + '</div><div style="font-size:13px;color:var(--text-3);margin-top:2px">' + L('In-depth guides for every module — understand WHY, not just click-throughs', 'Panduan mendalam setiap modul — faham KENAPA, bukan cuma klik') + '</div></div></div>' +
      '<input id="lc-q" class="form-input" type="search" autocomplete="off" placeholder="' + L('Search guides… e.g. invoice, payroll, quota', 'Cari panduan… cth invois, gaji, kuota') + '" style="margin-bottom:14px;max-width:520px"><div id="lc-body">' + spin + '</div>';
    var c = await LC.load(true), body = document.getElementById('lc-body'); if (!body) return;
    if (c.error) { body.innerHTML = '<div class="card" style="padding:24px"><p style="color:var(--danger)"><strong>Error:</strong> ' + esc(c.error.message) + '</p></div>'; return; }
    if (!c.ch.length) { body.innerHTML = '<div class="empty-state" style="padding:40px"><p>' + L('No guides available yet.', 'Tiada panduan tersedia buat masa ini.') + '</p></div>'; return; }
    var grid = function () {
      var st = STARTER.map(function (id) { return c.ls.find(function (l) { return String(l.id) === id; }); }).filter(Boolean);
      var sd = st.filter(function (l) { return c.done.has(String(l.id)); }).length;
      return (st.length ? '<div class="card" style="padding:0;margin-bottom:14px"><div style="padding:14px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px"><i class="ti ti-flag-3" style="color:var(--primary);font-size:18px"></i><b style="font-size:14px">' + L('Start here', 'Mula Di Sini') + '</b><span class="lc-sub" style="margin-left:auto">' + sd + '/' + st.length + '</span></div>' + st.map(function (l) { var ch = LC.chOf(c, l); return lessonRow(c, l, ch ? tx(ch, 'title') : ''); }).join('') + '</div>' : '') +
        '<div class="lc-grid">' + c.ch.map(function (ch) {
          var ls = LC.lessonsOf(c, ch.id), n = ls.length, d = ls.filter(function (l) { return c.done.has(String(l.id)); }).length, p = n ? Math.round(d / n * 100) : 0;
          return '<div class="card" style="padding:16px;cursor:pointer" onclick="openPage(\'learning\',{view:\'chapter\',id:\'' + esc(ch.id) + '\'})"><div style="display:flex;align-items:center;gap:10px;margin-bottom:10px"><i class="ti ' + LC.icon(ch.module_key) + '" style="font-size:22px;color:var(--primary)"></i><div style="font-weight:600;font-size:14px">' + esc(tx(ch, 'title')) + '</div></div><div style="height:6px;border-radius:3px;background:var(--bg);overflow:hidden;margin-bottom:6px"><div style="height:100%;width:' + p + '%;background:' + (p === 100 ? 'var(--success)' : 'var(--primary)') + '"></div></div><div class="lc-sub">' + d + '/' + n + ' ' + L('lessons completed', 'pelajaran selesai') + '</div></div>';
        }).join('') + '</div>';
    };
    var search = function (q) {
      q = q.trim().toLowerCase(); if (q.length < 2) return grid();
      var hit = function (s) { return String(s || '').toLowerCase().indexOf(q) >= 0; };
      var res = c.ls.filter(function (l) { return hit(l.title_en) || hit(l.title_bm) || hit(l.intro_en) || hit(l.intro_bm) || LC.stepsOf(c, l.id).some(function (s) { return hit(s.text_en) || hit(s.text_bm); }) || hit(tx(LC.chOf(c, l), 'title')); });
      return res.length ? '<div class="card" style="padding:0">' + res.slice(0, 30).map(function (l) { var ch = LC.chOf(c, l); return lessonRow(c, l, ch ? tx(ch, 'title') : ''); }).join('') + '</div>' : '<div class="empty-state" style="padding:30px"><p>' + L('No guide matches', 'Tiada panduan sepadan') + '</p></div>';
    };
    body.innerHTML = grid();
    var qi = document.getElementById('lc-q'); if (qi) qi.oninput = function () { body.innerHTML = search(qi.value); };
  };
  LC.chapter = async function (id) {
    main().innerHTML = spin; var c = await LC.load(), ch = !c.error && c.ch.find(function (x) { return String(x.id) === String(id); });
    if (!ch) { main().innerHTML = '<div class="empty-state"><p>' + L('Chapter not found.', 'Chapter tidak dijumpai.') + '</p><button class="btn btn-outline btn-sm" onclick="openPage(\'learning\')">← ' + L('Back', 'Kembali') + '</button></div>'; return; }
    var ls = LC.lessonsOf(c, ch.id);
    main().innerHTML = '<div class="page-header"><div><div class="page-title">' + esc(tx(ch, 'title')) + '</div>' + back("openPage('learning')", L('All Guides', 'Semua Panduan')) + '</div></div><div class="card" style="padding:20px;margin-bottom:16px"><p style="font-size:13px;color:var(--text-2);line-height:1.6;margin:0">' + esc(tx(ch, 'intro')) + '</p></div><div class="card" style="padding:0">' +
      (ls.length ? ls.map(function (l) { return lessonRow(c, l); }).join('') : '<div class="empty-state" style="padding:40px"><p>' + L('No lessons yet.', 'Tiada pelajaran lagi.') + '</p></div>') + '</div>';
  };
  LC.origLesson = window._renderLearningLessonDetail;
  LC.L = L; LC.esc = esc; LC.tx = tx; LC.spin = spin; LC.back = back;
  window._renderLearningChapterList = LC.list;
  window._renderLearningChapterDetail = LC.chapter;
  window.renderLearningCenter = async function (p) {
    p = p || {};
    if (p.view === 'chapter' && p.id) return LC.chapter(p.id);
    if (p.view === 'lesson' && p.id) return LC.lesson ? LC.lesson(p.id) : LC.origLesson(p.id);
    return LC.list();
  };
})();
