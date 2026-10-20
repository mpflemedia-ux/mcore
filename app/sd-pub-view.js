/* M-Core Service Desk - Public view page (?sr_view=TOKEN). No login. Shows status, title, description, SLA, deliverables. */
(function () {
  var qs = new URLSearchParams(location.search), TOK = qs.get('sr_view');
  if (!TOK) return;
  var lang = qs.get('lang') === 'en' ? 'en' : (qs.get('lang') === 'bm' ? 'bm' : ((navigator.language || '').slice(0, 2) === 'en' ? 'en' : 'bm'));
  var L = function (en, bm) { return lang === 'bm' ? bm : en; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); };
  var MB = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'], ME = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function dt(d) { if (!d) return ''; var m = new Date(new Date(d).getTime() + 288e5), h = m.getUTCHours(); return m.getUTCDate() + ' ' + (lang === 'bm' ? MB : ME)[m.getUTCMonth()] + ', ' + (h % 12 || 12) + ':' + String(m.getUTCMinutes()).padStart(2, '0') + ' ' + (lang === 'bm' ? (h >= 12 ? 'PTG' : 'PG') : (h >= 12 ? 'PM' : 'AM')); }
  function guard() {
    ['auth-page', 'intro-screen'].forEach(function (id) { var e = document.getElementById(id); if (e) e.style.display = 'none'; });
    var s = document.getElementById('shell'); if (s) s.classList.remove('active');
  }
  function mount() {
    var root = document.getElementById('sd-view-root');
    if (!root) { root = document.createElement('div'); root.id = 'sd-view-root'; root.style.cssText = 'position:fixed;inset:0;z-index:9000;overflow-y:auto;background:var(--bg);color:var(--text);-webkit-overflow-scrolling:touch'; document.body.appendChild(root); }
    guard(); var n = 0, iv = setInterval(function () { guard(); if (++n > 60) clearInterval(iv); }, 300);
    return root;
  }
  function stLabel(s) { return { submitted: L('Submitted', 'Dihantar'), triaged: L('Triaged', 'Disemak'), in_progress: L('In progress', 'Dalam proses'), delivered: L('Delivered', 'Siap'), closed: L('Closed', 'Ditutup'), revision: L('Revision', 'Pindaan') }[s] || s; }
  function render(root, d) {
    if (!d || d.expired) {
      root.innerHTML = '<div class="cob-root" style="max-width:480px;margin:0 auto;padding:18px 16px 40px"><div class="cob-card" style="padding:20px;text-align:center"><i class="ti ti-clock-exclamation" style="font-size:32px;color:var(--warning)"></i><b style="display:block;margin:12px 0 6px">' + L('Link expired', 'Link tamat tempoh') + '</b><div class="cob-xs">' + L('This request was closed more than 7 days ago.', 'Permintaan ini ditutup lebih 7 hari lalu.') + '</div></div></div>';
      return;
    }
    var files = (d.events || []).filter(function (e) { return e.type === 'attachment' && e.file_path; });
    var comments = (d.events || []).filter(function (e) { return e.type === 'comment'; });
    var head = '<div class="row" style="justify-content:space-between;margin-bottom:16px"><div class="row" style="gap:8px"><img src="mcore-logo.png" alt="M-Core" style="width:26px;height:26px;object-fit:contain"><b style="font-size:16px">M-CORE</b></div><div class="cob-seg"><button type="button" data-lang="en" class="' + (lang === 'en' ? 'on' : '') + '">EN</button><button type="button" data-lang="bm" class="' + (lang === 'bm' ? 'on' : '') + '">BM</button></div></div>';
    var body = '<div class="cob-card" style="padding:16px;margin-bottom:12px"><div class="row" style="gap:6px;flex-wrap:wrap;margin-bottom:10px"><span class="badge badge-blue">' + esc(stLabel(d.status)) + '</span><span class="sd-ref" style="margin-left:auto">' + esc(d.ref_no) + '</span></div><b style="font-size:18px;display:block;margin-bottom:6px">' + esc(d.title) + '</b><div class="cob-xs" style="margin-bottom:10px">' + esc(d.service_code || '') + (d.priority ? ' · ' + L('Priority', 'Keutamaan') + ' ' + esc(d.priority) : '') + '</div>' + (d.description ? '<div style="margin-bottom:10px">' + esc(d.description) + '</div>' : '') + '<div class="row" style="justify-content:space-between;padding-top:10px;border-top:1px solid var(--border)"><span class="cob-xs">' + L('SLA due', 'SLA tamat') + '</span><b>' + (d.sla_due ? dt(d.sla_due) : '—') + '</b></div></div>';
    var deliv = '<div class="cob-card" style="padding:16px;margin-bottom:12px"><b style="display:block;margin-bottom:8px">' + L('Deliverables', 'Hasil') + '</b>' + (files.length ? files.map(function (f) { return '<div class="sd-file" style="margin-bottom:8px"><i class="ti ti-file-text" style="font-size:22px;color:var(--danger)"></i><div class="grow" style="min-width:0"><b class="cob-ell">' + esc(f.body || (f.file_path || '').split('/').pop()) + '</b><div class="cob-xs">' + dt(f.created_at) + '</div></div></div>'; }).join('') : '<div class="cob-xs">' + L('Nothing delivered yet.', 'Belum ada hasil.') + '</div>') + '</div>';
    var cmts = comments.length ? '<div class="cob-card" style="padding:16px;margin-bottom:12px"><b style="display:block;margin-bottom:8px">' + L('Messages', 'Mesej') + '</b>' + comments.map(function (c) { return '<div style="margin-bottom:8px;padding:8px;background:var(--bg-secondary);border-radius:8px"><div class="cob-xs">' + dt(c.created_at) + '</div>' + esc(c.body) + '</div>'; }).join('') + '</div>' : '';
    var reply = '<div class="cob-card" style="padding:16px"><b style="display:block;margin-bottom:8px">' + L('Reply', 'Balas') + '</b><textarea id="sr-reply" class="form-input" rows="3" placeholder="' + L('Type a message…', 'Taip mesej…') + '" style="width:100%;margin-bottom:8px"></textarea><button type="button" class="btn btn-primary" id="sr-send" style="width:100%;min-height:44px">' + L('Send', 'Hantar') + '</button></div>';
    root.innerHTML = '<div class="cob-root" style="max-width:480px;margin:0 auto;padding:18px 16px 40px">' + head + body + deliv + cmts + reply + '<div class="cob-xs" style="text-align:center;margin-top:18px">' + L('Powered by M-Core', 'Dikuasakan oleh M-Core') + (d.tenant ? ' · ' + esc(d.tenant) : '') + '</div></div>';
    root.querySelectorAll('[data-lang]').forEach(function (b) { b.onclick = function () { var u = new URL(location.href); u.searchParams.set('lang', b.dataset.lang); location.href = u.toString(); }; });
    var send = root.querySelector('#sr-send');
    if (send) send.onclick = function () {
      var ta = root.querySelector('#sr-reply'), v = (ta.value || '').trim();
      if (!v) return;
      send.disabled = true;
      sb.rpc('sr_public_reply', { p_token: TOK, p_body: v }).then(function (r) {
        if (r.data && r.data.ok) { ta.value = ''; load(root); }
        send.disabled = false;
      }, function () { send.disabled = false; });
    };
  }
  function load(root) {
    sb.rpc('get_sr_public_view', { p_token: TOK }).then(function (r) { render(root, r.data); }, function () { render(root, null); });
  }
  var root = mount();
  load(root);
})();
