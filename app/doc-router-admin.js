/* Documents — email gate + petty AI + Google Drive upload */
(function () {
  var ALLOW = 'mikepaulfreelancer@gmail.com';
  var LS_CID = 'mcore_docs_drive_client';
  var LS_ROOT = 'mcore_docs_drive_root';
  var accessToken = null;
  var tokenClient = null;
  var folderCache = {};

  function email() {
    return String((APP.user && APP.user.email) || '').trim().toLowerCase();
  }
  function allowed() { return email() === ALLOW; }
  function isBm() { return APP.language === 'bm'; }
  function t(en, bm) { return isBm() ? bm : en; }
  function mainEl() { return document.getElementById('main'); }
  function esc(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function slug(s) {
    return String(s || '').replace(/[^a-zA-Z0-9]+/g, '').slice(0, 28) || 'Client';
  }
  function dateStr() {
    var d = new Date();
    return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  }

  function decide(text, filename, who) {
    var blob = (text || '') + ' ' + (filename || '') + ' ' + (who || '');
    var what = '', folder = '', why = '', client = who || '', cat = 'Doc';
    if (/fade\s*boys|fadeboys|la0068592|202403134273/i.test(blob)) {
      what = 'SSM / Borang D'; cat = 'SSM_BorangD'; client = client || 'Fade Boys Worldwide';
      folder = '05_Clients/Fade Boys Worldwide/01_Contracts & Agreements';
      why = t('Matched Fade Boys / SSM number.', 'Padan Fade Boys / no. SSM.');
    } else if (/pb\s*enterprise|pbenterprise/i.test(blob)) {
      what = t('Client document', 'Dokumen client'); cat = 'ClientDoc'; client = client || 'PB Enterprise';
      folder = '05_Clients/PB Enterprise/01_Contracts & Agreements';
      why = t('Matched PB Enterprise.', 'Padan PB Enterprise.');
    } else if (/borang d|perakuan pendaftaran|akta pendaftaran perniagaan|ezbiz|ssm/i.test(blob)) {
      what = 'SSM / Borang D'; cat = 'SSM_BorangD';
      folder = '05_Clients/' + (client || 'Client') + '/01_Contracts & Agreements';
      why = t('SSM registration certificate detected.', 'Sijil SSM dikesan.');
    } else if (/invoice|\binv\b|resit|receipt/i.test(blob)) {
      what = t('Invoice / receipt', 'Invois / resit'); cat = 'INV';
      folder = '02_Finance/02.1_Invoices (Client)';
      why = t('Invoice/receipt keywords.', 'Keyword invois/resit.');
    } else if (client) {
      what = t('Client document', 'Dokumen client'); cat = 'ClientDoc';
      folder = '05_Clients/' + client + '/01_Contracts & Agreements';
      why = t('AI read organisation name.', 'AI baca nama organisasi.');
    } else {
      what = t('Unknown', 'Tidak dikenal pasti');
      folder = '';
      why = t('AI could not classify. Edit folder then Confirm.', 'AI tidak dapat klasifikasi. Edit folder kemudian Sahkan.');
    }
    var ext = (filename.split('.').pop() || 'pdf');
    var name = dateStr() + '_' + slug(client || cat) + '_' + cat + '_Final.' + ext;
    return { what: what, who: client || '—', where: folder, why: why, folder: folder, name: name };
  }

  function loadGis() {
    return new Promise(function (resolve, reject) {
      if (window.google && google.accounts && google.accounts.oauth2) return resolve();
      var s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.onload = resolve;
      s.onerror = function () { reject(new Error('Google script failed')); };
      document.head.appendChild(s);
    });
  }

  async function connectDrive() {
    var cid = (document.getElementById('docs-cid') || {}).value || localStorage.getItem(LS_CID) || '';
    cid = cid.trim();
    if (!cid) { showToast(t('Paste OAuth Client ID first.', 'Tampal OAuth Client ID dulu.'), 'error'); return; }
    localStorage.setItem(LS_CID, cid);
    var root = (document.getElementById('docs-root') || {}).value || '';
    if (root) localStorage.setItem(LS_ROOT, root.trim());
    await loadGis();
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: cid,
      scope: 'https://www.googleapis.com/auth/drive',
      callback: function (resp) {
        if (resp.error) { showToast(resp.error, 'error'); return; }
        accessToken = resp.access_token;
        var st = document.getElementById('docs-drive-st');
        if (st) st.textContent = t('Drive connected', 'Drive tersambung');
        showToast(t('Drive connected', 'Drive tersambung'), 'success');
      }
    });
    tokenClient.requestAccessToken({ prompt: accessToken ? '' : 'consent' });
  }

  async function driveFetch(url, opts) {
    opts = opts || {};
    opts.headers = Object.assign({ Authorization: 'Bearer ' + accessToken }, opts.headers || {});
    var res = await fetch(url, opts);
    if (!res.ok) {
      var txt = await res.text();
      throw new Error(txt.slice(0, 180) || ('Drive HTTP ' + res.status));
    }
    return res.json();
  }

  async function findOrCreateChild(parentId, name) {
    var key = parentId + '//' + name;
    if (folderCache[key]) return folderCache[key];
    var q = encodeURIComponent("mimeType='application/vnd.google-apps.folder' and trashed=false and '" + parentId + "' in parents and name='" + name.replace(/'/g, "\\'") + "'");
    var data = await driveFetch('https://www.googleapis.com/drive/v3/files?q=' + q + '&fields=files(id,name)&pageSize=5');
    var id = data.files && data.files[0] && data.files[0].id;
    if (!id) {
      var created = await driveFetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parentId]
        })
      });
      id = created.id;
    }
    folderCache[key] = id;
    return id;
  }

  async function ensurePath(rootId, path) {
    var parts = String(path || '').split('/').map(function (p) { return p.trim(); }).filter(Boolean);
    var cur = rootId;
    for (var i = 0; i < parts.length; i++) cur = await findOrCreateChild(cur, parts[i]);
    return cur;
  }

  async function uploadFile(folderId, file, newName) {
    var meta = { name: newName, parents: [folderId] };
    var fd = new FormData();
    fd.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
    fd.append('file', file, newName);
    var res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + accessToken },
      body: fd
    });
    if (!res.ok) throw new Error((await res.text()).slice(0, 180));
    return res.json();
  }

  async function fileToImages(file) {
    var isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    if (isPdf) {
      if (typeof _pdfPagesToImageBlobs !== 'function') throw new Error('PDF helper missing');
      return _pdfPagesToImageBlobs(file, 2);
    }
    if (file.type.indexOf('image/') === 0) return [file];
    throw new Error(t('Use PDF or image (JPG/PNG).', 'Guna PDF atau imej (JPG/PNG).'));
  }

  async function aiScanImages(blobs) {
    if (typeof _compressImageToBase64 !== 'function' || typeof _invokeAiProxy !== 'function') {
      throw new Error('AI helpers missing');
    }
    var first = await _compressImageToBase64(blobs[0]);
    var rec = await _invokeAiProxy({
      action: 'receipt',
      image_base64: first.base64,
      mime_type: first.mimeType || 'image/jpeg'
    });
    var images = await Promise.all(blobs.map(function (b) { return _compressImageToBase64(b); }));
    var cust = await _invokeAiProxy({
      action: 'scan_customer_document',
      images: images.map(function (img) {
        return { image_base64: img.base64, mime_type: img.mimeType };
      })
    });
    try { if (typeof _usageCaptureAi === 'function') _usageCaptureAi(); } catch (e) {}
    var who = '';
    var extra = '';
    if (cust.data && cust.data.success && cust.data.data) {
      who = String(cust.data.data.name || '').trim();
      extra = [cust.data.data.address, cust.data.data.email].filter(Boolean).join(' ');
    }
    var recData = (rec.data && rec.data.success && rec.data.data) ? rec.data.data : {};
    if (!who) who = String(recData.vendor || recData.merchant || '').trim();
    extra += ' ' + String(recData.description || '');
    return { who: who, extra: extra, raw: recData };
  }

  function injectNav() {
    if (!allowed()) {
      var n = document.getElementById('nav-docs');
      if (n) n.remove();
      return;
    }
    var label = t('Documents', 'Dokumen');
    var existing = document.getElementById('nav-docs');
    if (existing) {
      var sp = existing.querySelector('span');
      if (sp) sp.textContent = label;
      return;
    }
    var nav = document.querySelector('.sidebar-nav') || document.querySelector('nav');
    if (!nav) return;
    var a = document.createElement('div');
    a.id = 'nav-docs';
    a.className = 'nav-item';
    a.setAttribute('data-page', 'docs');
    a.style.cursor = 'pointer';
    a.innerHTML = '<i class="ti ti-folders"></i><span>' + label + '</span>';
    a.onclick = function (ev) { ev.preventDefault(); openPage('docs', {}); };
    nav.appendChild(a);
  }

  window.renderDocs = function () {
    var root = mainEl();
    if (!root) return;
    if (!allowed()) {
      root.innerHTML = '<div class="empty-state"><h3>' + t('Access denied', 'Akses ditolak') + '</h3></div>';
      return;
    }
    APP.currentPage = 'docs';
    var ht = document.getElementById('header-title');
    if (ht) ht.textContent = t('Documents', 'Dokumen');
    var cid = localStorage.getItem(LS_CID) || '';
    var rid = localStorage.getItem(LS_ROOT) || '';
    root.innerHTML =
      '<div class="card" style="padding:16px;max-width:760px">' +
      '<h2 style="margin:0 0 8px">' + t('Documents', 'Dokumen') + '</h2>' +
      '<p style="color:var(--text-2);font-size:13px">' +
        t('Connect Drive first. Confirm uploads the file into the folder.', 'Sambung Drive dulu. Sahkan akan muat naik fail ke folder.') +
      '</p>' +
      '<label class="form-label">Google OAuth Client ID</label>' +
      '<input class="form-input" id="docs-cid" value="' + esc(cid) + '">' +
      '<label class="form-label">' + t('Phion Sdn Bhd folder ID (from Drive URL)', 'ID folder Phion Sdn Bhd (dari URL Drive)') + '</label>' +
      '<input class="form-input" id="docs-root" value="' + esc(rid) + '" placeholder="1abc...">' +
      '<div style="display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap">' +
        '<button type="button" class="btn btn-outline btn-sm" id="docs-connect">' + t('Connect Drive', 'Sambung Drive') + '</button>' +
        '<span id="docs-drive-st" style="font-size:12px;color:var(--text-2)">' +
          (accessToken ? t('Drive connected', 'Drive tersambung') : t('Drive not connected', 'Drive belum sambung')) +
        '</span>' +
      '</div>' +
      '<hr style="margin:16px 0;border-color:var(--border)">' +
      '<input id="docs-file" type="file" accept="image/*,application/pdf">' +
      '<div id="docs-status" style="margin-top:8px;font-size:13px;color:var(--text-2)"></div>' +
      '<div id="docs-result"></div>' +
      '<div id="docs-log" style="margin-top:16px;font-size:12px;color:var(--text-2)"></div>' +
      '</div>';
    document.getElementById('docs-connect').onclick = connectDrive;
    document.getElementById('docs-file').onchange = function (ev) {
      var f = ev.target.files && ev.target.files[0];
      if (f) runScan(f);
    };
    loadLog();
  };

  async function runScan(file) {
    window._docsLastFile = file;
    var status = document.getElementById('docs-status');
    var box = document.getElementById('docs-result');
    if (status) status.textContent = t('AI reading document…', 'AI membaca dokumen…');
    if (box) box.innerHTML = '';
    try {
      var blobs = await fileToImages(file);
      if (status) status.textContent = t('AI classifying…', 'AI mengelaskan…');
      var ai = await aiScanImages(blobs);
      var d = decide(ai.extra, file.name, ai.who);
      renderResult(file, d);
      if (status) status.textContent = t('Review the box, then Confirm.', 'Semak petak, kemudian Sahkan.');
    } catch (e) {
      if (status) status.textContent = (e && e.message) || t('Scan failed', 'Imbas gagal');
      showToast((e && e.message) || 'Scan failed', 'error');
    }
  }

  function renderResult(file, d) {
    var box = document.getElementById('docs-result');
    if (!box) return;
    box.innerHTML =
      '<div class="card" style="padding:12px;margin-top:12px">' +
        '<div style="font-size:12px;color:var(--text-3)">' + esc(file.name) + '</div>' +
        '<div style="margin-top:10px;padding:10px;border:1px solid var(--border);border-radius:8px">' +
          '<div><b>' + t('What', 'Apa') + '</b> — ' + esc(d.what) + '</div>' +
          '<div style="margin-top:6px"><b>' + t('Who', 'Siapa') + '</b> — ' + esc(d.who) + '</div>' +
          '<div style="margin-top:6px"><b>' + t('Where', 'Mana') + '</b> — ' + esc(d.where || t('not set', 'belum ditetapkan')) + '</div>' +
          '<div style="margin-top:6px"><b>' + t('Why', 'Kenapa') + '</b> — ' + esc(d.why) + '</div>' +
        '</div>' +
        '<label class="form-label">' + t('New filename', 'Nama fail baru') + '</label>' +
        '<input class="form-input" id="docs-name" value="' + esc(d.name) + '">' +
        '<label class="form-label">' + t('Destination folder', 'Folder destinasi') + '</label>' +
        '<input class="form-input" id="docs-folder" value="' + esc(d.folder) + '">' +
        '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">' +
          '<button type="button" class="btn btn-primary btn-sm" id="docs-confirm">' + t('Confirm', 'Sahkan') + '</button>' +
          '<button type="button" class="btn btn-outline btn-sm" id="docs-retry">' + t('Try again', 'Cuba lagi') + '</button>' +
        '</div>' +
      '</div>';
    document.getElementById('docs-confirm').onclick = function () {
      confirmRow(file, document.getElementById('docs-folder').value.trim(), document.getElementById('docs-name').value.trim(), d);
    };
    document.getElementById('docs-retry').onclick = function () {
      if (window._docsLastFile) runScan(window._docsLastFile);
    };
  }

  async function confirmRow(file, folder, name, d) {
    if (!folder || !name) {
      showToast(t('Folder + name required', 'Isi folder + nama'), 'error');
      return;
    }
    if (!accessToken) {
      showToast(t('Connect Drive first.', 'Sambung Drive dulu.'), 'error');
      return;
    }
    var rootId = ((document.getElementById('docs-root') || {}).value || localStorage.getItem(LS_ROOT) || '').trim();
    if (!rootId) {
      showToast(t('Paste Phion Sdn Bhd folder ID.', 'Tampal ID folder Phion Sdn Bhd.'), 'error');
      return;
    }
    localStorage.setItem(LS_ROOT, rootId);
    try {
      showToast(t('Uploading to Drive…', 'Memuat naik ke Drive…'), 'info');
      var destId = await ensurePath(rootId, folder);
      var up = await uploadFile(destId, file, name);
      var res = await sb.from('doc_routes').insert({
        tenant_id: APP.tenant && APP.tenant.id,
        created_by: APP.user && APP.user.id,
        created_email: email(),
        original_name: file.name,
        suggested_folder: d.folder,
        suggested_name: d.name,
        final_folder: folder,
        final_name: name,
        status: 'filed'
      });
      if (res.error) { showToast(res.error.message, 'error'); return; }
      showToast(t('Uploaded to Drive', 'Dimuat naik ke Drive') + ': ' + name, 'success');
      loadLog();
      if (up && up.webViewLink) console.log(up.webViewLink);
    } catch (e) {
      showToast((e && e.message) || t('Drive upload failed', 'Gagal muat naik Drive'), 'error');
    }
  }

  async function loadLog() {
    var el = document.getElementById('docs-log');
    if (!el || !window.sb) return;
    var res = await sb.from('doc_routes').select('final_folder,final_name,created_at').order('created_at', { ascending: false }).limit(20);
    if (res.error) { el.textContent = res.error.message; return; }
    var rows = res.data || [];
    el.innerHTML = '<div style="font-weight:600;margin-bottom:6px">' + t('Recent', 'Terkini') + '</div>' +
      (rows.length ? rows.map(function (r) {
        return '<div>' + String(r.created_at || '').slice(0, 16) + ' · ' + esc(r.final_folder) + '/' + esc(r.final_name) + '</div>';
      }).join('') : t('None yet.', 'Tiada lagi.'));
  }

  function wrapOpen() {
    var orig = window.openPage;
    if (typeof orig !== 'function' || orig._docs6) return;
    window.openPage = function (page, params) {
      if (page === 'docs' || page === 'documents') {
        if (!allowed()) { showToast(t('Access denied', 'Akses ditolak'), 'error'); return; }
        try { _clearUiOverlays(); } catch (e) {}
        try { _closeMobileSidebar(); } catch (e) {}
        APP.currentPage = 'docs';
        document.querySelectorAll('.nav-item').forEach(function (el) {
          el.classList.toggle('active', el.getAttribute('data-page') === 'docs');
        });
        window.renderDocs();
        return;
      }
      return orig.apply(this, arguments);
    };
    window.openPage._docs6 = true;
  }

  function boot() { wrapOpen(); injectNav(); }
  setInterval(boot, 800);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
