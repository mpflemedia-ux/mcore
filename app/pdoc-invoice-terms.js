/* Paint Settings → Invoice Terms onto .pdoc print previews. No-op elsewhere. */
(function () {
  function termsText() {
    var t = window.APP && APP.tenant;
    if (!t) return '';
    var fromCol = t.invoice_terms;
    var fromCfg = t.config && t.config.company_profile && t.config.company_profile.invoice_terms;
    return String(fromCol || fromCfg || '').trim();
  }
  function paint() {
    var txt = termsText();
    if (!txt) return;
    document.querySelectorAll('.pdoc').forEach(function (doc) {
      if (doc.querySelector('.pdoc-inv-terms')) return;
      var el = document.createElement('div');
      el.className = 'pdoc-inv-terms';
      el.style.cssText = 'padding:12px 16px 0;font-size:12px;line-height:1.5;color:#334155;white-space:pre-wrap';
      el.textContent = txt;
      var note = doc.querySelector('.pdoc-footer-note');
      if (note) doc.insertBefore(el, note);
      else doc.appendChild(el);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', paint);
  else paint();
  setInterval(paint, 800);
})();
