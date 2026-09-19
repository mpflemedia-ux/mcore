(function () {
  var CLIENTS = [
    ['fade boys', 'Fade Boys Worldwide'],
    ['fadeboys', 'Fade Boys Worldwide'],
    ['atas angin', 'Atas Angin MY Sdn. Bhd'],
    ['brozky', 'Brzky Empire'],
    ['brzky', 'Brzky Empire'],
    ['clore', 'Clore Health And Beauty'],
    ['mayang', 'Mayangs'],
    ['nuhea', 'Nuhea']
  ];
  var VENDORS = [
    ['ethye', 'ETHYE SDN BHD'],
    ['print expert', 'PRINT EXPERT SDN BHD'],
    ['print expert', 'PRINT EXPERT SDN BHD']
  ];
  var OWNER = /phion|puteri nur rabiatul|puteri nur rabiyatul|phubieyas|al-?adawiyah/i;

  var TYPES = [
    { key: 'Brand', re: /\.(png|jpe?g|webp|gif|svg)$/i, label: 'Brand asset' },
    { key: 'Brand', re: /\blogo\b|letterhead|brand asset|favicon|banner|poster|name card|kad nama|brand guide/i, label: 'Brand asset' },
    { key: 'Bank', re: /bank statement|penyata bank|bank-?in|slip bank|cheque|cek bank/i, label: 'Bank document' },
    { key: 'EPF', re: /\bepf\b|kwsp|\bsocso\b|perkeso|\beis\b|\bpcb\b|lhdn|cp204|sst/i, label: 'Statutory / payroll form' },
    { key: 'StaffLetter', re: /lanjutan percubaan|surat percubaan|probation|surat amaran|warning letter|show.?cause|resign|termination|penamatan|surat tawaran|offer letter|\bloa\b|surat lantikan|confirmation letter|surat pengesahan/i, label: 'Staff letter' },
    { key: 'Payslip', re: /payslip|pay slip|slip gaji/i, label: 'Payslip' },
    { key: 'Leave', re: /medical cert|\bmc\b|sick leave|cuti sakit|borang cuti|leave form/i, label: 'Leave / MC' },
    { key: 'CV', re: /\bcv\b|resume|borang kerja|job application|curriculum vitae/i, label: 'Recruitment' },
    { key: 'SSM', re: /\bssm\b|borang d|perakuan pendaftaran|akta pendaftaran|ezbiz/i, label: 'SSM / Borang D' },
    { key: 'NDA', re: /\bnda\b|\bmou\b|memorandum of understanding|non-?disclosure/i, label: 'NDA / MOU' },
    { key: 'Contract', re: /\bcontract\b|\bagreement\b|\bkontrak\b|\bperjanjian\b|scope of (work|service)|\bsow\b/i, label: 'Contract' },
    { key: 'License', re: /\blesen\b|\bpermit\b|\bpbt\b|license/i, label: 'Licence / permit' },
    { key: 'Minutes', re: /\bminit\b|\bmemo\b|minutes of meeting|mesyuarat/i, label: 'Minutes / memo' },
    { key: 'PV', re: /\bpv\b|payment voucher|baucar bayaran/i, label: 'Payment Voucher' },
    { key: 'SOA', re: /\bsoa\b|statement of account|penyata akaun/i, label: 'Statement of Account' },
    { key: 'CN', re: /credit note|debit note|nota kredit|nota debit/i, label: 'Credit / debit note' },
    { key: 'Claim', re: /\bclaim\b|tuntutan/i, label: 'Claim' },
    { key: 'SO', re: /sales order|\bsokl-|\bso[-_]?\d/i, label: 'Sales order' },
    { key: 'Quotation', re: /quotation|sebut harga|\bquote\b/i, label: 'Quotation' },
    { key: 'PO', re: /purchase order|pesanan belian/i, label: 'Purchase Order' },
    { key: 'Proposal', re: /proposal|pitch deck|pembentangan/i, label: 'Proposal' },
    { key: 'Invoice', re: /\binvoice\b|\binvois\b|\binv[-_ ]?\d/i, label: 'Invoice' },
    { key: 'Receipt', re: /\breceipt\b|\bresit\b|official receipt/i, label: 'Receipt' },
    { key: 'Letter', re: /\bletter\b|\bsurat\b/i, label: 'Letter' }
  ];

  function sectionOf(key) {
    if (key === 'Brand') return '04_Brand & Marketing';
    if (key === 'StaffLetter' || key === 'Payslip' || key === 'Leave' || key === 'CV' || key === 'EPF') return '03_Human Resource';
    if (key === 'SSM' || key === 'NDA' || key === 'Contract') return '08_Legal';
    if (key === 'Bank' || key === 'PV' || key === 'SOA' || key === 'CN' || key === 'Claim' || key === 'Invoice' || key === 'Receipt') return '02_Finance';
    if (key === 'SO' || key === 'Quotation' || key === 'PO' || key === 'Proposal') return '07_Projects';
    if (key === 'License' || key === 'Minutes' || key === 'Letter') return '01_Administration';
    return '01_Administration';
  }

  function detectType(blob, filename) {
    var name = String(filename || '');
    if (/\.(png|jpe?g|webp|gif|svg)$/i.test(name) || /logo|letterhead|banner|poster/i.test(name)) {
      return { key: 'Brand', label: 'Brand asset' };
    }
    for (var i = 0; i < TYPES.length; i++) {
      if (TYPES[i].re.test(blob)) return TYPES[i];
    }
    return { key: 'Other', label: 'Other' };
  }

  function matchList(blob, list) {
    var s = String(blob || '').toLowerCase();
    for (var i = 0; i < list.length; i++) {
      if (s.indexOf(list[i][0]) >= 0) return list[i][1];
    }
    return null;
  }

  function folderFor(typeKey, who, blob) {
    var sec = sectionOf(typeKey);
    var isOwner = OWNER.test(blob) || OWNER.test(who || '');
    var client = matchList(blob, CLIENTS) || matchList(who || '', CLIENTS);
    var vendor = matchList(blob, VENDORS) || matchList(who || '', VENDORS);
    if (typeKey === 'Brand' || typeKey === 'StaffLetter' || typeKey === 'Payslip' || typeKey === 'Leave' || typeKey === 'CV' || typeKey === 'EPF') {
      return sec;
    }
    if (vendor && !client) return '06_Partners & Vendors/' + vendor + '/' + sec;
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
