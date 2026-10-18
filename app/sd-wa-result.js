/* M-Core Service Desk - public client result page (no login): /app/?sr_result=TOKEN&lang=bm
   Talks only to Edge Function sd-result (token -> sha256 lookup server-side). Not deployed / expired / revoked => 'link tidak aktif'. */
(function () {
  var qs = new URLSearchParams(location.search), TOK = qs.get('sr_result');
  if (!TOK || window.SDR) return;
  window.SDR = 1;
  var lang = qs.get('lang') === 'en' ? 'en' : 'bm', root, D = null;
  var L = function (en, bm) { return lang === 'bm' ? bm : en; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); };
  var MB = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'], ME = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function dt(d, noTime) { var m = new Date(new Date(d).getTime() + 288e5), h = m.getUTCHours(); return m.getUTCDate() + ' ' + (lang === 'bm' ? MB : ME)[m.getUTCMonth()] + (noTime ? ' ' + m.getUTCFullYear() : ', ' + (h % 12 || 12) + ':' + String(m.getUTCMinutes()).padStart(2, '0') + ' ' + (lang === 'bm' ? (h >= 12 ? 'PTG' : 'PG') : (h >= 12 ? 'PM' : 'AM'))); }
  function size(b) { b = +b || 0; return b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB'; }
  function guard() { ['auth-page', 'intro-screen'].forEach(function (id) { var e = document.getElementById(id); if (e) e.style.display = 'none'; }); var s = document.getElementById('shell'); if (s) s.classList.remove('active'); }
  function mount() {
    root = document.getElementById('sdr-root');
    if (!root) { root = document.createElement('div'); root.id = 'sdr-root'; root.style.cssText = 'position:fixed;inset:0;z-index:9000;overflow-y:auto;background:var(--bg);color:var(--text);-webkit-overflow-scrolling:touch'; document.body.appendChild(root); }
    guard(); var n = 0, iv = setInterval(function () { guard(); if (++n > 60) clearInterval(iv); }, 300);
  }
  var card = function (h, st) { return '<div class="cob-card" style="padding:16px;margin-bottom:12px;' + (st || '') + '">' + h + '</div>'; };
  function page(body) {
    root.innerHTML = '<div class="cob-root" style="max-width:480px;margin:0 auto;padding:18px 16px 40px"><div class="row" style="justify-content:space-between;margin-bottom:16px"><div class="row" style="gap:8px"><i class="ti ti-hexagon-letter-m" style="font-size:26px;color:var(--primary)"></i><b style="font-size:16px;letter-spacing:.02em">M-CORE</b></div>' +
      '<div class="cob-seg" role="group" aria-label="Language"><button type="button" data-lang="en" class="' + (lang === 'en' ? 'on' : '') + '">EN</button><button type="button" data-lang="bm" class="' + (lang === 'bm' ? 'on' : '') + '">BM</button></div></div>' + body +
      '<div class="cob-xs" style="text-align:center;margin-top:18px">' + L('Powered by M-Core', 'Dikuasakan oleh M-Core') + (D && D.tenant_name ? ' · ' + L('Your data is only shared with ', 'Data anda hanya dikongsi dengan ') + esc(D.tenant_name) : '') + '</div></div>';
    root.querySelectorAll('[data-lang]').forEach(function (b) { b.onclick = function () { lang = b.dataset.lang; D ? show() : inactive(); }; });
  }
  function inactive() {
    page(card('<div style="text-align:center;padding:16px 0"><div style="width:64px;height:64px;border-radius:50%;background:var(--bg);border:1px solid var(--border);color:var(--text-3);display:inline-flex;align-items:center;justify-content:center"><i class="ti ti-link-off" style="font-size:34px"></i></div>' +
      '<div style="font-weight:700;font-size:18px;margin-top:12px">' + L('This link is not active', 'Link ini tidak aktif') + '</div><div class="cob-sm" style="margin-top:6px">' + L('This result link has expired, was replaced or is not available yet. Please ask the company for a new link.', 'Link hasil ini telah tamat tempoh, diganti atau belum tersedia. Sila minta link baharu daripada syarikat.') + '</div></div>'));
  }
  function call(body) {
    var url = (typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : '') + '/functions/v1/sd-result', key = typeof SUPABASE_ANON !== 'undefined' ? SUPABASE_ANON : '';
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: key, Authorization: 'Bearer ' + key }, body: JSON.stringify(Object.assign({ token: TOK }, body || {})) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { j._st = r.status; return j; }); });
  }
  function show(msg) {
    var d = D, done = d.closed_at || d.status === 'closed', rev = d.status === 'revision';
    var files = (d.files || []).map(function (f) {
      return '<div class="row" style="gap:10px;padding:10px 0;border-bottom:1px solid var(--border)"><i class="ti ti-file-text" style="font-size:20px;color:var(--primary)"></i><div class="grow" style="min-width:0"><b style="font-size:13.5px;display:block" class="cob-ell">' + esc(f.name) + '</b><div class="cob-xs">' + size(f.size) + '</div></div>' +
        (f.url ? '<a class="btn btn-sm btn-outline" href="' + esc(f.url) + '" target="_blank" rel="noopener" download><i class="ti ti-download"></i> ' + L('Download', 'Muat turun') + '</a>' : '<button type="button" class="btn btn-sm btn-outline" disabled><i class="ti ti-lock"></i></button>') + '</div>';
    }).join('');
    var badge = done ? '<span class="badge badge-gray"><i class="ti ti-circle-check"></i> ' + L('Confirmed & closed', 'Disahkan & ditutup') + '</span>' : rev ? '<span class="badge badge-yellow"><i class="ti ti-arrow-back-up"></i> ' + L('Changes requested', 'Pindaan diminta') + '</span>' : '<span class="badge badge-green"><i class="ti ti-circle-check"></i> ' + L('Done', 'Siap') + '</span>';
    var resp = d.can_respond ? card('<b style="font-size:15px">' + L('All good?', 'Semua okey?') + '</b><button type="button" class="btn" id="sdr-ok" style="width:100%;justify-content:center;margin-top:10px;background:var(--success);border-color:var(--success);color:#fff;font-weight:700;min-height:44px"><i class="ti ti-check"></i> ' + L('Confirm & close', 'Sahkan & tutup') + '</button>' +
      '<div class="form-group" style="margin:14px 0 8px"><label class="form-label" for="sdr-cm">' + L('Request changes', 'Minta pindaan') + '</label><textarea class="form-input" id="sdr-cm" rows="3" maxlength="2000" data-no-titlecase="1" placeholder="' + L('E.g. Ali’s overtime allowance is missing…', 'Contoh: Elaun lebih masa Ali belum dimasukkan…') + '"></textarea></div><button type="button" class="btn btn-outline" id="sdr-rev" style="width:100%;justify-content:center;min-height:44px"><i class="ti ti-pencil"></i> ' + L('Request changes', 'Minta pindaan') + '</button>')
      : card('<div class="row" style="gap:10px"><i class="ti ti-' + (rev ? 'arrow-back-up' : 'circle-check') + '" style="font-size:22px;color:var(--' + (rev ? 'warning' : 'success') + ')"></i><div class="cob-sm">' + (msg || (rev ? L('Thanks - your change request was sent. We will update you soon.', 'Terima kasih - permintaan pindaan telah dihantar. Kami akan maklumkan semula.') : done ? L('Thanks - this request is confirmed and closed.', 'Terima kasih - permintaan ini telah disahkan dan ditutup.') : L('This request is not waiting for your confirmation.', 'Permintaan ini tidak menunggu pengesahan anda.'))) + '</div></div>');
    page(card('<div class="row" style="gap:6px;flex-wrap:wrap">' + badge + '<span class="sd-ref" style="margin-left:auto">' + esc(d.ref_no) + '</span></div><div style="font-weight:700;font-size:17px;margin-top:8px;overflow-wrap:anywhere">' + esc(d.title) + '</div><div class="cob-sm">' + esc(lang === 'bm' ? d.service_bm : d.service_en) + ' · ' + esc(d.tenant_name || '') + '</div>' +
      (d.delivered_at ? '<div class="cob-sm" style="margin-top:6px"><i class="ti ti-clock-check" style="color:var(--success)"></i> ' + L('Done ', 'Siap ') + dt(d.delivered_at) + (d.hours_taken != null ? ' · ' + L('in ' + d.hours_taken + ' hours', 'dalam ' + d.hours_taken + ' jam') + (d.sla_hours ? ' (SLA ' + d.sla_hours + ' ' + L('hours', 'jam') + ')' : '') : '') + '</div>' : '')) +
      card('<b style="font-size:15px">' + L('Result files', 'Fail hasil') + ' (' + (d.files || []).length + ')</b>' + (files || '<div class="cob-xs" style="padding:10px 0">' + L('No files attached.', 'Tiada fail dilampirkan.') + '</div>') +
        (d.paid === false && (d.files || []).length ? '<div class="cob-banner warn" style="margin-top:10px"><i class="ti ti-lock"></i><div>' + L('Downloads are released after full payment.', 'Muat turun dibuka selepas bayaran penuh.') + '</div></div>' : '') +
        '<div class="cob-xs" style="margin-top:10px"><i class="ti ti-hourglass"></i> ' + L('This link is valid until ', 'Link ini sah sehingga ') + dt(d.expires_at, 1) + L('. After that, ask ', '. Selepas itu, minta link baharu daripada ') + esc(d.tenant_name || 'M-Core') + L(' for a new link.', /\.$/.test(d.tenant_name || '') ? '' : '.') + '</div>') +
      (d.timeline_count != null ? '<div class="cob-xs">Timeline: ' + (d.timeline_count || 0) + '</div>' : '') + (d.timeline && d.timeline.length ? card('<b style="font-size:15px">' + L('Timeline', 'Garis masa') + '</b>' + d.timeline.map(function (e) {
        var ic = e.type === 'comment' ? 'ti-message' : e.type === 'attachment' ? 'ti-paperclip' : 'ti-arrows-exchange';
        var lb = e.type === 'comment' ? L('Comment', 'Komen') : e.type === 'attachment' ? L('File', 'Fail') : L('Status', 'Status');
        return '<div style="display:flex;gap:10px;margin-top:10px"><i class="ti ' + ic + '" style="color:var(--text-secondary);margin-top:2px"></i><div style="min-width:0"><b>' + lb + '</b><div style="overflow-wrap:anywhere">' + esc(e.body || '') + '</div><div class="cob-xs">' + dt(e.created_at) + '</div></div></div>';
      }).join('')) : '') + resp);
    var ok = root.querySelector('#sdr-ok'), rv = root.querySelector('#sdr-rev');
    var send = function (action, btn) {
      var cm = (root.querySelector('#sdr-cm') || {}).value || '';
      if (action === 'revise' && cm.trim().length < 3) { var t = root.querySelector('#sdr-cm'); t.focus(); t.style.borderColor = 'var(--danger)'; return; }
      btn.disabled = true;
      call({ action: action, comment: cm.trim() }).then(function (j) {
        if (j.ok) { D.status = j.status; D.can_respond = false; if (j.status === 'closed') D.closed_at = new Date().toISOString(); show(); }
        else { btn.disabled = false; show(j.error === 'rate' ? L('Too many attempts. Please try again later.', 'Terlalu banyak cubaan. Sila cuba sebentar lagi.') : null); }
      }, function () { btn.disabled = false; });
    };
    if (ok) ok.onclick = function () { send('confirm', ok); };
    if (rv) rv.onclick = function () { send('revise', rv); };
    if (window.SDR_X) window.SDR_X({ root: root, d: d, lang: lang, msg: msg, call: call, show: show });
  }
  function boot() {
    mount();
    page(card('<div style="text-align:center;padding:24px"><div class="spinner dark" style="margin:0 auto"></div></div>'));
    call().then(function (j) { if (!j || !j.ok) return inactive(); D = j; show(); }, inactive);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
