/* Documents — email gate + petty-cash AI pipeline */
(function () {
  var ALLOW = 'mikepaulfreelancer@gmail.com';
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
    return String(s || '').replace(/[^a-zA-Z0-9]+/g, '').slice(0, 28) || 'Doc';
  }
  function dateStr() {
    var d = new Date();
    return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  }

  function pickWho(blob, fallback) {
    var m = blob.match(/ETHYE[^\n,]{0,40}/i);
    if (m) return m[0].replace(/[^A-Za-z0-9 .&-]/g, ' ').trim();
    m = blob.match(/BRZKY[^\n,]{0,30}/i);
    if (m) return m[0].replace(/[^A-Za-z0-9 .&-]/g, ' ').trim();
    return fallback || '';
  }

  function decide(text, filename, who) {
    var blob = (text || '') + ' ' + (filename || '') + ' ' + (who || '');
    var what = '', folder = '', client = who || '', cat = 'Doc';
    if (/duitnow|fund transfer|from account|recipient'?s duitnow|transaction details|transaction approval/i.test(blob)) {
      what = t('DuitNow / bank transfer', 'DuitNow / pindahan bank');
      cat = 'BankTransfer';
      client = pickWho(blob, client) || 'Bank';
      folder = '02_Finance/02.4_Bank Statements';
    } else if (/fade\s*boys|fadeboys|la0068592|202403134273/i.test(blob)) {
      what = 'SSM / Borang D'; cat = 'SSM_BorangD'; client = client || 'Fade Boys Worldwide';
      folder = '05_Clients/Fade Boys Worldwide/01_Contracts & Agreements';
    } else if (/borang d|perakuan pendaftaran|akta pendaftaran perniagaan|ezbiz|ssm/i.test(blob)) {
      what = 'SSM / Borang D'; cat = 'SSM_BorangD';
      folder = '05_Clients/' + (client || 'Client') + '/01_Contracts & Agreements';
    } else if (/invoice|\binv\b|resit|receipt/i.test(blob)) {
      what = t('Invoice / receipt', 'Invois / resit'); cat = 'INV';
      folder = '02_Finance/02.1_Invoices (Client)';
    } else if (/pb\s*enterprise|pbenterprise/i.test(blob)) {
      what = t('Client document', 'Dokumen client'); cat = 'ClientDoc'; client = client || 'PB Enterprise';
      folder = '05_Clients/PB Enterprise/01_Contracts & Agreements';
    } else if (client) {
      what = t('Client document', 'Dokumen client'); cat = 'ClientDoc';
      folder = '05_Clients/' + client + '/01_Contracts & Agreements';
    } else {
      what = t('Unknown', 'Tidak dikenal pasti');
      folder = '';
    }
    var ext = (filename.split('.').pop() || 'pdf');
    var name = dateStr() + '_' + slug(client || cat) + '_' + cat + '_Final.' + ext;
    return { what: what, who: client || '—', where: folder, folder: folder, name: name };
  }

  async function pdfAllText(file) {
    if (typeof _loadPdfJs !== 'function') return '';
    try {
      var pdfjsLib = await _loadPdfJs();
      var pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
      var out = '';
      var n = Math.min(pdf.numPages, 4);
      for (var i = 1; i <= n; i++) {
        var page = await pdf.getPage(i);
        var content = await page.getTextContent();
        out += (content.items || []).map(function (x) { return x.str; }).join(' ') + ' ';
      }
      return out;
    } catch (e) { return ''; }
  }

  async function fileToImages(file) {
    var isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    if (isPdf) {
      if (typeof _pdfPagesToImageBlobs !== 'function') throw new Error('PDF helper missing');
      return _pdfPagesToImageBlobs(file, 4);
    }
    if (file.type.indexOf('image/') === 0) return [file];
    throw new Error(t('Use PDF or image (JPG/PNG).', 'Guna PDF atau imej (JPG/PNG).'));
  }

  async function aiScanImages(blobs) {
    if (typeof _compressImageToBase64 !== 'function' || typeof _invokeAiProxy !== 'function') {
      throw new Error('AI helpers missing');
    }
    var images = await Promise.all(blobs.map(function (b) { return _compressImageToBase64(b); }));
    var rec = await _invokeAiProxy({
      action: 'receipt',
      image_base64: images[images.length - 1].base64,
      mime_type: images[images.length - 1].mimeType || 'image/jpeg'
    });
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
    extra += ' ' + String(recData.description || '') + ' ' + String(recData.amount || '');
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
    root.innerHTML =
      '<div class="card" style="padding:16px;max-width:760px">' +
      '<h2 style="margin:0 0 8px">' + t('Documents', 'Dokumen') + '</h2>' +
      '<p style="color:var(--text-2);font-size:13px">' +
        t('1. Upload  ·  2. AI scan all pages  ·  3. Confirm or Try again', '1. Muat naik  ·  2. AI imbas semua page  ·  3. Sahkan atau Cuba lagi') +
      '</p>' +
      '<input id="docs-file" type="file" accept="image/*,application/pdf">' +
      '<div id="docs-status" style="margin-top:8px;font-size:13px;color:var(--text-2)"></div>' +
      '<div id="docs-result"></div>' +
      '<div id="docs-log" style="margin-top:16px;font-size:12px;color:var(--text-2)"></div>' +
      '</div>';
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
    if (status) status.textContent = t('AI reading all pages…', 'AI membaca semua page…');
    if (box) box.innerHTML = '';
    try {
      var text = '';
      if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') text = await pdfAllText(file);
      var blobs = await fileToImages(file);
      if (status) status.textContent = t('AI classifying…', 'AI mengelaskan…');
      var ai = await aiScanImages(blobs);
      var d = decide(text + ' ' + ai.extra, file.name, ai.who);
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
    showToast(t('Saved', 'Disimpan') + ': ' + folder + '/' + name, 'success');
    loadLog();
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
