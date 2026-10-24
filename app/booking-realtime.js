/* Realtime booking alert: toast + beep + OS notification + bell badge.
   New booking rows carry ref_table/ref_id/link so a tap opens that booking on the dashboard card. v2 */
(function () {
  function beep() {
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      var ctx = new Ctx();
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 880;
      g.gain.value = 0.08;
      o.connect(g); g.connect(ctx.destination);
      o.start();
      setTimeout(function () { try { o.stop(); ctx.close(); } catch (e) {} }, 180);
    } catch (e) {}
  }
  function fmt(iso) {
    try { return new Date(iso).toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur', hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return iso || ''; }
  }
  function uuid(id) { return /^[0-9a-f-]{36}$/i.test(String(id || '')) ? String(id) : null; }
  /* bell / push: if the row points at a booking, open dashboard with that booking selected */
  function wrapNT() {
    var NT = window.NT; if (!NT || typeof NT.fromRow !== 'function') return false; if (NT.fromRow.__bkrt) return true;
    var fr = NT.fromRow;
    NT.fromRow = function (n) {
      var it = fr.apply(this, arguments), id = n && n.ref_table === 'bookings' ? uuid(n.ref_id) : null;
      if (id && it) it.go = ['dashboard', Object.assign({}, (it.go && it.go[1]) || {}, { bkid: id })];
      return it;
    };
    NT.fromRow.__bkrt = 1; return true;
  }
  var ntTries = 0; (function go() { if (!wrapNT() && ++ntTries < 40) setTimeout(go, 250); })();
  async function bumpBadge() {
    if (!window.sb || !APP.tenant) return;
    var since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    var q = await sb.from('bookings').select('id', { count: 'exact', head: true })
      .eq('tenant_id', APP.tenant.id)
      .in('status', ['hold', 'pending_payment'])
      .gte('created_at', since);
    var n = q.count || 0;
    var badge = document.getElementById('notif-badge');
    if (!badge) return;
    if (n > 0) {
      badge.classList.add('show');
      var cur = parseInt(badge.textContent, 10);
      if (!cur || cur < n) badge.textContent = String(n);
    }
  }
  function pushBell(b, msg, when) {
    var NT = window.NT, id = uuid(b && b.id);
    /* self-row with link+ref (NT.notify skips the actor, so insert here). OS alert comes from NT.listen with ?nt= */
    if (NT && NT.on && id && NT.tid() && NT.uid()) {
      sb.from('notifications').insert({
        tenant_id: NT.tid(), user_id: NT.uid(), actor_id: null,
        title: String(msg || '').slice(0, 200), body: String(when || '').slice(0, 500),
        category: 'self', kind: 'for_you', type: 'assigned.booking',
        ref_table: 'bookings', ref_id: id,
        link: { page: 'dashboard', params: { bkid: id }, icon: 'ti-calendar-plus' }
      }).then(function () { if (NT.refresh) NT.refresh(); }, function () {});
      return;
    }
    if (typeof _notifPushBell === 'function') _notifPushBell(msg, when);
    if (typeof _notifOsNotify === 'function') {
      try { _notifOsNotify('New booking', (b.customer_name || 'Customer') + ' · ' + when); } catch (e) {}
    } else if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try { new Notification('New booking', { body: (b.customer_name || 'Customer') + ' · ' + when }); } catch (e) {}
    }
  }
  function handleNewBooking(b) {
    if (!b) return;
    var name = b.customer_name || 'Customer';
    var when = fmt(b.starts_at);
    var msg = 'New booking: ' + name;
    function fire() {
      if (typeof showToast === 'function') showToast(msg, 'success');
      beep();
      pushBell(b, msg, when);
      if (typeof loadNotifications === 'function') try { loadNotifications(); } catch (e) {}
      bumpBadge();
    }
    if (!window.sb || !APP.tenant) return fire();
    sb.from('pay_settings').select('bk_n_new').eq('tenant_id', APP.tenant.id).maybeSingle().then(function (r) {
      if (r.data && r.data.bk_n_new === false) return;
      fire();
    }, function () { fire(); });
  }
  function banner() {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'default') return;
    if (document.getElementById('bk-alert-banner')) return;
    if (!document.getElementById('dashboard-wrap')) return;
    var isBm = APP.language === 'bm';
    var bar = document.createElement('div');
    bar.id = 'bk-alert-banner';
    bar.style.cssText = 'margin:0 0 10px;padding:8px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px;display:flex;justify-content:space-between;gap:8px;align-items:center';
    bar.innerHTML = '<span>' + (isBm ? 'Hidupkan alert tempahan' : 'Enable booking alerts') + '</span><button type="button" class="btn btn-outline btn-sm" id="bk-alert-on">' + (isBm ? 'Benarkan' : 'Allow') + '</button>';
    var host = document.getElementById('db-sec-booking') || document.getElementById('dashboard-wrap');
    if (host) host.parentNode.insertBefore(bar, host);
    document.getElementById('bk-alert-on').onclick = async function () {
      if (typeof _notifRequestOsPermission === 'function') await _notifRequestOsPermission();
      else if (typeof Notification !== 'undefined') await Notification.requestPermission();
      bar.remove();
    };
  }
  function watchNewBookings() {
    if (!window.sb || !APP.tenant || window._bkRealtimeOn) return;
    window._bkRealtimeOn = true;
    try {
      sb.channel('bookings-' + APP.tenant.id)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'bookings',
          filter: 'tenant_id=eq.' + APP.tenant.id
        }, function (payload) {
          handleNewBooking(payload && payload.new);
        })
        .subscribe();
    } catch (e) {
      window._bkRealtimeOn = false;
    }
    banner();
    bumpBadge();
  }
  function boot() {
    if (APP && APP.tenant) watchNewBookings();
  }
  setInterval(boot, 1500);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
