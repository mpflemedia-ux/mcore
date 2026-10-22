/* M-Core phone alerts P1 — replaces index.html _notifOsNotify (same name; optional 5th arg = notifications row).
   Fixes: dedupe by notification id (was: once per title per day), one tag per event (was: shared 'mcore-bell'),
   real priority for quiet-hours bypass (was: always 0), returns true only when shown (for an honest test toast).
   Legacy prefs mapping: when bell v2 is live (NT.on) the Type x Phone matrix + quiet hours govern; legacy
   user_notification_prefs.muted / os_phone are ignored. Without NT.on the legacy prefs still apply. */
(function () {
  if (window._notifOsV2) return; window._notifOsV2 = 1;
  var DK = 'mcore_os_seen_v2';
  function hash(s) { var h = 0; s = String(s); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
  /* true when key was already shown within ttl ms; otherwise records it */
  function seen(k, ttl) {
    try {
      var now = Date.now(), a = JSON.parse(localStorage.getItem(DK) || '[]').filter(function (x) { return now - x[1] < 864e5; });
      var hit = a.some(function (x) { return x[0] === k && now - x[1] < ttl; });
      if (!hit) { a = a.filter(function (x) { return x[0] !== k; }); a.push([k, now]); localStorage.setItem(DK, JSON.stringify(a.slice(-300))); }
      return hit;
    } catch (e) { return false; }
  }
  function vib(p) { return p >= 2 ? [300, 120, 300, 120, 300] : p >= 1 ? [200, 100, 200] : [120]; }
  window._notifOsSeen = seen;
  window._notifOsNotify = async function (title, body, force, link, n) {
    try {
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false;
      var NT = window.NT, prio = n && n.priority ? +n.priority : 0, id = n && n.id ? String(n.id) : '';
      if (!force) {
        if (NT && NT.on) { try { if (NT.quiet && NT.quiet(null, prio)) return false; } catch (e) {} }
        else {
          try { if (NT && NT.quiet && NT.quiet(null, prio)) return false; } catch (e) {}
          var prefs = {}; try { prefs = (typeof _notifGetPrefs === 'function') ? await _notifGetPrefs() : {}; } catch (e) {}
          if (prefs && (prefs.muted || prefs.os_phone === false)) return false;
        }
        if (id ? seen('n:' + id, 864e5) : seen('t:' + hash(String(title) + '|' + String(body || '')), 60000)) return false;
      }
      var url = '/app/';
      if (id) url = '/app/?nt=' + encodeURIComponent(id);
      else if (link && link.page) url = '/app/?page=' + encodeURIComponent(link.page) + (link.params && link.params.id ? '&id=' + encodeURIComponent(link.params.id) : '');
      var opts = {
        body: String(body || '').slice(0, 180), icon: '/app/icons/icon-192.png', badge: '/app/icons/badge-96.png',
        tag: id ? 'mcore-n-' + id : (force ? 'mcore-test' : 'mcore-l-' + hash(String(title) + '|' + String(body || ''))),
        renotify: !!force, data: { url: url, nid: id }, requireInteraction: prio >= 2, vibrate: vib(prio), timestamp: Date.now()
      };
      var t = String(title || 'M-Core').slice(0, 80);
      if (navigator.serviceWorker) {
        var reg = await Promise.race([navigator.serviceWorker.ready, new Promise(function (r) { setTimeout(function () { r(null); }, 3000); })]);
        if (reg && reg.showNotification) { await reg.showNotification(t, opts); return true; }
      }
      new Notification(t, opts); return true;
    } catch (e) { return false; }
  };
})();
