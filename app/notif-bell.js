/* M-Core bell v2 — dropdown (3 tabs), snooze sheet, morning digest. Falls back to the old bell until SQL is run. */
(function () {
  var NT = window.NT; if (!NT) return;
  var L = NT.L, esc = NT.esc, tab = 'action', cache = null, busy = null;
  NT.load = function () {
    if (busy) return busy;
    busy = Promise.all([NT.S && NT._sk === NT.lsKey() ? NT.S : NT.loadSettings(), NT.fetchRows(30), NT.loadLive()]).then(function (r) { NT.rows = r[1]; cache = NT.build(); NT.listen(); NT.tidy(); busy = null; return cache; }, function () { busy = null; return cache; });
    return busy;
  };
  NT.badge = function (t) { var b = document.getElementById('notif-badge'); if (!b) return; var n = t ? t.badge : 0; b.textContent = n > 99 ? '99+' : String(n); b.classList.toggle('show', n > 0); };
  NT.refresh = function () { return NT.load().then(function (t) { NT.badge(t); var m = document.getElementById('notif-menu'); if (m && m.classList.contains('open')) NT.paint(); }); };
  function tabs(t) {
    return '<div class="nt-tabs" role="tablist">' + [['action', L('Action', 'Tindakan'), t.badge], ['for_you', L('For you', 'Untuk Kau'), t.youN], ['activity', L('Activity', 'Aktiviti'), 0]].map(function (x) {
      return '<button type="button" role="tab" aria-selected="' + (tab === x[0]) + '" class="nt-tab' + (tab === x[0] ? ' on' : '') + '" data-tab="' + x[0] + '">' + esc(x[1]) + (x[2] ? ' <span class="nt-c">' + x[2] + '</span>' : '') + '</button>';
    }).join('') + '</div>';
  }
  function empty(k) {
    var m = { action: L('Nothing needs your action', 'Tiada yang perlu tindakan kau'), for_you: L('Nothing new for you', 'Tiada yang baharu untuk kau'), activity: L('No activity in the last 7 days', 'Tiada aktiviti 7 hari lepas') };
    return '<div class="nt-empty"><i class="ti ti-circle-check"></i>' + esc(m[k]) + '</div>';
  }
  NT.digestDue = function () { var S = NT.S; if (!S || !S.digest.on) return false; var k = 'mcore_nt_dg_' + NT.uid(); return localStorage.getItem(k) !== NT.day() && new Date().getHours() < 12; };
  NT.digestSeen = function () { localStorage.setItem('mcore_nt_dg_' + NT.uid(), NT.day()); };
  NT.paint = function () {
    var m = document.getElementById('notif-menu'); if (!m || !cache) return;
    var t = cache, list = t[tab] || [], dg = tab === 'action' && NT.digestDue();
    m.classList.add('nt-menu');
    m.innerHTML = '<div class="nt-h"><b>' + esc(L('Notifications', 'Pemberitahuan')) + '</b>' +
      NT.btn(L('Mark read', 'Tanda dibaca'), 'ti-checks', 'btn-outline', 'data-mr="1"') + '<button type="button" class="btn btn-sm btn-outline nt-b" data-set="1" aria-label="' + esc(L('Settings', 'Settings')) + '"><i class="ti ti-settings"></i></button></div>' + tabs(t) +
      (tab === 'activity' ? '<div class="nt-note"><i class="ti ti-info-circle"></i> ' + esc(L('Activity does not add to the badge', 'Aktiviti tidak tambah kiraan badge')) + '</div>' : '') +
      (dg ? '<div class="nt-dg"><i class="ti ti-sun"></i><div class="nt-bd"><b>' + esc(L('Morning summary ready', 'Ringkasan pagi sedia')) + '</b><div class="nt-m">' + t.badge + L(' to action · ', ' perlu tindakan · ') + t.youN + L(' for you', ' untuk kau') + '</div></div>' + NT.btn(L('View', 'Lihat'), '', 'btn-outline', 'data-dg="1"') + '</div>' : '') +
      '<div class="nt-list" id="notif-list">' + (list.length ? list.map(NT.itemHtml).join('') : empty(tab)) + '</div>' +
      (t.snoozed.length && tab === 'action' ? '<div class="nt-note">' + t.snoozed.length + ' ' + esc(L('snoozed', 'di-snooze')) + '</div>' : '') +
      '<div class="nt-f"><a href="javascript:void 0" data-all="1">' + esc(tab === 'activity' ? L('View Activity Log', 'Lihat Activity Log') : L('View all notifications', 'Lihat semua pemberitahuan')) + (tab === 'activity' ? ' <i class="ti ti-arrow-right"></i>' : '') + '</a></div>';
    NT.wire(m, list, NT.refresh);
    m.querySelectorAll('[data-tab]').forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); tab = b.dataset.tab; NT.paint(); }; });
    var q = function (s) { return m.querySelector(s); };
    q('[data-mr]').onclick = function (e) {
      e.stopPropagation();
      var ids = [], hide = [];
      list.forEach(function (i) {
        if (i.ids && i.ids.length && i.unread) ids = ids.concat(i.ids);
        if (i.live && i.key) hide.push(i.key);
      });
      try { var k = 'mcore_nt_hide_' + NT.uid(); var a = JSON.parse(localStorage.getItem(k) || '{}'); list.forEach(function (i) { if (i.live && i.key) a[i.key] = String(i.meta || ''); }); localStorage.setItem(k, JSON.stringify(a)); } catch (e) {}
      NT.markRead(ids).then(NT.refresh);
    };
    q('[data-set]').onclick = function (e) { e.stopPropagation(); NT.close(); window.openPage('notifikasi', { view: 'settings' }); };
    q('[data-all]').onclick = function (e) { e.stopPropagation(); NT.close(); window.openPage('notifikasi', tab === 'activity' ? { f: 'activity' } : {}); };
    if (dg) q('[data-dg]').onclick = function (e) { e.stopPropagation(); NT.digestSeen(); NT.close(); window.openPage('notifikasi', { view: 'digest' }); };
  };
  /* snooze sheet: 1 jam / Esok pagi / Isnin / pilih masa */
  NT.snoozeSheet = function (it, after) {
    var d = new Date(), h1 = new Date(d.getTime() + 36e5), tm = new Date(d); tm.setDate(d.getDate() + 1); tm.setHours(9, 0, 0, 0);
    var mon = new Date(d); mon.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); mon.setHours(9, 0, 0, 0);
    var loc = window.APP && APP.language === 'bm' ? 'ms-MY' : 'en-MY', f = function (x, o) { return x.toLocaleString(loc, o); };
    var opts = [['ti-clock', L('1 hour', '1 jam'), f(h1, { hour: 'numeric', minute: '2-digit' }), h1], ['ti-sunrise', L('Tomorrow morning', 'Esok pagi'), f(tm, { weekday: 'long', day: 'numeric', month: 'short' }) + ' · 9:00', tm], ['ti-calendar-week', L('Monday', 'Isnin'), f(mon, { day: 'numeric', month: 'short' }) + ' · 9:00', mon]];
    var w = document.createElement('div'); w.className = 'nt-sheet-w';
    w.innerHTML = '<div class="nt-ov"></div><div class="nt-sheet" role="dialog" aria-modal="true"><div class="nt-grip"></div><div class="nt-sh-h"><b>' + esc(L('Snooze notification', 'Snooze pemberitahuan')) + '</b><button type="button" class="nt-x" aria-label="Close"><i class="ti ti-x"></i></button></div><div class="nt-m" style="margin:2px 0 6px">' + esc(it.title) + '</div>' +
      opts.map(function (o, i) { return '<button type="button" class="nt-opt" data-o="' + i + '"><i class="ti ' + o[0] + '"></i><span><b>' + esc(o[1]) + '</b><small>' + esc(o[2]) + '</small></span><i class="ti ti-chevron-right"></i></button>'; }).join('') +
      '<label class="nt-opt nt-pick"><i class="ti ti-calendar-time"></i><span><b>' + esc(L('Pick a time…', 'Pilih masa…')) + '</b><input type="datetime-local" class="form-input" data-dt="1"></span></label>' +
      '<div class="nt-m" style="margin-top:10px"><i class="ti ti-info-circle"></i> ' + esc(L('Hidden from Action until then, then it comes back on top.', 'Item hilang dari Tindakan sehingga masa dipilih, kemudian kembali di atas.')) + '</div></div>';
    w.addEventListener('click', function (e) { e.stopPropagation(); });
    document.body.appendChild(w);
    var done = function (dt) { if (dt) { NT.S.sn[it.key] = dt.toISOString(); NT.saveSettings().then(after); try { showToast(L('Snoozed until ', 'Snooze sehingga ') + f(dt, { weekday: 'short', hour: 'numeric', minute: '2-digit' }), 'success'); } catch (e) {} } w.remove(); };
    w.querySelector('.nt-ov').onclick = function () { done(null); }; w.querySelector('.nt-x').onclick = function () { done(null); };
    w.querySelectorAll('[data-o]').forEach(function (b) { b.onclick = function () { done(opts[+b.dataset.o][3]); }; });
    w.querySelector('[data-dt]').onchange = function () { var v = new Date(this.value); if (v.getTime() > Date.now()) done(v); };
  };
  /* takeover: old bell keeps working until notif_01 SQL has run */
  function take() {
    var old = window.loadNotifications; if (typeof old !== 'function' || old._nt) return false;
    var w = function () {
      var self = this, args = arguments;
      if (!NT.uid() || !NT.tid()) return old.apply(self, args);
      return NT.probe().then(function (on) {
        if (!on) return old.apply(self, args);
        var m = document.getElementById('notif-menu');
        if (m && m.classList.contains('open') && !cache) m.innerHTML = '<div class="nt-empty"><div class="spinner" style="width:16px;height:16px;border-width:2px;display:inline-block"></div></div>';
        return NT.load().then(function (t) { NT.badge(t); if (m && m.classList.contains('open')) NT.paint(); });
      });
    };
    w._nt = 1; window.loadNotifications = w; return true;
  }
  if (!take()) document.addEventListener('DOMContentLoaded', take);
  setInterval(function () { if (NT.on && document.visibilityState === 'visible') NT.refresh(); }, 5 * 6e4);
})();
