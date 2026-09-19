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
  function phionRel(s) {
    if (/borang d|perakuan pendaftaran|akta pendaftaran|ezbiz|\bssm\b|la00\d+|certificate of business|business registration/.test(s))
      return '01_Administration/01.1_Company Registration & SSM';
    if (/payment voucher|\bpv\b|claim|tuntutan/.test(s))
      return '02_Finance/02.6_Payment Vouchers & Claims';
    if (/invoice|invois|receipt|resit|soa/.test(s))
      return '02_Finance/02.1_Invoices (Client)';
    if (/bank statement|penyata bank/.test(s))
      return '02_Finance/02.3_Bank Statements';
    if (/contract|agreement|kontrak|nda|mou/.test(s))
      return '08_Legal/08.1_Master Contracts';
    if (/quotation|proposal|sebut harga|sales order/.test(s))
      return '07_Projects';
    if (/logo|letterhead|brand/.test(s))
      return '04_Brand & Marketing/04.2_Logo & Visual Assets';
    return null;
  }
  function apply() {
    var cls = window._docsAiClass;
    if (!cls) return;
    var s = blob();
    var client = clientOf(s);
    var rel = phionRel(s);
    if (client && rel) {
      cls.who = client;
      cls.folder = '05_Clients/' + client + '/' + rel;
      if (/borang d|ssm|perakuan pendaftaran/.test(s)) cls.what = 'SSM / Borang D';
    }
  }
  setInterval(apply, 300);
})();
