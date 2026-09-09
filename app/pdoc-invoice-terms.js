/* Invoice Terms → .pdoc print + #public-inv-root public overlay */
(function () {
  var cached = '';
  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
  }
  function fromApp() {
    var t = window.APP && APP.tenant;
    if (!t) return '';
    var cfg = t.config || {};
    var cp = cfg.company_profile || cfg.companyProfile || {};
    return String(t.invoice_terms || cp.invoice_terms || '').trim();
  }
  function wrapNote() {
    if (typeof window._pdocNoSigNote !== 'function' || window._pdocNoSigNote._termsWrapped) return;
    var orig = window._pdocNoSigNote;
    window._pdocNoSigNote = function (isBm) {
      var txt = cached || fromApp();
      var block = txt
        ? '<div class="pdoc-inv-terms" style="padding:4px 0 12px;font-size:12px;line-height:1.55;color:#0f172a;white-space:pre-wrap">' + esc(txt) + '</div>'
        : '';
      return block + orig(isBm);
    };
    window._pdocNoSigNote._termsWrapped = true;
  }
  function blockHtml(txt) {
    return '<div class="pdoc-inv-terms" style="margin:16px 0 8px;padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;line-height:1.55;color:#0f172a;white-space:pre-wrap">' + esc(txt) + '</div>';
  }
  function paintPdoc() {
    var txt = cached || fromApp();
    if (!txt) return;
    document.querySelectorAll('.pdoc').forEach(function (doc) {
      if (doc.querySelector('.pdoc-inv-terms')) return;
      var el = document.createElement('div');
      el.className = 'pdoc-inv-terms';
      el.style.cssText = 'padding:12px 16px 0;font-size:12px;line-height:1.55;color:#0f172a;white-space:pre-wrap';
      el.textContent = txt;
      var note = doc.querySelector('.pdoc-footer-note');
      if (note) doc.insertBefore(el, note);
      else doc.appendChild(el);
    });
  }
  function paintPublic() {
    var txt = cached || fromApp();
    var root = document.getElementById('public-inv-root');
    if (!root || root.querySelector('.pdoc-inv-terms')) return;
    if (!txt) return;
    var card = root.firstElementChild;
    if (!card) return;
    var wrap = document.createElement('div');
    wrap.innerHTML = blockHtml(txt);
    var pay = null;
    var nodes = card.querySelectorAll('div');
    for (var i = 0; i < nodes.length; i++) {
      if ((nodes[i].textContent || '').trim().toUpperCase() === 'PAYMENT') { pay = nodes[i].parentElement; break; }
    }
    if (pay) card.insertBefore(wrap.firstChild, pay);
    else card.appendChild(wrap.firstChild);
  }
  async function hydrate() {
    cached = fromApp();
    wrapNote();
    paintPdoc();
    paintPublic();
    var t = window.APP && APP.tenant;
    if (cached) return;
    if (!window.sb) return;
    try {
      var q = sb.from('tenants').select('invoice_terms,config');
      if (t && t.id) q = q.eq('id', t.id);
      var r = await q.maybeSingle();
      var row = r && r.data;
      if (!row && t && t.id) return;
      if (!row) return;
      var cp = (row.config && row.config.company_profile) || {};
      cached = String(row.invoice_terms || cp.invoice_terms || '').trim();
      wrapNote(); paintPdoc(); paintPublic();
    } catch (e) {}
  }
  wrapNote();
  hydrate();
  setInterval(function () { wrapNote(); paintPdoc(); paintPublic(); if (!cached) hydrate(); }, 800);
})();
