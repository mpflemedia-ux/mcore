/* Invoice Terms on printed .pdoc — fetch tenants if APP.tenant not hydrated */
(function () {
  var cached = '';
  function fromApp() {
    var t = window.APP && APP.tenant;
    if (!t) return '';
    var cp = (t.config && (t.config.company_profile || t.config.companyProfile)) || {};
    return String(t.invoice_terms || cp.invoice_terms || '').trim();
  }
  function wrapNote() {
    if (typeof window._pdocNoSigNote !== 'function' || window._pdocNoSigNote._termsWrapped) return;
    var orig = window._pdocNoSigNote;
    window._pdocNoSigNote = function (isBm) {
      var txt = cached || fromApp();
      var block = txt
        ? '<div class="pdoc-inv-terms" style="padding:4px 0 12px;font-size:12px;line-height:1.5;color:#0f172a;white-space:pre-wrap">' +
          String(txt).replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</div>'
        : '';
      return block + orig(isBm);
    };
    window._pdocNoSigNote._termsWrapped = true;
  }
  function paintDom() {
    var txt = cached || fromApp();
    if (!txt) return;
    document.querySelectorAll('.pdoc').forEach(function (doc) {
      if (doc.querySelector('.pdoc-inv-terms')) return;
      var el = document.createElement('div');
      el.className = 'pdoc-inv-terms';
      el.style.cssText = 'padding:12px 16px 0;font-size:12px;line-height:1.5;color:#0f172a;white-space:pre-wrap';
      el.textContent = txt;
      var note = doc.querySelector('.pdoc-footer-note');
      if (note) doc.insertBefore(el, note);
      else doc.appendChild(el);
    });
  }
  async function hydrate() {
    cached = fromApp();
    wrapNote();
    paintDom();
    if (cached) return;
    var t = window.APP && APP.tenant;
    if (!window.sb || !t || !t.id) return;
    try {
      var r = await sb.from('tenants').select('invoice_terms,config').eq('id', t.id).maybeSingle();
      var row = r && r.data;
      if (!row) return;
      var cp = (row.config && row.config.company_profile) || {};
      cached = String(row.invoice_terms || cp.invoice_terms || '').trim();
      if (cached && APP.tenant) {
        APP.tenant.invoice_terms = cached;
        APP.tenant.config = APP.tenant.config || {};
        APP.tenant.config.company_profile = Object.assign({}, APP.tenant.config.company_profile || {}, { invoice_terms: cached });
      }
      wrapNote();
      paintDom();
    } catch (e) {}
  }
  wrapNote();
  hydrate();
  setInterval(function () { wrapNote(); paintDom(); if (!cached) hydrate(); }, 1000);
})();
