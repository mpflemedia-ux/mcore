/* WhatsApp document share (Phase 1) - public pages (public.html for ?public_inv, index.html for ?public_quo): expiry/revoke gate, view log ("Opened"), BM labels (&lang=bm). v1 */
(function () {
  var P = new URLSearchParams(location.search), type = P.get('public_inv') ? 'inv' : P.get('public_quo') ? 'quo' : null;
  if (!type || window.__wadPub) return; window.__wadPub = 1;
  var tok = P.get(type === 'inv' ? 'public_inv' : 'public_quo'), bm = P.get('lang') === 'bm', done = false, checked = false, row = null;
  var BM = { 'From': 'Daripada', 'Invoice': 'Invois', 'Quotation': 'Sebut harga', 'Bill to': 'Bil kepada', 'To': 'Kepada', 'Issue / Due': 'Tarikh / Tarikh akhir', 'Date / Valid': 'Tarikh / Sah hingga',
    'No lines': 'Tiada item', 'Payment': 'Bayaran', 'View-only': 'Paparan sahaja', 'Print': 'Cetak', '🖨 Print': '🖨 Cetak', '💳 Pay Online': '💳 Bayar Dalam Talian',
    'Loading invoice…': 'Memuatkan invois…', 'Loading invoice...': 'Memuatkan invois...', 'Missing token.': 'Token tiada.', 'SST:': 'SST:', 'Loading quotation…': 'Memuatkan sebut harga…', 'Invoice unavailable': 'Invois tidak tersedia', 'Quotation unavailable': 'Sebut harga tidak tersedia' };
  var PRE = [[/^Total: /, 'Jumlah: '], [/^Paid: /, 'Dibayar: '], [/^Balance: /, 'Baki: '], [/^Subtotal: /, 'Jumlah kecil: '], [/^Qty /, 'Kuantiti '], [/^SST: /, 'SST: ']];
  function tr(root) {
    if (!bm) return;
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), n;
    while ((n = w.nextNode())) {
      var s = n.nodeValue, k = s.trim(); if (!k) continue;
      if (BM[k]) { n.nodeValue = s.replace(k, BM[k]); continue; }
      for (var i = 0; i < PRE.length; i++) if (PRE[i][0].test(k)) { n.nodeValue = s.replace(PRE[i][0], PRE[i][1]); break; }
    }
    try { document.documentElement.lang = 'ms'; } catch (e) {}
  }
  function sha(s) { return crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)).then(function (b) { return Array.prototype.map.call(new Uint8Array(b), function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); }); }
  function gone(root) {
    var co = root.querySelector('.name,[style*="#0E7490"]'), c = (co && co.textContent.trim()) || (bm ? 'syarikat' : 'the company');
    root.innerHTML = '<div style="max-width:560px;margin:60px auto;padding:24px;background:#fff;color:#0f172a;border-radius:12px;border:1px solid #e2e8f0;text-align:center">' +
      '<h2 style="margin:0 0 8px;font-size:18px">' + (bm ? 'Link tamat tempoh' : 'Link expired') + '</h2><p style="color:#475569;margin:0">' +
      (bm ? 'Link ini telah tamat tempoh atau dibatalkan. Sila hubungi ' : 'This link has expired or was revoked. Please contact ') + c.replace(/[<>&]/g, '') + (bm ? ' untuk link baharu.' : ' for a new link.') + '</p></div>';
  }
  function log() {
    if (!row || sessionStorage.getItem('wad_v_' + row.id)) return;
    Promise.resolve(sb.auth && sb.auth.getSession ? sb.auth.getSession() : null).then(function (s) {
      if (s && s.data && s.data.session) return; /* staff previewing their own link: not an "Opened" */
      return sb.from('doc_views').insert({ tenant_id: row.tenant_id, link_id: row.id, doc_type: row.doc_type, doc_id: row.doc_id, token: tok }).then(function (r) {
        if (!r.error) sessionStorage.setItem('wad_v_' + row.id, '1');
      });
    }).catch(function () {});
  }
  var check = typeof sb !== 'undefined' && tok ? sha(tok).then(function (h) {
    return sb.from('doc_public_links').select('id,tenant_id,doc_type,doc_id,expires_at,revoked_at').eq('token_hash', h).maybeSingle();
  }).then(function (r) { checked = true; row = r && !r.error ? r.data : null; }, function () { checked = true; }) : Promise.resolve(checked = true);
  function apply(root) {
    if (done || !/View-only|Paparan sahaja|unavailable|tidak tersedia/.test(root.textContent || '')) { tr(root); return; }
    done = true; root.style.visibility = 'hidden';
    var t = setTimeout(function () { root.style.visibility = ''; }, 3000);
    check.then(function () {
      clearTimeout(t);
      var dead = row && (row.revoked_at || new Date(row.expires_at) <= new Date());
      if (dead) gone(root); else { tr(root); if (/View-only|Paparan sahaja/.test(root.textContent)) log(); }
      root.style.visibility = '';
    });
  }
  function rootEl() { return document.getElementById('public-inv-root') || (/public\.html/.test(location.pathname) && document.getElementById('root')); }
  var mo = new MutationObserver(function () { var r = rootEl(); if (r) { mo.disconnect(); apply(r); new MutationObserver(function () { if (!r.__wadBusy) { r.__wadBusy = 1; apply(r); r.__wadBusy = 0; } }).observe(r, { childList: true, subtree: true }); } });
  var r0 = rootEl();
  if (r0) mo.observe(r0, { childList: true }); else mo.observe(document.body || document.documentElement, { childList: true, subtree: true });
  if (r0) apply(r0);
})();
