(function () {
  var ROOT = '1XLo0KDErqPiGDXXiuwzNa9nW7TF0Kn74';
  var CID = '490414473408-0gb8sv4d1s51rvorepp7bna1j7igenj7.apps.googleusercontent.com';
  var cache = {};
  var busy = false;

  function t(en, bm) { return APP.language === 'bm' ? bm : en; }
  function token() {
    return window._docsAccessToken || (typeof window._docsGetToken === 'function' && window._docsGetToken()) || null;
  }
  function ensureToken() {
    return new Promise(function (resolve, reject) {
      var tok = token();
      if (tok) return resolve(tok);
      if (!window.google || !google.accounts || !google.accounts.oauth2) {
        return reject(new Error(t('Connect Drive first.', 'Sambung Drive dulu.')));
      }
      var client = google.accounts.oauth2.initTokenClient({
        client_id: CID,
        scope: 'https://www.googleapis.com/auth/drive',
        callback: function (resp) {
          if (!resp || !resp.access_token) return reject(new Error(resp && resp.error || 'No token'));
          window._docsAccessToken = resp.access_token;
          resolve(resp.access_token);
        }
      });
      client.requestAccessToken({ prompt: '' });
    });
  }

  async function api(url, opts) {
    var tok = await ensureToken();
    opts = opts || {};
    opts.headers = Object.assign({ Authorization: 'Bearer ' + tok }, opts.headers || {});
    var res = await fetch(url, opts);
    if (!res.ok) throw new Error((await res.text()).slice(0, 200));
    if (res.status === 204) return {};
    return res.json();
  }

  function driveUrl(path, extra) {
    extra = extra || '';
    return 'https://www.googleapis.com' + path +
      (path.indexOf('?') >= 0 ? '&' : '?') +
      'supportsAllDrives=true&includeItemsFromAllDrives=true' + extra;
  }

  async function child(parentId, name) {
    var key = parentId + '//' + name;
    if (cache[key]) return cache[key];
    var q = encodeURIComponent("mimeType='application/vnd.google-apps.folder' and trashed=false and '" + parentId + "' in parents and name='" + name.replace(/'/g, "\\'") + "'");
    var data = await api(driveUrl('/drive/v3/files') + '&q=' + q + '&fields=files(id,name)&pageSize=5');
    var id = data.files && data.files[0] && data.files[0].id;
    if (!id) {
      var created = await api(driveUrl('/drive/v3/files'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] })
      });
      id = created.id;
    }
    cache[key] = id;
    return id;
  }

  async function ensurePath(path) {
    var parts = String(path || '').split('/').map(function (p) { return p.trim(); }).filter(Boolean);
    var cur = ROOT;
    for (var i = 0; i < parts.length; i++) cur = await child(cur, parts[i]);
    return cur;
  }

  async function upload(folderId, file, newName) {
    var tok = await ensureToken();
    var meta = { name: newName, parents: [folderId] };
    var fd = new FormData();
    fd.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
    fd.append('file', file, newName);
    var res = await fetch(driveUrl('/upload/drive/v3/files?uploadType=multipart') + '&fields=id,name,webViewLink', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + tok },
      body: fd
    });
    if (!res.ok) throw new Error((await res.text()).slice(0, 200));
    return res.json();
  }

  async function run() {
    if (busy) return;
    var file = window._docsLastFile;
    var folderEl = document.getElementById('docs-folder');
    var nameEl = document.getElementById('docs-name');
    var folder = folderEl && folderEl.value.trim();
    var name = nameEl && nameEl.value.trim();
    if (!file) { showToast(t('Choose a file first.', 'Pilih fail dulu.'), 'error'); return; }
    if (!folder || !name) { showToast(t('Folder + name required', 'Isi folder + nama'), 'error'); return; }
    busy = true;
    try {
      showToast(t('Uploading to Drive…', 'Memuat naik ke Drive…'), 'info');
      var dest = await ensurePath(folder);
      await upload(dest, file, name);
      showToast(t('Uploaded to Drive', 'Dimuat naik ke Drive') + ': ' + name, 'success');
      try {
        await sb.from('doc_routes').insert({
          tenant_id: APP.tenant && APP.tenant.id,
          created_by: APP.user && APP.user.id,
          created_email: (APP.user && APP.user.email) || '',
          original_name: file.name,
          suggested_folder: folder,
          suggested_name: name,
          final_folder: folder,
          final_name: name,
          status: 'filed'
        });
      } catch (e) {}
    } catch (e) {
      showToast(e.message || t('Drive upload failed', 'Gagal muat naik Drive'), 'error');
    }
    busy = false;
  }

  document.addEventListener('click', function (e) {
    var tEl = e.target;
    if (!tEl) return;
    if (tEl.id !== 'docs-confirm' && !(tEl.closest && tEl.closest('#docs-confirm'))) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    run();
  }, true);
})();
