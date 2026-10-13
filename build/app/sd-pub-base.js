/* M-Core Service Desk - Public Link base (no login): helpers, page shell, inactive screen, status page (?sr_status=SECRET).
   The status page reads only ref/status/service/dates by sha256(secret); no names, contacts or notes are readable by anon. */
(function () {
  if (window.SDP) return;
  var qs = new URLSearchParams(location.search), TOK = qs.get('service_link'), SEC = qs.get('sr_status');
  if (!TOK && !SEC) return;
  var lang = qs.get('lang') === 'en' ? 'en' : (qs.get('lang') === 'bm' ? 'bm' : ((navigator.language || '').slice(0, 2) === 'en' ? 'en' : 'bm'));
  var L = function (en, bm) { return lang === 'bm' ? bm : en; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); };
  var TYPES = /\.(pdf|jpe?g|png|webp|heic|xlsx?|csv|txt|docx?)$/i, MAX = 10485760;
  var root, MB = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'], ME = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function dt(d) { var m = new Date(new Date(d).getTime() + 288e5), h = m.getUTCHours(); return m.getUTCDate() + ' ' + (lang === 'bm' ? MB : ME)[m.getUTCMonth()] + ', ' + (h % 12 || 12) + ':' + String(m.getUTCMinutes()).padStart(2, '0') + ' ' + (lang === 'bm' ? (h >= 12 ? 'PTG' : 'PG') : (h >= 12 ? 'PM' : 'AM')); }
  function hex(s) { return crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)).then(function (b) { return Array.prototype.map.call(new Uint8Array(b), function (x) { return x.toString(16).padStart(2, '0'); }).join(''); }); }
  function rnd(n) { var a = new Uint8Array(n), c = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'; crypto.getRandomValues(a); return Array.prototype.map.call(a, function (x) { return c[x % c.length]; }).join(''); }
  function guard() {
    ['auth-page', 'intro-screen'].forEach(function (id) { var e = document.getElementById(id); if (e) e.style.display = 'none'; });
    var s = document.getElementById('shell'); if (s) s.classList.remove('active');
  }
  function mount() {
    root = document.getElementById('sd-pub-root');
    if (!root) { root = document.createElement('div'); root.id = 'sd-pub-root'; root.style.cssText = 'position:fixed;inset:0;z-index:9000;overflow-y:auto;background:var(--bg);color:var(--text);-webkit-overflow-scrolling:touch'; document.body.appendChild(root); }
    guard(); var n = 0, iv = setInterval(function () { guard(); if (++n > 60) clearInterval(iv); }, 300);
  }
  function head(name) {
    return '<div class="row" style="justify-content:space-between;margin-bottom:16px"><div class="row" style="gap:8px"><i class="ti ti-hexagon-letter-m" style="font-size:26px;color:var(--primary)"></i><b style="font-size:16px;letter-spacing:.02em">M-CORE</b></div>' +
      '<div class="cob-seg" role="group" aria-label="Language"><button type="button" data-lang="en" class="' + (lang === 'en' ? 'on' : '') + '">EN</button><button type="button" data-lang="bm" class="' + (lang === 'bm' ? 'on' : '') + '">BM</button></div></div>' +
      (name ? '<div class="cob-card" style="padding:14px 16px;margin-bottom:12px;display:flex;gap:12px;align-items:center"><div style="width:42px;height:42px;border-radius:10px;background:var(--primary-light);color:var(--primary);display:flex;align-items:center;justify-content:center;font-weight:800">' + esc(name.trim().charAt(0).toUpperCase()) + '</div><div style="min-width:0"><b style="font-size:15px">' + esc(name) + '</b><div class="cob-xs">' + L('Service request · handled by M-Core', 'Permohonan servis · dikendalikan oleh M-Core') + '</div></div></div>' : '');
  }
  function page(body, name) {
    root.innerHTML = '<div class="cob-root" style="max-width:480px;margin:0 auto;padding:18px 16px 40px">' + head(name) + body + '<div class="cob-xs" style="text-align:center;margin-top:18px">' + L('Powered by M-Core', 'Dikuasakan oleh M-Core') + (name ? ' · ' + L('Your data is only shared with ', 'Data anda hanya dikongsi dengan ') + esc(name) : '') + '</div></div>';
    root.querySelectorAll('[data-lang]').forEach(function (b) { b.onclick = function () { lang = b.dataset.lang; if (window.SDP && SDP.onLang) SDP.onLang(); }; });
    root.scrollTop = 0;
  }
  var card = function (h) { return '<div class="cob-card" style="padding:16px;margin-bottom:12px">' + h + '</div>'; };
  var fg = function (l, h) { return '<div class="form-group" style="margin-bottom:12px"><label class="form-label">' + l + '</label>' + h + '</div>'; };
  function inactive() {
    page(card('<div style="text-align:center;padding:16px 0"><div style="width:64px;height:64px;border-radius:50%;background:var(--bg);border:1px solid var(--border);color:var(--text-3);display:inline-flex;align-items:center;justify-content:center"><i class="ti ti-link-off" style="font-size:34px"></i></div>' +
      '<div style="font-weight:700;font-size:18px;margin-top:12px">' + L('This link is not active', 'Link ini tidak aktif') + '</div><div class="cob-sm" style="margin-top:6px">' + L('This request link was turned off, reset, has expired or reached its monthly limit. Please contact the company for the latest link.', 'Link permohonan ini telah dimatikan, ditetap semula, tamat tempoh atau mencapai had bulanan. Sila hubungi syarikat untuk link terkini.') + '</div>' +
      (lastStatus() ? '<a class="btn btn-outline" style="width:100%;justify-content:center;margin-top:16px" href="' + esc(lastStatus()) + '"><i class="ti ti-search"></i> ' + L('Check an existing request', 'Semak status permohonan sedia ada') + '</a>' : '') + '</div>'));
  }
  function lastStatus() { try { var x = JSON.parse(localStorage.getItem('sd_pub_last') || 'null'); return x && x.sec ? statusUrl(x.sec) : ''; } catch (e) { return ''; } }
  function statusUrl(sec) { return location.origin + location.pathname + '?sr_status=' + encodeURIComponent(sec) + '&lang=' + lang; }
  function status(sec) {
    var last = null; try { last = JSON.parse(localStorage.getItem('sd_pub_last') || 'null'); } catch (e) {}
    hex(sec).then(function (h) { return sb.from('service_public_requests').select('tenant_id,link_id,ref_no,service_code,status,created_at,decided_at').eq('status_hash', h).maybeSingle(); }).then(function (r) {
      var q = r && r.data; if (!q) return inactive();
      return Promise.all([sb.from('service_catalog').select('name_en,name_bm').eq('code', q.service_code).maybeSingle(), sb.from('service_public_links').select('display_name').eq('id', q.link_id).maybeSingle()]).then(function (x) {
        var sv = x[0].data ? (lang === 'bm' ? x[0].data.name_bm : x[0].data.name_en) : q.service_code, name = (x[1].data && x[1].data.display_name) || (last && last.ref === q.ref_no ? last.name : '');
        var title = last && last.ref === q.ref_no ? last.title : '';
        var chip = q.status === 'pending' ? ['yellow', 'ti-hourglass', L('Waiting for approval', 'Menunggu kelulusan')] : q.status === 'approved' ? ['blue', 'ti-loader-2', L('In progress', 'Dalam proses')] : ['red', 'ti-x', L('Not accepted', 'Tidak diterima')];
        var on = function (c) { return 'var(--' + c + ')'; }, off = 'var(--text-3)';
        var steps = [['ti-send', L('Sent', 'Dihantar'), dt(q.created_at), on('success')],
          q.status === 'rejected' ? ['ti-x', L('Not accepted by ', 'Tidak diterima oleh ') + (name || ''), q.decided_at ? dt(q.decided_at) : '—', on('danger')]
            : ['ti-hourglass', (q.status === 'pending' ? L('Waiting for approval by ', 'Menunggu kelulusan ') : L('Approved by ', 'Diluluskan oleh ')) + (name || ''), q.status === 'pending' ? L('Usually within 1 working day', 'Biasanya dalam 1 hari bekerja') : dt(q.decided_at), q.status === 'pending' ? on('warning') : on('success')],
          ['ti-loader-2', L('In progress', 'Dalam proses'), q.status === 'approved' ? L('With the M-Core team', 'Bersama pasukan M-Core') : '—', q.status === 'approved' ? on('primary') : off],
          ['ti-package', L('Done', 'Siap'), '—', off]];
        page(card('<div class="row" style="gap:6px;flex-wrap:wrap"><span class="badge badge-' + chip[0] + '"><i class="ti ' + chip[1] + '"></i> ' + chip[2] + '</span><span class="sd-ref" style="margin-left:auto">' + esc(q.ref_no) + '</span></div>' +
          (title ? '<div style="font-weight:700;font-size:17px;margin-top:8px">' + esc(title) + '</div>' : '') + '<div class="cob-sm"' + (title ? '' : ' style="margin-top:8px"') + '>' + esc(sv) + ' · ' + L('sent ', 'dihantar ') + dt(q.created_at) + '</div>') +
          card('<b style="font-size:15px">Status</b><div class="sd-tl" style="margin-top:8px">' + (q.status === 'rejected' ? steps.slice(0, 2) : steps).map(function (s) { return '<div class="sd-ev"><i class="ti ' + s[0] + '" style="color:' + s[3] + '"></i><div class="grow"><b style="font-size:13.5px">' + esc(s[1]) + '</b><div class="cob-xs">' + esc(s[2]) + '</div></div></div>'; }).join('') + '</div>') +
          '<div class="cob-xs" style="text-align:center">' + L('This page does not show any internal company information.', 'Halaman ini tidak memaparkan maklumat dalaman syarikat.') + '</div>', name);
      });
    }).catch(function () { inactive(); });
  }
  window.SDP = { TOK: TOK, SEC: SEC, L: L, esc: esc, dt: dt, hex: hex, rnd: rnd, mount: mount, page: page, card: card, fg: fg, inactive: inactive, statusUrl: statusUrl, status: status,
    lang: function () { return lang; }, setLang: function (v) { lang = v; }, root: function () { return root; } };
})();
