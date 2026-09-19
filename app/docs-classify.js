/* WHAT then WHO then folder. Uses scanned page text when present. */
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
    { key: 'StaffLetter', re: /lanjutan percubaan|surat percubaan|probation|confirmation of employment|surat amaran|warning letter|show.?cause|memo intern|staff letter/i, label: 'Staff letter' },
    { key: 'SSM', re: /ssm|borang d|perakuan pendaftaran|akta pendaftaran|ezbiz|la00\d+/i, label: 'SSM / Borang D' },
    { key: 'LOA', re: /\bloa\b|surat tawaran|offer letter|letter of offer|letter of appointment|surat lantikan|surat pengesahan/i, label: 'LOA / Offer' },
    { key: 'Payslip', re: /payslip|pay slip|slip gaji|salary slip/i, label: 'Payslip' },
    { key: 'PV', re: /\bpv\b|payment voucher|baucar bayaran/i, label: 'Payment Voucher' },
    { key: 'SOA', re: /\bsoa\b|statement of account|penyata akaun/i, label: 'Statement of Account' },
    { key: 'Claim', re: /claim|tuntutan/i, label: 'Claim' },
    { key: 'Quotation', re: /quotation|quote|sebut harga/i, label: 'Quotation' },
    { key: 'PO', re: /\bpo\b|purchase order|pesanan belian/i, label: 'Purchase Order' },
    { key: 'Contract', re: /contract|agreement|kontrak|perjanjian|nda/i, label: 'Contract' },
    { key: 'Invoice', re: /invoice|invois|\binv[-_ ]?\d/i, label: 'Invoice' },
    { key: 'Receipt', re: /receipt|resit/i, label: 'Receipt' },
    { key: 'Letter', re: /letter|surat/i, label: 'Letter' }
  ];

  function sectionOf(key) {
    if (key === 'StaffLetter' || key === 'Payslip') return '03_Human Resource';
    if (key === 'SSM' || key === 'LOA' || key === 'Contract') return '08_Legal';
    if (key === 'Invoice' || key === 'Receipt' || key === 'PV' || key === 'SOA' || key === 'Claim') return '02_Finance';
    if (key === 'Quotation' || key === 'PO') return '07_Projects';
    if (key === 'Letter') return '01_Administration';
    return '';
  }

  function parseBox(txt) {
    var who = '', what = '';
    var m = txt.match(/Who\s*[\u2014\-]\s*(.+)/i);
    if (m) who = m[1].split('\n')[0].trim();
    m = txt.match(/What\s*[\u2014\-]\s*(.+)/i);
    if (m) what = m[1].split('\n')[0].trim();
    return { who: who, what: what, raw: txt };
  }

  function detectType(blob) {
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
    if (typeKey === 'StaffLetter' || typeKey === 'Payslip') return '03_Human Resource';
    if (client && !isOwner) return sec ? ('05_Clients/' + client + '/' + sec) : '';
    if (isOwner && sec) return sec;
    return sec || '';
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
    var p = parseBox(box.textContent || '');
    var orig = window._docsOrigName || (window._docsLastFile && window._docsLastFile.name) || '';
    var blob = [orig, window._docsScanText || '', p.what, p.who, p.raw].join(' ');
    var typ = detectType(blob);
    var next = folderFor(typ.key, p.who, blob);
    if (next && folder.value !== next) folder.value = next;
    if (typ.label) setLine(box, 'What', typ.label);
    if (next) setLine(box, 'Where', next);
  }

  setInterval(apply, 500);
})();
