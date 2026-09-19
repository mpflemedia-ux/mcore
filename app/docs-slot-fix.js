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
  function slotOf(s) {
    if (/borang d|perakuan pendaftaran|akta pendaftaran|ezbiz|\bssm\b|la00\d+|certificate of business|business registration/.test(s))
      return '01_Contracts & Agreements';
    if (/payment voucher|\bpv\b|invoice|invois|receipt|resit|claim|tuntutan|soa/.test(s))
      return '06_Invoices & Payment';
    if (/quotation|proposal|sebut harga|sales order/.test(s))
      return '02_Proposals & Quotations';
    if (/contract|agreement|kontrak|nda|mou/.test(s))
      return '01_Contracts & Agreements';
    return null;
  }
  function apply() {
    var cls = window._docsAiClass;
    if (!cls) return;
    var s = blob();
    var client = clientOf(s);
    var slot = slotOf(s);
    if (client && slot) {
      cls.who = client;
      cls.folder = '05_Clients/' + client + '/' + slot;
      if (/borang d|ssm|perakuan pendaftaran/.test(s)) cls.what = 'SSM / Borang D';
    }
  }
  setInterval(apply, 300);
})();
