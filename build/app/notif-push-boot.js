/* M-Core phone alerts P2 — boot glue: deep links from notification taps (?nt= / ?ntp= / ?page=&id=, SW 'mcore-open'),
   device sync after login, flush push-send after the app inserts notifications, remove this device on sign-out. */
(function () {
  var NT = window.NT; if (!NT || !NT.push || NT.push.booted) return;
  var P = NT.push; P.booted = 1;
  function parse(search) {
    try { var q = new URLSearchParams(search || ''), d = {}; ['nt', 'ntp', 'page', 'id'].forEach(function (k) { var v = q.get(k); if (v) d[k] = String(v).slice(0, 80); }); return (d.nt || d.ntp || d.page) ? d : null; } catch (e) { return null; }
  }
  function ready() { return !!(window.APP && APP.user && APP.user.id && APP.tenant && APP.tenant.id && typeof window.openPage === 'function'); }
  P.route = function (d) {
    if (!d) return Promise.resolve(false);
    if (d.nt) {
      return Promise.resolve(sb.from('notifications').select('*').eq('id', d.nt).eq('user_id', NT.uid()).maybeSingle()).then(function (r) {
        var n = r && r.data; if (!n || !NT.same(n.tenant_id, NT.tid())) { window.openPage('notifikasi', {}); return false; }
        NT.open(NT.fromRow(NT.classify(n))); return true;
      }, function () { window.openPage('notifikasi', {}); return false; });
    }
    if (d.ntp) { window.openPage('notifikasi', {}); return Promise.resolve(true); }
    if (/^[a-z0-9_-]{1,40}$/i.test(d.page || '')) { window.openPage(d.page, d.id ? { id: d.id } : {}); return Promise.resolve(true); }
    return Promise.resolve(false);
  };
  /* capture deep link once, strip it from the address bar, route after login */
  var pend = parse(location.search);
  if (pend) {
    try { var u = new URL(location.href); ['nt', 'ntp', 'page', 'id'].forEach(function (k) { u.searchParams.delete(k); }); history.replaceState(history.state, '', u.pathname + u.search + u.hash); } catch (e) {}
  }
  var last = null; /* account seen by the last sync; re-syncs when a different account logs in on this tab */
  function tick() {
    if (!ready()) { if (!(window.APP && APP.user && APP.user.id)) last = null; return; }
    if (pend) { var d = pend; pend = null; setTimeout(function () { P.route(d); }, 400); }
    if (String(last) !== String(APP.user.id)) { last = APP.user.id; P.sync(); }
  }
  tick(); setInterval(tick, 1000);
  try {
    if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', function (e) {
      var m = e && e.data; if (!m || m.type !== 'mcore-open' || !ready()) return;
      var d = parse(String(m.url || '').split('?')[1] || ''); if (d) P.route(d);
    });
  } catch (e) {}
  /* app-side inserts into notifications -> ask push-send to deliver (server re-reads rows; idempotent) */
  try {
    if (window.sb && sb.from && !sb.__ntPushWrap) {
      var of = sb.from.bind(sb); sb.__ntPushWrap = 1;
      sb.from = function (t) {
        var q = of.apply(null, arguments);
        try { if (t === 'notifications' && q && typeof q.insert === 'function') { var oi = q.insert; q.insert = function () { var b = oi.apply(q, arguments); P.flush(); return b; }; } } catch (e) {}
        return q;
      };
    }
  } catch (e) {}
  /* sign-out: stop pushes to this device for this account (row soft-deleted; re-enabled automatically at next login) */
  try {
    if (window.sb && sb.auth && sb.auth.signOut && !sb.auth.__ntPushWrap) {
      var so = sb.auth.signOut.bind(sb.auth); sb.auth.__ntPushWrap = 1;
      sb.auth.signOut = function () {
        var a = arguments, pre = P.on && NT.uid() ? Promise.race([P.off(true), new Promise(function (r) { setTimeout(r, 1500); })]) : Promise.resolve();
        return pre.catch(function () {}).then(function () { return so.apply(null, a); });
      };
    }
  } catch (e) {}
})();
