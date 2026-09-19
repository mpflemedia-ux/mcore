/* Documents — mikepaulfreelancer@gmail.com only. Scan content, not filename only. */
(function () {
  var ALLOW = 'mikepaulfreelancer@gmail.com';
  function email() {
    return String((APP.user && APP.user.email) || '').trim().toLowerCase();
  }
  function allowed() { return email() === ALLOW; }
  function isBm() { return APP.language === 'bm'; }
  function t(en, bm) { return isBm() ? bm : en; }
  function mainEl() { return document.getElementById('main'); }

  var RULES = [
    { test: /fade\s*boys|fadeboys|la0068592|202403134273/i, category: 'SSM_BorangD',
      folder: '05_Clients/Fade Boys Worldwide/01_Contracts & Agreements', client: 'FadeBoysWorldwide' },
    { test: /pb\s*enterprise|pbenterprise/i, category: 'ClientDoc',
      folder: '05_Clients/PB Enterprise/01_Contracts & Agreements', client: 'PBEnterprise' },
    { test: /borang d|perakuan pendaftaran|akta pendaftaran perniagaan|ezbiz/i, category: 'SSM_BorangD',
      folder: '05_Clients/{CLIENT}/01_Contracts & Agreements' },
    { test: /invoice|\binv\b|resit|receipt/i, category: 'INV', folder: '02_Finance/02.1_Invoices (Client)' },
    { test: /contract|agreement|perjanjian/i, category: 'Contract', folder: '05_Clients/{CLIENT}/01_Contracts & Agreements' },
    { test: /\bnda\b|non[- ]disclosure/i, category: 'NDA', folder: '08_Legal/NDAs' }
  ];

  function slug(s) {
    return String(s || '').replace(/[^a-zA-Z0-9]+/g, '').slice(0, 28) || 'Client';
  }
  function dateStr() {
    var d = new Date();
    return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  }

  function classify(haystack, filename, clientHint) {
    var hit = null;
    var blob = String(haystack || '') + ' ' + String(filename || '');
    for (var i = 0; i < RULES.length; i++) {
      if (RULES[i].test.test(blob)) { hit = RULES[i]; break; }
    }
    var ext = (filename.split('.').pop() || 'pdf');
    var client = clientHint || (hit && hit.client) || '';
    if (!hit && client) {
      hit = { category: 'ClientDoc', folder: '05_Clients/{CLIENT}/01_Contracts & Agreements' };
    }
    if (!hit) {
      return { folder: '', name: dateStr() + '_Review_' + filename.replace(/[^a-zA-Z0-9.]+/g, '_'), unmatched: true };
    }
    var folder = hit.folder.replace('{CLIENT}', client || 'Client');
    var owner = slug(client || hit.client || 'Client');
    var base = filename.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9]+/g, '').slice(0, 24);
    return {
      folder: folder,
      name: dateStr() + '_' + owner + '_' + hit.category + '_' + (base || 'Doc') + '_Final.' + ext,
      unmatched: false
    };
  }

  async function pdfText(file) {
    if (typeof _loadPdfJs !== 'function') return '';
    try {
      var pdfjsLib = await _loadPdfJs();
      var pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
      var out = '';
      var n = Math.min(pdf.numPages, 2);
      for (var i = 1; i <= n; i++) {
        var page = await pdf.getPage(i);
        var content = await page.getTextContent();
        out += (content.items || []).map(function (x) { return x.str; }).join(' ') + ' ';
      }
      return out;
    } catch (e) {
      return '';
    }
  }

  async function aiClientName(file) {
    if (typeof _invokeAiProxy !== 'function' || typeof _compressImageToBase64 !== 'function') return '';
    try {
      var blobs = [file];
      var isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
      if (isPdf && typeof _pdfPagesToImageBlobs === 'function') {
        blobs = await _pdfPagesToImageBlobs(file, 2);
      } else if (file.type.indexOf('image/') !== 0 && !isPdf) {
        return '';
      }
      var images = await Promise.all(blobs.map(function (b) { return _compressImageToBase64(b); }));
      var res = await _invokeAiProxy({
        action: 'scan_customer_document',
        images: images.map(function (img) { return { image_base64: img.base64, mime_type: img.mimeType }; })
      });
      if (res.error || !res.data || !res.data.success) return '';
      try { if (typeof _usageCaptureAi === 'function') _usageCaptureAi(); } catch (e) {}
      var r = res.data.data || {};
      return String(r.name || '').trim();
    } catch (e) {
      return '';
    }
  }

  function injectNav() {
    if (!allowed()) {
      var gone = document.getElementById('nav-docs');
      if (gone) gone.remove();
      return;
    }
    var label = t('Documents', 'Dokumen');
    var existing = document.getElementById('nav-docs');
    if (existing) {
      var sp = existing.querySelector('span');
      if (sp && sp.textContent !== label) sp.textContent = label;
      return;
    }
    var nav = document.querySelector('.sidebar-nav') || document.getElementById('sidebar-nav') || document.querySelector('nav');
    if (!nav) return;
    var a = document.createElement('div');
    a.id = 'nav-docs';
    a.className = 'nav-item';
    a.setAttribute('data-page', 'docs');
    a.style.cssText = 'cursor:pointer';
    a.innerHTML = '<i class="ti ti-folders"></i><span>' + label + '</span>';
    a.onclick = function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      if (typeof openPage === 'function') openPage('docs', {});
    };
    nav.appendChild(a);
  }

  function cardHtml(f, sug, idx, statusMsg) {
    var id = 'docrow-' + idx;
    return '<div style="font-weight:600;word-break:break-all">' + f.name + '</div>' +
      (statusMsg ? '<div id="' + id + '-st" style="font-size:12px;color:var(--text-2);margin-top:4px">' + statusMsg + '</div>' : '') +
      (sug.unmatched ? '<div style="color:var(--warning);font-size:12px;margin-top:4px">' +
        t('Still unmatched after scan', 'Masih tidak sepadan selepas imbas') + '</div>' : '') +
      '<label class="form-label">' + t('Destination folder', 'Folder destinasi') + '</label>' +
      '<input class="form-input" id="' + id + '-folder" value="' + String(sug.folder).replace(/"/g, '') + '">' +
      '<label class="form-label">' + t('New filename', 'Nama fail baru') + '</label>' +
      '<input class="form-input" id="' + id + '-name" value="' + String(sug.name).replace(/"/g, '') + '">' +
      '<button type="button" class="btn btn-primary btn-sm" style="margin-top:8px">' +
        t('Confirm', 'Sahkan') + '</button>';
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
    root.innerHTML =
      '<div class="card" style="padding:16px;max-width:720px">' +
      '<h2 style="margin:0 0 8px">' + t('Documents', 'Dokumen') + '</h2>' +
      '<p style="color:var(--text-2);font-size:13px">' +
        t('Upload → system scans content → you confirm.', 'Muat naik → sistem imbas isi → anda sahkan.') +
      '</p>' +
      '<input id="docs-file" type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" multiple>' +
      '<div id="docs-list" style="margin-top:12px"></div>' +
      '<div id="docs-log" style="margin-top:16px;font-size:12px;color:var(--text-2)"></div>' +
      '</div>';
    var inp = document.getElementById('docs-file');
    if (inp) inp.onchange = function (ev) { handleFiles(ev.target.files); };
    loadLog();
  };

  async function handleFiles(fileList) {
    var box = document.getElementById('docs-list');
    if (!box) return;
    box.innerHTML = '';
    var files = Array.from(fileList || []);
    for (var idx = 0; idx < files.length; idx++) {
      (function (f, i) {
        var wrap = document.createElement('div');
        wrap.className = 'card';
        wrap.style.cssText = 'padding:12px;margin-top:10px';
        wrap.innerHTML = '<div style="font-weight:600">' + f.name + '</div><div style="font-size:12px;color:var(--text-2)">' +
          t('Scanning…', 'Mengimbas…') + '</div>';
        box.appendChild(wrap);
        scanOne(f, i, wrap);
      })(files[idx], idx);
    }
  }

  async function scanOne(f, idx, wrap) {
    var text = '';
    var isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
    if (isPdf) text = await pdfText(f);
    var sug = classify(text, f.name, '');
    if (sug.unmatched) {
      wrap.querySelector('div:last-child').textContent = t('Reading document…', 'Membaca dokumen…');
      var aiName = await aiClientName(f);
      sug = classify(text + ' ' + aiName, f.name, aiName);
    }
    wrap.innerHTML = cardHtml(f, sug, idx, sug.unmatched ? '' : t('Scanned — review then Confirm.', 'Diimbas — semak kemudian Sahkan.'));
    wrap.querySelector('button').onclick = function () {
      confirmRow(f,
        document.getElementById('docrow-' + idx + '-folder').value.trim(),
        document.getElementById('docrow-' + idx + '-name').value.trim(),
        sug);
    };
  }

  async function confirmRow(file, folder, name, sug) {
    if (!folder || !name) {
      showToast(t('Folder + name required', 'Isi folder + nama'), 'error');
      return;
    }
    try {
      var res = await sb.from('doc_routes').insert({
        tenant_id: APP.tenant && APP.tenant.id,
        created_by: APP.user && APP.user.id,
        created_email: email(),
        original_name: file.name,
        suggested_folder: sug.folder,
        suggested_name: sug.name,
        final_folder: folder,
        final_name: name,
        status: 'filed'
      });
      if (res.error) { showToast(res.error.message, 'error'); return; }
      showToast(t('Saved', 'Disimpan') + ': ' + folder + '/' + name, 'success');
      loadLog();
    } catch (e) {
      showToast(e.message || t('Save failed', 'Gagal simpan'), 'error');
    }
  }

  async function loadLog() {
    var el = document.getElementById('docs-log');
    if (!el || !window.sb) return;
    var res = await sb.from('doc_routes').select('original_name,final_folder,final_name,created_at').order('created_at', { ascending: false }).limit(20);
    if (res.error) { el.textContent = res.error.message; return; }
    var rows = res.data || [];
    el.innerHTML = '<div style="font-weight:600;margin-bottom:6px">' + t('Recent', 'Terkini') + '</div>' +
      (rows.length ? rows.map(function (r) {
        return '<div>' + String(r.created_at || '').slice(0, 16) + ' · ' + r.final_folder + '/' + r.final_name + '</div>';
      }).join('') : t('None yet.', 'Tiada lagi.'));
  }

  function wrapOpen() {
    var orig = window.openPage;
    if (typeof orig !== 'function') return;
    if (orig._docs4) return;
    window.openPage = function (page, params) {
      if (page === 'docs' || page === 'documents') {
        if (!allowed()) { showToast(t('Access denied', 'Akses ditolak'), 'error'); return; }
        try { _clearUiOverlays(); } catch (e) {}
        try { _closeMobileSidebar(); } catch (e) {}
        APP.currentPage = 'docs';
        document.querySelectorAll('.nav-item').forEach(function (el) {
          el.classList.toggle('active', el.getAttribute('data-page') === 'docs');
        });
        var title = document.getElementById('header-title');
        if (title) title.textContent = t('Documents', 'Dokumen');
        window.renderDocs();
        return;
      }
      return orig.apply(this, arguments);
    };
    window.openPage._docs4 = true;
  }

  function boot() { wrapOpen(); injectNav(); }
  setInterval(boot, 800);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
