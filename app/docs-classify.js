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
    ['print expert', 'PRINT EXPERT SDN BHD']
  ];
  var OWNER = /phion|puteri nur rabiatul|puteri nur rabiyatul|phubieyas|al-?adawiyah/i;
  var TYPES = [
    { key: 'Brand', re: /\.(png|jpe?g|webp|gif|svg|ai)$/i, label: 'Brand asset' },
    { key: 'Brand', re: /\blogo\b|letterhead|brand book|brand guide|favicon|banner|poster|name card|kad nama/i, label: 'Brand asset' },
    { key: 'Bank', re: /bank statement|penyata bank|bank-?in/i, label: 'Bank statement' },
    { key: 'Tax', re: /\bsst\b|form c|audited|cp204|lhdn|income tax/i, label: 'Tax / accounts' },
    { key: 'EPF', re: /\bepf\b|kwsp|\bsocso\b|perkeso|\beis\b|\bpcb\b/i, label: 'EPF / SOCSO' },
    { key: 'StaffLetter', re: /lanjutan percubaan|surat percubaan|probation|surat amaran|warning letter|show.?cause|resign|termination|penamatan|surat tawaran|offer letter|\bloa\b|surat lantikan|confirmation letter/i, label: 'Staff letter' },
    { key: 'Payslip', re: /payslip|pay slip|slip gaji/i, label: 'Payslip' },
    { key: 'Leave', re: /medical cert|\bmc\b|sick leave|cuti|leave form|leave application/i, label: 'Leave / MC' },
    { key: 'CV', re: /\bcv\b|resume|borang kerja|job description|\bjd\b/i, label: 'Recruitment' },
    { key: 'SSM', re: /\bssm\b|borang d|form 9|form 24|form 49|perakuan pendaftaran|annual return|constitution/i, label: 'SSM / company secretarial' },
    { key: 'NDA', re: /\bnda\b|\bmou\b|non-?disclosure/i, label: 'NDA / MOU' },
    { key: 'Contract', re: /\bcontract\b|\bagreement\b|\bkontrak\b|\bperjanjian\b|tenancy|scope of (work|service)/i, label: 'Contract' },
    { key: 'License', re: /\blesen\b|\bpermit\b|\bpbt\b/i, label: 'Licence' },
    { key: 'Minutes', re: /\bminit\b|minutes of meeting|board meeting|agm|egm/i, label: 'Minutes' },
    { key: 'Policy', re: /policy|sop_|employee handbook|code of conduct|pdpa/i, label: 'Policy / SOP' },
    { key: 'PV', re: /\bpv\b|payment voucher|baucar bayaran/i, label: 'Payment Voucher' },
    { key: 'SOA', re: /\bsoa\b|statement of account|penyata akaun/i, label: 'SOA' },
    { key: 'CN', re: /credit note|debit note|nota kredit/i, label: 'Credit note' },
    { key: 'Claim', re: /\bclaim\b|tuntutan/i, label: 'Claim' },
    { key: 'SO', re: /sales order|\bsokl-/i, label: 'Sales order' },
    { key: 'Quotation', re: /quotation|sebut harga/i, label: 'Quotation' },
    { key: 'PO', re: /purchase order|pesanan belian/i, label: 'PO' },
    { key: 'Proposal', re: /proposal|pitch deck|pembentangan|brief/i, label: 'Proposal / brief' },
    { key: 'Invoice', re: /\binvoice\b|\binvois\b|\binv[-_ ]?\d/i, label: 'Invoice' },
    { key: 'Receipt', re: /\breceipt\b|\bresit\b|payment proof/i, label: 'Receipt' },
    { key: 'Letter', re: /\bletter\b|\bsurat\b/i, label: 'Letter' }
  ];

  function phionPath(key) {
    var map = {
      Brand: '04_Brand & Marketing/04.2_Logo & Visual Assets',
      Bank: '02_Finance/02.3_Bank Statements',
      Tax: '02_Finance/02.5_Tax & Accounting',
      EPF: '03_Human Resource/03.2_Payroll & Claims',
      StaffLetter: '03_Human Resource/03.1_Employee Records',
      Payslip: '03_Human Resource/03.2_Payroll & Claims',
      Leave: '03_Human Resource/03.5_Leave & Attendance',
      CV: '03_Human Resource/03.3_Recruitment',
      SSM: '01_Administration/01.1_Company Registration & SSM',
      NDA: '08_Legal/08.2_NDAs',
      Contract: '08_Legal/08.1_Master Contracts',
      License: '01_Administration/01.2_Licenses & Permits',
      Minutes: '01_Administration/01.4_Meeting Minutes',
      Policy: '01_Administration/01.3_Policies & SOPs',
      PV: '02_Finance/02.6_Payment Vouchers & Claims',
      SOA: '02_Finance/02.1_Invoices (Client)',
      CN: '02_Finance/02.1_Invoices (Client)',
      Claim: '02_Finance/02.6_Payment Vouchers & Claims',
      SO: '07_Projects',
      Quotation: '07_Projects',
      PO: '06_Partners & Vendors/06.2_Vendors',
      Proposal: '07_Projects',
      Invoice: '02_Finance/02.1_Invoices (Client)',
      Receipt: '02_Finance/02.1_Invoices (Client)',
      Letter: '01_Administration',
      Other: '01_Administration'
    };
    return map[key] || '01_Administration';
  }

  function clientSlot(key) {
    var map = {
      SSM: '01_Contracts & Agreements',
      NDA: '01_Contracts & Agreements',
      Contract: '01_Contracts & Agreements',
      Quotation: '02_Proposals & Quotations',
      Proposal: '02_Proposals & Quotations',
      SO: '02_Proposals & Quotations',
      Invoice: '06_Invoices & Payment',
      Receipt: '06_Invoices & Payment',
      SOA: '06_Invoices & Payment',
      CN: '06_Invoices & Payment',
      Minutes: '07_Meeting Notes & Communication',
      Letter: '07_Meeting Notes & Communication'
    };
    return map[key] || '07_Meeting Notes & Communication';
  }

  function detectType(blob, filename) {
    var name = String(filename || '');
    if (/\.(png|jpe?g|webp|gif|svg|ai)$/i.test(name) || /logo|letterhead|banner|poster/i.test(name)) {
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
    var isOwner = OWNER.test(blob) || OWNER.test(who || '');
    var client = matchList(blob, CLIENTS) || matchList(who || '', CLIENTS);
    var vendor = matchList(blob, VENDORS) || matchList(who || '', VENDORS);
    if (typeKey === 'Brand' || typeKey === 'StaffLetter' || typeKey === 'Payslip' || typeKey === 'Leave' || typeKey === 'CV' || typeKey === 'EPF') {
      return phionPath(typeKey);
    }
    if (vendor && !client) {
      return '06_Partners & Vendors/06.2_Vendors/' + vendor;
    }
    if (client && !isOwner) {
      return '05_Clients/' + client + '/' + clientSlot(typeKey);
    }
    if (typeKey === 'Invoice' && vendor) return '02_Finance/02.2_Invoices (Vendor)';
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
