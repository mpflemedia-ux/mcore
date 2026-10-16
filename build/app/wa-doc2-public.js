/* WhatsApp document share (Phase 2) - public pages: invoice "Pay online" (#pay, existing ToyyibPay flow only) + quotation Accept / Decline. Needs wa_doc_02.sql. v1 */
(function () {
  var P = new URLSearchParams(location.search), type = P.get('public_inv') ? 'inv' : P.get('public_quo') ? 'quo' : null;
  if (!type || window.__wad2Pub) return; window.__wad2Pub = 1;
  var tok = P.get(type === 'inv' ? 'public_inv' : 'public_quo'), bm = P.get('lang') === 'bm', done = false;
  var T = bm ? { pay: 'Bayar dalam talian', wait: 'Menyediakan…', payFail: 'Bayaran dalam talian gagal: ', q: 'Terima sebut harga ini?', acc: 'Terima', dec: 'Tolak', reason: 'Sebab (pilihan)', name: 'Nama anda (pilihan)', send: 'Hantar penolakan', cancel: 'Batal', accDone: 'Terima kasih. Anda telah menerima sebut harga ini pada ', decDone: 'Anda telah menolak sebut harga ini pada ', fail: 'Jawapan tidak dapat dihantar. Sila cuba lagi.' }
    : { pay: 'Pay online', wait: 'Preparing…', payFail: 'Online payment failed: ', q: 'Accept this quotation?', acc: 'Accept', dec: 'Decline', reason: 'Reason (optional)', name: 'Your name (optional)', send: 'Send decline', cancel: 'Cancel', accDone: 'Thank you. You accepted this quotation on ', decDone: 'You declined this quotation on ', fail: 'Could not send your answer. Please try again.' };
  function has() { return typeof sb !== 'undefined'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(v) { var d = new Date(v); return d.toLocaleDateString('en-GB', { timeZone: 'Asia/Kuala_Lumpur' }) + ' ' + d.toLocaleTimeString('en-US', { timeZone: 'Asia/Kuala_Lumpur', hour: 'numeric', minute: '2-digit' }); }
  function sha(s) { return crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)).then(function (b) { return Array.prototype.map.call(new Uint8Array(b), function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); }); }
  function rootEl() { return document.getElementById('public-inv-root') || (/public\.html/.test(location.pathname) && document.getElementById('root')); }
  function anchor(root) { var ps = root.querySelectorAll('p'); return ps.length ? ps[ps.length - 1] : null; }
  var BTN = 'min-height:44px;padding:10px 18px;border-radius:10px;font:inherit;font-size:15px;font-weight:700;cursor:pointer;';
  function box(root, id, html) {
    var a = anchor(root), d = document.createElement('div'); d.id = id; d.className = 'no-print';
    d.style.cssText = 'margin-top:18px;padding:16px 12px;border:1px solid #cbd5e1;border-radius:12px;background:#f8fafc;color:#0f172a;text-align:center';
    d.innerHTML = html; if (a) a.parentNode.insertBefore(d, a); else root.appendChild(d); return d;
  }
  function payBox(root) {
    var txt = root.innerText || '', m = txt.match(/(?:Balance|Baki):\s*(?:RM|MYR)\s*([\d,]+\.\d\d)/);
    if (!m || Number(m[1].replace(/,/g, '')) <= 0.005) return;
    sb.rpc('has_active_toyyibpay_config_for_invoice', { p_token: tok }).then(function (r) {
      if (!r || r.data !== true || document.getElementById('pay')) return;
      var d = box(root, 'pay', '<button type="button" style="' + BTN + 'border:0;background:#0E7490;color:#fff;width:100%;max-width:320px">💳 ' + T.pay + '</button>');
      var b = d.querySelector('button');
      b.onclick = function () {
        b.disabled = true; b.textContent = T.wait;
        sb.functions.invoke('toyyibpay-tenant-invoice-create-bill', { body: { token: tok } }).then(function (x) {
          var u = x && !x.error && x.data && x.data.success && x.data.data && x.data.data.payment_url;
          if (!u) throw new Error((x && x.error && x.error.message) || (x && x.data && x.data.error) || 'Payment request failed');
          location.href = u;
        }).catch(function (e) { alert(T.payFail + (e.message || e)); b.disabled = false; b.textContent = '💳 ' + T.pay; });
      };
      if (location.hash === '#pay') setTimeout(function () { d.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 200);
    }, function () {});
  }
  function quoBox(root, row) {
    Promise.all([sb.from('doc_responses').select('response,created_at').eq('link_id', row.id).order('created_at', { ascending: false }).limit(1),
      Promise.resolve(sb.auth && sb.auth.getSession ? sb.auth.getSession() : null)]).then(function (a) {
      if (a[0].error) return; /* SQL 02 not run */
      var last = (a[0].data || [])[0], staff = a[1] && a[1].data && a[1].data.session;
      if (last) return box(root, 'wd2-acc', '<div style="font-size:15px;font-weight:700;color:' + (last.response === 'accepted' ? '#166534' : '#991b1b') + '">' + (last.response === 'accepted' ? '✓ ' + T.accDone : '✕ ' + T.decDone) + esc(fmt(last.created_at)) + '</div>');
      if (staff) return;
      var d = box(root, 'wd2-acc', '<div style="font-weight:800;font-size:16px;margin-bottom:12px">' + T.q + '</div>' +
        '<div data-b style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap"><button type="button" data-a="accepted" style="' + BTN + 'border:0;background:#166534;color:#fff;flex:1;max-width:200px">✓ ' + T.acc + '</button>' +
        '<button type="button" data-d style="' + BTN + 'border:1px solid #991b1b;background:#fff;color:#991b1b;flex:1;max-width:200px">✕ ' + T.dec + '</button></div>' +
        '<div data-f style="display:none;text-align:left;margin-top:8px"><label style="font-size:13px;font-weight:700;color:#334155">' + T.reason + '</label><textarea data-no-titlecase="1" maxlength="500" rows="3" style="display:block;width:100%;box-sizing:border-box;margin:4px 0 10px;padding:10px;border:1px solid #94a3b8;border-radius:8px;font:inherit;font-size:14px;color:#0f172a;background:#fff"></textarea>' +
        '<label style="font-size:13px;font-weight:700;color:#334155">' + T.name + '</label><input data-no-titlecase="1" maxlength="120" style="display:block;width:100%;box-sizing:border-box;margin:4px 0 12px;padding:10px;border:1px solid #94a3b8;border-radius:8px;font:inherit;font-size:14px;color:#0f172a;background:#fff">' +
        '<div style="display:flex;gap:10px"><button type="button" data-c style="' + BTN + 'border:1px solid #94a3b8;background:#fff;color:#0f172a;flex:1">' + T.cancel + '</button><button type="button" data-a="declined" style="' + BTN + 'border:0;background:#991b1b;color:#fff;flex:1.4">' + T.send + '</button></div></div>');
      var f = d.querySelector('[data-f]'), bs = d.querySelector('[data-b]');
      d.querySelector('[data-d]').onclick = function () { f.style.display = 'block'; bs.style.display = 'none'; };
      d.querySelector('[data-c]').onclick = function () { f.style.display = 'none'; bs.style.display = 'flex'; };
      d.querySelectorAll('[data-a]').forEach(function (b) { b.onclick = function () {
        var resp = b.dataset.a, reason = resp === 'declined' ? f.querySelector('textarea').value.trim().slice(0, 500) : '', nm = f.querySelector('input').value.trim().slice(0, 120);
        d.querySelectorAll('button').forEach(function (x) { x.disabled = true; });
        sb.from('doc_responses').insert({ tenant_id: row.tenant_id, link_id: row.id, doc_type: 'quo', doc_id: row.doc_id, token: tok, response: resp, reason: reason || null, responder_name: nm || null }).then(function (r) {
          if (r.error) throw r.error;
          d.innerHTML = '<div style="font-size:15px;font-weight:700;color:' + (resp === 'accepted' ? '#166534' : '#991b1b') + '">' + (resp === 'accepted' ? '✓ ' + T.accDone : '✕ ' + T.decDone) + esc(fmt(new Date())) + '</div>';
        }).catch(function () { alert(T.fail); d.querySelectorAll('button').forEach(function (x) { x.disabled = false; }); });
      }; });
    }, function () {});
  }
  function apply(root) {
    if (done || !has() || !/View-only|Paparan sahaja/.test(root.textContent || '')) return;
    done = true;
    sha(tok).then(function (h) { return sb.from('doc_public_links').select('id,tenant_id,doc_type,doc_id,expires_at,revoked_at').eq('token_hash', h).maybeSingle(); }).then(function (q) {
      if (q.error) return; /* SQL 01 not run */
      var row = q.data, live = row && !row.revoked_at && new Date(row.expires_at) > new Date();
      if (row && !live) return;
      return sb.from('doc_responses').select('id').limit(1).then(function (z) {
        if (z.error) return; /* SQL 02 not run */
        if (type === 'inv') payBox(root); else if (live && row.doc_type === 'quo') quoBox(root, row);
      });
    }, function () {});
  }
  var r0 = rootEl();
  var mo = new MutationObserver(function () { var r = rootEl(); if (r) apply(r); });
  mo.observe(r0 || document.body, { childList: true, subtree: true });
  if (r0) apply(r0);
})();
