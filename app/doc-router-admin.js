/* Documents — mikepaulfreelancer@gmail.com only */
(function () {
  var ALLOW = 'mikepaulfreelancer@gmail.com';
  function email() {
    return String((APP.user && APP.user.email) || '').trim().toLowerCase();
  }
  function allowed() { return email() === ALLOW; }
  function isBm() { return APP.language === 'bm'; }
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
    if (document.getElementById('nav-docs')) return;
    var nav = document.querySelector('.sidebar-nav') || document.getElementById('sidebar-nav') || document.querySelector('nav');
    if (!nav) return;
    var a = document.createElement('div');
    a.id = 'nav-docs';
    a.className = 'nav-item';
    a.dataset.page = 'docs';
    a.setAttribute('data-page', 'docs');
    a.style.cssText = 'cursor:pointer';
    a.innerHTML = '<i class="ti ti-folders"></i><span>Documents</span>';
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
      root.innerHTML = '<div class="empty-state"><h3>Access denied</h3></div>';
      return;
    }
    APP.currentPage = 'docs';
    var ht = document.getElementById('header-title');
    if (ht) ht.textContent = 'Documents';
    root.innerHTML =
      '<div class="card" style="padding:16px;max-width:720px">' +
      '<h2 style="margin:0 0 8px">Documents</h2>' +
      '<p style="color:var(--text-2);font-size:13px">Upload → semak folder & nama → Confirm.</p>' +
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
          (sug.unmatched ? '<div style="color:var(--warning);font-size:12px;margin-top:4px">Unmatched — isi folder manual</div>' : '') +
          '<label class="form-label">Destination folder</label>' +
          '<input class="form-input" id="' + id + '-folder" value="' + String(sug.folder).replace(/"/g,'') + '">' +
          '<label class="form-label">New filename</label>' +
          '<input class="form-input" id="' + id + '-name" value="' + String(sug.name).replace(/"/g,'') + '">' +
          '<button type="button" class="btn btn-primary btn-sm" style="margin-top:8px">Confirm</button>';
        wrap.querySelector('button').onclick = function () {
          confirmRow(f, document.getElementById(id + '-folder').value.trim(), document.getElementById(id + '-name').value.trim(), sug);
        };
        box.appendChild(wrap);
      });
    };
    loadLog();
  };

  async function confirmRow(file, folder, name, sug) {
    if (!folder || !name) { showToast(isBm() ? 'Isi folder + nama' : 'Folder + name required', 'error'); return; }
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
      showToast('Filed: ' + folder + '/' + name, 'success');
      loadLog();
    } catch (e) {
      showToast(e.message || 'Save failed', 'error');
    }
  }

  async function loadLog() {
    var el = document.getElementById('docs-log');
    if (!el || !window.sb) return;
    var res = await sb.from('doc_routes').select('original_name,final_folder,final_name,created_at').order('created_at', { ascending: false }).limit(20);
    if (res.error) { el.textContent = res.error.message; return; }
    el.innerHTML = '<div style="font-weight:600;margin-bottom:6px">Recent</div>' +
      ((res.data || []).map(function (r) {
        return '<div>' + String(r.created_at || '').slice(0, 16) + ' · ' + r.final_folder + '/' + r.final_name + '</div>';
      }).join('') || 'Tiada lagi.');
  }

  function wrapOpen() {
    var orig = window.openPage;
    if (typeof orig !== 'function') return;
    if (orig._docs2) return;
    window.openPage = function (page, params) {
      if (page === 'docs' || page === 'documents') {
        if (!allowed()) { showToast('Access denied', 'error'); return; }
        try { _clearUiOverlays(); } catch (e) {}
        try { _closeMobileSidebar(); } catch (e) {}
        APP.currentPage = 'docs';
        document.querySelectorAll('.nav-item').forEach(function (el) {
          el.classList.toggle('active', el.getAttribute('data-page') === 'docs');
        });
        var title = document.getElementById('header-title');
        if (title) title.textContent = 'Documents';
        window.renderDocs();
        return;
      }
      return orig.apply(this, arguments);
    };
    window.openPage._docs2 = true;
  }

  function boot() { wrapOpen(); injectNav(); }
  setInterval(boot, 800);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
