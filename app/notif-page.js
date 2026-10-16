/* M-Core bell v2 — full notifications page (search + filters, grouped by day) + morning digest view. Route: notifikasi */
(function () {
  var NT = window.NT; if (!NT) return;
  var L = NT.L, esc = NT.esc, st = { q: '', f: 'all', mod: '', days: 7 };
  function main() { return document.getElementById('main'); }
  function title(t) { var h = document.getElementById('header-title'); if (h) h.textContent = t; }
  function prep(params) {
    try { _clearUiOverlays(); } catch (e) {} try { _closeMobileSidebar(); } catch (e) {} try { closeUserDropdown(); } catch (e) {}
    try { APP.currentPage = 'notifikasi'; _navPushHistory('notifikasi', params || {}); } catch (e) {}
    document.querySelectorAll('.nav-item').forEach(function (el) { el.classList.remove('active'); });
  }
  var MODS = [['', L('All', 'Semua')], ['approval', L('Approvals', 'Kelulusan')], ['sd', 'Service Desk'], ['assigned', L('Assigned & @mention', 'Ditugaskan & @mention')], ['overdue', L('Overdue invoices', 'Invois overdue')], ['contract', L('Contracts & plan', 'Kontrak & langganan')], ['activity', L('Activity', 'Aktiviti')]];
  function dayLbl(ts) { var d = NT.day(ts), t = NT.day(); if (d === t) return L('TODAY', 'HARI INI'); if (d === NT.day(Date.now() - 864e5)) return L('YESTERDAY', 'SEMALAM'); return new Date(ts).toLocaleDateString(window.APP && APP.language === 'bm' ? 'ms-MY' : 'en-MY', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase(); }
  function list(all) {
    var c = Date.now() - st.days * 864e5, q = st.q.toLowerCase(), S = NT.S, items = NT.group(NT.rows.filter(function (n) { return !(n.actor_id && NT.same(n.actor_id, NT.uid())); }).map(NT.fromRow).concat(NT.live.map(function (x) { return Object.assign({ ids: [] }, x); })));
    return items.filter(function (it) {
      if (it.ts < c && !it.live) return false;
      if (st.mod && it.cat !== st.mod) return false;
      if (q && (it.title + ' ' + it.meta).toLowerCase().indexOf(q) < 0) return false;
      var f = st.f; if (f === 'unread') return it.unread || (it.live && it.kind === 'action'); if (f === 'pin') return NT.isPinned(it); if (f === 'snooze') return NT.isSnoozed(it);
      if (f === 'action' || f === 'for_you' || f === 'activity') return (it.kind === 'action' && it.done ? 'for_you' : it.kind) === f;
      return true;
    }).sort(function (a, b) { return b.ts - a.ts; });
  }
  function chip(k, lbl) { return '<button type="button" class="btn btn-sm ' + (st.f === k ? 'btn-primary' : 'btn-outline') + ' nt-b" data-f="' + k + '">' + esc(lbl) + '</button>'; }
  function paintList() {
    var box = main().querySelector('#nt-pl'); if (!box) return; var it = list(), h = '', last = '';
    it.forEach(function (x, i) { var d = dayLbl(x.ts); if (d !== last) { h += '<div class="nt-grp">' + esc(d) + '</div>'; last = d; } h += NT.itemHtml(x, i); });
    box.innerHTML = h || '<div class="nt-empty"><i class="ti ti-search"></i>' + esc(L('No notifications match', 'Tiada pemberitahuan sepadan')) + '</div>';
    NT.wire(box, it, function () { NT.load().then(function (t) { NT.badge(t); render(); }); });
  }
  function render() {
    var t = NT.build({ all: 1 }), un = NT.rows.filter(function (n) { return !n.read_at; }).length, sn = Object.keys(NT.S.sn).length;
    main().innerHTML = '<div class="nt-page"><div class="nt-ph"><h2>' + esc(L('Notifications', 'Pemberitahuan')) + '</h2><button type="button" class="btn btn-sm btn-outline nt-b" data-set="1"><i class="ti ti-settings"></i> ' + esc(L('Settings', 'Settings')) + '</button></div>' +
      '<div class="nt-srch"><i class="ti ti-search"></i><input class="form-input" id="nt-q" type="search" placeholder="' + esc(L('Search name, reference, client…', 'Cari nama, rujukan, client…')) + '" value="' + esc(st.q) + '"></div>' +
      '<div class="nt-chips">' + chip('all', L('All', 'Semua')) + chip('unread', L('Unread', 'Belum dibaca') + ' (' + un + ')') + chip('action', L('Action', 'Tindakan')) + chip('for_you', L('For you', 'Untuk Kau')) + chip('activity', L('Activity', 'Aktiviti')) + chip('pin', L('Pinned', 'Dipin')) + chip('snooze', 'Snooze (' + sn + ')') + '</div>' +
      '<div class="nt-chips"><label class="nt-sel"><i class="ti ti-filter"></i><select id="nt-mod" class="form-select">' + MODS.map(function (m) { return '<option value="' + m[0] + '"' + (st.mod === m[0] ? ' selected' : '') + '>' + esc(L('Module: ', 'Modul: ') + m[1]) + '</option>'; }).join('') + '</select></label>' +
      '<label class="nt-sel"><i class="ti ti-calendar"></i><select id="nt-days" class="form-select">' + [7, 30, 90].map(function (d) { return '<option value="' + d + '"' + (st.days === d ? ' selected' : '') + '>' + d + L(' days', ' hari') + '</option>'; }).join('') + '</select></label></div>' +
      '<div class="nt-card" id="nt-pl"></div><div class="nt-foot">' + esc(L('Kept 90 days · audit: sent → read → acted', 'Disimpan 90 hari · audit: dihantar → dibaca → tindakan')) + '</div></div>';
    var m = main(), tm = null;
    m.querySelector('#nt-q').oninput = function () { var v = this.value; clearTimeout(tm); tm = setTimeout(function () { st.q = v; paintList(); }, 200); };
    m.querySelector('#nt-mod').onchange = function () { st.mod = this.value; paintList(); };
    m.querySelector('#nt-days').onchange = function () { st.days = +this.value; NT.fetchRows(st.days).then(function (r) { NT.rows = r; paintList(); }); };
    m.querySelectorAll('[data-f]').forEach(function (b) { b.onclick = function () { st.f = b.dataset.f; render(); }; });
    m.querySelector('[data-set]').onclick = function () { window.openPage('notifikasi', { view: 'settings' }); };
    paintList(); return t;
  }
  function drow(ic, c, a, b, n) { return '<div class="nt-dr"><i class="ti ' + ic + '" style="color:' + c + '"></i><div class="nt-bd"><b>' + esc(a) + '</b><div class="nt-m">' + esc(b) + '</div></div><b class="nt-dn" style="color:' + c + '">' + n + '</b></div>'; }
  NT.digestHtml = function () {
    var t = NT.build(), y = NT.day(Date.now() - 864e5), by = {}, n = function (c) { return t.action.filter(function (i) { return i.cat === c; }); };
    NT.rows.forEach(function (r) { if (r._k === 'activity' && NT.day(r.created_at) === y) { var k = String(r.title).split(/[:·]/)[0].trim(); by[k] = (by[k] || 0) + 1; } });
    var ap = n('approval'), sd = n('sd'), ov = n('overdue')[0];
    var h = '<div class="nt-card nt-dgc"><div class="nt-dgh"><i class="ti ti-sun"></i><div><b>' + esc(L('Morning summary', 'Ringkasan pagi')) + '</b><div class="nt-m">' + new Date().toLocaleDateString(window.APP && APP.language === 'bm' ? 'ms-MY' : 'en-MY', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }) + ' · ' + esc((APP.tenant && APP.tenant.name) || 'M-Core') + '</div></div></div>' +
      '<div class="nt-sec">' + esc(L('NEEDS ACTION', 'PERLU TINDAKAN')) + '</div>' +
      (ap.length ? drow('ti-circle-check', 'var(--primary)', L('Approvals waiting', 'Menunggu kelulusan'), ap.slice(0, 2).map(function (i) { return i.title.split(' · ')[0]; }).join(' · '), ap.length) : '') +
      (sd.length ? drow('ti-headset', 'var(--danger)', 'Service Desk', sd[0].title, sd.length) : '') +
      (ov ? drow('ti-file-invoice', 'var(--danger)', L('Overdue invoices', 'Invois overdue'), ov.meta, ov.count) : '') +
      (!ap.length && !sd.length && !ov ? '<div class="nt-m" style="padding:8px 0">' + esc(L('Nothing waiting. Nice.', 'Tiada yang menunggu.')) + '</div>' : '') +
      '<div class="nt-sec">' + esc(L('YESTERDAY', 'SEMALAM')) + '</div>' + (Object.keys(by).length ? Object.keys(by).slice(0, 5).map(function (k) { return drow('ti-activity', 'var(--text-2)', k, L('Activity', 'Aktiviti'), by[k]); }).join('') : '<div class="nt-m" style="padding:8px 0">' + esc(L('No activity yesterday', 'Tiada aktiviti semalam')) + '</div>') +
      '<div class="nt-acts" style="margin-top:14px"><button type="button" class="btn btn-primary" data-ga="1" style="flex:1;justify-content:center">' + esc(L('Open Action', 'Buka Tindakan')) + ' (' + t.badge + ')</button><button type="button" class="btn btn-outline" data-gl="1" style="flex:1;justify-content:center">Activity Log</button></div>' +
      '<div class="nt-foot">' + esc(L('Sent once each morning to Bell', 'Dihantar sekali setiap pagi ke Bell')) + (NT.ch('approval', 't') ? ' & Telegram' : '') + ' · ' + esc(L('change in Settings', 'tukar dalam Settings')) + '</div></div>';
    return { html: h, t: t };
  };
  function digest() {
    var d = NT.digestHtml(); NT.digestSeen(); main().innerHTML = '<div class="nt-page">' + d.html + '</div>';
    main().querySelector('[data-ga]').onclick = function () { st.f = 'action'; window.openPage('notifikasi', {}); };
    main().querySelector('[data-gl]').onclick = function () { window.openPage('notifikasi', { f: 'activity' }); };
  }
  NT.page = function (params) {
    params = params || {}; prep(params);
    title(params.view === 'settings' ? L('Notification settings', 'Tetapan') : params.view === 'digest' ? L('Morning summary', 'Ringkasan pagi') : L('Notifications', 'Pemberitahuan'));
    main().innerHTML = '<div style="padding:40px;text-align:center"><div class="spinner"></div></div>';
    return NT.probe().then(function (on) {
      if (!on) { main().innerHTML = '<div class="nt-page"><div class="nt-empty">' + esc(L('New notifications are not set up yet.', 'Pemberitahuan baharu belum disediakan.')) + '</div></div>'; return; }
      if (params.f) st.f = params.f;
      return Promise.all([NT.S && NT._sk === NT.lsKey() ? NT.S : NT.loadSettings(), NT.fetchRows(st.days), NT.loadLive()]).then(function (r) {
        NT.rows = r[1]; if (params.view === 'settings') return NT.settingsPage(main()); if (params.view === 'digest') return digest(); render();
      });
    });
  };
  function wrap() {
    var o = window.openPage; if (typeof o !== 'function' || o._ntW) return;
    var w = function (page, params) { if (page === 'notifikasi') return NT.page(params); return o.apply(this, arguments); };
    w._ntW = 1; window.openPage = w;
  }
  wrap(); document.addEventListener('DOMContentLoaded', wrap); setTimeout(wrap, 1500);
})();
