/* M-Core Projects - Share WhatsApp on the board: share button + "Shared Nx · date" on cards, Remind on overdue cards,
   multi-select "Share selected (N)" summary, daily "Today & overdue" card. Hook: projects.js paint() -> window._pjAfterPaint(state). */
(function () {
  var W = window.PJW; if (!W || W._board) return; W._board = 1;
  var last = null, key = '';
  function T(lang) { return function (en, ms) { return lang === 'bm' ? ms : en; }; }
  W.sumText = function (tasks, lang) {
    var t = T(lang), bm = lang === 'bm', co = (APP.tenant && APP.tenant.name) || 'M-Core';
    var out = ['*' + t('Selected Tasks Summary', 'Ringkasan Task Pilihan') + ' · ' + co + '*', W.dmy(W.today()) + ' · ' + tasks.length + ' task', ''];
    tasks.forEach(function (k, i) {
      var st = W.late(k) ? '⚠️ ' + t('Overdue ', 'Lewat ') + W.lateDays(k) + t(' day(s)', ' hari') : k.column_key === 'done' ? W.colName('done', bm) : (Number(k.progress) || 0) ? (Number(k.progress) || 0) + '%' : W.colName(k.column_key, bm);
      out.push((i + 1) + '. *' + k.title + '*', '   👤 ' + (W.empName(k.assignee_employee_id) || '-') + ' · 📅 ' + (k.due_date ? W.dm(k.due_date) : '-') + ' · ' + st);
    });
    out.push('', '🔗 ' + location.origin + location.pathname.replace(/[^/]*$/, ''), '_' + t('Sent via M-Core', 'Dihantar melalui M-Core') + '_');
    return out.join('\n');
  };
  function shareable(k) { return W.canShare(k); }
  function clean(main) { main.querySelectorAll('.pjw-inj').forEach(function (n) { n.remove(); }); main.querySelectorAll('.pj-card').forEach(function (c) { c.classList.remove('pjw-late', 'pjw-on'); }); var b = document.getElementById('pjw-bar'); if (b) b.remove(); }
  function decorate(st) {
    var main = document.getElementById('main'); if (!main || !main.querySelector('.pj-wrap')) return;
    clean(main); main.querySelector('.pj-wrap').classList.toggle('pjw-selmode', W.selOn);
    var byId = {}; (st.tasks || []).forEach(function (k) { byId[k.id] = k; });
    main.querySelectorAll('.pj-card[data-id]').forEach(function (card) {
      var k = byId[card.getAttribute('data-id')]; if (!k) return;
      var can = shareable(k), late = W.late(k), sh = W.shares[k.id];
      if (late) {
        card.classList.add('pjw-late');
        var anchor = card.querySelector('.pj-tag') || card.querySelector('.pj-card-title');
        if (anchor) anchor.insertAdjacentHTML('afterend', '<span class="pjw-badge pjw-inj"><i class="ti ti-alert-triangle"></i> ' + W.L('Overdue ', 'Lewat ') + W.lateDays(k) + W.L(' d', ' hari') + '</span>');
      }
      if (W.selOn && can) {
        card.insertAdjacentHTML('afterbegin', '<input type="checkbox" class="pjw-chk pjw-inj" aria-label="' + W.L('Select', 'Pilih') + '"' + (W.sel[k.id] ? ' checked' : '') + '>');
        if (W.sel[k.id]) card.classList.add('pjw-on');
        card.querySelector('.pjw-chk').onclick = function (e) { e.stopPropagation(); if (this.checked) W.sel[k.id] = 1; else delete W.sel[k.id]; decorate(st); };
      }
      var foot = '<div class="pjw-foot pjw-inj">' + (sh ? '<small><i class="ti ti-brand-whatsapp" style="color:var(--pjw)"></i> ' + W.L('Shared ', 'Dikongsi ') + sh.n + 'x · ' + W.dm(sh.last) + '</small>' : '') +
        (can && !W.selOn ? '<span class="sp">' + (late ? '<button type="button" class="btn btn-sm btn-primary" data-pjw-rem="' + k.id + '"><i class="ti ti-bell-ringing"></i> ' + W.L('Remind', 'Ingatkan') + '</button>' : '') + '<button type="button" class="pjw-btn" data-pjw-sh="' + k.id + '" aria-label="' + W.L('Share to WhatsApp', 'Share ke WhatsApp') + '" title="' + W.L('Share to WhatsApp', 'Share ke WhatsApp') + '"><i class="ti ti-brand-whatsapp"></i></button></span>' : '') + '</div>';
      if (sh || (can && !W.selOn)) { var pct = card.querySelector('.pj-pct'); (pct || card.querySelector('.pj-card-meta') || card).insertAdjacentHTML('afterend', foot); }
      var det = card.querySelector('details.pj-detail');
      if (det) { var go = function () { if (det.open && W.activity) W.activity(det, k, can); }; det.addEventListener('toggle', go); go(); }
    });
    main.querySelectorAll('[data-pjw-sh]').forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); W.share({ task: byId[b.dataset.pjwSh] }); }; });
    main.querySelectorAll('[data-pjw-rem]').forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); W.share({ task: byId[b.dataset.pjwRem], tpl: 'reminder' }); }; });
    tools(main, st); if (W.selOn) bar(st); if (W.daily && W.dailyCard) W.dailyCard(main, st);
  }
  function tools(main, st) {
    var box = main.querySelector('.pj-tools'); if (!box || !(st.tasks || []).some(shareable)) return;
    box.insertAdjacentHTML('beforeend', '<button type="button" class="btn btn-sm btn-outline pjw-inj" id="pjw-sel"' + (W.selOn ? ' style="border-color:var(--primary);color:var(--primary)"' : '') + '><i class="ti ti-checkbox"></i> ' + W.L('Select', 'Pilih') + '</button>' +
      (W.isTA() ? '<button type="button" class="btn btn-sm btn-outline pjw-inj" id="pjw-day"' + (W.daily ? ' style="border-color:var(--primary);color:var(--primary)"' : '') + '><i class="ti ti-calendar-due"></i> ' + W.L('Today & overdue', 'Hari ini & lewat') + '</button>' : ''));
    box.querySelector('#pjw-sel').onclick = function () { W.selOn = !W.selOn; W.sel = {}; decorate(st); };
    var d = box.querySelector('#pjw-day'); if (d) d.onclick = function () { W.daily = !W.daily; decorate(st); };
  }
  function bar(st) {
    var ks = (st.tasks || []).filter(function (k) { return W.sel[k.id]; }), lang = W.bm() ? 'bm' : 'en';
    var b = document.createElement('div'); b.id = 'pjw-bar'; b.className = 'pjw-bar';
    b.innerHTML = '<div style="display:flex;align-items:center;gap:8px"><button type="button" class="pjw-x" id="pjw-bx" aria-label="' + W.L('Close', 'Tutup') + '"><i class="ti ti-x"></i></button><b style="font-size:13.5px;flex:1">' + ks.length + W.L(' task(s) selected', ' task dipilih') + '</b><button type="button" class="btn btn-sm pjw-go" id="pjw-bs"' + (ks.length ? '' : ' disabled') + '><i class="ti ti-brand-whatsapp"></i> ' + W.L('Share selected', 'Share pilihan') + ' (' + ks.length + ')</button></div>' + (ks.length ? '<div style="margin-top:10px">' + W.bubble(W.sumText(ks, lang)) + '</div>' : '');
    document.body.appendChild(b);
    b.querySelector('#pjw-bx').onclick = function () { W.selOn = false; W.sel = {}; decorate(st); };
    b.querySelector('#pjw-bs').onclick = function () { if (ks.length) W.share({ tasks: ks, tpl: 'summary', kind: 'other', text: function (l) { return W.sumText(ks, l); } }); };
  }
  W.after = function () { if (last) decorate(last); };
  window._pjAfterPaint = function (st) {
    last = st;
    if (!window.sb || !W.tid()) return;
    W.probe().then(function (ok) {
      if (!ok) return;
      var k = W.tid() + '|' + st.projectId + '|' + (st.tasks || []).map(function (x) { return x.id; }).join(',');
      (k === key ? Promise.resolve() : W.load(st).then(function () { key = k; })).then(function () { if (last === st) decorate(st); });
    });
  };
  /* deep link from shared message: /app/?pj_task=<id> opens the task (after login, tenant RLS applies) */
  var pt = new URLSearchParams(location.search).get('pj_task');
  if (pt && /^[0-9a-f-]{36}$/i.test(pt)) {
    var n = 0, go = function () {
      if (!(window.APP && APP.tenant && APP.tenant.id && typeof openPage === 'function')) { if (++n < 90) setTimeout(go, 1000); return; }
      sb.from('project_tasks').select('id,project_id').eq('id', pt).eq('tenant_id', APP.tenant.id).is('deleted_at', null).maybeSingle().then(function (r) {
        try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) {}
        if (r.data) { window._pjOpenTask = r.data.id; openPage('projects', { id: r.data.project_id }); }
      });
    };
    go();
  }
})();
