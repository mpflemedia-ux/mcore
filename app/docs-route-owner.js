(function () {
  var CLIENTS = [
    ['fade boys', 'Fade Boys Worldwide'],
    ['atas angin', 'Atas Angin MY Sdn. Bhd'],
    ['brozky', 'Brzky Empire'],
    ['brzky', 'Brzky Empire'],
    ['clore', 'Clore Health And Beauty'],
    ['mayang', 'Mayangs'],
    ['nuhea', 'Nuhea'],
    ['pb enterprise', 'PB Enterprise']
  ];
  var OWNER = /phion|puteri nur rabiatul|puteri nur rabiyatul|phubieyas|al-?adawiyah/i;

  function section(what) {
    var w = String(what || '');
    if (/SSM|Borang D|legal|kontrak|agreement|loa/i.test(w)) return '08_Legal';
    if (/invoice|invois|receipt|resit|finance/i.test(w)) return '02_Finance';
    if (/hr|human|payslip|leave|gaji/i.test(w)) return '03_Human Resource';
    if (/brand|marketing/i.test(w)) return '04_Brand & Marketing';
    if (/partner|vendor/i.test(w)) return '06_Partners & Vendors';
    if (/project/i.test(w)) return '07_Projects';
    if (/operation/i.test(w)) return '09_Operations';
    return '01_Administration';
  }

  function parseBox(txt) {
    var who = '', what = '';
    var m = txt.match(/Who\s*[\u2014\-]\s*(.+)/i);
    if (m) who = m[1].split('\n')[0].trim();
    m = txt.match(/What\s*[\u2014\-]\s*(.+)/i);
    if (m) what = m[1].split('\n')[0].trim();
    return { who: who, what: what };
  }

  function matchClient(blob) {
    var s = String(blob || '').toLowerCase();
    for (var i = 0; i < CLIENTS.length; i++) {
      if (s.indexOf(CLIENTS[i][0]) >= 0) return CLIENTS[i][1];
    }
    return null;
  }

  function target(who, what) {
    var blob = who + ' ' + what;
    var sec = section(what);
    if (OWNER.test(blob) && !matchClient(blob)) return sec;
    var c = matchClient(blob) || (who && who !== '\u2014' ? who : null);
    if (c && !OWNER.test(c)) return '05_Clients/' + c + '/' + sec;
    return sec;
  }

  function apply() {
    var folder = document.getElementById('docs-folder');
    var box = document.getElementById('docs-result');
    if (!folder || !box) return;
    var p = parseBox(box.textContent || '');
    if (!p.what && !p.who) return;
    var next = target(p.who, p.what);
    if (next && folder.value !== next) folder.value = next;
  }

  setInterval(apply, 500);
})();
