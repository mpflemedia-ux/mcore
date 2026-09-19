(function () {
  var last = '';
  function slug(s) {
    return String(s || '').replace(/[_\-]+/g, ' ').replace(/[^A-Za-z0-9 ]+/g, ' ').trim().split(/\s+/).filter(Boolean).map(function (w) {
      return w.charAt(0).toUpperCase() + w.slice(1);
    }).join('').slice(0, 40);
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
  function typeCode(what, folder) {
    var w = String(what || '').toLowerCase();
    var f = String(folder || '');
    if (/logo|brand/.test(w) || f.indexOf('04.2') >= 0) return 'Brand_Logo';
    if (/probation|staff letter|percubaan|offer|loa/.test(w) || f.indexOf('03.1') >= 0) return 'HR_StaffLetter';
    if (/payslip/.test(w)) return 'HR_Payslip';
    if (/ssm|borang/.test(w)) return 'SSM';
    if (/invoice|invois/.test(w)) return 'INV';
    if (/receipt|resit/.test(w)) return 'Receipt';
    if (/contract|agreement/.test(w)) return 'Contract';
    if (/nda/.test(w)) return 'NDA';
    return slug(what) || 'Doc';
  }
  function subject(who, orig) {
    var w = String(who || '').replace(/phion[^,]*/ig, '').trim();
    var s = slug(w);
    if (s && !/^Phion/i.test(s)) return s;
    return slug(String(orig || '').replace(/\.[^.]+$/, '').replace(/^Phion[_ \-]*/i, '')) || 'File';
  }
  function build() {
    var input = document.getElementById('docs-name');
    if (!input || document.activeElement === input) return;
    var orig = window._docsOrigName || (window._docsLastFile && window._docsLastFile.name) || '';
    var cls = window._docsAiClass || {};
    var folder = ((document.getElementById('docs-folder') || {}).value) || cls.folder || '';
    if (!orig && !cls.what) return;
    var name = today() + '_Phion_' + typeCode(cls.what, folder) + '_' + subject(cls.who, orig) + '.' + extOf(orig);
    if (name === last) return;
    last = name;
    input.value = name;
  }
  setInterval(build, 800);
})();
