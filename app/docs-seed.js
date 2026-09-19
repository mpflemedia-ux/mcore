(function () {
  var ROOT = '1XLo0KDErqPiGDXXiuwzNa9nW7TF0Kn74';
  var CID = '490414473408-0gb8sv4d1s51rvorepp7bna1j7igenj7.apps.googleusercontent.com';
  var PHION_FULL = {
    '01_Administration': {
      '01.1_Company Registration & SSM': ['Form 9','Form 24','Form 49','Constitution_MA','Annual Return','SSM Correspondence'],
      '01.2_Licenses & Permits': ['Business Premise License','Industry License','Renewal Tracking'],
      '01.3_Policies & SOPs': ['Company Policies','Standard Operating Procedures','Employee Handbook'],
      '01.4_Meeting Minutes': ['Board of Directors','Management Meeting','AGM_EGM'],
      '01.5_Office & Facilities': ['Tenancy Agreement','Utility Bills','Office Inventory']
    },
    '02_Finance': {
      '02.1_Invoices (Client)': ['Outstanding','Credit Notes'],
      '02.2_Invoices (Vendor)': ['Recurring Vendors'],
      '02.3_Bank Statements': [],
      '02.4_Budgets & Financial Reports': ['Annual Budget','Monthly Management Account','Cashflow Projection'],
      '02.5_Tax & Accounting': ['SST Returns','Income Tax','Audited Financial Statements','LHDN Letters'],
      '02.6_Payment Vouchers & Claims': ['Staff Claims','Payment Vouchers']
    },
    '03_Human Resource': {
      '03.1_Employee Records': ['Active Employees','Former Employees'],
      '03.2_Payroll & Claims': ['Payslips','Claims & Reimbursement','EPF_SOCSO'],
      '03.3_Recruitment': ['Job Descriptions','Candidates','Offer Letters'],
      '03.4_Training & Development': ['Training Calendar','Certificates'],
      '03.5_Leave & Attendance': ['Leave Applications','Leave Balance'],
      '03.6_HR Policies & Forms': []
    },
    '04_Brand & Marketing': {
      '04.1_Brand Guidelines': [],
      '04.2_Logo & Visual Assets': ['Primary Logo','Secondary Logo','Social Media Kit'],
      '04.3_Marketing Materials': ['Brochure','Pitch Deck','Name Card','Email Signature'],
      '04.4_Website & Digital': [],
      '04.5_Social Media': ['Content Calendar','Graphics','Analytics'],
      '04.6_Campaigns': []
    },
    '05_Clients': {
      '_Client List & Overview': [],
      '_Archive': []
    },
    '06_Partners & Vendors': {
      '06.1_Partners': [],
      '06.2_Vendors': []
    },
    '07_Projects': {},
    '08_Legal': {
      '08.1_Master Contracts': [],
      '08.2_NDAs': [],
      '08.3_Intellectual Property': []
    },
    '09_Operations': {
      '09.1_Templates': [],
      '09.2_Tools & Software': [],
      '09.3_Inventory & Assets': []
    },
    '99_Archive': {}
  };
  var CLIENT_TREE = {
    '01_Administration': ['01.1_Company Registration & SSM','01.2_Licenses & Permits','01.3_Policies & SOPs','01.4_Meeting Minutes','01.5_Office & Facilities'],
    '02_Finance': ['02.1_Invoices (Client)','02.2_Invoices (Vendor)','02.3_Bank Statements','02.4_Budgets & Financial Reports','02.5_Tax & Accounting','02.6_Payment Vouchers & Claims'],
    '03_Human Resource': ['03.1_Employee Records','03.2_Payroll & Claims','03.3_Recruitment','03.4_Training & Development','03.5_Leave & Attendance','03.6_HR Policies & Forms'],
    '04_Brand & Marketing': ['04.1_Brand Guidelines','04.2_Logo & Visual Assets','04.3_Marketing Materials','04.4_Website & Digital','04.5_Social Media','04.6_Campaigns'],
    '06_Partners & Vendors': ['06.1_Partners','06.2_Vendors'],
    '07_Projects': [],
    '08_Legal': ['08.1_Master Contracts','08.2_NDAs','08.3_Intellectual Property'],
    '09_Operations': ['09.1_Templates','09.2_Tools & Software','09.3_Inventory & Assets'],
    '99_Archive': []
  };
  var cache = {};
  function token() { return window._docsAccessToken || (typeof window._docsGetToken === 'function' && window._docsGetToken()) || null; }
  function t(en, bm) { return APP.language === 'bm' ? bm : en; }
  function status(msg) { var el = document.getElementById('docs-seed-st'); if (el) el.textContent = msg; }
  function ensureToken() {
    return new Promise(function (resolve, reject) {
      var tok = token();
      if (tok) return resolve(tok);
      if (!window.google || !google.accounts || !google.accounts.oauth2) return reject(new Error(t('Connect Drive first.', 'Sambung Drive dulu.')));
      var client = google.accounts.oauth2.initTokenClient({
        client_id: CID, scope: 'https://www.googleapis.com/auth/drive',
        callback: function (resp) {
          if (!resp || !resp.access_token) return reject(new Error((resp && resp.error) || 'No token'));
          window._docsAccessToken = resp.access_token; resolve(resp.access_token);
        }
      });
      client.requestAccessToken({ prompt: '' });
    });
  }
  async function api(url, opts) {
    var tok = await ensureToken();
    opts = opts || {}; opts.headers = Object.assign({ Authorization: 'Bearer ' + tok }, opts.headers || {});
    var res = await fetch(url, opts);
    if (!res.ok) throw new Error((await res.text()).slice(0, 160));
    return res.json();
  }
  async function child(parentId, name) {
    var key = parentId + '//' + name;
    if (cache[key]) return cache[key];
    var q = encodeURIComponent("mimeType='application/vnd.google-apps.folder' and trashed=false and '" + parentId + "' in parents and name='" + name.replace(/'/g, "\\'") + "'");
    var data = await api('https://www.googleapis.com/drive/v3/files?q=' + q + '&fields=files(id,name)&pageSize=5&supportsAllDrives=true&includeItemsFromAllDrives=true');
    var id = data.files && data.files[0] && data.files[0].id;
    if (!id) {
      var created = await api('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] })
      });
      id = created.id;
    }
    cache[key] = id; return id;
  }
  async function seedNode(parentId, node) {
    if (!node) return;
    if (Array.isArray(node)) {
      for (var i = 0; i < node.length; i++) await child(parentId, node[i]);
      return;
    }
    var keys = Object.keys(node);
    for (var k = 0; k < keys.length; k++) {
      status(t('Seeding ', 'Seed ') + keys[k]);
      var id = await child(parentId, keys[k]);
      await seedNode(id, node[keys[k]]);
    }
  }
  async function seedFlat(parentId, tree) {
    var keys = Object.keys(tree);
    for (var i = 0; i < keys.length; i++) {
      var id = await child(parentId, keys[i]);
      var subs = tree[keys[i]] || [];
      for (var j = 0; j < subs.length; j++) await child(id, subs[j]);
    }
  }
  async function listClients(clientsId) {
    var data = await api('https://www.googleapis.com/drive/v3/files?q=' +
      encodeURIComponent("mimeType='application/vnd.google-apps.folder' and trashed=false and '" + clientsId + "' in parents") +
      '&fields=files(id,name)&pageSize=100&supportsAllDrives=true&includeItemsFromAllDrives=true');
    return (data.files || []).filter(function (f) { return f.name.indexOf('_') !== 0; });
  }
  async function seedRoot() {
    try {
      await ensureToken();
      await seedNode(ROOT, PHION_FULL);
      var clientsId = await child(ROOT, '05_Clients');
      var clients = await listClients(clientsId);
      for (var i = 0; i < clients.length; i++) {
        status(t('Client SOP ', 'SOP client ') + clients[i].name);
        await seedFlat(clients[i].id, CLIENT_TREE);
      }
      status(t('Full SOP ready', 'SOP penuh sedia'));
      showToast(t('Folders seeded', 'Folder sudah di-seed'), 'success');
    } catch (e) { status(e.message || 'Seed failed'); showToast(e.message || 'Seed failed', 'error'); }
  }
  async function seedClient() {
    var name = prompt(t('New client folder name', 'Nama folder client baru'));
    if (!name) return; name = name.trim(); if (!name) return;
    try {
      await ensureToken();
      var clientsId = await child(ROOT, '05_Clients');
      var clientId = await child(clientsId, name);
      await seedFlat(clientId, CLIENT_TREE);
      status(t('Created ', 'Dicipta ') + '05_Clients/' + name);
      showToast(t('Client folder ready', 'Folder client sedia'), 'success');
    } catch (e) { showToast(e.message || 'Failed', 'error'); }
  }
  function inject() {
    if (!document.getElementById('docs-connect')) return;
    if (document.getElementById('docs-seed')) return;
    var btn = document.getElementById('docs-connect');
    var wrap = document.createElement('div');
    wrap.id = 'docs-seed';
    wrap.style.cssText = 'margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center';
    wrap.innerHTML = '<button type="button" class="btn btn-outline btn-sm" id="docs-seed-root">' + t('Seed folders', 'Seed folder') + '</button><button type="button" class="btn btn-outline btn-sm" id="docs-seed-client">' + t('New client', 'Client baru') + '</button><div id="docs-seed-st" style="font-size:12px;color:var(--text-2);overflow-wrap:anywhere;flex:1 1 100%"></div>';
    btn.parentNode.parentNode.insertBefore(wrap, btn.parentNode.nextSibling);
    document.getElementById('docs-seed-root').onclick = seedRoot;
    document.getElementById('docs-seed-client').onclick = seedClient;
  }
  setInterval(inject, 700);
})();
