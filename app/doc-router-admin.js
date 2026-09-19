/* Documents — mikepaulfreelancer@gmail.com only */
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
    { test: /borang d|perakuan pendaftaran|akta pendaftaran perniagaan|ezbiz/i, category: 'SSM_BorangD',
      folder: '05_Clients/{CLIENT}/01_Contracts & Agreements' },
    { test: /invoice|\binv\b|resit|receipt/i, category: 'INV', folder: '02_Finance/02.1_Invoices (Client)' },
    { test: /contract|agreement|perjanjian/i, category: 'Contract', folder: '05_Clients/{CLIENT}/01_Contracts & Agreements' },
    { test: /\bnda\b|non[- ]disclosure/i, category: 'NDA', folder: '08_Legal/NDAs' }
  ];

  function classify(filename) {
    var hit = null;
    for (var i = 0; i < RULES.length; i++) {
      if (RULES[i].test.test(filename)) { hit = RULES[i]; break; }
    }
    var d = new Date();
    var ds = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    var ext = (filename.split('.').pop() || 'pdf');
    if (!hit) {
      return { folder: '', name: ds + '_Review_' + filename.replace(/[^a-zA-Z0-9.]+/g, '_'), unmatched: true };
    }
    var folder = hit.folder.replace('{CLIENT}', hit.client || 'Client');
    var base = filename.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9]+/g, '').slice(0, 28);
    return {
      folder: folder,
      name: ds + '_' + (hit.client || 'Client') + '_' + hit.category + '_' + (base || 'Doc') + '_Final.' + ext,
      unmatched: false
    };
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
        t('Upload → review folder & name → Confirm.', 'Muat naik → semak folder & nama → Sahkan.') +
      '</p>' +
      '<input id="docs-file" type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" multiple>' +
      '<div id="docs-list" style="margin-top:12px"></div>' +
      '<div id="docs-log" style="margin-top:16px;font-size:12px;color:var(--text-2)"></div>' +
      '</div>';
    var inp = document.getElementById('docs-file');
    if (inp) inp.onchange = function (ev) {
      var files = ev.target.files || [];
      var box = document.getElementById('docs-list');
      box.innerHTML = '';
      Array.from(files).forEach(function (f, idx) {
        var sug = classify(f.name);
        var id = 'docrow-' + idx;
        var wrap = document.createElement('div');
        wrap.className = 'card';
        wrap.style.cssText = 'padding:12px;margin-top:10px';
        wrap.innerHTML =
          '<div style="font-weight:600;word-break:break-all">' + f.name + '</div>' +
          (sug.unmatched ? '<div style="color:var(--warning);font-size:12px;margin-top:4px">' +
            t('Unmatched — fill folder manually', 'Tidak sepadan — isi folder sendiri') + '</div>' : '') +
          '<label class="form-label">' + t('Destination folder', 'Folder destinasi') + '</label>' +
          '<input class="form-input" id="' + id + '-folder" value="' + String(sug.folder).replace(/"/g,'') + '">' +
          '<label class="form-label">' + t('New filename', 'Nama fail baru') + '</label>' +
          '<input class="form-input" id="' + id + '-name" value="' + String(sug.name).replace(/"/g,'') + '">' +
          '<button type="button" class="btn btn-primary btn-sm" style="margin-top:8px">' +
            t('Confirm', 'Sahkan') + '</button>';
        wrap.querySelector('button').onclick = function () {
          confirmRow(f, document.getElementById(id + '-folder').value.trim(), document.getElementById(id + '-name').value.trim(), sug);
        };
        box.appendChild(wrap);
      });
    };
    loadLog();
  };

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
    if (orig._docs3) return;
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
    window.openPage._docs3 = true;
  }

  function boot() { wrapOpen(); injectNav(); }
  setInterval(boot, 800);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
