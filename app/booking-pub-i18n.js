/* Public booking page (?book=TOKEN) - EN/BM toggle + text keys. Display only: rewrites the visible text that booking.js
   renders (EN, or BM in staff-pick mode) to the chosen language. Default: ?lang=, else the browser's saved app language
   (nexerp_lang), else browser ms->BM, else EN (current page). Free services (RM 0) read as booked, as booking-free-confirm.js does. v1 */
(function () {
  if (window.BKP || !/[?&]book=/.test(location.search)) return;
  var q = new URLSearchParams(location.search).get('lang'), cur = q === 'bm' || q === 'en' ? q : null;
  if (!cur) { try { cur = localStorage.getItem('nexerp_lang'); } catch (e) {} }
  if (cur !== 'bm' && cur !== 'en') cur = /^ms/i.test(navigator.language || '') ? 'bm' : 'en';
  var P = [
    ['Booking', 'Tempahan'], ['Book a slot', 'Tempah slot'], ['Date', 'Tarikh'], ['Staff', 'Staf'],
    ['Loading booking…', 'Memuatkan tempahan…'], ['Booking unavailable', 'Tempahan tidak tersedia'],
    ['No services open yet.', 'Tiada servis dibuka lagi.'], ['No slot', 'Tiada slot'],
    ['No staff assigned yet.', 'Tiada staf ditugaskan lagi.'], ['Pick a staff member, then a service and time.', 'Pilih staf, kemudian servis dan masa.'],
    ['No services for this staff.', 'Tiada servis untuk staf ini.'], ['Add-ons', 'Tambahan'], ['Cancel', 'Batal'],
    ['Confirm hold', 'Tahan slot'], ['Confirm booking', 'Sahkan tempahan'], ['Held', 'Ditahan'], ['Booked', 'Ditempah'],
    ['Pay invoice', 'Bayar invois'], ['Tenant will confirm payment.', 'Peniaga akan mengesahkan bayaran.'],
    ['Slot confirmed. No payment required.', 'Slot disahkan. Tiada bayaran diperlukan.']
  ];
  var K = {
    unavail: ['Unavailable', 'Tidak tersedia'], phold: ['Awaiting payment', 'Menunggu bayaran'], pconf: ['Confirmed', 'Disahkan'],
    'Full name': ['Full name', 'Nama penuh'], 'Nama penuh': ['Full name', 'Nama penuh'], Email: ['Email', 'E-mel'], 'E-mel': ['Email', 'E-mel'], Phone: ['Phone', 'Telefon'], Telefon: ['Phone', 'Telefon']
  };
  var RX = [
    { e: /^Slot held (\d+) min until payment\.$/, b: /^Slot ditahan (\d+) minit sehingga bayaran\.$/, E: function (m) { return 'Slot held ' + m[1] + ' min until payment.'; }, B: function (m) { return 'Slot ditahan ' + m[1] + ' minit sehingga bayaran.'; } },
    { p: function (el) { return el.tagName === 'H3' && el.closest('#bk-form'); }, e: /^Book (.+)$/, b: /^Tempah (.+)$/, E: function (m) { return 'Book ' + m[1]; }, B: function (m) { return 'Tempah ' + m[1]; } },
    { p: function (el) { return el.classList.contains('bk-slot'); }, e: /^(.+) · full$/, b: /^(.+) · penuh$/, E: function (m) { return m[1] + ' · full'; }, B: function (m) { return m[1] + ' · penuh'; } },
    { p: function (el) { return el.classList.contains('bkp-meta'); }, e: /^(.*· \d+) min( ·.*)?$/, b: /^(.*· \d+) minit( ·.*)?$/, E: function (m) { return m[1] + ' min' + (m[2] || ''); }, B: function (m) { return m[1] + ' minit' + (m[2] || ''); } }
  ];
  var MAP = {}; P.forEach(function (p) { MAP[p[0]] = p; MAP[p[1]] = p; });
  var price = null;
  function pick(p) { return cur === 'bm' ? p[1] : p[0]; }
  function conv(s, el) {
    var p = MAP[s]; if (p) return pick(p);
    for (var i = 0; i < RX.length; i++) {
      var r = RX[i]; if (r.p && !r.p(el)) continue;
      var m = s.match(r.e) || s.match(r.b); if (m) return cur === 'bm' ? r.B(m) : r.E(m);
    }
    return s;
  }
  var HOLD = /^(Slot held \d+ min until payment\.|Slot ditahan \d+ minit sehingga bayaran\.)$/;
  function freeFix(root) {
    var f = root.querySelector('#bk-form');
    if (f) {
      price = null;
      f.querySelectorAll('p').forEach(function (p) { var m = (p.textContent || '').match(/RM\s*(\d+(?:\.\d+)?)/i); if (m && price == null) price = Number(m[1]); });
      if (price != null && price <= 0) f.querySelectorAll('button[type=submit]').forEach(function (b) { var t = b.textContent.trim(); if (t === 'Confirm hold' || t === 'Tahan slot') b.textContent = pick(MAP['Confirm booking']); });
      return;
    }
    if (price == null || price > 0) return;
    root.querySelectorAll('.bkp-modal h3').forEach(function (h) {
      var t = h.textContent.trim(); if (t === 'Held' || t === 'Ditahan') h.textContent = pick(MAP.Booked);
      Array.prototype.forEach.call(h.parentNode.querySelectorAll('p'), function (p) {
        var s = p.textContent.trim();
        if (HOLD.test(s)) p.textContent = pick(MAP['Slot confirmed. No payment required.']);
        else if (MAP[s] === MAP['Tenant will confirm payment.'] || p.querySelector('a.bkp-pay')) p.classList.add('bkp-hide');
      });
      var pill = h.parentNode.querySelector('.bkp-pill'); if (pill) { pill.className = 'bkp-pill ok'; pill.setAttribute('data-bkp-k', 'pconf'); }
    });
  }
  function tr(root) {
    freeFix(root);
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), n, list = [];
    while ((n = w.nextNode())) list.push(n);
    list.forEach(function (t) {
      var el = t.parentNode; if (!el || el.closest('.bkp-foot, .bkp-top, [data-bkp-k]')) return;
      var v = t.nodeValue, s = v.trim(); if (!s) return;
      var o = conv(s, el); if (o !== s) { var nv = v.replace(s, o); if (nv !== v) t.nodeValue = nv; }
    });
    root.querySelectorAll('[data-bkp-k]').forEach(function (el) { var k = K[el.getAttribute('data-bkp-k')]; if (k && el.textContent !== pick(k)) el.textContent = pick(k); });
    root.querySelectorAll('input[placeholder]').forEach(function (i) { var k = K[i.getAttribute('placeholder')]; if (k && i.getAttribute('placeholder') !== pick(k)) i.setAttribute('placeholder', pick(k)); });
    root.querySelectorAll('a.bkp-pay').forEach(function (a) { try { var u = new URL(a.href); if (u.searchParams.get('lang') !== cur) { u.searchParams.set('lang', cur); a.href = u.toString(); } } catch (e) {} });
    document.documentElement.lang = cur === 'bm' ? 'ms' : 'en';
  }
  window.BKP = {
    lang: function () { return cur; },
    set: function (l) {
      cur = l === 'bm' ? 'bm' : 'en';
      try { var u = new URL(location.href); u.searchParams.set('lang', cur); history.replaceState(history.state, '', u); } catch (e) {}
      if (window._bkpRun) window._bkpRun();
    },
    tr: tr
  };
})();
