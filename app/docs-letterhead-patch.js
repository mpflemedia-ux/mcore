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
    if (/contract|agreement|ssm|nda|mou|borang|perjanjian|kontrak|borang d|perakuan/.test(s)) return '01_Contracts & Agreements';
    if (/quotat|proposal|brief|sales order|sebut harga/.test(s)) return '02_Proposals & Quotations';
    if (/feedback|revision/.test(s)) return '08_Feedback & Revisions';
    if (/letter|meeting|minutes|surat|minit/.test(s)) return '07_Meeting Notes & Communication';
    return '07_Meeting Notes & Communication';
  }
  function phionFolder(blob) {
    var s = String(blob || '').toLowerCase();
    if (/invoice|invois|receipt|resit|soa/.test(s)) return '02_Finance/02.1_Invoices (Client)';
    if (/\bpv\b|voucher|claim/.test(s)) return '02_Finance/02.6_Payment Vouchers & Claims';
    if (/ssm|borang|form 9|form 24|form 49/.test(s)) return '01_Administration/01.1_Company Registration & SSM';
    if (/contract|nda|agreement|mou/.test(s)) return '08_Legal/08.1_Master Contracts';
    return '01_Administration';
  }
  window._docsLetterheadDecide = function (text, filename, who, helpers) {
    helpers = helpers || {};
    var t = helpers.t || function (en) { return en; };
    var slug = helpers.slug || function (s) { return String(s || '').replace(/[^a-zA-Z0-9]+/g, '').slice(0, 28) || 'Client'; };
    var dateStr = helpers.dateStr || function () {
      var d = new Date();
      return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    };
    var blob = (text || '') + ' ' + (filename || '') + ' ' + (who || '');
    var client = normalizeWho(who);
    var isPhion = /phion/i.test(blob);
    var what = '', folder = '', why = '', cat = 'Doc';
    if (isPhion) {
      if (/invoice|\binv\b|resit|receipt/i.test(blob)) { what = t('Invoice / receipt', 'Invois / resit'); cat = 'INV'; }
      else if (/borang d|ssm/i.test(blob)) { what = 'SSM / Borang D'; cat = 'SSM_BorangD'; }
      else { what = t('Phion document', 'Dokumen Phion'); cat = 'PhionDoc'; }
      folder = phionFolder(blob);
      why = t('Phion mentioned - company path.', 'Phion disebut - path syarikat.');
    } else if (client) {
      folder = '05_Clients/' + client + '/' + clientSlot(blob);
      if (/invoice|\binv\b|resit|receipt|claim|soa|\bpv\b/i.test(blob)) { what = t('Invoice / receipt', 'Invois / resit'); cat = 'INV'; }
      else if (/borang d|ssm|contract|agreement|nda/i.test(blob)) {
        what = /ssm|borang/i.test(blob) ? 'SSM / Borang D' : t('Contract / agreement', 'Kontrak / perjanjian');
        cat = /ssm|borang/i.test(blob) ? 'SSM_BorangD' : 'Contract';
      } else { what = t('Client document', 'Dokumen client'); cat = 'ClientDoc'; }
      why = t('Letterhead client (not Bill To / description).', 'Client letterhead (bukan Bill To / description).');
    } else {
      what = t('Unknown', 'Tidak dikenal pasti');
      folder = '';
      why = t('AI could not classify. Edit folder then Confirm.', 'AI tidak dapat klasifikasi. Edit folder kemudian Sahkan.');
    }
    var ext = (String(filename || '').split('.').pop() || 'pdf');
    var name = dateStr() + '_' + slug(client || cat) + '_' + cat + '_Final.' + ext;
    return { what: what, who: client || '-', where: folder, why: why, folder: folder, name: name };
  };
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
    var scan = window._docsScanText || '';
    var who = normalizeWho((window._docsAiClass && window._docsAiClass.who) || '');
    if (!who) {
      var head = String(scan).slice(0, 1200).toLowerCase();
      var letterheads = ['tns consulting','tns consult','fade boys','brozky','brzky','atas angin','clore','pb enterprise','mayang','nuhea'];
      for (var li = 0; li < letterheads.length; li++) {
        if (head.indexOf(letterheads[li]) >= 0) { who = normalizeWho(letterheads[li]); break; }
      }
    }
    if (!who) who = normalizeWho(whoFromUi());
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
      var box = document.getElementById('docs-result');
      if (box) {
        var nodes = box.querySelectorAll('div');
        for (var i = 0; i < nodes.length; i++) {
          var el = nodes[i];
          if (el.querySelector('b') && el.textContent.indexOf('Who') === 0 && el.children.length <= 2)
            el.innerHTML = '<b>Who</b> \u2014 ' + who;
          if (el.querySelector('b') && el.textContent.indexOf('Where') === 0 && el.children.length <= 2)
            el.innerHTML = '<b>Where</b> \u2014 ' + want;
        }
      }
    }
  }
  setInterval(apply, 400);
})();
