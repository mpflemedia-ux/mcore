/* Seed Phion SOP folders + pack each existing client. */
(function () {
  var SOP = [
    '01_Administration','02_Finance','03_Human Resource','04_Brand & Marketing',
    '05_Clients','06_Partners & Vendors','07_Projects','08_Legal','09_Operations','99_Archive'
  ];
  var ROOT = '1XLo0KDErqPiGDXXiuwzNa9nW7TF0Kn74';
  var CID = '490414473408-0gb8sv4d1s51rvorepp7bna1j7igenj7.apps.googleusercontent.com';
  var cache = {};

  function token() {
    return window._docsAccessToken || (typeof window._docsGetToken === 'function' && window._docsGetToken()) || null;
  }
  function t(en, bm) { return APP.language === 'bm' ? bm : en; }
  function status(msg) {
    var el = document.getElementById('docs-seed-st');
    if (el) el.textContent = msg;
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
          if (resp.error || !resp.access_token) {
            reject(new Error(resp.error || 'No token'));
            return;
          }
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
    if (!res.ok) throw new Error((await res.text()).slice(0, 160));
    return res.json();
  }

  async function child(parentId, name) {
    var key = parentId + '//' + name;
    if (cache[key]) return cache[key];
    var q = encodeURIComponent("mimeType='application/vnd.google-apps.folder' and trashed=false and '" + parentId + "' in parents and name='" + name.replace(/'/g, "\\'") + "'");
    var data = await api('https://www.googleapis.com/drive/v3/files?q=' + q + '&fields=files(id,name)&pageSize=5');
    var id = data.files && data.files[0] && data.files[0].id;
    if (!id) {
      var created = await api('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] })
      });
      id = created.id;
    }
    cache[key] = id;
    return id;
  }

  async function seedInto(parentId) {
    var ids = {};
    for (var i = 0; i < SOP.length; i++) ids[SOP[i]] = await child(parentId, SOP[i]);
    return ids;
  }

  async function listClientFolders(clientsId) {
    var data = await api('https://www.googleapis.com/drive/v3/files?q=' +
      encodeURIComponent("mimeType='application/vnd.google-apps.folder' and trashed=false and '" + clientsId + "' in parents") +
      '&fields=files(id,name)&pageSize=100');
    return (data.files || []).sort(function (a, b) { return String(a.name).localeCompare(b.name); });
  }

  async function seedRoot() {
    try {
      status(t('Seeding Phion SB folders…', 'Sedang seed folder Phion SB…'));
      await ensureToken();
      var ids = await seedInto(ROOT);
      var clients = await listClientFolders(ids['05_Clients']);
      for (var i = 0; i < clients.length; i++) {
        status(t('Packing client ', 'Isi folder client ') + (i + 1) + '/' + clients.length + ' — ' + clients[i].name);
        await seedInto(clients[i].id);
      }
      var names = clients.map(function (c) { return c.name; });
      status(t('Done. Packed: ', 'Siap. Diisi: ') + (names.join(', ') || '—'));
      showToast(t('Client folders packed', 'Folder client sudah diisi'), 'success');
    } catch (e) {
      status(e.message || 'Seed failed');
      showToast(e.message || 'Seed failed', 'error');
    }
  }

  async function seedClient() {
    var name = prompt(t('New client folder name', 'Nama folder client baru'));
    if (!name) return;
    name = name.trim();
    if (!name) return;
    try {
      status(t('Creating client…', 'Mencipta client…'));
      await ensureToken();
      var rootIds = await seedInto(ROOT);
      var clientId = await child(rootIds['05_Clients'], name);
      await seedInto(clientId);
      status(t('Created ', 'Dicipta ') + '05_Clients/' + name);
      showToast(t('Client folder ready', 'Folder client sedia'), 'success');
    } catch (e) {
      status(e.message || 'Failed');
      showToast(e.message || 'Failed', 'error');
    }
  }

  function inject() {
    if (!document.getElementById('docs-connect')) return;
    if (document.getElementById('docs-seed')) return;
    var btn = document.getElementById('docs-connect');
    var wrap = document.createElement('div');
    wrap.id = 'docs-seed';
    wrap.style.cssText = 'margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center';
    wrap.innerHTML =
      '<button type="button" class="btn btn-outline btn-sm" id="docs-seed-root">' +
        t('Seed folders', 'Seed folder') + '</button>' +
      '<button type="button" class="btn btn-outline btn-sm" id="docs-seed-client">' +
        t('New client', 'Client baru') + '</button>' +
      '<div id="docs-seed-st" style="font-size:12px;color:var(--text-2);overflow-wrap:anywhere;flex:1 1 100%"></div>';
    btn.parentNode.parentNode.insertBefore(wrap, btn.parentNode.nextSibling);
    document.getElementById('docs-seed-root').onclick = seedRoot;
    document.getElementById('docs-seed-client').onclick = seedClient;
  }

  setInterval(inject, 700);
})();
