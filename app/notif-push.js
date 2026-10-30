/* M-Core phone alerts P2 — Web Push client (i18n: LANG.*.notifPush). Inert until supabase/push_01.sql has run
   (feature-detects push_subscriptions). Subscribe/sync this device, device list, soft-delete remove, server-routed
   test, flush after app inserts notifications, deep links from notification taps (?nt= / ?ntp= / ?page=). */
(function () {
  var NT = window.NT; if (!NT || NT.push) return;
  var P = NT.push = { on: false, probed: null };
  P.KEY = 'BKWe51JAjBhp9fPZQ9AYQq_BSiTMFE4cuyT8DwwRBe9-4JyfKutEyVyxiFkjcEj5_3kCXXsJNAnKWmGgOEptflo';
  var K = {
    en: { phoneT: 'Phone alerts', stUnsup: 'This browser cannot show phone alerts', stIos: 'On iPhone, add M-Core to the Home Screen first', stDenied: 'Blocked in browser settings. Allow notifications for this site, then reload.',
      stDefault: 'Not allowed on this device yet', stLocal: 'Allowed · alerts show only while M-Core is open', stOff: 'Allowed · phone push is off on this device', stOn: 'Active · alerts arrive even when M-Core is closed',
      pushOn: 'Turn on push', pushOff: 'Turn off', test: 'Send test', testLocal: 'Test shown on this device', testSrv: 'Test sent to {n} device(s)', testNone: 'No active device. Turn on push first.',
      testFail: 'Test could not be delivered', testBlocked: 'Allow notifications first', subOk: 'Phone push is on for this device', subFail: 'Could not turn on push on this device', subSupport: 'Exit Support first, then turn on push on your own account', subOff: 'Phone push is off for this device',
      supHint: 'Push registers to your own account (not the Support client)',
      devices: 'Devices', devicesD: 'Phones and browsers that receive your alerts', thisDev: 'This device', lastActive: 'Last active', remove: 'Remove', removed: 'Device removed', noDev: 'No devices yet',
      iosT: 'Get alerts on iPhone', ios1: 'Open M-Core in Safari', ios2: 'Tap Share, then Add to Home Screen', ios3: 'Open M-Core from the Home Screen icon', ios4: 'Come back to this page and tap Allow', iosN: 'Needs iOS 16.4 or later.', guide: 'How to',
      rtTitle: 'Phone alert routing', rtD: 'Which roles get phone alerts for each type. Default: all roles, as set in their own settings.', rtAll: 'All roles',
      esc: 'Urgent escalation', escD: 'Telegram the platform admin when an urgent request is not picked up within', min: 'minutes', escOff: '0 = off', rtSave: 'Save routing', rtSaved: 'Routing saved', rtFail: 'Could not save routing' },
    bm: { phoneT: 'Amaran telefon', stUnsup: 'Pelayar ini tidak boleh papar amaran telefon', stIos: 'Di iPhone, tambah M-Core ke Skrin Utama dahulu', stDenied: 'Disekat dalam tetapan pelayar. Benarkan pemberitahuan untuk laman ini, kemudian muat semula.',
      stDefault: 'Belum dibenarkan pada peranti ini', stLocal: 'Dibenarkan · amaran hanya keluar semasa M-Core dibuka', stOff: 'Dibenarkan · push telefon dimatikan pada peranti ini', stOn: 'Aktif · amaran sampai walaupun M-Core ditutup',
      pushOn: 'Hidupkan push', pushOff: 'Matikan', test: 'Hantar ujian', testLocal: 'Ujian dipaparkan pada peranti ini', testSrv: 'Ujian dihantar ke {n} peranti', testNone: 'Tiada peranti aktif. Hidupkan push dahulu.',
      testFail: 'Ujian tidak dapat dihantar', testBlocked: 'Benarkan pemberitahuan dahulu', subOk: 'Push telefon dihidupkan untuk peranti ini', subFail: 'Tidak dapat hidupkan push pada peranti ini', subSupport: 'Keluar Support dulu, kemudian hidupkan push pada akaun sendiri', subOff: 'Push telefon dimatikan untuk peranti ini',
      supHint: 'Push didaftarkan ke akaun anda sendiri (bukan klien Support)',
      devices: 'Peranti', devicesD: 'Telefon dan pelayar yang menerima amaran anda', thisDev: 'Peranti ini', lastActive: 'Aktif terakhir', remove: 'Buang', removed: 'Peranti dibuang', noDev: 'Belum ada peranti',
      iosT: 'Dapatkan amaran di iPhone', ios1: 'Buka M-Core dalam Safari', ios2: 'Tekan Kongsi, kemudian Tambah ke Skrin Utama', ios3: 'Buka M-Core dari ikon Skrin Utama', ios4: 'Kembali ke halaman ini dan tekan Benarkan', iosN: 'Perlu iOS 16.4 atau lebih baharu.', guide: 'Cara',
      rtTitle: 'Laluan amaran telefon', rtD: 'Peranan yang menerima amaran telefon bagi setiap jenis. Lalai: semua peranan, ikut tetapan masing-masing.', rtAll: 'Semua peranan',
      esc: 'Eskalasi segera', escD: 'Telegram admin platform jika permintaan segera tidak diambil dalam', min: 'minit', escOff: '0 = mati', rtSave: 'Simpan laluan', rtSaved: 'Laluan disimpan', rtFail: 'Tidak dapat simpan laluan' }
  };
  try { ['en', 'bm'].forEach(function (lg) { if (!LANG[lg]) return; var o = LANG[lg].notifPush = LANG[lg].notifPush || {}; Object.keys(K[lg]).forEach(function (k) { if (!(k in o)) o[k] = K[lg][k]; }); }); } catch (e) {}
  P.T = function (k, n) { var lg = (window.APP && APP.language === 'bm') ? 'bm' : 'en', d = null; try { d = LANG[lg].notifPush; } catch (e) {} return String((d && d[k]) || K[lg][k] || K.en[k] || k).replace('{n}', n == null ? '' : n); };
  var nav = navigator, ua = String(nav.userAgent || '');
  P.ios = function () { return /iPad|iPhone|iPod/.test(ua) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1); };
  P.standalone = function () { try { return !!(nav.standalone || matchMedia('(display-mode: standalone)').matches); } catch (e) { return false; } };
  P.canPush = function () { return 'serviceWorker' in nav && 'PushManager' in window; };
  /* unsupported | ios | denied | default | granted */
  P.perm = function () {
    if (typeof Notification === 'undefined' || !('serviceWorker' in nav)) return P.ios() && !P.standalone() ? 'ios' : 'unsupported';
    if (P.ios() && !P.standalone()) return 'ios';
    return Notification.permission;
  };
  P.probe = function (force) {
    if (P.probed && !force) return P.probed;
    return (P.probed = Promise.resolve(sb.from('push_subscriptions').select('id').limit(1)).then(function (r) { P.on = !r.error; return P.on; }, function () { P.on = false; return false; }));
  };
  P.reg = function () {
    if (!('serviceWorker' in nav)) return Promise.resolve(null);
    var ready = nav.serviceWorker.getRegistration('./').then(function (ex) {
      return (ex ? Promise.resolve(ex) : nav.serviceWorker.register('./sw.js?v=16')).then(function () { return nav.serviceWorker.ready; });
    }).catch(function () { return null; });
    return Promise.race([ready, new Promise(function (r) { setTimeout(function () { r(null); }, 12000); })]);
  };
  P.current = function () { return P.reg().then(function (r) { return r && r.pushManager ? r.pushManager.getSubscription() : null; }).catch(function () { return null; }); };
  function u8(b64) { var s = (b64 + '===='.slice((b64.length % 4) || 4)).replace(/-/g, '+').replace(/_/g, '/'), raw = atob(s), a = new Uint8Array(raw.length); for (var i = 0; i < raw.length; i++) a[i] = raw.charCodeAt(i); return a; }
  P.label = function () {
    var os = /Android/.test(ua) ? 'Android' : P.ios() ? 'iPhone/iPad' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'Device';
    var br = /Edg\//.test(ua) ? 'Edge' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
    return os + ' · ' + br + (P.standalone() ? ' (app)' : '');
  };
  /* PA Support switches APP.tenant; push_subscriptions RLS needs user_profiles.tenant_id (home). */
  P.inSupport = function () {
    try {
      if (window.PAE && PAE.inSupport && PAE.inSupport()) return true;
      if (document.getElementById('support-tenant-banner')) return true;
      if (sessionStorage.getItem('mcore_support_session')) return true;
    } catch (e) {}
    return false;
  };
  P.homeTid = function () {
    if (P._homeTid) return Promise.resolve(P._homeTid);
    try {
      var ut = window.APP && APP.user && (APP.user.tenant_id || APP.user.tenantId);
      if (ut) { P._homeTid = ut; return Promise.resolve(ut); }
    } catch (e) {}
    if (!P.inSupport() && NT.tid()) { P._homeTid = NT.tid(); return Promise.resolve(P._homeTid); }
    if (!NT.uid()) return Promise.resolve(null);
    return Promise.resolve(sb.from('user_profiles').select('tenant_id').eq('id', NT.uid()).maybeSingle())
      .then(function (r) {
        var t = r && r.data && r.data.tenant_id;
        if (t) P._homeTid = t;
        return t || null;
      }, function () { return null; });
  };
  P.save = function (sub) {
    var j = sub.toJSON ? sub.toJSON() : sub, k = j.keys || {}, now = new Date().toISOString();
    if (!NT.uid() || !j.endpoint || !k.p256dh || !k.auth) return Promise.resolve(false);
    return P.homeTid().then(function (tid) {
      if (!tid) return false;
      return Promise.resolve(sb.from('push_subscriptions').upsert({ tenant_id: tid, user_id: NT.uid(), endpoint: j.endpoint, p256dh: k.p256dh, auth: k.auth, device_label: P.label(), ua: ua.slice(0, 380),
        platform: P.ios() ? 'ios' : /Android/.test(ua) ? 'android' : 'desktop', lang: APP.language === 'bm' ? 'bm' : 'en', last_seen_at: now, deleted_at: null, fail_count: 0 }, { onConflict: 'user_id,endpoint' }))
        .then(function (r) { return !r.error; }, function () { return false; });
    });
  };
  /* { ok, reason } — reason is i18n key when not ok */
  P.subscribe = function () {
    if (!P.canPush() || P.perm() !== 'granted') return Promise.resolve({ ok: false, reason: 'subFail' });
    var inS = P.inSupport();
    return P.homeTid().then(function (ht) {
      if (inS && !ht) return { ok: false, reason: 'subSupport' };
      return P.probe().then(function (on) {
        if (!on) return { ok: false, reason: 'subFail' };
        return P.reg().then(function (r) {
          if (!r || !r.pushManager) return { ok: false, reason: 'subFail' };
          try { localStorage.removeItem('mcore_push_off_' + NT.uid()); } catch (e) {}
          return r.pushManager.getSubscription().then(function (s) { return s || r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: u8(P.KEY) }); })
            .then(function (s) { return P.save(s); })
            .then(function (ok) {
              if (ok) return { ok: true };
              return { ok: false, reason: (inS && !P._homeTid) ? 'subSupport' : 'subFail' };
            });
        });
      });
    }).catch(function () { return { ok: false, reason: 'subFail' }; });
  };
  /* this device's row (active), or null */
  P.mine = function () {
    return P.current().then(function (s) {
      if (!s || !P.on) return null;
      return P.homeTid().then(function (tid) {
        if (!tid) return null;
        return Promise.resolve(sb.from('push_subscriptions').select('id').eq('user_id', NT.uid()).eq('tenant_id', tid).eq('endpoint', s.endpoint).is('deleted_at', null).limit(1)).then(function (r) { return (r && r.data && r.data[0]) || null; }, function () { return null; });
      });
    });
  };
  P.state = function () {
    var p = P.perm(); if (p !== 'granted') return Promise.resolve(p);
    if (!P.canPush()) return Promise.resolve('local');
    return P.probe().then(function (on) { return on ? P.mine().then(function (m) { return m ? 'on' : 'off'; }) : 'local'; });
  };
  P.devices = function () {
    return P.homeTid().then(function (tid) {
      if (!tid) return [];
      return Promise.resolve(sb.from('push_subscriptions').select('id,device_label,platform,last_seen_at,last_ok_at,endpoint').eq('tenant_id', tid).eq('user_id', NT.uid()).is('deleted_at', null).order('last_seen_at', { ascending: false }).limit(20))
        .then(function (r) { return (r && r.data) || []; }, function () { return []; });
    });
  };
  P.remove = function (id) {
    return P.homeTid().then(function (tid) {
      if (!tid) return false;
      return Promise.resolve(sb.from('push_subscriptions').update({ deleted_at: new Date().toISOString() }).eq('id', id).eq('user_id', NT.uid()).eq('tenant_id', tid)).then(function (r) { return !r.error; }, function () { return false; });
    });
  };
  /* turn off on this device: soft delete row; keep browser permission */
  P.off = function (keep) { try { if (!keep) localStorage.setItem('mcore_push_off_' + NT.uid(), '1'); } catch (e) {} return P.mine().then(function (m) { return m ? P.remove(m.id) : true; }); };
  P.invoke = function (body) {
    return Promise.resolve(sb.functions.invoke('push-send', { body: body })).then(function (r) { return r && !r.error ? (r.data || {}) : null; }, function () { return null; });
  };
  P.test = function (subId) { return P.invoke(subId ? { action: 'test', sub_id: subId } : { action: 'test' }); };
  var ft = null;
  P.flush = function () { if (!P.on) return; clearTimeout(ft); ft = setTimeout(function () { P.invoke({ action: 'flush' }); }, 1500); };
  P.sync = function () {
    if (!NT.uid()) return Promise.resolve();
    return P.probe(true).then(function (on) {
      if (!on || !P.canPush() || P.perm() !== 'granted') return;
      return P.current().then(function (s) {
        if (!s) return;
        var key = 'mcore_push_sync_' + NT.uid(), off = false, fresh = false;
        try { off = localStorage.getItem('mcore_push_off_' + NT.uid()) === '1'; fresh = Date.now() - (+localStorage.getItem(key) || 0) < 6 * 36e5; } catch (e) {}
        return P.mine().then(function (m) {
          if ((m && fresh) || (!m && off)) return;
          return P.save(s).then(function () { try { localStorage.setItem(key, String(Date.now())); } catch (e) {} });
        });
      });
    });
  };
})();
