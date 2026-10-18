/* M-Core Service Desk - Public Result Link (no login, /app/?sr_result=TOKEN). Needs sd-pub-base.js.
   service_requests/service_request_events have no anon RLS at all, so this never queries them
   directly - all reads/writes go through the sd-result Edge Function (service-role key). Status
   labels/colours and the business-hours SLA calc are duplicated from app/sd-data.js on purpose
   (same reason sd-pub-base.js has its own esc/dt): an anonymous visitor cannot rely on SD/COB,
   which are gated behind login. */
(function () {
  if (window._sdPubResult || !window.SDP) return; window._sdPubResult = 1;
  var P = SDP, TOK = P.SR, L = function (a, b) { return P.L(a, b); }, esc = P.esc, page = P.page, card = P.card, dt = P.dt, inactive = P.inactive;
  if (!TOK) return;
  var FN = 'https://wjqhhnjlgoigoagsnsen.supabase.co/functions/v1/sd-result';
  var ST = { submitted: ['blue', 'Submitted', 'Dihantar'], triaged: ['blue', 'Triaged', 'Disaring'], in_progress: ['blue', 'In progress', 'Dalam proses'],
    waiting_client: ['yellow', 'Waiting on you', 'Tunggu klien'], delivered: ['green', 'Delivered', 'Dihantar'], revision: ['yellow', 'Revision', 'Revisi'],
    closed: ['gray', 'Confirmed & closed', 'Disahkan & ditutup'], out_of_scope: ['red', 'Out of scope', 'Luar skop'], cancelled: ['gray', 'Cancelled', 'Dibatalkan'] };
  var EVI = { status: 'ti-arrows-exchange', comment: 'ti-message', attachment: 'ti-paperclip', support_access: 'ti-shield-lock' };
  var root, data;
  function size(n) { if (n == null) return ''; var k = n / 1024; return k < 1024 ? Math.round(k) + ' KB' : (k / 1024).toFixed(1) + ' MB'; }
  function badge(s) { var x = ST[s] || ST.submitted; return '<span class="badge badge-' + x[0] + '">' + esc(L(x[1], x[2])) + '</span>'; }
  function evText(e) {
    if (e.type === 'status') { var x = ST[e.to_status] || ST.submitted; return '<b>' + esc(L(x[1], x[2])) + '</b>'; }
    if (e.type === 'attachment') return '<b>' + L(e.deliverable ? 'Deliverable uploaded' : 'File attached', e.deliverable ? 'Hasil kerja dimuat naik' : 'Fail dilampirkan') + '</b>';
    if (e.type === 'support_access') return '<b>' + L('Support access', 'Akses sokongan') + '</b>';
    return '<b>' + L('Comment', 'Komen') + '</b>';
  }
  function bhLabel(h) { var a = Math.abs(h); return a >= 1 ? Math.round(a) + L(' hours', ' jam') : Math.max(1, Math.round(a * 60)) + L(' min', ' min'); }
  function wk(ms) { var d = new Date(ms + 288e5).getUTCDay(); return d !== 0 && d !== 6; }
  function bhBetween(a, b) {
    var x = new Date(a).getTime(), y = new Date(b).getTime(); if (!(y > x)) return 0;
    var h = 0, step = 900000, guard = 0;
    for (var m = x; m < y && guard++ < 40000; m += step) if (wk(m)) h += Math.min(step, y - m);
    return h / 3600000;
  }
  function render() {
    var d = data, done = d.closed_at || d.delivered_at;
    var slaLine = done ? L('Done ', 'Siap ') + dt(done) + (d.sla_hours != null ? ' · ' + L('in ', 'dalam ') + bhLabel(bhBetween(d.created_at, done)) + ' (' + L('SLA ', 'SLA ') + d.sla_hours + L(' hours)', ' jam)') : '') : '';
    var files = d.events.filter(function (e) { return e.type === 'attachment' && e.deliverable && e.file; });
    var fileRow = function (e) {
      return '<div class="sd-file"><i class="ti ti-file-text" style="font-size:22px;color:var(--danger)"></i><div class="grow" style="min-width:0"><b class="cob-ell" title="' + esc(e.file.name) + '">' + esc(e.file.name) + '</b><div class="cob-xs">' + size(e.file.size) + '</div></div>' +
        (e.file.url ? '<a class="btn btn-outline btn-icon" href="' + esc(e.file.url) + '" style="width:40px;height:40px"><i class="ti ti-download"></i></a>' : '') + '</div>';
    };
    var canReopen = d.status === 'closed' || d.status === 'delivered';
    page(card('<div class="row" style="gap:6px;flex-wrap:wrap">' + badge(d.status) + '<span class="sd-ref" style="margin-left:auto">' + esc(d.ref_no) + '</span></div>' +
      '<div style="font-weight:700;font-size:18px;margin-top:8px">' + esc(d.title) + '</div><div class="cob-sm">' + esc(L(d.service_name_en, d.service_name_bm)) + '</div>' +
      (slaLine ? '<div class="cob-xs" style="margin-top:8px">' + esc(slaLine) + '</div>' : '')) +
      card('<b style="font-size:15px">' + L('Result files', 'Fail hasil kerja') + ' (' + files.length + ')</b>' +
        (files.length ? files.map(fileRow).join('') : '<div class="cob-xs" style="padding:10px 0">' + L('Nothing delivered yet.', 'Belum ada hasil kerja.') + '</div>') +
        (d.expires_on ? '<div class="cob-xs" style="margin-top:10px"><i class="ti ti-clock"></i> ' + L('This link is valid until ', 'Link ini sah sehingga ') + esc(d.expires_on) + L('. After that, ask ', '. Selepas itu, sila hubungi ') + esc(d.tenant_name || 'M-Core') + L(' for a new link.', ' untuk link baharu.') + '</div>' : '')) +
      card('<b style="font-size:15px">' + L('Timeline', 'Garis masa') + '</b><div class="sd-tl" style="margin-top:8px">' + (d.events.length ? d.events.map(function (e) {
        return '<div class="sd-ev"><i class="ti ' + (EVI[e.type] || 'ti-point') + '"></i><div class="grow" style="min-width:0">' + evText(e) +
          (e.body ? '<div style="font-size:13px;white-space:pre-wrap;word-break:break-word">' + esc(e.body) + '</div>' : '') +
          (e.file ? '<div class="cob-xs" style="margin-top:2px"><i class="ti ti-paperclip"></i> ' + (e.file.url ? '<a href="' + esc(e.file.url) + '">' + esc(e.file.name) + '</a>' : esc(e.file.name)) + ' · ' + size(e.file.size) + '</div>' : '') +
          '<div class="cob-xs">' + dt(e.created_at) + (e.actor_name ? ' · ' + esc(e.actor_name) : '') + '</div></div></div>';
      }).join('') : '<div class="cob-xs" style="padding:10px 0">' + L('No activity yet.', 'Belum ada aktiviti.') + '</div>') + '</div>') +
      (d.status === 'closed' ? card('<div class="row" style="gap:8px;align-items:center"><i class="ti ti-circle-check" style="font-size:22px;color:var(--success)"></i><div class="cob-sm">' + L('Thanks - this request is confirmed and closed.', 'Terima kasih - permohonan ini telah disahkan dan ditutup.') + '</div></div>' +
        (canReopen ? '<button type="button" class="btn btn-outline" id="sr-reopen-btn" style="width:100%;justify-content:center;margin-top:12px"><i class="ti ti-arrow-back-up"></i> ' + L('Reopen request', 'Buka semula permohonan') + '</button>' +
          '<div id="sr-reopen-box" style="display:none;margin-top:10px"><textarea class="form-input" id="sr-reopen-reason" rows="3" placeholder="' + L('What still needs fixing?', 'Apa yang perlu dibetulkan lagi?') + '"></textarea><button type="button" class="btn btn-primary" id="sr-reopen-go" style="width:100%;justify-content:center;margin-top:8px">' + L('Send', 'Hantar') + '</button></div>' : '')
      ) : ''), d.tenant_name);
    var rb = root.querySelector('#sr-reopen-btn'); if (rb) rb.onclick = function () { root.querySelector('#sr-reopen-box').style.display = 'block'; rb.style.display = 'none'; };
    var rg = root.querySelector('#sr-reopen-go'); if (rg) rg.onclick = function () {
      var reason = (root.querySelector('#sr-reopen-reason').value || '').trim();
      if (!reason) { root.querySelector('#sr-reopen-reason').focus(); return; }
      rg.disabled = true;
      fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t: TOK, reason: reason }) })
        .then(function (r) { return r.json(); }).then(function (x) { if (!x.success) throw new Error(x.error); data = x.data; render(); })
        .catch(function () { rg.disabled = false; });
    };
  }
  function load() {
    page('<div class="page-loading"><div class="spinner"></div></div>');
    fetch(FN + '?t=' + encodeURIComponent(TOK)).then(function (r) { return r.json(); }).then(function (x) {
      if (!x.success) return inactive();
      data = x.data; render();
    }).catch(function () { inactive(); });
  }
  function start() { P.mount(); root = P.root(); P.onLang = load; load(); }
  (function go() { if (document.body) start(); else setTimeout(go, 80); })();
})();
