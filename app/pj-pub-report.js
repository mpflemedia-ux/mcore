/* M-Core Projects - Public report link (no login, /app/?pj_report=TOKEN). View-only: project stats
   + task list by column; viewer can leave a message (notifies the project's tenant owner/admin).
   Self-contained (own mount/page/esc/dt), same reason sd-pub-base.js is: an anonymous visitor
   cannot rely on SD/COB or the authenticated Projects module, which are gated behind login.
   projects/project_tasks have no anon RLS at all, so all reads/writes go through the pj-report
   Edge Function (service-role key) - this file never queries those tables directly. */
(function () {
  var qs = new URLSearchParams(location.search), TOK = qs.get('pj_report');
  if (!TOK) return;
  if (window._pjPubReport) return; window._pjPubReport = 1;
  var lang = qs.get('lang') === 'en' ? 'en' : (qs.get('lang') === 'bm' ? 'bm' : ((navigator.language || '').slice(0, 2) === 'en' ? 'en' : 'bm'));
  var L = function (en, bm) { return lang === 'bm' ? bm : en; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); };
  var MB = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'], ME = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function dmy(d) { var p = String(d || '').slice(0, 10).split('-'); return p.length === 3 ? p[2] + ' ' + (lang === 'bm' ? MB : ME)[+p[1] - 1] + ' ' + p[0] : '—'; }
  var COLS = [['backlog', 'Backlog', 'Belakang'], ['progress', 'In Progress', 'Sedang Jalan'], ['review', 'Review', 'Semakan'], ['done', 'Done', 'Siap']];
  var FN = 'https://wjqhhnjlgoigoagsnsen.supabase.co/functions/v1/pj-report';
  var root, data;

  function guard() {
    ['auth-page', 'intro-screen'].forEach(function (id) { var e = document.getElementById(id); if (e) e.style.display = 'none'; });
    var s = document.getElementById('shell'); if (s) s.classList.remove('active');
  }
  function mount() {
    root = document.getElementById('pjp-root');
    if (!root) { root = document.createElement('div'); root.id = 'pjp-root'; root.style.cssText = 'position:fixed;inset:0;z-index:9000;overflow-y:auto;background:var(--bg);color:var(--text);-webkit-overflow-scrolling:touch'; document.body.appendChild(root); }
    guard(); var n = 0, iv = setInterval(function () { guard(); if (++n > 60) clearInterval(iv); }, 300);
  }
  function head() {
    return '<div class="row" style="justify-content:space-between;margin-bottom:16px"><div class="row" style="gap:8px"><img src="assets/mcore-boot-mark.png" alt="M-Core" style="width:26px;height:26px;object-fit:contain"><b style="font-size:16px;letter-spacing:.02em">M-CORE</b></div>' +
      '<div class="cob-seg" role="group" aria-label="Language"><button type="button" data-lang="en" class="' + (lang === 'en' ? 'on' : '') + '">EN</button><button type="button" data-lang="bm" class="' + (lang === 'bm' ? 'on' : '') + '">BM</button></div></div>';
  }
  function page(body) {
    root.innerHTML = '<div class="cob-root" style="max-width:640px;margin:0 auto;padding:18px 16px 40px">' + head() + body + '<div class="cob-xs" style="text-align:center;margin-top:18px">' + L('Powered by M-Core', 'Dikuasakan oleh M-Core') + '</div></div>';
    root.querySelectorAll('[data-lang]').forEach(function (b) { b.onclick = function () { lang = b.dataset.lang; render(); }; });
    root.scrollTop = 0;
  }
  var card = function (h) { return '<div class="cob-card" style="padding:16px;margin-bottom:12px">' + h + '</div>'; };
  function inactive() {
    page(card('<div style="text-align:center;padding:16px 0"><div style="width:64px;height:64px;border-radius:50%;background:var(--bg);border:1px solid var(--border);color:var(--text-3);display:inline-flex;align-items:center;justify-content:center"><i class="ti ti-link-off" style="font-size:34px"></i></div>' +
      '<div style="font-weight:700;font-size:18px;margin-top:12px">' + L('This link is not active', 'Link ini tidak aktif') + '</div><div class="cob-sm" style="margin-top:6px">' + L('This report link was revoked, has expired, or never existed. Please ask for a new link.', 'Link laporan ini telah ditarik balik, tamat tempoh, atau tidak wujud. Sila minta link baharu.') + '</div></div>'));
  }

  function colLabel(key) { var c = COLS.filter(function (x) { return x[0] === key; })[0]; return c ? L(c[1], c[2]) : key; }

  function render() {
    var d = data;
    var byCol = {}; COLS.forEach(function (c) { byCol[c[0]] = []; });
    (d.tasks || []).forEach(function (k) { (byCol[k.column_key] || (byCol[k.column_key] = [])).push(k); });
    var statCells = [
      [L('Total', 'Jumlah'), d.stats.total], [L('In Progress', 'Sedang Jalan'), d.stats.progress],
      [L('Done', 'Siap'), d.stats.done], [L('Overdue', 'Lewat'), d.stats.overdue], [L('Progress', 'Kemajuan'), d.stats.pct + '%'],
    ];
    var taskRow = function (k) {
      var pct = Math.max(0, Math.min(100, Number(k.progress) || 0));
      return '<div class="pjp-task" data-tid="' + esc(k.id) + '" style="cursor:pointer">' +
        '<div class="row" style="justify-content:space-between;gap:8px"><b style="font-size:13.5px;word-break:break-word">' + esc(k.title) + '</b>' + (k.tag ? '<span class="pjp-tag">' + esc(k.tag) + '</span>' : '') + '</div>' +
        '<div class="row cob-xs" style="justify-content:space-between;margin-top:4px"><span>' + (k.assignee_name ? esc(k.assignee_name) : L('Unassigned', 'Belum ditugaskan')) + '</span><span>' + (k.due_date ? dmy(k.due_date) : '—') + '</span></div>' +
        '<div class="pjp-bar"><i style="width:' + pct + '%"></i></div></div>';
    };
    page(card('<div style="font-weight:700;font-size:18px">' + esc(d.project_name) + '</div><div class="cob-xs" style="margin-top:2px">' + esc(d.project_kind === 'client' ? L('Client project', 'Projek klien') : L('Internal project', 'Projek dalaman')) + '</div>') +
      card('<div class="pjp-stats">' + statCells.map(function (c) { return '<div><small>' + esc(c[0]) + '</small><b>' + esc(c[1]) + '</b></div>'; }).join('') + '</div>') +
      COLS.map(function (c) {
        var items = byCol[c[0]] || [];
        return card('<b style="font-size:14px">' + esc(colLabel(c[0])) + ' (' + items.length + ')</b>' + (items.length ? '<div style="margin-top:8px">' + items.map(taskRow).join('') + '</div>' : '<div class="cob-xs" style="padding:8px 0">' + L('No tasks', 'Tiada task') + '</div>'));
      }).join('') +
      card('<b style="font-size:14px">' + L('Leave a message', 'Tinggal mesej') + '</b><div class="cob-xs" style="margin:2px 0 10px">' + L('We will see it, not a live chat.', 'Kami akan nampak, bukan sembang langsung.') + '</div>' +
        '<textarea class="form-input" id="pjp-msg" rows="3" maxlength="2000" placeholder="' + L('Type a message…', 'Taip mesej…') + '"></textarea>' +
        '<div id="pjp-msg-err" class="cob-xs" style="color:var(--danger);display:none;margin-top:6px"></div>' +
        '<button type="button" class="btn btn-primary" id="pjp-send" style="width:100%;justify-content:center;margin-top:8px"><i class="ti ti-send"></i> ' + L('Send', 'Hantar') + '</button>' +
        '<div id="pjp-msg-ok" class="cob-xs" style="color:var(--success);display:none;margin-top:8px"><i class="ti ti-circle-check"></i> ' + L('Message sent. Thank you.', 'Mesej dihantar. Terima kasih.') + '</div>') +
      '<style>.pjp-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(78px,1fr));gap:8px}.pjp-stats div{background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:8px}.pjp-stats small{color:var(--text-3);font-size:11px}.pjp-stats b{display:block;font-size:17px}' +
      '.pjp-task{padding:8px 0;border-bottom:1px solid var(--border)}.pjp-task:last-child{border-bottom:0}.pjp-tag{font-size:10.5px;padding:1px 7px;border-radius:99px;background:var(--primary-light);color:var(--primary);white-space:nowrap}' +
      '.pjp-bar{height:5px;background:var(--border);border-radius:99px;margin-top:5px;overflow:hidden}.pjp-bar i{display:block;height:100%;background:var(--primary)}</style>');
    var send = root.querySelector('#pjp-send');
    send.onclick = function () {
      var ta = root.querySelector('#pjp-msg'), v = (ta.value || '').trim(), err = root.querySelector('#pjp-msg-err'), ok = root.querySelector('#pjp-msg-ok');
      err.style.display = 'none'; ok.style.display = 'none';
      if (!v) { err.textContent = L('Please write a message first.', 'Sila tulis mesej dahulu.'); err.style.display = 'block'; ta.focus(); return; }
      send.disabled = true;
      fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t: TOK, message: v }) })
        .then(function (r) { return r.json(); }).then(function (x) {
          send.disabled = false;
          if (!x.success) { err.textContent = L('Could not send. Please try again.', 'Tidak dapat dihantar. Sila cuba lagi.'); err.style.display = 'block'; return; }
          ta.value = ''; ok.style.display = 'block';
        }).catch(function () { send.disabled = false; err.textContent = L('Could not send. Please try again.', 'Tidak dapat dihantar. Sila cuba lagi.'); err.style.display = 'block'; });
    };
    root.querySelectorAll('[data-tid]').forEach(function (row) {
      row.onclick = function () {
        var k = (d.tasks || []).filter(function (x) { return String(x.id) === row.getAttribute('data-tid'); })[0];
        if (k) openDetail(k);
      };
    });
  }

  function openDetail(k) {
    var pct = Math.max(0, Math.min(100, Number(k.progress) || 0));
    var atts = k.attachments || [];
    var m = document.createElement('div'); m.className = 'cob-modal';
    m.innerHTML = '<div class="cob-card cob-mbox" style="padding:18px"><div class="row" style="justify-content:space-between;margin-bottom:10px"><b style="font-size:15px;word-break:break-word;flex:1">' + esc(k.title) + '</b><button type="button" class="btn btn-sm btn-outline" id="pjp-dx"><i class="ti ti-x"></i></button></div>' +
      '<div class="cob-mbody" style="padding:4px 2px">' +
      '<div class="row" style="gap:6px;flex-wrap:wrap;margin-bottom:10px">' + (k.tag ? '<span class="pjp-tag">' + esc(k.tag) + '</span>' : '') + (k.is_important ? '<span class="pjp-flag" style="background:var(--danger-light,rgba(220,38,38,.12));color:var(--danger)">' + L('Important', 'Penting') + '</span>' : '') + (k.is_urgent ? '<span class="pjp-flag" style="background:var(--warning-light,rgba(217,119,6,.12));color:var(--warning)">' + L('Urgent', 'Segera') + '</span>' : '') + '</div>' +
      '<div class="pjp-dgrid">' +
      '<div><small>' + L('Status', 'Status') + '</small><b>' + esc(colLabel(k.column_key)) + '</b></div>' +
      '<div><small>' + L('Assignee', 'Ditugaskan kepada') + '</small><b>' + (k.assignee_name ? esc(k.assignee_name) : L('Unassigned', 'Belum ditugaskan')) + '</b></div>' +
      '<div><small>' + L('Start', 'Mula') + '</small><b>' + (k.start_date ? dmy(k.start_date) : '—') + '</b></div>' +
      '<div><small>' + L('Due', 'Tarikh akhir') + '</small><b>' + (k.due_date ? dmy(k.due_date) : '—') + '</b></div>' +
      '</div>' +
      '<div style="margin-top:14px"><small class="cob-xs">' + L('Progress', 'Kemajuan') + '</small><div class="pjp-bar" style="margin-top:4px"><i style="width:' + pct + '%"></i></div><div class="cob-xs" style="text-align:right;margin-top:2px">' + pct + '%</div></div>' +
      (k.notes ? '<div style="margin-top:14px"><small class="cob-xs">' + L('Notes', 'Nota') + '</small><div style="font-size:13px;white-space:pre-wrap;word-break:break-word;margin-top:4px">' + esc(k.notes) + '</div></div>' : '') +
      (atts.length ? '<div style="margin-top:14px"><small class="cob-xs">' + L('Attachments', 'Lampiran') + '</small><div class="pjp-atts" style="margin-top:6px">' + atts.map(function (a) {
        return a.url ? '<a class="pjp-att" href="' + esc(a.url) + '" target="_blank" rel="noopener"><img src="' + esc(a.url) + '" alt="' + esc(a.name) + '" loading="lazy"></a>' : '';
      }).join('') + '</div></div>' : '') +
      '</div></div>' +
      '<style>.pjp-flag{font-size:10.5px;padding:1px 7px;border-radius:99px;font-weight:600}.pjp-dgrid{display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:13px}.pjp-dgrid small{display:block;color:var(--text-3);font-size:11px}.pjp-dgrid b{display:block;margin-top:2px;word-break:break-word}' +
      '.pjp-atts{display:flex;flex-wrap:wrap;gap:8px}.pjp-att{display:block;width:72px;height:72px;border-radius:8px;overflow:hidden;border:1px solid var(--border);flex-shrink:0}.pjp-att img{width:100%;height:100%;object-fit:cover;display:block}</style>';
    document.body.appendChild(m);
    var close = function () { m.remove(); };
    m.querySelector('#pjp-dx').onclick = close;
    m.addEventListener('click', function (e) { if (e.target === m) close(); });
  }

  function load() {
    page('<div class="page-loading"><div class="spinner"></div></div>');
    fetch(FN + '?t=' + encodeURIComponent(TOK)).then(function (r) { return r.json(); }).then(function (x) {
      if (!x.success) return inactive();
      data = x.data; render();
    }).catch(function () { inactive(); });
  }
  (function go() { if (document.body) { mount(); load(); } else setTimeout(go, 80); })();
})();
