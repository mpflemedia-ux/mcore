(function () {
  var last = '';
  function slug(s) {
    return String(s || '').replace(/[_\-]+/g, ' ').replace(/[^A-Za-z0-9 ]+/g, ' ').trim().split(/\s+/).filter(Boolean).map(function (w) {
      return w.charAt(0).toUpperCase() + w.slice(1);
    }).join('').slice(0, 36);
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
    return '' + d.getFullYear() + m + day;
  }
  function ownerPrefix(who, folder, text) {
    var b = String(who || '') + ' ' + String(folder || '') + ' ' + String(text || '');
    if (/brozky|brzky/i.test(b)) return 'Brozky';
    if (/fade boys/i.test(b)) return 'FadeBoys';
    if (/atas angin/i.test(b)) return 'AtasAngin';
    if (/clore/i.test(b)) return 'Clore';
    if (/mayang/i.test(b)) return 'Mayangs';
    if (/nuhea/i.test(b)) return 'Nuhea';
    return 'Phion';
  }
  function typeCode(what, folder) {
    var w = String(what || '').toLowerCase();
    if (/voucher|\bpv\b/.test(w) || String(folder).indexOf('02.6') >= 0) return 'PV';
    if (/claim/.test(w)) return 'Claim';
    if (/invoice/.test(w)) return 'INV';
    if (/receipt/.test(w)) return 'Receipt';
    if (/probation|staff letter/.test(w)) return 'HR_StaffLetter';
    if (/ssm/.test(w)) return 'SSM';
    if (/logo|brand/.test(w)) return 'Brand_Logo';
    return slug(what) || 'Doc';
  }
  function subject(who, orig, text) {
    var pay = String(text || '').match(/pay(?:ee| to)\s*[:\-]?\s*([A-Za-z ]{5,40})/i);
    if (pay) return slug(pay[1]);
    var w = String(who || '').replace(/phion[^,]*/ig, '').replace(/brozky[^,]*/ig, '').replace(/brzky[^,]*/ig, '').trim();
    var s = slug(w);
    if (s) return s;
    return slug(String(orig || '').replace(/\.[^.]+$/, '')) || 'File';
  }
  function build() {
    var input = document.getElementById('docs-name');
    if (!input || document.activeElement === input) return;
    var orig = window._docsOrigName || (window._docsLastFile && window._docsLastFile.name) || '';
    var cls = window._docsAiClass || {};
    var folder = ((document.getElementById('docs-folder') || {}).value) || cls.folder || '';
    var text = window._docsScanText || '';
    if (!orig && !cls.what) return;
    var name = today() + '_' + ownerPrefix(cls.who, folder, text) + '_' + typeCode(cls.what, folder) + '_' + subject(cls.who, orig, text) + '.' + extOf(orig);
    if (name === last) return;
    last = name;
    input.value = name;
  }
  setInterval(build, 800);
})();
