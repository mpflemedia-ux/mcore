/* M-Core back-office support - QR code on printed invoice/quotation linking to the live public link (only when a valid, unrevoked, unexpired link exists). Print-only, small, keeps 1 page.
   QR generator: same qrcode-generator build the repo already uses (sd-pub-owner.js), loaded lazily. v1 */
(function () {
  if (!window.BO || !window.WAD || BO.qr) return;
  var B = BO, W = WAD, E = B.esc, t = B.t, LIB = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js', lib = null, pend = {};
  B.add({ en: { qrL: 'Scan to view online' }, bm: { qrL: 'Imbas untuk lihat dalam talian' } });
  var css = document.createElement('style');
  css.textContent = '.bo-qr{display:none}@media print{.bo-qr{display:flex!important;align-items:center;justify-content:flex-end;gap:8px;padding:0 24px 4px;font-size:9px;color:#475569;break-inside:avoid;page-break-inside:avoid}.bo-qr img{width:58px;height:58px;display:block}}';
  document.head.appendChild(css);
  function load() { if (!lib) lib = window.qrcode ? Promise.resolve() : new Promise(function (ok, no) { var s = document.createElement('script'); s.src = LIB; s.onload = ok; s.onerror = function () { lib = null; no(); }; document.head.appendChild(s); }); return lib; }
  var TBL = { inv: 'invoices', quo: 'quotations' }, PRM = { inv: 'public_inv', quo: 'public_quo' };
  B.qrUrl = function (type, id) {
    return Promise.resolve(sb.from(TBL[type]).select('public_token').eq('id', id).eq('tenant_id', B.tid()).maybeSingle()).then(function (r) {
      var tok = r && r.data && r.data.public_token; if (!tok) return null;
      return W.sha(tok).then(function (h) { return sb.from('doc_public_links').select('expires_at,revoked_at').eq('token_hash', h).maybeSingle(); }).then(function (q) {
        var l = q && q.data; if (!l || l.revoked_at || !(new Date(l.expires_at) > new Date())) return null;
        return W.base() + '?' + PRM[type] + '=' + encodeURIComponent(tok);
      });
    }).catch(function () { return null; });
  };
  function put(type, id, foot) {
    B.qrUrl(type, id).then(function (u) {
      if (!u || !foot.isConnected) return;
      return load().then(function () {
        var q = window.qrcode(0, 'M'); q.addData(u); q.make();
        var d = document.getElementById('bo-qr') || document.createElement('div'); d.id = 'bo-qr'; d.className = 'bo-qr'; d.dataset.id = id; d.dataset.url = u;
        d.innerHTML = '<span>' + E(t('qrL')) + '</span><img alt="QR" src="' + q.createDataURL(4, 0) + '">';
        if (!d.parentNode) foot.parentNode.insertBefore(d, foot);
      });
    }).catch(function () {}).then(function () { pend[id] = 0; });
  }
  function scan() {
    [['inv', '_invPublicLink'], ['quo', '_quoPublicLink']].forEach(function (x) {
      var pb = document.querySelector('#main button[onclick^="' + x[1] + "('" + '"]'); if (!pb) return;
      var id = (pb.getAttribute('onclick').match(/\('([^']+)'/) || [])[1], foot = document.querySelector('#main .pdoc-footer-note'); if (!id || !foot) return;
      var cur = document.getElementById('bo-qr'); if ((cur && cur.dataset.id === id && cur.isConnected) || pend[id]) return;
      if (cur) cur.remove(); pend[id] = 1; put(x[0], id, foot);
    });
  }
  B.qr = scan;
  var q = 0; new MutationObserver(function () { if (!q) { q = 1; setTimeout(function () { q = 0; scan(); }, 150); } }).observe(document.body, { childList: true, subtree: true });
})();
