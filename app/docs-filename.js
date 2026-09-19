(function () {
  function slug(s) {
    return String(s || '')
      .replace(/[_\-]+/g, ' ')
      .replace(/[^A-Za-z0-9 ]+/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(function (w) { return w && !/^(sdn|bhd|bin|binti|the|of|and)$/i.test(w); })
      .map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(); })
      .join('')
      .slice(0, 28);
  }
  function ymd() {
    var d = new Date();
    function p(n) { n = String(n); return n.length < 2 ? '0' + n : n; }
    return String(d.getFullYear()) + p(d.getMonth() + 1) + p(d.getDate());
  }
  function extOf(name) {
    var m = String(name || '').match(/\.([A-Za-z0-9]+)$/);
    return (m ? m[1] : 'pdf').toLowerCase();
  }
  function owner(who, folder, text) {
    var b = [who, folder, text].join(' ');
    if (/brozky|brzky/i.test(b)) return 'Brozky';
    if (/fade boys/i.test(b)) return 'FadeBoys';
    if (/atas angin/i.test(b)) return 'AtasAngin';
    if (/clore/i.test(b)) return 'Clore';
    if (/mayang/i.test(b)) return 'Mayangs';
    if (/nuhea/i.test(b)) return 'Nuhea';
    return 'Phion';
  }
  function typeCode(what, name) {
    var s = (what + ' ' + name).toLowerCase().replace(/[_\-]+/g, ' ');
    if (/leave slip|\bleave\b|cuti/.test(s)) return 'HR_Leave';
    if (/offer letter|compensation|incentive|probation|staff letter|\bloa\b/.test(s)) return 'HR_StaffLetter';
    if (/payslip/.test(s)) return 'HR_Payslip';
    if (/payment voucher|\bpv\b/.test(s)) return 'PV';
    if (/claim/.test(s)) return 'Claim';
    if (/invoice/.test(s)) return 'INV';
    if (/ssm|borang/.test(s)) return 'SSM';
    if (/profil|company profile|brochure/.test(s)) return 'Brand_Profile';
    if (/logo/.test(s) || /\.(png|jpe?g|svg)$/i.test(name)) return 'Brand_Logo';
    var t = slug(what);
    return t && t !== 'Doc' ? t : 'Doc';
  }
  function subject(what, who, name, text) {
    var blob = [text, what, who, name].join('\n');
    var emp = blob.match(/employee\s*[:\u2014\-]?\s*([A-Za-z][A-Za-z \-]{2,40})/i);
    if (emp) {
      var nick = emp[1].split(/\u2014|–|\u2013|\-|\(/)[0];
      return slug(nick);
    }
    var pay = blob.match(/pay(?:ee| to)\s*[:\-]?\s*([A-Za-z ]{4,40})/i);
    if (pay) return slug(pay[1]);
    var w = String(who || '').replace(/phion.*$/i, '').replace(/brozky.*$/i, '').trim();
    var s = slug(w);
    if (s && !/^(Phion|Brozky|Fadeboys)$/i.test(s)) return s;
    var n = String(name || '').replace(/\.[^.]+$/, '').replace(/^(phion|leave slip|pv)[_ \-]*/i, '');
    s = slug(n);
    if (s && !/^(Leave|Slip|Leaveslip|Doc)$/i.test(s)) return s;
    return 'File';
  }
  function build() {
    var input = document.getElementById('docs-name');
    if (!input) return;
    input.setAttribute('data-no-titlecase', '1');
    if (document.activeElement === input) return;
    var orig = window._docsOrigName || (window._docsLastFile && window._docsLastFile.name) || '';
    var cls = window._docsAiClass || {};
    var folder = ((document.getElementById('docs-folder') || {}).value) || cls.folder || '';
    var text = window._docsScanText || '';
    if (!orig && !cls.what) return;
    var name = ymd() + '_' + owner(cls.who, folder, text) + '_' + typeCode(cls.what, orig) + '_' + subject(cls.what, cls.who, orig, text) + '.' + extOf(orig);
    if (input.value !== name) input.value = name;
  }
  setInterval(build, 500);
})();
