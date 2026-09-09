/* Invoice Terms → .pdoc print + #public-inv-root */
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
  function wrapRpc() {
    if (!window.sb || typeof sb.rpc !== 'function' || sb.rpc._termsWrapped) return;
    var orig = sb.rpc.bind(sb);
    sb.rpc = function (name, args) {
      var out = orig(name, args);
      Promise.resolve(out).then(function (res) {
        var d = res && res.data;
        if (name === 'get_public_invoice' && d && d.invoice_terms) {
          cached = String(d.invoice_terms).trim();
          paintPublic();
        }
      }).catch(function () {});
      return out;
    };
    sb.rpc._termsWrapped = true;
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
    cached = cached || fromApp();
    wrapNote(); wrapRpc();
    paintPdoc(); paintPublic();
    if (cached) return;
    var t = window.APP && APP.tenant;
    if (!window.sb || !t || !t.id) return;
    try {
      var r = await sb.from('tenants').select('invoice_terms,config').eq('id', t.id).maybeSingle();
      var row = r && r.data;
      if (!row) return;
      var cp = (row.config && row.config.company_profile) || {};
      cached = String(row.invoice_terms || cp.invoice_terms || '').trim();
      wrapNote(); paintPdoc(); paintPublic();
    } catch (e) {}
  }
  wrapNote(); wrapRpc(); hydrate();
  setInterval(function () { wrapNote(); wrapRpc(); paintPdoc(); paintPublic(); if (!cached) hydrate(); }, 800);
})();
