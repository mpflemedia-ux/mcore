/* M-Core back-office support - WhatsApp weekly update for Projects (client progress) and Sales Plan (weekly target vs actual), via the existing WAD share sheet. Logged as doc_shares template 'weekly' (bo_support_03.sql). v1 */
(function () {
  if (!window.BO || !window.WAD || BO.weekly) return;
  var B = BO, W = WAD, E = B.esc, t = B.t;
  B.add({
    en: { wkBtn: 'Weekly update', wkPj: 'Client progress summary', wkPjD: 'Progress, in progress, overdue and next due', wkSp: 'Weekly sales update', wkSpD: 'Last week and this week: target vs actual',
      wkTi: 'Weekly update – {n}', wkOf: 'Week of {d}', wkPct: 'Progress: {p}% ({d}/{t} tasks done)', wkIn: 'In progress', wkNx: 'Due next 7 days', wkOd: 'Overdue tasks: {n}', wkLast: 'Last week ({c})', wkNow: 'This week ({c})', wkTd: 'Plan to date', wkTa: 'Target {t} · Actual {a} · {p}%', wkNone: 'Nothing yet' },
    bm: { wkBtn: 'Kemas kini mingguan', wkPj: 'Ringkasan kemajuan klien', wkPjD: 'Kemajuan, sedang jalan, lewat dan tarikh akhir seterusnya', wkSp: 'Kemas kini jualan mingguan', wkSpD: 'Minggu lepas dan minggu ini: sasaran vs sebenar',
      wkTi: 'Kemas kini mingguan – {n}', wkOf: 'Minggu {d}', wkPct: 'Kemajuan: {p}% ({d}/{t} task siap)', wkIn: 'Sedang jalan', wkNx: 'Tarikh akhir 7 hari lagi', wkOd: 'Task lewat: {n}', wkLast: 'Minggu lepas ({c})', wkNow: 'Minggu ini ({c})', wkTd: 'Setakat ini', wkTa: 'Sasaran {t} · Sebenar {a} · {p}%', wkNone: 'Belum ada' }
  });
  function iso(d) { return new Date(d.getTime() + 8 * 36e5).toISOString().slice(0, 10); }
  function co() { return (window.APP && APP.tenant && APP.tenant.name) || ''; }
  function sign(lines) { var c = co(); return lines.filter(function (x) { return x != null; }).join('\n') + (c ? '\n\n– ' + c : ''); }
  function btn(id, fn) { var b = document.createElement('button'); b.type = 'button'; b.id = id; b.className = 'btn btn-sm btn-outline wad-btn no-print'; b.style.margin = '8px 0'; b.innerHTML = '<i class="ti ti-brand-whatsapp"></i> ' + E(t('wkBtn')); b.onclick = fn; return b; }
  function open(type, id, ref, to, phone, label, desc, build) {
    W.open({ docType: type, docId: id, docRef: ref, to: to || '', phone: phone || '', recipientKind: 'customer', k: 'weekly', step: 1,
      tpls: [{ k: 'weekly', label: label, desc: desc }], build: function (k, lang) { return Promise.resolve(build(lang)).then(function (x) { return { text: x }; }); } });
  }
  /* ---- Projects ---- */
  function pjBuild(p, lang) {
    return Promise.resolve(sb.from('project_tasks').select('title,column_key,due_date,progress').eq('tenant_id', B.tid()).eq('project_id', p.id).is('deleted_at', null).order('sort_order').limit(500)).then(function (r) {
      var ts = (r && r.data) || [], td = iso(new Date()), nx = iso(new Date(Date.now() + 7 * 864e5)), T = function (k, v) { return B.t(k, v, lang); };
      var done = ts.filter(function (x) { return x.column_key === 'done'; }), inp = ts.filter(function (x) { return x.column_key === 'progress'; }),
        od = ts.filter(function (x) { return x.due_date && String(x.due_date).slice(0, 10) < td && x.column_key !== 'done'; }),
        up = ts.filter(function (x) { var d = x.due_date && String(x.due_date).slice(0, 10); return d && d >= td && d <= nx && x.column_key !== 'done'; });
      var pct = ts.length ? Math.round(ts.reduce(function (n, x) { return n + Math.max(0, Math.min(100, +x.progress || 0)); }, 0) / ts.length) : 0;
      var li = function (a, f) { return a.length ? a.slice(0, 5).map(f).join('\n') : '• ' + T('wkNone'); };
      return sign(['*' + T('wkTi', { n: p.name }) + '*', T('wkOf', { d: B.date(new Date()) }), '', T('wkPct', { p: pct, d: done.length, t: ts.length }), '',
        '*' + T('wkIn') + '*', li(inp, function (x) { return '• ' + x.title + ' (' + (+x.progress || 0) + '%)'; }), '',
        '*' + T('wkNx') + '*', li(up, function (x) { return '• ' + x.title + ' – ' + B.date(x.due_date); }), od.length ? '\n' + T('wkOd', { n: od.length }) : null]);
    });
  }
  function pjShare(pid) {
    Promise.resolve(sb.from('projects').select('id,name,customer_id').eq('tenant_id', B.tid()).eq('id', pid).maybeSingle()).then(function (r) {
      var p = r && r.data; if (!p) return;
      return (p.customer_id ? Promise.resolve(sb.from('customers').select('name,phone').eq('tenant_id', B.tid()).eq('id', p.customer_id).maybeSingle()).then(function (c) { return c.data; }, function () { return null; }) : Promise.resolve(null)).then(function (c) {
        open('project', p.id, p.name, c && c.name, c && c.phone, t('wkPj'), t('wkPjD'), function (lang) { return pjBuild(p, lang); });
      });
    }).catch(function (e) { B.toast(t('err') + ((e && e.message) || e), 'error'); });
  }
  /* ---- Sales Plan ---- */
  function spBuild(lang) {
    var S = window.SP, st = S && S.state, p = st && st.plan; if (!p) return '';
    var T = function (k, v) { return B.t(k, v, lang); }, td = iso(new Date()), ws = (st.weeks || []).slice().sort(function (a, b) { return String(a.start_date).localeCompare(String(b.start_date)); });
    var act = function (w) { var m = w.gmv_manual; return m != null && m !== '' ? +m : (+w.gmv_auto || 0); }, M = function (v) { return S.money ? S.money(v, p.currency) : String(Math.round(v)); };
    var pc = function (a, g) { return g ? Math.round(a / g * 100) : 0; }, line = function (w) { var g = +w.gmv_target || 0, a = act(w); return T('wkTa', { t: M(g), a: M(a), p: pc(a, g) }); };
    var now = ws.filter(function (w) { return String(w.start_date).slice(0, 10) <= td && String(w.end_date).slice(0, 10) >= td; })[0],
      past = ws.filter(function (w) { return String(w.end_date).slice(0, 10) < td; }), last = past[past.length - 1];
    var g = past.reduce(function (n, w) { return n + (+w.gmv_target || 0); }, 0), a = past.reduce(function (n, w) { return n + act(w); }, 0);
    return sign(['*' + T('wkTi', { n: p.name }) + '*', T('wkOf', { d: B.date(new Date()) }), '',
      last ? '*' + T('wkLast', { c: last.code || B.date(last.start_date) }) + '*\n' + line(last) : null, now ? '\n*' + T('wkNow', { c: now.code || B.date(now.start_date) }) + '*\n' + line(now) : null,
      past.length ? '\n*' + T('wkTd') + '*\n' + T('wkTa', { t: M(g), a: M(a), p: pc(a, g) }) : null]);
  }
  /* ---- hooks ---- */
  function scan() {
    if (!B.tid() || !W.allowed) return;
    var s = document.querySelector('#main .pj-stats'), on = document.querySelector('#main .pj-proj.on button[data-proj]');
    if (s && !document.getElementById('bo-wk-pj')) { var pid = on && on.dataset.proj; if (pid && pid !== '__all__') s.parentNode.insertBefore(btn('bo-wk-pj', function () { pjShare(pid); }), s.nextSibling); }
    var sm = document.getElementById('sp-wk-sum');
    if (sm && !document.getElementById('bo-wk-sp') && window.SP && SP.state && SP.state.plan) {
      var p = SP.state.plan; sm.parentNode.insertBefore(btn('bo-wk-sp', function () { open('splan', p.id, p.name, '', '', t('wkSp'), t('wkSpD'), spBuild); }), sm);
    }
  }
  B.weekly = { pj: pjBuild, sp: spBuild };
  var q = 0; new MutationObserver(function () { if (!q) { q = 1; setTimeout(function () { q = 0; scan(); }, 120); } }).observe(document.body, { childList: true, subtree: true });
})();
