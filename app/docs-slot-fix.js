(function () {
  function blob() {
    var cls = window._docsAiClass || {};
    return [cls.what, cls.why, cls.folder, window._docsScanText, window._docsOrigName].join(' ').toLowerCase();
  }
  function clientOf(s) {
    if (/fade boys|fadeboys/.test(s)) return 'Fade Boys Worldwide';
    if (/brozky|brzky/.test(s)) return 'Brzky Empire';
    if (/atas angin/.test(s)) return 'Atas Angin MY Sdn. Bhd';
    if (/clore/.test(s)) return 'Clore Health And Beauty';
    if (/mayang/.test(s)) return 'Mayangs';
    if (/nuhea/.test(s)) return 'Nuhea';
    return null;
  }
  function isPhion(s) {
    return /phion/.test(s) && !clientOf(s);
  }
  function relOf(s) {
    if (/profil syarikat|company profile|brochure|pitch deck|name card/.test(s))
      return '04_Brand & Marketing/04.3_Marketing Materials';
    if (/logo|letterhead|brand book/.test(s))
      return '04_Brand & Marketing/04.2_Logo & Visual Assets';
    if (/borang d|perakuan pendaftaran|akta pendaftaran|ezbiz|\bssm\b|la00\d+|form 9|form 24|form 49/.test(s))
      return '01_Administration/01.1_Company Registration & SSM';
    if (/payment voucher|\bpv\b|claim|tuntutan/.test(s))
      return '02_Finance/02.6_Payment Vouchers & Claims';
    if (/invoice|invois|receipt|resit|soa/.test(s))
      return '02_Finance/02.1_Invoices (Client)';
    if (/bank statement|penyata bank/.test(s))
      return '02_Finance/02.3_Bank Statements';
    if (/probation|staff letter|offer letter|\bloa\b|surat lantikan/.test(s))
      return '03_Human Resource/03.1_Employee Records';
    if (/payslip|epf|socso/.test(s))
      return '03_Human Resource/03.2_Payroll & Claims';
    if (/contract|agreement|kontrak|nda|mou/.test(s))
      return '08_Legal/08.1_Master Contracts';
    if (/quotation|proposal|sebut harga/.test(s))
      return '07_Projects';
    return '01_Administration/01.3_Policies & SOPs';
  }
  function valid(folder) {
    return /^(01_|02_|03_|04_|05_|06_|07_|08_|09_|99_)/.test(String(folder || ''));
  }
  function apply() {
    var cls = window._docsAiClass;
    if (!cls) return;
    var s = blob();
    var client = clientOf(s);
    var rel = relOf(s);
    if (client) {
      cls.who = client;
      cls.folder = '05_Clients/' + client + '/' + rel;
    } else {
      cls.folder = rel;
    }
    if (/profil syarikat|company profile/.test(s)) cls.what = 'Company profile';
    if (!valid(cls.folder)) cls.folder = rel;
  }
  setInterval(apply, 300);
})();
