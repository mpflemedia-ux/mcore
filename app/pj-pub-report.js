/* M-Core Projects - Public report link (no login, /app/?pj_report=TOKEN). View-only: whole-project
   mode shows stats + task list by column (click a task for detail); task mode (link scoped to one
   task) shows that task's detail directly as the page. Either way, task detail includes full
   activity (comments + attachments from project_task_comments) and viewer can leave a message
   (notifies the project's tenant owner/admin). Self-contained (own mount/page/esc/dt), same reason
   sd-pub-base.js is: an anonymous visitor cannot rely on SD/COB or the authenticated Projects
   module, which are gated behind login. projects/project_tasks have no anon RLS at all, so all
   reads/writes go through the pj-report Edge Function (service-role key) - this file never queries
   those tables directly. */
(function () {
  var qs = new URLSearchParams(location.search), TOK = qs.get('pj_report');
  if (!TOK) return;
  if (window._pjPubReport) return; window._pjPubReport = 1;
  var lang = qs.get('lang') === 'en' ? 'en' : (qs.get('lang') === 'bm' ? 'bm' : ((navigator.language || '').slice(0, 2) === 'en' ? 'en' : 'bm'));
  var L = function (en, bm) { return lang === 'bm' ? bm : en; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); };
  var MB = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'], ME = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function dmy(d) { var p = String(d || '').slice(0, 10).split('-'); return p.length === 3 ? p[2] + ' ' + (lang === 'bm' ? MB : ME)[+p[1] - 1] + ' ' + p[0] : '—'; }
  function dtFull(d) { if (!d) return ''; try { return new Date(d).toLocaleString(lang === 'bm' ? 'ms-MY' : 'en-MY', { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return String(d).slice(0, 16); } }
  var COLS = [['backlog', 'Backlog', 'Belakang'], ['progress', 'In Progress', 'Sedang Jalan'], ['review', 'Review', 'Semakan'], ['done', 'Done', 'Siap']];
  var FN = 'https://wjqhhnjlgoigoagsnsen.supabase.co/functions/v1/pj-report';
  // 'project-comments' Storage bucket itself is images-only, 5MB (see projects_wa_share_01.sql) - not
  // the broader PDF/Office/CSV allowlist sd-wa-result.js uses with its own 'service-files' bucket.
  var IMG_TYPES = /\.(jpe?g|png|webp|heic|gif)$/i, FILE_MAX = 5242880, FILES_MAX = 3;
  var selectedPjFiles = [];
  function size(b) { b = +b || 0; return b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB'; }
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

  function activityItem(a) {
    var icon = a.file ? 'ti-paperclip' : 'ti-message';
    return '<div class="pjp-act"><i class="ti ' + icon + '"></i><div class="grow" style="min-width:0">' +
      (a.body ? '<div style="font-size:13px;white-space:pre-wrap;word-break:break-word">' + esc(a.body) + '</div>' : '') +
      (a.file && a.file.url ? '<a class="pjp-att" href="' + esc(a.file.url) + '" target="_blank" rel="noopener"><img src="' + esc(a.file.url) + '" alt="' + esc(a.file.name || '') + '" loading="lazy"></a>' : '') +
      '<div class="cob-xs" style="margin-top:3px">' + esc(dtFull(a.created_at)) + (a.by ? ' · ' + esc(a.by) : '') + '</div></div></div>';
  }

  function taskDetailBody(k) {
    var pct = Math.max(0, Math.min(100, Number(k.progress) || 0));
    var act = k.activity || [];
    return '<div class="row" style="gap:6px;flex-wrap:wrap;margin-bottom:10px">' + (k.tag ? '<span class="pjp-tag">' + esc(k.tag) + '</span>' : '') + (k.is_important ? '<span class="pjp-flag" style="background:var(--danger-light,rgba(220,38,38,.12));color:var(--danger)">' + L('Important', 'Penting') + '</span>' : '') + (k.is_urgent ? '<span class="pjp-flag" style="background:var(--warning-light,rgba(217,119,6,.12));color:var(--warning)">' + L('Urgent', 'Segera') + '</span>' : '') + '</div>' +
      '<div class="pjp-dgrid">' +
      '<div><small>' + L('Status', 'Status') + '</small><b>' + esc(colLabel(k.column_key)) + '</b></div>' +
      '<div><small>' + L('Assignee', 'Ditugaskan kepada') + '</small><b>' + (k.assignee_name ? esc(k.assignee_name) : L('Unassigned', 'Belum ditugaskan')) + '</b></div>' +
      '<div><small>' + L('Start', 'Mula') + '</small><b>' + (k.start_date ? dmy(k.start_date) : '—') + '</b></div>' +
      '<div><small>' + L('Due', 'Tarikh akhir') + '</small><b>' + (k.due_date ? dmy(k.due_date) : '—') + '</b></div>' +
      '</div>' +
      '<div style="margin-top:14px"><small class="cob-xs">' + L('Progress', 'Kemajuan') + '</small><div class="pjp-bar" style="margin-top:4px"><i style="width:' + pct + '%"></i></div><div class="cob-xs" style="text-align:right;margin-top:2px">' + pct + '%</div></div>' +
      (k.notes ? '<div style="margin-top:14px"><small class="cob-xs">' + L('Notes', 'Nota') + '</small><div style="font-size:13px;white-space:pre-wrap;word-break:break-word;margin-top:4px">' + esc(k.notes) + '</div></div>' : '') +
      '<div style="margin-top:14px"><small class="cob-xs">' + L('Activity', 'Aktiviti') + ' (' + act.length + ')</small><div class="pjp-acts" style="margin-top:6px">' + (act.length ? act.map(activityItem).join('') : '<div class="cob-xs" style="padding:6px 0">' + L('No activity yet.', 'Belum ada aktiviti.') + '</div>') + '</div></div>';
  }

  function msgSectionHtml() {
    return card('<b style="font-size:14px">' + L('Leave a message', 'Tinggal mesej') + '</b><div class="cob-xs" style="margin:2px 0 10px">' + L('We will see it, not a live chat.', 'Kami akan nampak, bukan sembang langsung.') + '</div>' +
      '<textarea class="form-input" id="pjp-msg" rows="3" maxlength="2000" placeholder="' + L('Type a message…', 'Taip mesej…') + '"></textarea>' +
      '<div class="form-group" style="margin:10px 0 0">' +
      '<input type="file" id="pjp-file" accept=".jpg,.jpeg,.png,.webp,.heic,.gif" multiple style="display:none">' +
      '<button type="button" class="btn btn-sm btn-outline" id="pjp-file-btn"><i class="ti ti-paperclip"></i> ' + L('Attach images', 'Lampirkan imej') + '</button>' +
      '<div class="cob-xs" style="margin-top:6px">' + L('Up to 3 images, 5MB each (JPG, PNG, WEBP, HEIC, GIF).', 'Maksimum 3 imej, 5MB setiap satu (JPG, PNG, WEBP, HEIC, GIF).') + '</div>' +
      '<div id="pjp-file-list"></div>' +
      '<div id="pjp-file-err" class="cob-banner err" style="display:none;margin-top:8px"><i class="ti ti-alert-circle"></i><div></div></div></div>' +
      '<div id="pjp-msg-err" class="cob-xs" style="color:var(--danger);display:none;margin-top:6px"></div>' +
      '<button type="button" class="btn btn-primary" id="pjp-send" style="width:100%;justify-content:center;margin-top:8px"><i class="ti ti-send"></i> ' + L('Send', 'Hantar') + '</button>' +
      '<div id="pjp-msg-ok" class="cob-xs" style="color:var(--success);display:none;margin-top:8px"><i class="ti ti-circle-check"></i> ' + L('Message sent. Thank you.', 'Mesej dihantar. Terima kasih.') + '</div>');
  }
  function pjFileErr(m) { var e = root.querySelector('#pjp-file-err'); if (!e) return; if (m) { e.querySelector('div').textContent = m; e.style.display = 'flex'; } else e.style.display = 'none'; }
  function renderPjFilePreview() {
    var list = root.querySelector('#pjp-file-list'); if (!list) return;
    list.innerHTML = selectedPjFiles.map(function (f, i) {
      return '<div class="row" style="gap:8px;padding:6px 0;border-bottom:1px solid var(--border)"><img src="' + URL.createObjectURL(f) + '" style="width:36px;height:36px;border-radius:6px;object-fit:cover"><div class="grow" style="min-width:0"><b class="cob-ell" style="font-size:12.5px;display:block">' + esc(f.name) + '</b><div class="cob-xs">' + size(f.size) + '</div></div><button type="button" class="btn btn-sm btn-outline" data-prm="' + i + '" aria-label="Remove"><i class="ti ti-x"></i></button></div>';
    }).join('');
    list.querySelectorAll('[data-prm]').forEach(function (b) { b.onclick = function () { selectedPjFiles.splice(+b.dataset.prm, 1); renderPjFilePreview(); }; });
    var fb = root.querySelector('#pjp-file-btn');
    if (fb) fb.innerHTML = '<i class="ti ti-paperclip"></i> ' + L('Attach images', 'Lampirkan imej') + (selectedPjFiles.length ? ' (' + selectedPjFiles.length + '/' + FILES_MAX + ')' : '');
  }
  function uploadPjAll() {
    return selectedPjFiles.reduce(function (p, f) {
      return p.then(function (acc) {
        return fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t: TOK, action: 'upload_url', filename: f.name, size: f.size }) })
          .then(function (r) { return r.json(); }).then(function (j) {
            if (!j.success) throw new Error(j.error || 'upload_url');
            return sb.storage.from('project-comments').uploadToSignedUrl(j.path, j.token, f).then(function (u) {
              if (u.error) throw u.error;
              acc.push({ path: j.path, name: f.name.slice(-200), size: f.size });
              return acc;
            });
          });
      });
    }, Promise.resolve([]));
  }
  function bindMsgSection() {
    var send = root.querySelector('#pjp-send'); if (!send) return;
    var fileBtn = root.querySelector('#pjp-file-btn'), fileIn = root.querySelector('#pjp-file');
    if (fileBtn && fileIn) {
      fileBtn.onclick = function () { fileIn.click(); };
      fileIn.onchange = function () {
        var picked = Array.prototype.slice.call(fileIn.files || []); fileIn.value = ''; pjFileErr('');
        for (var i = 0; i < picked.length; i++) {
          var f = picked[i];
          if (selectedPjFiles.length >= FILES_MAX) { pjFileErr(L('Maximum 3 images.', 'Maksimum 3 imej.')); break; }
          if (!IMG_TYPES.test(f.name)) { pjFileErr(L('Unsupported file type: ', 'Jenis fail tidak disokong: ') + f.name); continue; }
          if (f.size > FILE_MAX) { pjFileErr(L('Image too large (max 5MB): ', 'Imej terlalu besar (maks 5MB): ') + f.name); continue; }
          selectedPjFiles.push(f);
        }
        renderPjFilePreview();
      };
    }
    renderPjFilePreview();
    send.onclick = function () {
      var ta = root.querySelector('#pjp-msg'), v = (ta.value || '').trim(), err = root.querySelector('#pjp-msg-err'), ok = root.querySelector('#pjp-msg-ok');
      err.style.display = 'none'; ok.style.display = 'none'; pjFileErr('');
      if (!v) { err.textContent = L('Please write a message first.', 'Sila tulis mesej dahulu.'); err.style.display = 'block'; ta.focus(); return; }
      send.disabled = true;
      uploadPjAll().then(function (files) {
        return fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ t: TOK, action: 'message', message: v }, files.length ? { files: files } : {})) });
      }).then(function (r) { return r.json(); }).then(function (x) {
        send.disabled = false;
        if (!x.success) { err.textContent = x.error === 'rate_limited' ? L('Too many messages. Please try again later.', 'Terlalu banyak mesej. Sila cuba sebentar lagi.') : L('Could not send. Please try again.', 'Tidak dapat dihantar. Sila cuba lagi.'); err.style.display = 'block'; return; }
        ta.value = ''; selectedPjFiles = []; renderPjFilePreview(); ok.style.display = 'block';
      }).catch(function () { send.disabled = false; pjFileErr(L('Could not upload image(s). Please try again.', 'Tidak dapat memuat naik imej. Sila cuba lagi.')); });
    };
  }

  function render() {
    var d = data;
    if (d.mode === 'task') {
      var k = (d.tasks || [])[0];
      page(card('<div class="cob-xs">' + esc(d.project_name) + '</div><div style="font-weight:700;font-size:18px;word-break:break-word;margin-top:2px">' + esc(k.title) + '</div>') +
        card(taskDetailBody(k)) + msgSectionHtml());
      bindMsgSection();
      return;
    }
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
      msgSectionHtml());
    bindMsgSection();
    root.querySelectorAll('[data-tid]').forEach(function (row) {
      row.onclick = function () {
        var k = (d.tasks || []).filter(function (x) { return String(x.id) === row.getAttribute('data-tid'); })[0];
        if (k) openDetail(k);
      };
    });
  }

  function openDetail(k) {
    var m = document.createElement('div'); m.className = 'cob-modal';
    m.innerHTML = '<div class="cob-card cob-mbox" style="padding:18px"><div class="row" style="justify-content:space-between;margin-bottom:10px"><b style="font-size:15px;word-break:break-word;flex:1">' + esc(k.title) + '</b><button type="button" class="btn btn-sm btn-outline" id="pjp-dx"><i class="ti ti-x"></i></button></div>' +
      '<div class="cob-mbody" style="padding:4px 2px">' + taskDetailBody(k) + '</div></div>';
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
