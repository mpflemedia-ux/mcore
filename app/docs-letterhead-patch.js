(function () {
  var KNOWN = [
    ['fade boys', 'Fade Boys Worldwide'], ['fadeboys', 'Fade Boys Worldwide'],
    ['atas angin', 'Atas Angin MY Sdn. Bhd'], ['brozky', 'Brzky Empire'], ['brzky', 'Brzky Empire'],
    ['clore', 'Clore Health And Beauty'], ['mayang', 'Mayangs'], ['nuhea', 'Nuhea'],
    ['tns consulting', 'TNS Consulting'], ['tns consult', 'TNS Consulting'],
    ['pb enterprise', 'PB Enterprise'], ['pbenterprise', 'PB Enterprise']
  ];
  function titleClient(name) {
    return String(name || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).map(function (w) {
      if (/^(sdn|bhd|my|tns|ssm|nda|soa|pv)$/i.test(w)) return w.toUpperCase();
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    }).join(' ');
  }
  function normalizeWho(who) {
    var raw = String(who || '').replace(/\s+/g, ' ').trim();
    if (!raw || raw === '-' || raw === '\u2014') return '';
    var low = raw.toLowerCase();
    for (var i = 0; i < KNOWN.length; i++) {
      if (low.indexOf(KNOWN[i][0]) >= 0 || low === KNOWN[i][1].toLowerCase()) return KNOWN[i][1];
    }
    return titleClient(raw);
  }
  function clientSlot(blob) {
    var s = String(blob || '').toLowerCase();
    if (/invoice|invois|\binv\b|receipt|resit|\bpv\b|voucher|claim|soa|payment/.test(s)) return '06_Invoices & Payment';
    if (/contract|agreement|ssm|nda|mou|borang|perjanjian|kontrak/.test(s)) return '01_Contracts & Agreements';
    if (/quotat|proposal|brief|sales order|sebut harga/.test(s)) return '02_Proposals & Quotations';
    if (/feedback|revision/.test(s)) return '08_Feedback & Revisions';
    return '07_Meeting Notes & Communication';
  }
  function whoFromUi() {
    var box = document.getElementById('docs-result');
    if (!box) return '';
    var m = (box.textContent || '').match(/Who\s*[\u2014\-]\s*(.+)/i);
    return m ? m[1].split('\n')[0].trim() : '';
  }
  function apply() {
    var folderEl = document.getElementById('docs-folder');
    if (!folderEl) return;
    var text = window._docsScanText || '';
    var who = normalizeWho((window._docsAiClass && window._docsAiClass.who) || whoFromUi());
    var name = window._docsOrigName || '';
    var blob = [text, who, name, folderEl.value].join(' ');
    if (/phion/i.test(blob)) return;
    if (!who) return;
    var cur = folderEl.value.trim();
    var want = '05_Clients/' + who + '/' + clientSlot(blob + ' ' + ((window._docsAiClass && window._docsAiClass.what) || ''));
    var wrong = !cur || cur.indexOf('05_Clients/' + who + '/') !== 0 || /^(02_Finance|01_Administration|03_Human|08_Legal|07_Projects)/.test(cur);
    if (wrong && folderEl.value !== want) {
      folderEl.value = want;
      if (!window._docsAiClass) window._docsAiClass = {};
      window._docsAiClass.who = who;
      window._docsAiClass.folder = want;
    }
  }
  setInterval(apply, 400);
})();
