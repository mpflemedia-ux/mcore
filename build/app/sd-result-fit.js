/* M-Core Service Desk - public result page (?sr_result=TOKEN, sd-wa-result.js) layout fit on phones:
   long file names / links in the Timeline and Result files wrap inside the card instead of running off the right edge,
   and stored names "1792652174180-Offer_Letter.pdf" show as "Offer_Letter.pdf" (href and download unchanged; full name in title). v1 */
(function () {
  if (window._sdResFit || !/[?&]sr_result=/.test(location.search)) return; window._sdResFit = 1;
  var PRE = /^(\d{13})-(?=\S)/;
  var css = document.createElement('style'); css.id = 'sd-result-fit';
  css.textContent = '#sdr-root .cob-root{min-width:0}' +
    '#sdr-root .cob-card div[style*="min-width:0"]{flex:1 1 auto;max-width:100%}' +
    '#sdr-root a[download].row{display:flex;align-items:flex-start;max-width:100%;min-width:0;overflow-wrap:anywhere;word-break:break-word;line-height:1.35}' +
    '#sdr-root a[download].row>.ti{flex:0 0 auto;margin-top:2px}' +
    '#sdr-root .cob-card div,#sdr-root .cob-card b{overflow-wrap:anywhere}';
  (document.head || document.documentElement).appendChild(css);
  function clean(root) {
    root.querySelectorAll('a[download], .cob-ell, .cob-xs').forEach(function (el) {
      if (el._sdFit) return; el._sdFit = 1;
      for (var n = el.firstChild; n; n = n.nextSibling) {
        if (n.nodeType !== 3) continue;
        var t = n.nodeValue, lead = t.match(/^\s*/)[0], s = t.slice(lead.length);
        if (PRE.test(s)) { if (!el.title) el.title = s.trim(); n.nodeValue = lead + s.replace(PRE, ''); }
      }
    });
  }
  function hook() {
    var root = document.getElementById('sdr-root');
    if (!root) return false;
    clean(root);
    new MutationObserver(function () { clean(root); }).observe(root, { childList: true, subtree: true });
    return true;
  }
  if (!hook()) { var n = 0, iv = setInterval(function () { if (hook() || ++n > 100) clearInterval(iv); }, 200); }
})();
