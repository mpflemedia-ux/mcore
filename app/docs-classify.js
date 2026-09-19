(function () {
  var CLIENTS = [['fade boys','Fade Boys Worldwide'],['fadeboys','Fade Boys Worldwide'],['atas angin','Atas Angin MY Sdn. Bhd'],['brozky','Brzky Empire'],['brzky','Brzky Empire'],['clore','Clore Health And Beauty'],['mayang','Mayangs'],['nuhea','Nuhea']];
  var VENDORS = [['ethye','ETHYE SDN BHD'],['print expert','PRINT EXPERT SDN BHD']];
  var OWNER = /phion|puteri nur rabiatul|puteri nur rabiyatul|phubieyas|al-?adawiyah/i;
  function norm(s) { return String(s || '').replace(/[_\-]+/g, ' ').replace(/\s+/g, ' '); }
  var TYPES = [
    { key: 'Brand', re: /logo|letterhead|banner|poster|name card/i, label: 'Brand asset' },
    { key: 'StaffLetter', re: /lanjutan percubaan|extension of probation|probation|percubaan|surat amaran|offer letter|\bloa\b|surat lantikan/i, label: 'Staff letter' },
    { key: 'SSM', re: /\bssm\b|borang d|form 9|form 24|form 49/i, label: 'SSM / company secretarial' },
    { key: 'Invoice', re: /\binvoice\b|\binvois\b/i, label: 'Invoice' },
    { key: 'Receipt', re: /\breceipt\b|\bresit\b/i, label: 'Receipt' },
    { key: 'Letter', re: /\bletter\b|\bsurat\b/i, label: 'Letter' }
  ];
  function phionPath(key) {
    return ({
      Brand: '04_Brand & Marketing/04.2_Logo & Visual Assets',
      StaffLetter: '03_Human Resource/03.1_Employee Records',
      SSM: '01_Administration/01.1_Company Registration & SSM',
      Invoice: '02_Finance/02.1_Invoices (Client)',
      Receipt: '02_Finance/02.1_Invoices (Client)',
      Letter: '01_Administration',
      Other: '01_Administration'
    })[key] || '01_Administration';
  }
  function clientSlot(key) {
    return ({ SSM: '01_Contracts & Agreements', Invoice: '06_Invoices & Payment', Receipt: '06_Invoices & Payment', Letter: '07_Meeting Notes & Communication' })[key] || '07_Meeting Notes & Communication';
  }
  function detectType(blob, filename) {
    if (/\.(png|jpe?g|webp|gif|svg|ai)$/i.test(filename || '')) return { key: 'Brand', label: 'Brand asset' };
    for (var i = 0; i < TYPES.length; i++) if (TYPES[i].re.test(blob)) return TYPES[i];
    return { key: 'Other', label: 'Other' };
  }
  function matchList(blob, list) {
    var s = String(blob || '').toLowerCase();
    for (var i = 0; i < list.length; i++) if (s.indexOf(list[i][0]) >= 0) return list[i][1];
    return null;
  }
  function folderFor(typeKey, who, blob) {
    var isOwner = OWNER.test(blob) || OWNER.test(who || '');
    var client = matchList(blob, CLIENTS) || matchList(who || '', CLIENTS);
    var vendor = matchList(blob, VENDORS) || matchList(who || '', VENDORS);
    if (typeKey === 'Brand' || typeKey === 'StaffLetter') return phionPath(typeKey);
    if (vendor && !client) return '06_Partners & Vendors/06.2_Vendors/' + vendor;
    if (client && !isOwner) return '05_Clients/' + client + '/' + clientSlot(typeKey);
    return phionPath(typeKey);
  }
  function setLine(box, label, value) {
    var nodes = box.querySelectorAll('div');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.querySelector('b') && el.textContent.indexOf(label) === 0 && el.children.length <= 2) {
        el.innerHTML = '<b>' + label + '</b> \u2014 ' + value;
      }
    }
  }
  function apply() {
    if (window._docsAiClass && window._docsAiClass.folder) return;
    var folder = document.getElementById('docs-folder');
    var box = document.getElementById('docs-result');
    if (!folder || !box) return;
    var orig = window._docsOrigName || (window._docsLastFile && window._docsLastFile.name) || '';
    var who = '';
    var m = (box.textContent || '').match(/Who\s*[\u2014\-]\s*(.+)/i);
    if (m) who = m[1].split('\n')[0].trim();
    var blob = norm([orig, window._docsScanText || '', who].join(' '));
    var typ = detectType(blob, orig);
    var next = folderFor(typ.key, who, blob);
    if (next) folder.value = next;
    setLine(box, 'What', typ.label);
    setLine(box, 'Where', next);
  }
  setInterval(apply, 500);
})();
