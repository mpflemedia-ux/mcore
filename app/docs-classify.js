(function () {
  var CLIENTS = [
    ['fade boys', 'Fade Boys Worldwide'],
    ['fadeboys', 'Fade Boys Worldwide'],
    ['atas angin', 'Atas Angin MY Sdn. Bhd'],
    ['brozky', 'Brzky Empire'],
    ['brzky', 'Brzky Empire'],
    ['clore', 'Clore Health And Beauty'],
    ['mayang', 'Mayangs'],
    ['nuhea', 'Nuhea'],
    ['pb enterprise', 'PB Enterprise']
  ];
  var OWNER = /phion|puteri nur rabiatul|puteri nur rabiyatul|phubieyas|al-?adawiyah/i;
  var TYPES = [
    { key: 'Brand', re: /\.(png|jpe?g|webp|gif|svg)$/i, label: 'Brand asset' },
    { key: 'Brand', re: /\blogo\b|letterhead|brand asset|favicon|icon pack/i, label: 'Brand asset' },
    { key: 'StaffLetter', re: /lanjutan percubaan|surat percubaan|probation|surat amaran|warning letter|show.?cause/i, label: 'Staff letter' },
    { key: 'SSM', re: /\bssm\b|borang d|perakuan pendaftaran|akta pendaftaran|ezbiz/i, label: 'SSM / Borang D' },
    { key: 'LOA', re: /\bloa\b|surat tawaran|offer letter|letter of appointment|surat lantikan/i, label: 'LOA / Offer' },
    { key: 'Payslip', re: /payslip|pay slip|slip gaji/i, label: 'Payslip' },
    { key: 'PV', re: /\bpv\b|payment voucher|baucar bayaran/i, label: 'Payment Voucher' },
    { key: 'SOA', re: /\bsoa\b|statement of account|penyata akaun/i, label: 'Statement of Account' },
    { key: 'Claim', re: /\bclaim\b|tuntutan/i, label: 'Claim' },
    { key: 'Quotation', re: /quotation|sebut harga/i, label: 'Quotation' },
    { key: 'PO', re: /purchase order|pesanan belian/i, label: 'Purchase Order' },
    { key: 'Contract', re: /\bcontract\b|\bagreement\b|\bkontrak\b|\bperjanjian\b|\bnda\b/i, label: 'Contract' },
    { key: 'Invoice', re: /\binvoice\b|\binvois\b|\binv[-_ ]?\d/i, label: 'Invoice' },
    { key: 'Receipt', re: /\breceipt\b|\bresit\b/i, label: 'Receipt' },
    { key: 'Letter', re: /\bletter\b|\bsurat\b/i, label: 'Letter' }
  ];

  function sectionOf(key) {
    if (key === 'Brand') return '04_Brand & Marketing';
    if (key === 'StaffLetter' || key === 'Payslip') return '03_Human Resource';
    if (key === 'SSM' || key === 'LOA' || key === 'Contract') return '08_Legal';
    if (key === 'Invoice' || key === 'Receipt' || key === 'PV' || key === 'SOA' || key === 'Claim') return '02_Finance';
    if (key === 'Quotation' || key === 'PO') return '07_Projects';
    if (key === 'Letter') return '01_Administration';
    return '01_Administration';
  }

  function detectType(blob, filename) {
    var name = String(filename || '');
    if (/\.(png|jpe?g|webp|gif|svg)$/i.test(name) || /logo|letterhead/i.test(name)) {
      return { key: 'Brand', label: 'Brand asset' };
    }
    for (var i = 0; i < TYPES.length; i++) {
      if (TYPES[i].re.test(blob)) return TYPES[i];
    }
    return { key: 'Other', label: 'Other' };
  }

  function detectClient(blob) {
    var s = String(blob || '').toLowerCase();
    for (var i = 0; i < CLIENTS.length; i++) {
      if (s.indexOf(CLIENTS[i][0]) >= 0) return CLIENTS[i][1];
    }
    return null;
  }

  function folderFor(typeKey, who, blob) {
    var sec = sectionOf(typeKey);
    var isOwner = OWNER.test(blob) || OWNER.test(who || '');
    var client = detectClient(blob) || detectClient(who || '');
    if (typeKey === 'Brand' || typeKey === 'StaffLetter' || typeKey === 'Payslip') return sec;
    if (client && !isOwner) return '05_Clients/' + client + '/' + sec;
    return sec;
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
    var folder = document.getElementById('docs-folder');
    var box = document.getElementById('docs-result');
    if (!folder || !box) return;
    var orig = window._docsOrigName || (window._docsLastFile && window._docsLastFile.name) || '';
    var who = '';
    var m = (box.textContent || '').match(/Who\s*[\u2014\-]\s*(.+)/i);
    if (m) who = m[1].split('\n')[0].trim();
    var blob = [orig, window._docsScanText || '', who].join(' ');
    var typ = detectType(blob, orig);
    var next = folderFor(typ.key, who, blob);
    if (next && folder.value !== next) folder.value = next;
    setLine(box, 'What', typ.label);
    setLine(box, 'Where', next);
  }

  setInterval(apply, 500);
})();
