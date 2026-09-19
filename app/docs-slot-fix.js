(function () {
  function clientOf(s) {
    if (/fade boys|fadeboys/.test(s)) return 'Fade Boys Worldwide';
    if (/brozky|brzky/.test(s)) return 'Brzky Empire';
    if (/atas angin/.test(s)) return 'Atas Angin MY Sdn. Bhd';
    if (/clore/.test(s)) return 'Clore Health And Beauty';
    if (/mayang/.test(s)) return 'Mayangs';
    if (/nuhea/.test(s)) return 'Nuhea';
    return null;
  }
  function relOf(what, name) {
    var s = (what + ' ' + name).toLowerCase().replace(/[_\-]+/g, ' ');
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
  function apply() {
    var cls = window._docsAiClass;
    var name = window._docsOrigName || '';
    var what = (cls && cls.what) || '';
    if (!what && !name) return;
    var hint = [what, name, window._docsScanText || ''].join(' ');
    var client = clientOf(hint.toLowerCase());
    var rel = relOf(what, name);
    if (!cls) window._docsAiClass = cls = {};
    cls.folder = client ? ('05_Clients/' + client + '/' + rel) : rel;
    if (client) cls.who = client;
  }
  setInterval(apply, 300);
})();
