/* Seed Phion SOP folders + new client pack. Email-gated page only. */
(function () {
  var SOP = [
    '01_Administration',
    '02_Finance',
    '03_Human Resource',
    '04_Brand & Marketing',
    '05_Clients',
    '06_Partners & Vendors',
    '07_Projects',
    '08_Legal',
    '09_Operations',
    '99_Archive'
  ];
  var ROOT = '1XLo0KDErqPiGDXXiuwzNa9nW7TF0Kn74';
  var cache = {};

  function token() {
    return window._docsAccessToken || (typeof window._docsGetToken === 'function' && window._docsGetToken()) || null;
  }
  function rootId() {
    var el = document.getElementById('docs-root');
    return (el && el.value.trim()) || localStorage.getItem('mcore_docs_drive_root') || ROOT;
  }
  function t(en, bm) { return APP.language === 'bm' ? bm : en; }

  async function api(url, opts) {
    var tok = token();
    if (!tok) throw new Error(t('Connect Drive first.', 'Sambung Drive dulu.'));
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

  async function listClients(clientsId) {
    var data = await api('https://www.googleapis.com/drive/v3/files?q=' +
      encodeURIComponent("mimeType='application/vnd.google-apps.folder' and trashed=false and '" + clientsId + "' in parents") +
      '&fields=files(id,name)&pageSize=100');
    return (data.files || []).map(function (f) { return f.name; }).sort();
  }

  function status(msg) {
    var el = document.getElementById('docs-seed-st');
    if (el) el.textContent = msg;
  }

  async function seedRoot() {
    try {
      status(t('Seeding Phion SB folders…', 'Sedang seed folder Phion SB…'));
      var ids = await seedInto(rootId());
      var names = await listClients(ids['05_Clients']);
      status(t('Root OK. Clients: ', 'Root OK. Client: ') + (names.join(', ') || '—'));
      showToast(t('Folders seeded', 'Folder sudah di-seed'), 'success');
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
      var rootIds = await seedInto(rootId());
      var clientId = await child(rootIds['05_Clients'], name);
      await seedInto(clientId);
      status(t('Created ', 'Dicipta ') + '05_Clients/' + name + ' + SOP folders');
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
