/* M-Core phone alerts — Notification settings: real permission/push status, Allow / Turn on push / honest Send test,
   iPhone Add to Home Screen guide, device list (Test / Remove). Wraps NT.settingsPage; notif-settings.js untouched. */
(function () {
  var NT = window.NT; if (!NT || !NT.push || !NT.settingsPage || NT.settingsPage.__push) return;
  var P = NT.push, T = P.T, esc = NT.esc, base = NT.settingsPage;
  try { if (!document.getElementById('nt-push-css')) { var st = document.createElement('style'); st.id = 'nt-push-css';
    st.textContent = '.nt-pbtns{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}.nt-pbtns .btn{min-height:36px}.nt-pst-on{color:var(--text);font-weight:600}.nt-pst-bad{color:var(--text);font-weight:600}' +
      '.nt-pios{margin:10px 0 0;padding-left:20px;font-size:13px;line-height:1.6;color:var(--text)}.nt-pios li{margin:2px 0}.nt-pdev{margin-top:12px;padding-top:10px;border-top:1px solid var(--border)}' +
      '.nt-pdev .nt-row{padding:8px 0;flex-wrap:wrap;gap:8px}.nt-pdev .nt-row+.nt-row{border-top:1px solid var(--border)}.nt-pdev .nt-bd{min-width:0;flex:1 1 160px}.nt-pdev b{overflow-wrap:anywhere}';
    document.head.appendChild(st); } } catch (e) {}
  function when(t) { if (!t) return '-'; try { return new Date(t).toLocaleString(APP.language === 'bm' ? 'ms-MY' : 'en-MY', { timeZone: 'Asia/Kuala_Lumpur', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return String(t).slice(0, 16); } }
  function toast(k, kind, n) { try { showToast(T(k, n), kind); } catch (e) {} }
  var MSG = { unsupported: 'stUnsup', ios: 'stIos', denied: 'stDenied', 'default': 'stDefault', local: 'stLocal', off: 'stOff', on: 'stOn' };
  function paint(card) {
    return P.state().then(function (st) {
      if (!card.isConnected) return;
      card.dataset.st = st;
      var cls = st === 'on' ? ' nt-pst-on' : (st === 'denied' || st === 'unsupported') ? ' nt-pst-bad' : '';
      var btn = function (a, k, pri) { return '<button type="button" class="btn btn-sm ' + (pri ? 'btn-primary' : 'btn-outline') + '" data-pa="' + a + '">' + esc(T(k)) + '</button>'; };
      var b = '';
      if (st === 'default') b += btn('allow', 'allow', 1);
      if (st === 'off') b += btn('sub', 'pushOn', 1);
      if (st === 'on') b += btn('unsub', 'pushOff');
      if (st === 'ios') b += btn('guide', 'guide', 1);
      b += btn('test', 'test');
      var ios = '<div class="nt-pios-w"' + (st === 'ios' ? '' : ' hidden') + '><b style="display:block;margin-top:10px">' + esc(T('iosT')) + '</b><ol class="nt-pios"><li>' + esc(T('ios1')) + '</li><li>' + esc(T('ios2')) + '</li><li>' + esc(T('ios3')) + '</li><li>' + esc(T('ios4')) + '</li></ol><div class="nt-m">' + esc(T('iosN')) + '</div></div>';
      card.innerHTML = '<div class="nt-row"><i class="ti ti-device-mobile nt-big"></i><div class="nt-bd"><b>' + esc(T('phoneT')) + '</b><div class="nt-m' + cls + '" id="nt-push-st" role="status" aria-live="polite">' + esc(T(MSG[st] || 'stDefault')) + '</div></div></div>' +
        '<div class="nt-pbtns">' + b + '</div>' + ios + (P.on ? '<div class="nt-pdev" id="nt-pdev"></div>' : '');
      wire(card);
      if (P.on) devices(card);
    });
  }
  function allowLabel() { try { return (LANG[APP.language === 'bm' ? 'bm' : 'en'].notifSet || {}).allow; } catch (e) { return ''; } }
  T = function (k, n) { return k === 'allow' ? (allowLabel() || (APP.language === 'bm' ? 'Benarkan' : 'Allow')) : P.T(k, n); };
  function devices(card) {
    var box = card.querySelector('#nt-pdev'); if (!box) return;
    Promise.all([P.devices(), P.current()]).then(function (r) {
      var list = r[0], cur = r[1] && r[1].endpoint;
      box.innerHTML = '<div class="nt-bd"><b>' + esc(T('devices')) + '</b><div class="nt-m">' + esc(T('devicesD')) + '</div></div>' +
        (list.length ? list.map(function (d) {
          var me = cur && String(d.endpoint) === String(cur);
          return '<div class="nt-row"><i class="ti ' + (d.platform === 'desktop' ? 'ti-device-desktop' : 'ti-device-mobile') + '" aria-hidden="true"></i><div class="nt-bd"><b>' + esc(d.device_label || 'Device') + '</b>' +
            '<div class="nt-m">' + (me ? esc(T('thisDev')) + ' · ' : '') + esc(T('lastActive')) + ': ' + esc(when(d.last_seen_at)) + '</div></div>' +
            '<button type="button" class="btn btn-sm btn-outline" data-dt="' + esc(d.id) + '">' + esc(T('test')) + '</button><button type="button" class="btn btn-sm btn-outline" data-dr="' + esc(d.id) + '">' + esc(T('remove')) + '</button></div>';
        }).join('') : '<div class="nt-m" style="margin-top:6px">' + esc(T('noDev')) + '</div>');
      box.querySelectorAll('[data-dt]').forEach(function (b) { b.onclick = function () { b.disabled = true; srvTest(b.dataset.dt).then(function () { b.disabled = false; }); }; });
      box.querySelectorAll('[data-dr]').forEach(function (b) { b.onclick = function () {
        b.disabled = true; var id = b.dataset.dr, mine = list.some(function (d) { return String(d.id) === String(id) && cur && String(d.endpoint) === String(cur); });
        P.remove(id).then(function (ok) { if (ok && mine) { try { localStorage.setItem('mcore_push_off_' + NT.uid(), '1'); } catch (e) {} } toast(ok ? 'removed' : 'rtFail', ok ? 'success' : 'error'); paint(card); });
      }; });
    });
  }
  function srvTest(id) {
    return P.test(id).then(function (r) {
      if (!r || r.ok === false) return toast('testFail', 'error');
      if (r.sent > 0) return toast('testSrv', 'success', r.sent);
      if (!r.subs) return toast('testNone', 'warning');
      toast('testFail', 'error');
    });
  }
  function test(card) {
    var st = card.dataset.st;
    if (st !== 'local' && st !== 'off' && st !== 'on') { toast('testBlocked', 'warning'); return Promise.resolve(); }
    if (st === 'on') return srvTest(null);
    return Promise.resolve(window._notifOsNotify ? window._notifOsNotify('M-Core · ' + T('test'), T('testLocal'), true) : false).then(function (ok) { toast(ok ? 'testLocal' : 'testFail', ok ? 'success' : 'error'); });
  }
  function wire(card) {
    card.querySelectorAll('[data-pa]').forEach(function (b) { b.onclick = function () {
      var a = b.dataset.pa; b.disabled = true; var done = function () { b.disabled = false; return paint(card); };
      if (a === 'guide') { var g = card.querySelector('.nt-pios-w'); if (g) g.hidden = !g.hidden; b.disabled = false; return; }
      if (a === 'test') return test(card).then(function () { b.disabled = false; });
      if (a === 'allow') return Promise.resolve(typeof _notifRequestOsPermission === 'function' ? _notifRequestOsPermission() : (typeof Notification !== 'undefined' ? Notification.requestPermission() : null))
        .then(function () { return P.perm() === 'granted' && P.canPush() ? P.probe().then(function (on) { return on && P.subscribe(); }) : null; }).then(done, done);
      if (a === 'sub') return P.subscribe().then(function (ok) { toast(ok ? 'subOk' : 'subFail', ok ? 'success' : 'error'); return done(); }, done);
      if (a === 'unsub') return P.off().then(function () { toast('subOff', 'success'); return done(); }, done);
    }; });
  }
  NT.settingsPage = function (m) {
    var r = base.apply(this, arguments);
    try {
      var os = m.querySelector('[data-os]'), row = os && os.closest('.nt-row'); if (row) row.remove();
      var cards = m.querySelectorAll('.nt-card'), card = document.createElement('div');
      card.className = 'nt-card nt-pad'; card.id = 'nt-push';
      if (cards[0] && cards[0].nextSibling) cards[0].parentNode.insertBefore(card, cards[0].nextSibling); else (m.querySelector('.nt-page') || m).appendChild(card);
      card.innerHTML = '<div class="nt-row"><i class="ti ti-device-mobile nt-big"></i><div class="nt-bd"><b>' + esc(T('phoneT')) + '</b><div class="nt-m">…</div></div></div>';
      P.probe().then(function () { paint(card); });
      if (NT.pushAdmin) NT.pushAdmin(m);
    } catch (e) {}
    return r;
  };
  NT.settingsPage.__push = 1;
})();
