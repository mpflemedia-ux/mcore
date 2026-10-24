/* Booking realtime: bell+toast; tap -> Inbox; claim -> proof. Catch-up offline/receipt. v4 */
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
  function claimFor(bkId, invId) {
    if (!window.sb || !APP.tenant || !bkId) return Promise.resolve(null);
    var p = invId ? Promise.resolve(invId)
      : sb.from('bookings').select('invoice_id').eq('id', bkId).eq('tenant_id', APP.tenant.id).maybeSingle()
        .then(function (r) { return r.data && r.data.invoice_id; }, function () { return null; });
    return p.then(function (iid) {
      if (!iid) return null;
      return sb.from('payment_claims').select('id').eq('tenant_id', APP.tenant.id).eq('invoice_id', iid)
        .eq('status', 'pending').is('deleted_at', null).order('created_at', { ascending: false }).limit(1)
        .then(function (r) { return (r.data && r.data[0] && r.data[0].id) || null; }, function () { return null; });
    });
  }
  function paramsFor(id, cid) {
    var p = { bkid: id, bktab: cid ? 'proof' : 'det' };
    if (cid) p.claim = cid;
    return p;
  }
  function wrapNT() {
    var NT = window.NT; if (!NT || typeof NT.fromRow !== 'function') return false; if (NT.fromRow.__bkrt) return true;
    var fr = NT.fromRow;
    NT.fromRow = function (n) {
      var it = fr.apply(this, arguments), id = n && n.ref_table === 'bookings' ? uuid(n.ref_id) : null;
      if (!id && n && n.link && n.link.params) id = uuid(n.link.params.bkid);
      if (id && it) {
        var lp = (n.link && n.link.params) || {};
        var cid = lp.claim || (it.go && it.go[1] && it.go[1].claim) || null;
        it.go = ['dashboard', paramsFor(id, cid)];
        if (lp.bktab) it.go[1].bktab = lp.bktab;
      }
      return it;
    };
    NT.fromRow.__bkrt = 1;
    if (typeof NT.open === 'function' && !NT.open.__bkrt) {
      var op = NT.open;
      NT.open = function (it) {
        var g1 = (it && it.go && it.go[1]) || {};
        var id = uuid(g1.bkid) || (it && it.row && it.row.ref_table === 'bookings' ? uuid(it.row.ref_id) : null);
        if (!id || g1.claim) {
          if (id && !g1.bktab) it.go = ['dashboard', Object.assign({}, g1, { bkid: id, bktab: g1.claim ? 'proof' : 'det' })];
          return op.apply(this, arguments);
        }
        return claimFor(id).then(function (cid) {
          it.go = ['dashboard', paramsFor(id, cid)];
          return op.call(NT, it);
        }, function () {
          it.go = ['dashboard', paramsFor(id, null)];
          return op.call(NT, it);
        });
      };
      NT.open.__bkrt = 1;
    }
    return true;
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
  function insertBell(b, msg, when, cid, silent) {
    var NT = window.NT, id = uuid(b && b.id);
    if (!(NT && NT.on && id && NT.tid() && NT.uid())) {
      if (!silent && typeof _notifPushBell === 'function') _notifPushBell(msg, when);
      return Promise.resolve();
    }
    var params = paramsFor(id, cid);
    return sb.from('notifications').insert({
      tenant_id: NT.tid(), user_id: NT.uid(), actor_id: null,
      title: String(msg || '').slice(0, 200), body: String(when || '').slice(0, 500),
      category: cid ? 'sales' : 'self', kind: cid ? 'action' : 'for_you',
      type: cid ? 'sales.booking_receipt' : 'assigned.booking',
      priority: cid ? 2 : 0,
      ref_table: cid ? 'payment_claims' : 'bookings', ref_id: cid || id,
      link: { page: 'dashboard', params: params, icon: cid ? 'ti-receipt' : 'ti-calendar-plus' }
    }).then(function () { if (NT.refresh) NT.refresh(); }, function () {});
  }
  function pushBell(b, msg, when, silent) {
    var id = uuid(b && b.id);
    if (!id) return;
    claimFor(id, b && b.invoice_id).then(function (cid) {
      insertBell(b, msg, when, cid, silent);
      if (silent) return;
      if (typeof _notifOsNotify === 'function') {
        try { _notifOsNotify('New booking', (b.customer_name || 'Customer') + ' · ' + when); } catch (e) {}
      } else if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try { new Notification('New booking', { body: (b.customer_name || 'Customer') + ' · ' + when }); } catch (e) {}
      }
    });
  }
  function handleNewBooking(b, silent) {
    if (!b) return;
    var name = b.customer_name || 'Customer';
    var when = fmt(b.starts_at);
    var msg = 'New booking: ' + name;
    function fire() {
      if (!silent) {
        if (typeof showToast === 'function') showToast(msg, 'success');
        beep();
      }
      pushBell(b, msg, when, silent);
      if (!silent && typeof loadNotifications === 'function') try { loadNotifications(); } catch (e) {}
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
  function catchUpNew() {
    var NT = window.NT;
    if (!window.sb || !APP.tenant || !NT || !NT.uid || !NT.uid()) return;
    var since = new Date(Date.now() - 36 * 3600 * 1000).toISOString();
    sb.from('bookings').select('id,customer_name,starts_at,invoice_id,created_at,status')
      .eq('tenant_id', APP.tenant.id).in('status', ['hold', 'pending_payment'])
      .gte('created_at', since).order('created_at', { ascending: false }).limit(15)
      .then(function (r) {
        (r.data || []).forEach(function (b) {
          var id = uuid(b.id); if (!id) return;
          sb.from('notifications').select('id').eq('tenant_id', APP.tenant.id).eq('user_id', NT.uid())
            .eq('ref_table', 'bookings').eq('ref_id', id).limit(1)
            .then(function (n) {
              if (n.data && n.data.length) return;
              handleNewBooking(b, true);
            }, function () {});
        });
      }, function () {});
  }
  function catchUpClaims() {
    var NT = window.NT;
    if (!window.sb || !APP.tenant || !NT || !NT.uid || !NT.uid()) return;
    sb.from('pay_settings').select('bk_n_receipt,bk_n_who').eq('tenant_id', APP.tenant.id).maybeSingle().then(function (ps) {
      if (ps.data && ps.data.bk_n_receipt === false) return;
      var who = (ps.data && ps.data.bk_n_who) || 'owner_admin';
      sb.from('payment_claims').select('id,invoice_id,amount').eq('tenant_id', APP.tenant.id)
        .eq('status', 'pending').is('notified_at', null).is('deleted_at', null).limit(8)
        .then(function (r) {
          (r.data || []).forEach(function (c) {
            sb.from('bookings').select('id,quote_ref,customer_name').eq('tenant_id', APP.tenant.id).eq('invoice_id', c.invoice_id).limit(1)
              .then(function (b) {
                var bk = (b.data || [])[0]; if (!bk) return;
                sb.from('payment_claims').update({ notified_at: new Date().toISOString() }).eq('id', c.id).is('notified_at', null).select('id')
                  .then(function (u) {
                    if (!u.data || !u.data.length) return;
                    var roles = who === 'owner' ? ['owner'] : ['owner', 'admin'];
                    sb.from('user_profiles').select('id,role,language').eq('tenant_id', APP.tenant.id)
                      .then(function (ur) {
                        var rows = (ur.data || []).filter(function (x) { return roles.indexOf(String(x.role || '').toLowerCase()) >= 0; }).map(function (x) {
                          var bm = x.language === 'bm';
                          return {
                            tenant_id: APP.tenant.id, user_id: x.id, actor_id: null,
                            title: (bm ? 'Resit bayaran tempahan untuk disemak' : 'Booking payment receipt to review').slice(0, 200),
                            body: ([bk.quote_ref, bk.customer_name, 'RM ' + (Number(c.amount) || 0).toFixed(2)].filter(Boolean).join(' · ')).slice(0, 500),
                            category: 'sales', kind: 'action', type: 'sales.booking_receipt', priority: 2,
                            ref_table: 'payment_claims', ref_id: c.id,
                            link: { page: 'dashboard', params: paramsFor(bk.id, c.id), icon: 'ti-receipt' }
                          };
                        });
                        if (rows.length) sb.from('notifications').insert(rows).then(function () { if (NT.refresh) NT.refresh(); }, function () {});
                      }, function () {});
                  }, function () {});
              }, function () {});
          });
        }, function () {});
    }, function () {});
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
    catchUpNew();
    catchUpClaims();
    setInterval(catchUpNew, 90000);
    setInterval(catchUpClaims, 45000);
  }
  function boot() {
    if (APP && APP.tenant) watchNewBookings();
  }
  setInterval(boot, 1500);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
