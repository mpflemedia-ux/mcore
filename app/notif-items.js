/* M-Core bell v2 — build tab lists (filter, group ×N, snooze, pin) + shared item renderer/actions. */
(function () {
  var NT = window.NT; if (!NT) return;
  var L = NT.L, esc = NT.esc;
  function link(n) {
    var l = n.link; if (l && l.page) return [l.page, l.params || {}];
    if (n.category === 'service_desk') { var ref = (String(n.title).match(/SR-\d{6}-\d+/) || [])[0]; return [NT.isPA() ? 'admin' : 'servis_saya', NT.isPA() ? { view: 'sd_desk', ref: ref } : { ref: ref }]; }
    var c = n.category; return [{ sales: 'sales', inventory: 'inventory', purchasing: 'purchasing', finance: 'accounting', hr: 'hr', onboarding: 'client_onboarding' }[c] || 'dashboard', {}];
  }
  var ICON = { sd: 'ti-headset', approval: 'ti-circle-check', assigned: 'ti-user-check', overdue: 'ti-file-invoice', contract: 'ti-file-time', activity: 'ti-activity' };
  NT.fromRow = function (n) {
    var ic = (n.link && n.link.icon) || (n.type === 'mention' || /^assigned\.mention/.test(n.type || '') ? 'ti-at' : ICON[n._cat] || 'ti-bell');
    var tt = n.title, rv = String(tt).match(/^(SR-\d{6}-\d+): (revision requested|client confirmed)/);
    if (rv) tt = (rv[2] === 'revision requested' ? L('Client requested revision · ', 'Client minta pindaan · ') : L('Client confirmed · ', 'Client sahkan · ')) + rv[1];
    return { key: n.group_key ? 'g:' + n.group_key : 'n:' + n.id, row: n, ids: [n.id], kind: n._k, cat: n._cat, icon: ic, color: n.priority ? 'var(--danger)' : (n._k === 'activity' ? 'var(--text-2)' : 'var(--primary)'), ts: new Date(n.created_at).getTime(), prio: n.priority ? 1 : 0, unread: !n.read_at, done: !!n.acted_at, title: tt, meta: n.body || '', go: link(n), actor: n.actor_id };
  };
  /* group rows that share group_key (and same-day activity titles) -> one item ×N */
  NT.group = function (items) {
    var by = {}, out = [];
    items.forEach(function (it) {
      var g = it.row && (it.row.group_key || (it.kind === 'activity' ? 'act:' + String(it.title).split(':')[0].slice(0, 24) + ':' + NT.day(it.ts) : null));
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
  NT.build = function (opts) {
    opts = opts || {}; var S = NT.S || NT.merge();
    var rows = NT.rows.filter(function (n) { return !(n.actor_id && NT.same(n.actor_id, NT.uid())); }).map(NT.fromRow);
    var hid = {}; try { JSON.parse(localStorage.getItem('mcore_nt_hide_' + NT.uid() + '_' + NT.day()) || '[]').forEach(function (k) { hid[k] = 1; }); } catch (e) {}
    var all = NT.group(rows.concat(NT.live.filter(function (x) { return !hid[x.key]; }).map(function (x) { return Object.assign({ ids: [] }, x); })));
    var t = { action: [], for_you: [], activity: [], snoozed: [] };
    all.forEach(function (it) {
      if (!NT.ch(it.cat, 'b', S) && !opts.all) return;
      if (it.kind === 'action' && it.done) it.kind = 'for_you';
      if (NT.isSnoozed(it) && !opts.all) { t.snoozed.push(it); return; }
      (t[it.kind] || t.for_you).push(it);
    });
    var cut = Date.now() - 7 * 864e5;
    if (!opts.all) { t.for_you = t.for_you.filter(function (i) { return i.unread || i.live || i.ts > cut; }).slice(0, 30); t.activity = t.activity.filter(function (i) { return i.ts > cut; }).slice(0, 30); }
    Object.keys(t).forEach(function (k) { t[k].sort(function (a, b) { return (NT.isPinned(b) - NT.isPinned(a)) || (b.prio - a.prio) || (b.ts - a.ts); }); });
    t.badge = t.action.length; t.youN = t.for_you.filter(function (i) { return i.unread || i.live; }).length;
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
    return '<div class="nt-it' + (it.prio ? ' nt-hi' : '') + (it.unread ? ' nt-un' : '') + '" data-i="' + i + '"><div class="nt-ic"><i class="ti ' + esc(it.icon) + '" style="color:' + it.color + '"></i></div><div class="nt-bd">' +
      '<div class="nt-tr"><div class="nt-t">' + (NT.isPinned(it) ? '<i class="ti ti-pin-filled nt-pin"></i> ' : '') + esc(it.title) + '</div><span class="nt-w">' + NT.when(it.ts) + '</span></div>' +
      (it.meta ? '<div class="nt-m">' + esc(it.meta) + '</div>' : '') +
      (it.prio ? '<div class="nt-p"><i class="ti ti-alert-triangle"></i> ' + (it.esc ? L('Escalated · waiting over 24h', 'Dieskalasi · menunggu lebih 24 jam') : L('High priority', 'Keutamaan tinggi')) + '</div>' : (it.late ? '<div class="nt-m nt-late"><i class="ti ti-clock-exclamation"></i> ' + L('Waiting over 24h', 'Menunggu lebih 24 jam') + '</div>' : '')) +
      (acts ? '<div class="nt-acts">' + acts + '</div>' : '') + '</div><button type="button" class="nt-more" data-pin="' + i + '" aria-label="Pin" title="' + esc(NT.isPinned(it) ? L('Unpin', 'Nyahpin') : 'Pin') + '"><i class="ti ' + (NT.isPinned(it) ? 'ti-pinned-off' : 'ti-pin') + '"></i></button></div>';
  };
  NT.open = function (it) {
    if (!it) return; NT.markRead(it.ids); if (it.kind === 'action' && it.row) NT.acted(it.ids);
    var g = it.go || ['dashboard', {}], p = Object.assign({}, g[1]);
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
    root.querySelectorAll('[data-pin]').forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); var it = items[+b.dataset.pin], p = NT.S.pin, k = p.indexOf(it.key); if (k >= 0) p.splice(k, 1); else p.push(it.key); NT.saveSettings().then(after); }; });
    root.querySelectorAll('.nt-it').forEach(function (r) { r.onclick = function () { var it = items[+r.dataset.i]; if (it.acts && it.acts.length && it.kind === 'action' && !it.row) { NT.close(); NT.open(it); return; } NT.close(); NT.open(it); }; });
  };
  NT.close = function () { try { _notifOpen = false; } catch (e) {} var m = document.getElementById('notif-menu'); if (m) m.classList.remove('open'); };
})();
