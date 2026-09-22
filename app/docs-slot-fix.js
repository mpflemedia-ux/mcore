(function () {
  var KNOWN = [
    ['fade boys', 'Fade Boys Worldwide'],
    ['fadeboys', 'Fade Boys Worldwide'],
    ['atas angin', 'Atas Angin MY Sdn. Bhd'],
    ['brozky', 'Brzky Empire'],
    ['brzky', 'Brzky Empire'],
    ['clore', 'Clore Health And Beauty'],
    ['mayang', 'Mayangs'],
    ['nuhea', 'Nuhea'],
    ['tns consulting', 'TNS Consulting'],
    ['tns consult', 'TNS Consulting']
  ];
  function titleClient(name) {
    return String(name || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).map(function (w) {
      if (/^(sdn|bhd|my|tns|ssm|nda|soa|pv)$/i.test(w)) return w.toUpperCase();
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    }).join(' ');
  }
  function normalizeWho(who) {
    var raw = String(who || '').replace(/\s+/g, ' ').trim();
    if (!raw || raw === '\u2014' || raw === '-') return '';
    var low = raw.toLowerCase();
    for (var i = 0; i < KNOWN.length; i++) {
      if (low.indexOf(KNOWN[i][0]) >= 0 || low === KNOWN[i][1].toLowerCase()) return KNOWN[i][1];
    }
    return titleClient(raw);
  }
  function clientSlot(what, name, text) {
    var s = [what, name, text].join(' ').toLowerCase().replace(/[_\-]+/g, ' ');
    if (/invoice|invois|\binv\b|receipt|resit|\bpv\b|voucher|claim|soa|payment/.test(s)) return '06_Invoices & Payment';
    if (/contract|agreement|ssm|nda|mou|borang|perjanjian|kontrak/.test(s)) return '01_Contracts & Agreements';
    if (/quotat|proposal|brief|sales order|sebut harga/.test(s)) return '02_Proposals & Quotations';
    if (/feedback|revision|revisi/.test(s)) return '08_Feedback & Revisions';
    if (/deliverable|final\b/.test(s)) return '05_Final Deliverables';
    if (/working file|draft|wip/.test(s)) return '04_Working Files';
    if (/requirement|scope/.test(s)) return '03_Brief & Requirements';
    if (/letter|meeting|minutes|surat|minit/.test(s)) return '07_Meeting Notes & Communication';
    return '07_Meeting Notes & Communication';
  }
  function phionRel(what, name, text) {
    var s = [what, name, text].join(' ').toLowerCase().replace(/[_\-]+/g, ' ');
    if (/\.(png|jpe?g|webp|gif|svg|ai)$/.test(name) || /\blogo\b/.test(s))
      return '04_Brand & Marketing/04.2_Logo & Visual Assets';
    if (/profil syarikat|company profile|brochure|pitch deck|name card/.test(s))
      return '04_Brand & Marketing/04.3_Marketing Materials';
    if (/borang d|perakuan|\bssm\b|form 9|form 24|form 49|ezbiz/.test(s))
      return '01_Administration/01.1_Company Registration & SSM';
    if (/offer letter|surat tawaran|compensation|incentive|probation|percubaan|staff letter|\bloa\b|surat lantikan|warning letter/.test(s))
      return '03_Human Resource/03.1_Employee Records';
    if (/payslip|slip gaji|epf|socso/.test(s))
      return '03_Human Resource/03.2_Payroll & Claims';
    if (/leave|cuti|\bmc\b/.test(s))
      return '03_Human Resource/03.5_Leave & Attendance';
    if (/payment voucher|\bpv\b|staff claim/.test(s))
      return '02_Finance/02.6_Payment Vouchers & Claims';
    if (/invoice|invois|receipt|resit|soa/.test(s))
      return '02_Finance/02.1_Invoices (Client)';
    if (/bank statement/.test(s))
      return '02_Finance/02.3_Bank Statements';
    if (/nda|mou|contract|agreement|kontrak|perjanjian/.test(s))
      return '08_Legal/08.1_Master Contracts';
    if (/quotation|proposal|sebut harga/.test(s))
      return '07_Projects';
    return '01_Administration/01.3_Policies & SOPs';
  }
  function whoFromUi() {
    var box = document.getElementById('docs-result');
    if (!box) return '';
    var m = (box.textContent || '').match(/Who\s*[\u2014\-]\s*(.+)/i);
    return m ? m[1].split('\n')[0].trim() : '';
  }
  function apply() {
    var cls = window._docsAiClass;
    // Only fill when AI folder empty - never overwrite letterhead AI route
    if (cls && cls.folder) return;
    var name = window._docsOrigName || (window._docsLastFile && window._docsLastFile.name) || '';
    var what = (cls && cls.what) || '';
    var text = window._docsScanText || '';
    if (!what && !name) return;
    var who = normalizeWho((cls && cls.who) || whoFromUi());
    var folderEl = document.getElementById('docs-folder');
    if (folderEl && folderEl.value.trim()) return;
    var folder;
    if (/phion/i.test([text, who, name].join(' '))) {
      folder = phionRel(what, name, text);
    } else if (who) {
      // Letterhead who - do NOT map Nuhea/etc from body over letterhead
      folder = '05_Clients/' + who + '/' + clientSlot(what, name, text);
    } else {
      return;
    }
    if (!cls) window._docsAiClass = cls = {};
    cls.folder = folder;
    if (who) cls.who = who;
    if (folderEl) folderEl.value = folder;
  }
  setInterval(apply, 300);
})();
