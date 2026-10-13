/* M-Core Service Desk - Public Link owner settings ('Servis Saya' › 'Link awam'): on/off, copy, scannable QR + PNG, reset,
   allowed services (contracted only), monthly link quota, optional expiry. Owner/admin only (RLS). Hidden if table missing. */
(function () {
  var SD = window.SD; if (!SD || SD._pubOwner) return; SD._pubOwner = 1;
  SD.pub = { ok: null, link: null, used: 0, pending: [] };
  var st = document.createElement('style'); st.textContent = '.sd-pubg{grid-template-columns:minmax(0,1fr)!important}@media(min-width:1101px){.sd-pubg{grid-template-columns:minmax(0,1fr) 420px!important}}.sd-pubg>div,.sd-pubg .cob-card,.sd-pubg .row>.grow{min-width:0}.sd-pubq{display:flex;gap:14px;flex-wrap:wrap;align-items:center}@media(max-width:640px){.sd-pubq{flex-direction:column;align-items:stretch}.sd-pubq>#pl-qr{align-self:center}.sd-pubq>.grow{min-width:0!important;width:100%}}'; document.head.appendChild(st);
  var QRLIB = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js';
  SD.pubProbe = function () {
    if (SD.pub.ok != null) return Promise.resolve(SD.pub.ok);
    return Promise.resolve(sb.from('service_public_links').select('id', { count: 'exact', head: true }).limit(1)).then(function (r) { SD.pub.ok = !!(r && !r.error); return SD.pub.ok; }, function () { SD.pub.ok = false; return false; });
  };
  SD.pubUrl = function (tok) { return location.origin + location.pathname.replace(/[^/]*$/, '') + '?service_link=' + encodeURIComponent(tok); };
  function hex(s) { return crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)).then(function (b) { return Array.prototype.map.call(new Uint8Array(b), function (x) { return x.toString(16).padStart(2, '0'); }).join(''); }); }
  function tok() { var a = new Uint8Array(20), c = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'; crypto.getRandomValues(a); return Array.prototype.map.call(a, function (x) { return c[x % c.length]; }).join(''); }
  SD.pubLoad = function () {
    var tid = SD.tid();
    return Promise.all([sb.from('service_public_links').select('*').eq('tenant_id', tid).is('deleted_at', null).maybeSingle(),
      sb.from('service_public_requests').select('*').eq('tenant_id', tid).is('deleted_at', null).order('created_at', { ascending: false }).limit(200)]).then(function (r) {
      SD.pub.link = r[0].data || null; var rows = r[1].data || [], ms = SD.monthIso();
      SD.pub.used = SD.pub.link ? rows.filter(function (x) { return SD.same(x.link_id, SD.pub.link.id) && x.created_at >= ms; }).length : 0;
      SD.pub.pending = rows.filter(function (x) { return x.status === 'pending'; });
      SD.pubPill();
    });
  };
  SD.pubPill = function () {
    var el = document.querySelector('.nav-item[data-page="servis_saya"]'); if (!el) return;
    var p = el.querySelector('.cob-navcnt'), n = SD.pub.pending.length;
    if (!n) { if (p) p.remove(); return; }
    if (!p) { p = document.createElement('span'); p.className = 'cob-navcnt'; el.appendChild(p); }
    p.textContent = n > 99 ? '99+' : String(n);
  };
  function loadQr() { return window.qrcode ? Promise.resolve() : new Promise(function (ok, no) { var s = document.createElement('script'); s.src = QRLIB; s.onload = ok; s.onerror = no; document.head.appendChild(s); }); }
  function drawQr(url) {
    return loadQr().then(function () {
      var q = window.qrcode(0, 'M'); q.addData(url); q.make();
      var n = q.getModuleCount(), px = 6, pad = 4, c = document.createElement('canvas'); c.width = c.height = (n + pad * 2) * px;
      var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = '#0F172A';
      for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) if (q.isDark(y, x)) g.fillRect((x + pad) * px, (y + pad) * px, px, px);
      c.style.cssText = 'width:170px;height:170px;border-radius:8px;image-rendering:pixelated'; c.setAttribute('role', 'img'); c.setAttribute('aria-label', 'QR'); return c;
    });
  }
  SD.tabsBar = function (active) {
    return '<div class="cob-chips" style="margin-bottom:12px"><button class="cob-chip' + (active === 'req' ? ' on' : '') + '" data-tab="req">' + SD.L('Requests', 'Permohonan') + '</button><button class="cob-chip' + (active === 'link' ? ' on' : '') + '" data-tab="link"><i class="ti ti-link"></i> ' + SD.L('Public link', 'Link awam') + '</button></div>';
  };
  SD.bindTabs = function (m) { m.querySelectorAll('[data-tab]').forEach(function (b) { b.onclick = function () { SD.go('servis_saya', b.dataset.tab === 'link' ? { tab: 'link' } : {}); }; }); };
  SD.pubSettings = function () {
    return Promise.all([SD.pubLoad(), SD.catalog(), SD.myContract(SD.tid())]).then(function (x) { paint(x[1], x[2]); });
  };
  function paint(cat, c) {
    var m = SD.main(); if (!m) return;
    var l = SD.pub.link || { enabled: false, services: [], monthly_quota: 10, expires_on: null }, url = l.token ? SD.pubUrl(l.token) : '';
    var mine = cat.filter(function (x) { return c && (c.services || []).indexOf(x.code) >= 0; }), q = l.monthly_quota, pct = q ? Math.min(100, Math.round(SD.pub.used / q * 100)) : 0;
    var cq = SD.CL && SD.CL.c && SD.CL.c.monthly_quota != null ? SD.CL.used + ' / ' + SD.CL.c.monthly_quota : null;
    var card = function (h) { return '<div class="cob-card" style="padding:16px;margin-bottom:12px">' + h + '</div>'; };
    m.innerHTML = '<div class="cob-root">' + SD.tabsBar('link') + '<div class="sd-pubg"><div>' +
      card('<div class="row"><div class="grow"><b style="font-size:15px">' + SD.L('Public service request link', 'Link awam permohonan servis') + '</b><div class="cob-xs">' + SD.L('Your customers or staff can send requests without logging in. Every request needs your approval.', 'Pelanggan atau staf anda boleh hantar permohonan tanpa log masuk. Setiap permohonan perlu kelulusan anda.') + '</div></div><button type="button" class="cob-sw' + (l.enabled ? ' on' : '') + '" id="pl-en" aria-label="' + SD.L('Enable link', 'Hidupkan link') + '"></button></div>') +
      (l.token ? card('<b style="font-size:15px">' + SD.L('Your link', 'Link anda') + '</b><div class="row" style="gap:8px;margin-top:10px"><div class="form-input grow" style="min-height:42px;display:flex;align-items:center;font-family:ui-monospace,Menlo,monospace;font-size:12.5px;min-width:0"><span class="cob-ell" title="' + SD.esc(url) + '">' + SD.esc(url.replace(/^https?:\/\//, '')) + '</span></div><button class="btn btn-primary" id="pl-cp"><i class="ti ti-copy"></i> ' + SD.L('Copy', 'Salin') + '</button></div>' +
        '<div class="sd-pubq" style="margin-top:14px"><div id="pl-qr" style="width:170px;height:170px;border-radius:8px;background:#fff"></div><div class="grow" style="min-width:150px"><div class="cob-xs" style="margin-bottom:8px">' + SD.L('Print the QR at your counter, on invoices or quotations.', 'Cetak QR di kaunter, invois atau sebut harga.') + '</div>' +
        '<button class="btn btn-outline" id="pl-dl" style="width:100%;justify-content:center;margin-bottom:8px"><i class="ti ti-download"></i> ' + SD.L('Download QR (PNG)', 'Muat turun QR (PNG)') + '</button><button class="btn btn-outline" id="pl-rs" style="width:100%;justify-content:center;color:var(--danger);border-color:var(--danger)"><i class="ti ti-refresh-alert"></i> ' + SD.L('Reset link', 'Tetap semula link') + '</button><div class="cob-xs" style="margin-top:6px">' + SD.L('The old link and QR will stop working.', 'Link dan QR lama akan berhenti berfungsi.') + '</div></div></div>') : '') +
      '</div><div>' + card('<b style="font-size:15px">' + SD.L('Services allowed via link', 'Servis dibenarkan melalui link') + '</b><div class="cob-xs" style="margin:2px 0 10px">' + SD.L('Only services in your contract.', 'Hanya servis dalam kontrak anda.') + '</div><div class="sd-cbx" style="grid-template-columns:1fr">' +
        (mine.length ? mine.map(function (x) { return '<label><input type="checkbox" value="' + x.code + '"' + ((l.services || []).indexOf(x.code) >= 0 ? ' checked' : '') + '><span>' + SD.esc(SD.L(x.name_en, x.name_bm)) + '</span></label>'; }).join('') : '<span class="cob-xs">' + SD.L('No active contract services.', 'Tiada servis kontrak aktif.') + '</span>') + '</div>') +
      card('<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div class="form-group"><label class="form-label">' + SD.L('Link quota / month', 'Kuota link / bulan') + '</label><input type="number" min="0" max="1000" class="form-input" id="pl-q" value="' + q + '"></div><div class="form-group"><label class="form-label">' + SD.L('Expiry date (optional)', 'Tarikh luput (pilihan)') + '</label><input type="date" class="form-input" id="pl-x" value="' + (l.expires_on || '') + '"></div></div>' +
        '<div class="row" style="justify-content:space-between"><b style="font-size:12.5px">' + SD.L('Used this month', 'Digunakan bulan ini') + '</b><b style="font-size:12.5px">' + SD.pub.used + ' / ' + q + '</b></div><div class="cob-bar" style="margin-top:6px"><i style="width:' + pct + '%"></i></div>' +
        '<div class="cob-xs" style="margin-top:8px">' + SD.L('Approved public requests also count against your monthly contract quota', 'Permohonan link awam juga mengira kuota kontrak bulanan selepas diluluskan') + (cq ? ' (' + cq + ')' : '') + '.</div>' +
        '<button class="btn btn-primary" id="pl-sv" style="width:100%;justify-content:center;margin-top:14px"><i class="ti ti-device-floppy"></i> ' + SD.L('Save settings', 'Simpan tetapan') + '</button>') + '</div></div></div>';
    SD.bindTabs(m);
    var en = m.querySelector('#pl-en'); en.onclick = function () { en.classList.toggle('on'); };
    if (l.token) {
      drawQr(url).then(function (cv) { var h = m.querySelector('#pl-qr'); if (h) { h.innerHTML = ''; h.appendChild(cv); } }, function () { var h = m.querySelector('#pl-qr'); if (h) h.innerHTML = '<span class="cob-xs" style="padding:8px;display:block;color:#475569">' + SD.L('QR unavailable offline', 'QR tidak tersedia luar talian') + '</span>'; });
      m.querySelector('#pl-cp').onclick = function () { try { navigator.clipboard.writeText(url); SD.toast(SD.L('Link copied', 'Link disalin'), 'success'); } catch (e) {} };
      m.querySelector('#pl-dl').onclick = function () { var cv = m.querySelector('#pl-qr canvas'); if (!cv) return; var a = document.createElement('a'); a.href = cv.toDataURL('image/png'); a.download = 'mcore-link-awam-qr.png'; document.body.appendChild(a); a.click(); a.remove(); };
      m.querySelector('#pl-rs').onclick = function () { if (confirm(SD.L('Reset the link? The old link and QR stop working immediately.', 'Tetap semula link? Link dan QR lama terus berhenti berfungsi.'))) save(true); };
    }
    m.querySelector('#pl-sv').onclick = function () { save(false); };
    function save(reset) {
      var t = reset || !l.token ? tok() : l.token;
      hex(t).then(function (h) {
        var rec = { tenant_id: SD.tid(), token: t, token_hash: h, display_name: String((APP.tenant && APP.tenant.name) || '').slice(0, 200), enabled: en.classList.contains('on'),
          services: Array.prototype.map.call(m.querySelectorAll('.sd-cbx input:checked'), function (x) { return x.value; }), monthly_quota: Math.max(0, Math.min(1000, parseInt(m.querySelector('#pl-q').value, 10) || 0)),
          expires_on: m.querySelector('#pl-x').value || null, updated_at: new Date().toISOString() };
        return (l.id ? sb.from('service_public_links').update(rec).eq('id', l.id) : sb.from('service_public_links').insert(rec)).then(function (r) {
          if (r.error) throw r.error; SD.toast(reset ? SD.L('New link created', 'Link baharu dicipta') : SD.L('Saved', 'Disimpan'), 'success'); return SD.pubSettings();
        });
      }).catch(function (e) { SD.toast(SD.err(e), 'error'); });
    }
  }
})();
