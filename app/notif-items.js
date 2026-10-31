/* M-Core bell v2 — build tab lists (filter, group ×N, snooze, pin) + shared item renderer/actions. */
(function () {
  var NT = window.NT; if (!NT) return;
  var L = NT.L, esc = NT.esc;
  function link(n) {
    var l = n.link; if (l && l.page) return [l.page, l.params || {}];
    if (n.category === 'service_desk') {
      var page = NT.isPA() ? 'admin' : 'servis_saya';
      /* ref_id is the SR's real id, set on every SD notification at insert time (bellFor/bellNew/
         push-send) -- use it directly so the click opens the request itself (SD.detail via
         admin.sd_desk's/view.servis_saya's own p.id handling), not just the board/list. Regex-
         parsing ref_no out of the title and resolving it back to an id via an extra DB round trip
         (NT.open's p.ref fallback) stays only as a safety net for any row that somehow lacks ref_id. */
      if (n.ref_table === 'service_requests' && n.ref_id) return [page, NT.isPA() ? { view: 'sd_desk', id: n.ref_id } : { id: n.ref_id }];
      var ref = (String(n.title).match(/SR-(?:[A-Z0-9]+-)?\d{6}-\d+/) || [])[0];
      return [page, NT.isPA() ? { view: 'sd_desk', ref: ref } : { ref: ref }];
    }
    var c = n.category; return [{ sales: 'sales', inventory: 'inventory', purchasing: 'purchasing', finance: 'accounting', hr: 'hr', onboarding: 'client_onboarding' }[c] || 'dashboard', {}];
  }
  var ICON = { sd: 'ti-headset', approval: 'ti-circle-check', assigned: 'ti-user-check', overdue: 'ti-file-invoice', contract: 'ti-file-time', activity: 'ti-activity' };
  NT.fromRow = function (n) {
    var ic = (n.link && n.link.icon) || (n.type === 'mention' || /^assigned\.mention/.test(n.type || '') ? 'ti-at' : ICON[n._cat] || 'ti-bell');
    var tt = n.title, rv = String(tt).match(/^(SR-(?:[A-Z0-9]+-)?\d{6}-\d+): (revision requested|client confirmed)/);
    if (rv) tt = (rv[2] === 'revision requested' ? L('Client requested revision · ', 'Client minta pindaan · ') : L('Client confirmed · ', 'Client sahkan · ')) + rv[1];
    return { key: n.group_key ? 'g:' + n.group_key : 'n:' + n.id, row: n, ids: [n.id], kind: n._k, cat: n._cat, icon: ic, color: n.priority ? 'var(--danger)' : (n._k === 'activity' ? 'var(--text-2)' : 'var(--primary)'), ts: new Date(n.created_at).getTime(), prio: n.priority ? 1 : 0, unread: !n.read_at, done: !!n.acted_at, title: tt, meta: n.body || '', go: link(n), actor: n.actor_id };
  };
  /* group rows that share group_key (and near-simultaneous activity titles) -> one item ×N.
     Fallback key (no group_key, e.g. legacy/trigger-inserted rows) matches NT.ACT_RE's own
     prefix -- not a naive title.split(':')[0], which silently stopped grouping the moment a
     trigger's title used a different separator (dash, etc.) -- and buckets by a rolling 2-min
     window rather than calendar day, so a burst of e.g. journal-entry rows collapses into one
     item instead of spamming the bell, while entries hours apart stay separate. */
  NT.group = function (items) {
    var by = {}, out = [];
    items.forEach(function (it) {
      var m = it.kind === 'activity' && NT.ACT_RE && NT.ACT_RE.exec(it.title || '');
      var g = it.row && (it.row.group_key || (m ? 'act:' + m[1].slice(0, 24) + ':' + Math.floor(it.ts / 120000) : null));
      if (!g) { out.push(it); return; }
      var h = by[g];
      if (!h) { h = by[g] = Object.assign({}, it, { key: 'g:' + g, count: 1, metas: [it.meta] }); out.push(h); return; }
      h.count++; h.ids = h.ids.concat(it.ids); h.unread = h.unread || it.unread; if (h.metas.length < 3 && it.meta) h.metas.push(it.meta);
    });
    out.forEach(function (h) {
      if (h.count > 1 && h.metas) {
        if (/^Kehadiran|^Attendance/i.test(h.title)) h.title = L('Attendance: ', 'Kehadiran: ') + h.count + L(' records today', ' rekod hari ni');
        else h.title = String(h.title).replace(/\s*×\d+$/, '') + ' ×' + h.count;
        h.meta = h.metas.filter(Boolean).slice(0, 2).join(' · ') + (h.count > 2 ? ' +' + (h.count - 2) + L(' more', ' lagi') : '');
      }
    });
    return out;
  };
  NT.isSnoozed = function (it) { var u = NT.S && NT.S.sn[it.key]; return !!(u && new Date(u).getTime() > Date.now()); };
  NT.isPinned = function (it) { return !!(NT.S && NT.S.pin.indexOf(it.key) >= 0); };
  /* ---- one event = one entry: a DB row about the same source doc as a live item merges into it ---- */
  var LIVE_OF = { 'hr.leave_submitted': 'leave:', 'hr.ot_submitted': 'ot:', 'hr.exp_submitted': 'claim:', 'hr.adv_submitted': 'adv:', 'hr.os_submitted': 'os:' };
  NT.liveKey = function (n, refIx) {
    var p = n && LIVE_OF[n.type]; if (p && n.ref_id) return p + n.ref_id;
    return n && /^sd\./.test(n.type || '') && n._k === 'action' && n.ref_id && refIx ? refIx[n.ref_id] || null : null;
  };
  /* ---- "seen" for live items (no DB row to stamp): key -> meta when last marked read. Old hide map migrates in. ---- */
  NT.seenKey = function () { return 'mcore_nt_seen_' + NT.uid(); };
  NT.seen = function () {
    var s = {}, hk = 'mcore_nt_hide_' + NT.uid();
    try {
      s = JSON.parse(localStorage.getItem(NT.seenKey()) || '{}') || {};
      var h = localStorage.getItem(hk); if (h) { Object.assign(s, JSON.parse(h) || {}); localStorage.removeItem(hk); localStorage.setItem(NT.seenKey(), JSON.stringify(s)); }
    } catch (e) {}
    return s;
  };
  NT.markSeen = function (items) {
    var s = NT.seen(), live = {};
    (items || []).forEach(function (i) { if (i && i.live && i.key) s[i.key] = String(i.meta || ''); });
    if (NT.live.length) { NT.live.forEach(function (x) { live[x.key] = 1; }); Object.keys(s).forEach(function (k) { if (!live[k]) delete s[k]; }); }
    try { localStorage.setItem(NT.seenKey(), JSON.stringify(s)); } catch (e) {}
  };
  /* ---- auto-resolve: an action row whose source doc is no longer waiting is done (persisted via acted) ---- */
  var OPEN_ST = { leave_requests: ['pending', 'submitted'], ot_claims: ['pending', 'submitted'], expense_claims: ['pending', 'submitted'], cash_advances: ['pending', 'submitted'], outstation_requests: ['pending', 'submitted'] };
  var SD_OPEN = { 'sd.new': ['submitted'], 'sd.revision': ['revision', 'triaged', 'in_progress'], 'sd.delivered': ['delivered'] };
  function openFor(n) { return n.ref_table === 'service_requests' ? SD_OPEN[n.type] : OPEN_ST[n.ref_table]; }
  NT.resolve = function (rows) {
    var by = {};
    (rows || []).forEach(function (n) { if (n._k === 'action' && !n.acted_at && n.ref_id && openFor(n)) (by[n.ref_table] = by[n.ref_table] || []).push(n); });
    var jobs = Object.keys(by).map(function (tbl) {
      var ids = by[tbl].map(function (n) { return String(n.ref_id); }).filter(function (v, i, a) { return a.indexOf(v) === i; }).slice(0, 200);
      return Promise.resolve(sb.from(tbl).select('id,status').in('id', ids)).then(function (r) {
        if (!r || r.error) return [];
        var st = {}; (r.data || []).forEach(function (x) { st[String(x.id)] = String(x.status || '').toLowerCase(); });
        return by[tbl].filter(function (n) { var s = st[String(n.ref_id)]; return s != null && openFor(n).indexOf(s) < 0; });
      }, function () { return []; });
    });
    return Promise.all(jobs).then(function (res) {
      var done = [].concat.apply([], res), now = new Date().toISOString();
      done.forEach(function (n) { n.acted_at = now; n.read_at = n.read_at || now; });
      if (done.length) NT.acted(done.map(function (n) { return n.id; }));
      return rows;
    }, function () { return rows; });
  };
  NT.build = function (opts) {
    opts = opts || {}; var S = NT.S || NT.merge(), seen = NT.seen(), liveBy = {}, refIx = {}, merged = {};
    NT.live.forEach(function (x) { liveBy[x.key] = x; (x.refs || []).forEach(function (r) { refIx[String(r)] = x.key; }); });
    var rows = [];
    NT.rows.forEach(function (n) {
      if (n.actor_id && NT.same(n.actor_id, NT.uid())) return;
      var lk = !n.acted_at && NT.liveKey(n, refIx);
      if (lk && liveBy[lk]) { (merged[lk] = merged[lk] || []).push(n); return; }
      rows.push(NT.fromRow(n));
    });
    var lives = NT.live.map(function (x) {
      var it = Object.assign({ ids: [] }, x), m = merged[x.key];
      if (m) { it.ids = m.map(function (r) { return r.id; }); it.unread = m.some(function (r) { return !r.read_at; }); }
      else it.unread = seen[x.key] !== String(x.meta || '');
      return it;
    });
    var all = NT.group(rows.concat(lives));
    var t = { action: [], for_you: [], activity: [], snoozed: [] };
    all.forEach(function (it) {
      if (!NT.ch(it.cat, 'b', S) && !opts.all) return;
      if (it.kind === 'action' && it.done) it.kind = 'for_you';
      if (NT.isSnoozed(it) && !opts.all) { t.snoozed.push(it); return; }
      (t[it.kind] || t.for_you).push(it);
    });
    var cut = Date.now() - 7 * 864e5;
    if (!opts.all) { t.for_you = t.for_you.filter(function (i) { return i.unread || i.live || i.ts > cut; }).slice(0, 30); t.activity = t.activity.filter(function (i) { return i.ts > cut; }).slice(0, 30); }
    Object.keys(t).forEach(function (k) { t[k].sort(function (a, b) { return (NT.isPinned(b) - NT.isPinned(a)) || (b.unread - a.unread) || (b.prio - a.prio) || (b.ts - a.ts); }); });
    var un = function (i) { return !!i.unread; };
    /* badge = UNREAD (Action + For you); open-but-read action items stay listed, never counted */
    t.actN = t.action.length; t.actU = t.action.filter(un).length; t.youN = t.for_you.filter(un).length;
    t.badge = t.actU + t.youN; t.all = all;
    return t;
  };
  NT.when = function (ts) {
    var m = Math.round((Date.now() - ts) / 6e4); if (m < 1) return L('now', 'baru');
    if (m < 60) return m + L(' min', ' min'); if (m < 1440) return Math.round(m / 60) + L(' h', ' jam');
    return m < 2880 ? L('Yesterday', 'Semalam') : new Date(ts).toLocaleDateString(window.APP && APP.language === 'bm' ? 'ms-MY' : 'en-MY', { day: 'numeric', month: 'short' });
  };
  NT.btn = function (lbl, ic, cls, data) { return '<button type="button" class="btn btn-sm ' + cls + ' nt-b" ' + data + '>' + (ic ? '<i class="ti ' + ic + '"></i>' : '') + esc(lbl) + '</button>'; };
  NT.itemHtml = function (it, i) {
    var acts = '';
    (it.acts || []).forEach(function (a) { acts += a[0] === 'approve' ? NT.btn(L('Approve', 'Lulus'), 'ti-check', 'btn-primary', 'data-act="' + i + '" data-a="approve"') : NT.btn(L('Reject', 'Tolak'), 'ti-x', 'btn-outline', 'data-act="' + i + '" data-a="reject"'); });
    if (it.kind === 'action' && it.row && !it.done) acts += NT.btn(L('Open', 'Buka'), 'ti-arrow-right', it.prio ? 'btn-primary' : 'btn-outline', 'data-go="' + i + '"');
    if (it.count > 1 && it.cat === 'overdue') acts = NT.btn(L('View ', 'Lihat ') + it.count + L(' invoices', ' invois'), '', 'btn-outline', 'data-go="' + i + '"');
    if (it.kind === 'action') acts += NT.btn(NT.isSnoozed(it) ? L('Unsnooze', 'Batal snooze') : 'Snooze', 'ti-clock-pause', 'btn-outline', 'data-sn="' + i + '"');
    if (it.tenant) acts += NT.btn(L('Mute', 'Senyap'), 'ti-bell-off', 'btn-outline', 'data-mute="' + i + '"');
    return '<div class="nt-it' + (it.prio ? ' nt-hi' : '') + (it.unread ? ' nt-un' : '') + '" data-i="' + i + '"><div class="nt-ic"><i class="ti ' + esc(it.icon) + '" style="color:' + it.color + '"></i></div><div class="nt-bd">' +
      '<div class="nt-tr"><div class="nt-t">' + (NT.isPinned(it) ? '<i class="ti ti-pin-filled nt-pin"></i> ' : '') + esc(it.title) + '</div><span class="nt-w">' + NT.when(it.ts) + '</span></div>' +
      (it.meta ? '<div class="nt-m">' + esc(it.meta) + '</div>' : '') +
      (it.prio ? '<div class="nt-p"><i class="ti ti-alert-triangle"></i> ' + (it.esc ? L('Escalated · waiting over 24h', 'Dieskalasi · menunggu lebih 24 jam') : L('High priority', 'Keutamaan tinggi')) + '</div>' : (it.late ? '<div class="nt-m nt-late"><i class="ti ti-clock-exclamation"></i> ' + L('Waiting over 24h', 'Menunggu lebih 24 jam') + '</div>' : '')) +
      (acts ? '<div class="nt-acts">' + acts + '</div>' : '') + '</div><button type="button" class="nt-more" data-pin="' + i + '" aria-label="Pin" title="' + esc(NT.isPinned(it) ? L('Unpin', 'Nyahpin') : 'Pin') + '"><i class="ti ' + (NT.isPinned(it) ? 'ti-pinned-off' : 'ti-pin') + '"></i></button></div>';
  };
  NT.open = function (it) {
    if (!it) return; NT.markRead(it.ids); if (it.live) NT.markSeen([it]); if (it.kind === 'action' && it.row) NT.acted(it.ids);
    (NT.rows || []).forEach(function (n) { if ((it.ids || []).indexOf(n.id) >= 0) n.read_at = n.read_at || new Date().toISOString(); }); try { NT.badge(NT.build()); } catch (e) {}
    var g = it.go || ['dashboard', {}], p = Object.assign({}, g[1]);
    if (p.taskId) { window._pjOpenTask = p.taskId; delete p.taskId; } // projects.js reads+clears this to auto-open that task's detail (same mechanism as the WhatsApp task deep-link)
    if (p.ref && !p.id) {
      return sb.from('service_requests').select('id').eq('ref_no', p.ref).maybeSingle().then(function (r) { if (r && r.data) p.id = r.data.id; delete p.ref; window.openPage(g[0], p); }, function () { delete p.ref; window.openPage(g[0], p); });
    }
    delete p.ref; window.openPage(g[0], p);
  };
  /* wire a rendered list; items = array used for indices; after() re-renders */
  NT.wire = function (root, items, after) {
    root.querySelectorAll('[data-act]').forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); var it = items[+b.dataset.act], a = (it.acts || [])[0]; b.disabled = true; var f = function () { if (a[1] !== 'claim') after(); }; NT.doAct(b.dataset.a, a[1], a[2]).then(f, f); }; });
    root.querySelectorAll('[data-go]').forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); NT.close(); NT.open(items[+b.dataset.go]); }; });
    root.querySelectorAll('[data-sn]').forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); var it = items[+b.dataset.sn]; if (NT.isSnoozed(it)) { delete NT.S.sn[it.key]; NT.saveSettings().then(after); } else NT.snoozeSheet(it, after); }; });
    root.querySelectorAll('[data-mute]').forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); var it = items[+b.dataset.mute]; if (!it || !it.tenant) return; try { var k = 'mcore_nt_mute_' + NT.uid(); var a = JSON.parse(localStorage.getItem(k) || '[]'); if (a.indexOf(it.tenant) < 0) a.push(it.tenant); localStorage.setItem(k, JSON.stringify(a)); } catch (e) {} after(); }; });
    root.querySelectorAll('[data-pin]').forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); var it = items[+b.dataset.pin], p = NT.S.pin, k = p.indexOf(it.key); if (k >= 0) p.splice(k, 1); else p.push(it.key); NT.saveSettings().then(after); }; });
    root.querySelectorAll('.nt-it').forEach(function (r) { r.onclick = function () { var it = items[+r.dataset.i]; if (it.acts && it.acts.length && it.kind === 'action' && !it.row) { NT.close(); NT.open(it); return; } NT.close(); NT.open(it); }; });
  };
  NT.close = function () { try { _notifOpen = false; } catch (e) {} var m = document.getElementById('notif-menu'); if (m) m.classList.remove('open'); };
})();
