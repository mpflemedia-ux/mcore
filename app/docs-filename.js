(function () {
  function slug(s) {
    return String(s || '')
      .replace(/[_\-]+/g, ' ')
      .replace(/[^A-Za-z0-9 ]+/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); })
      .join('')
      .slice(0, 40);
  }
  function extOf(name) {
    var m = String(name || '').match(/\.([A-Za-z0-9]+)$/);
    return m ? m[1].toLowerCase() : 'pdf';
  }
  function today() {
    var d = new Date();
    var m = String(d.getMonth() + 1);
    var day = String(d.getDate());
    if (m.length < 2) m = '0' + m;
    if (day.length < 2) day = '0' + day;
    return d.getFullYear() + m + day;
  }
  function typeCode(what, folder) {
    var w = String(what || '').toLowerCase();
    var f = String(folder || '').toLowerCase();
    if (/logo|brand/.test(w) || f.indexOf('04.2') >= 0) return 'Brand_Logo';
    if (/staff letter|probation|percubaan|offer|loa|amaran/.test(w) || f.indexOf('03.1') >= 0) return 'HR_StaffLetter';
    if (/payslip|slip gaji/.test(w)) return 'HR_Payslip';
    if (/epf|socso/.test(w)) return 'HR_EPF';
    if (/leave|cuti/.test(w) || f.indexOf('03.5') >= 0) return 'HR_Leave';
    if (/ssm|borang/.test(w) || f.indexOf('01.1') >= 0) return 'SSM';
    if (/invoice|invois/.test(w)) return 'INV';
    if (/receipt|resit/.test(w)) return 'Receipt';
    if (/\bpv\b|voucher/.test(w)) return 'PV';
    if (/soa/.test(w)) return 'SOA';
    if (/quotation|sebut/.test(w)) return 'QUO';
    if (/proposal|brief/.test(w)) return 'Proposal';
    if (/contract|agreement|kontrak/.test(w)) return 'Contract';
    if (/nda|mou/.test(w)) return 'NDA';
    if (/bank/.test(w)) return 'BankStatement';
    return slug(what) || 'Doc';
  }
  function subject(who, orig) {
    var w = String(who || '');
    if (/phion/i.test(w)) w = w.replace(/phion[^,]*/i, '').trim();
    var s = slug(w);
    if (s && !/^Phion/i.test(s)) return s;
    var n = String(orig || '').replace(/\.[^.]+$/, '');
    n = n.replace(/^Phion[_\- ]*/i, '');
    return slug(n).slice(0, 40) || 'File';
  }
  function build() {
    var input = document.getElementById('docs-name');
    if (!input) return;
    var orig = window._docsOrigName || (window._docsLastFile && window._docsLastFile.name) || '';
    var cls = window._docsAiClass || {};
    var folder = ((document.getElementById('docs-folder') || {}).value) || cls.folder || '';
    var what = cls.what || '';
    var who = cls.who || '';
    if (!what && !folder && !orig) return;
    var name = today() + '_Phion_' + typeCode(what, folder) + '_' + subject(who, orig) + '.' + extOf(orig);
    if (input.value !== name) input.value = name;
  }
  setInterval(build, 400);
})();
