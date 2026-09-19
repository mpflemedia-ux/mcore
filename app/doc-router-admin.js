/* Documents — mikepaulfreelancer@gmail.com only */
(function () {
  var ALLOW = 'mikepaulfreelancer@gmail.com';
  function email() {
    return String((APP.user && APP.user.email) || '').trim().toLowerCase();
  }
  function allowed() { return email() === ALLOW; }
  function isBm() { return APP.language === 'bm'; }

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
      return {
        folder: '',
        name: ds + '_Review_' + filename.replace(/[^a-zA-Z0-9.]+/g, '_'),
        unmatched: true
      };
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
    var nav = document.getElementById('sidebar-nav') || document.querySelector('.sidebar-nav') || document.querySelector('nav');
    if (!nav) return;
    var dash = nav.querySelector('[onclick*="dashboard"]');
    var a = document.createElement('div');
    a.id = 'nav-docs';
    a.className = dash ? dash.className : '';
    a.style.cssText = 'cursor:pointer;padding:8px 14px;display:flex;align-items:center;gap:8px';
    a.innerHTML = '<i class="ti ti-folders"></i><span>' + (isBm() ? 'Documents' : 'Documents') + '</span>';
    a.onclick = function () { openPage('docs', {}); };
    if (dash && dash.parentNode) dash.parentNode.insertBefore(a, dash.nextSibling);
    else nav.appendChild(a);
  }

  window.renderDocs = function () {
    var root = document.getElementById('page-content') || document.getElementById('main-content') || document.getElementById('app-root');
    if (!root) root = document.querySelector('main');
    if (!root) return;
    if (!allowed()) {
      root.innerHTML = '<div class="card" style="padding:24px">Access denied.</div>';
      return;
    }
    root.innerHTML =
      '<div class="card" style="padding:16px;max-width:720px">' +
      '<h2 style="margin:0 0 8px">Documents</h2>' +
      '<p style="color:var(--text-2);font-size:13px">Upload → semak folder & nama → Confirm. Akaun ini sahaja.</p>' +
      '<input id="docs-file" type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" multiple>' +
      '<div id="docs-list" style="margin-top:12px"></div>' +
      '<div id="docs-log" style="margin-top:16px;font-size:12px;color:var(--text-2)"></div>' +
      '</div>';
    document.getElementById('docs-file').onchange = function (ev) {
      var files = ev.target.files || [];
      var box = document.getElementById('docs-list');
      box.innerHTML = '';
      Array.from(files).forEach(function (f, idx) {
        var sug = classify(f.name);
        var id = 'docrow-' + idx;
        var wrap = document.createElement('div');
        wrap.className = 'card';
        wrap.style.cssText = 'padding:12px;margin-top:10px;border:1px solid var(--border)';
        wrap.innerHTML =
          '<div style="font-weight:600;word-break:break-all">' + f.name + '</div>' +
          (sug.unmatched ? '<div style="color:var(--warning);font-size:12px;margin-top:4px">Unmatched — isi folder manual</div>' : '') +
          '<label class="form-label">Destination folder</label>' +
          '<input class="form-input" id="' + id + '-folder" value="' + sug.folder.replace(/"/g, '') + '">' +
          '<label class="form-label">New filename</label>' +
          '<input class="form-input" id="' + id + '-name" value="' + sug.name.replace(/"/g, '') + '">' +
          '<button type="button" class="btn btn-primary btn-sm" style="margin-top:8px" data-i="' + idx + '">Confirm</button>';
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
      var row = {
        tenant_id: APP.tenant && APP.tenant.id,
        created_by: APP.user && APP.user.id,
        created_email: email(),
        original_name: file.name,
        suggested_folder: sug.folder,
        suggested_name: sug.name,
        final_folder: folder,
        final_name: name,
        status: 'filed'
      };
      var res = await sb.from('doc_routes').insert(row);
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
      (res.data || []).map(function (r) {
        return '<div>' + (r.created_at || '').slice(0, 16) + ' · ' + r.final_folder + '/' + r.final_name + '</div>';
      }).join('') || 'Tiada lagi.';
  }

  var _open = window.openPage;
  if (typeof _open === 'function' && !_open._docs) {
    window.openPage = function (page, params) {
      if (page === 'docs') {
        if (!allowed()) { showToast('Access denied', 'error'); return; }
        try { _open.call(this, 'dashboard', params || {}); } catch (e) {}
        setTimeout(function () { if (typeof renderDocs === 'function') renderDocs(); }, 30);
        return;
      }
      return _open.apply(this, arguments);
    };
    window.openPage._docs = true;
  }

  setInterval(injectNav, 1000);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectNav);
  else injectNav();
})();
