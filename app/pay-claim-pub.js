/* M-Core payment attachments - Phase 3, public invoice page: "Already paid? Send your payment slip" (payment_claims + private doc-files/{tenant}/claims/{token}/).
   Works in index.html (?public_inv=) and public.html. Hidden until pay_attach_03.sql has run, and only on a live (not revoked / expired) invoice link. v1 */
(function () {
  var Q = new URLSearchParams(location.search), tok = Q.get('public_inv');
  if (!tok || window.__payClaimPub) return; window.__payClaimPub = 1;
  var bm = Q.get('lang') === 'bm' || /Paparan sahaja/.test(document.body ? document.body.textContent : ''), done = false, MAX = 10485760, MAXN = 5;
  var T = bm ? { h: 'Sudah bayar?', d: 'Hantar slip bayaran anda. Kami akan sahkan selepas semakan.', open: 'Hantar slip bayaran', amt: 'Jumlah dibayar (RM)', date: 'Tarikh bayaran', ref: 'No. rujukan bank (pilihan)', name: 'Nama anda (pilihan)', note: 'Nota (pilihan)', files: 'Slip / resit (gambar atau PDF, maks 10 MB, 5 fail)', cam: 'Kamera', pick: 'Pilih fail', send: 'Hantar', cancel: 'Batal', wait: 'Menghantar…', need: 'Sila isi jumlah dan lampirkan sekurang-kurangnya satu slip.', big: 'Fail terlalu besar (maks 10 MB): ', type: 'Jenis fail tidak disokong: ', ok: 'Terima kasih! Slip anda telah dihantar. Kami akan mengesahkan bayaran tidak lama lagi.', pend: 'Slip dihantar pada {d} · menunggu pengesahan', fail: 'Tidak berjaya menghantar. Sila cuba lagi atau hubungi kami.', rm: 'Buang' }
    : { h: 'Already paid?', d: 'Send us your payment slip. We will confirm it after checking.', open: 'Send payment slip', amt: 'Amount paid (RM)', date: 'Payment date', ref: 'Bank reference no. (optional)', name: 'Your name (optional)', note: 'Note (optional)', files: 'Slip / receipt (photo or PDF, max 10 MB, 5 files)', cam: 'Camera', pick: 'Choose file', send: 'Send', cancel: 'Cancel', wait: 'Sending…', need: 'Please fill in the amount and attach at least one slip.', big: 'File too large (max 10 MB): ', type: 'File type not supported: ', ok: 'Thank you! Your slip has been sent. We will confirm the payment shortly.', pend: 'Slip sent on {d} · waiting for confirmation', fail: 'Could not send. Please try again or contact us.', rm: 'Remove' };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function sha(b) { return crypto.subtle.digest('SHA-256', b).then(function (x) { return Array.prototype.map.call(new Uint8Array(x), function (v) { return ('0' + v.toString(16)).slice(-2); }).join(''); }); }
  function fmt(v) { return new Date(v).toLocaleDateString('en-GB', { timeZone: 'Asia/Kuala_Lumpur' }); }
  function today() { return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }); }
  function rootEl() { return document.getElementById('public-inv-root') || (/public\.html/.test(location.pathname) && document.getElementById('root')); }
  var OKT = /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/i, EXT = /\.(jpe?g|png|webp|heic|heif|pdf)$/i;
  var IN = 'display:block;width:100%;box-sizing:border-box;margin:4px 0 10px;padding:10px;border:1px solid #94a3b8;border-radius:8px;font:inherit;font-size:15px;color:#0f172a;background:#fff';
  var LB = 'font-size:13px;font-weight:700;color:#334155', BTN = 'min-height:44px;padding:10px 16px;border-radius:10px;font:inherit;font-size:15px;font-weight:700;cursor:pointer;';
  function shrink(f) { /* photos > 1.5 MB -> JPEG 1600px; HEIC / PDF as-is */
    if (!/^image\/(jpeg|png|webp)$/i.test(f.type) || f.size <= 1572864) return Promise.resolve(f);
    return new Promise(function (res) {
      var u = URL.createObjectURL(f), im = new Image();
      im.onload = function () { var s = Math.min(1, 1600 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(u);
        c.toBlob(function (b) { res(b && b.size < f.size ? new File([b], f.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : f); }, 'image/jpeg', 0.82); };
      im.onerror = function () { URL.revokeObjectURL(u); res(f); }; im.src = u;
    });
  }
  function balance(root) { var m = (root.innerText || '').match(/(?:Balance|Baki)(?: Due| Tertunggak)?:?\s*(?:RM|MYR)\s*([\d,]+\.\d\d)/i); return m ? Number(m[1].replace(/,/g, '')) : null; }
  function box(root, html) {
    var ps = root.querySelectorAll('p'), a = ps.length ? ps[ps.length - 1] : null, d = document.createElement('div'); d.id = 'pay-claim'; d.className = 'no-print';
    d.style.cssText = 'margin-top:18px;padding:16px 14px;border:1px solid #cbd5e1;border-radius:12px;background:#f8fafc;color:#0f172a;text-align:left';
    d.innerHTML = html; var pay = document.getElementById('pay');
    if (pay && pay.parentNode) pay.parentNode.insertBefore(d, pay.nextSibling); else if (a) a.parentNode.insertBefore(d, a); else root.appendChild(d); return d;
  }
  function form(root, row, bal) {
    var files = [];
    var d = box(root, '<div style="font-weight:800;font-size:16px">' + T.h + '</div><div style="font-size:14px;color:#334155;margin:4px 0 12px">' + T.d + '</div>' +
      '<button type="button" data-o style="' + BTN + 'border:1px solid #0E7490;background:#fff;color:#0E7490;width:100%">📎 ' + T.open + '</button><div data-f style="display:none">' +
      '<label style="' + LB + '">' + T.amt + '<input data-amt type="number" inputmode="decimal" step="0.01" min="0.01" style="' + IN + '" value="' + (bal > 0 ? bal.toFixed(2) : '') + '"></label>' +
      '<label style="' + LB + '">' + T.date + '<input data-dt type="date" style="' + IN + '" value="' + today() + '" max="' + today() + '"></label>' +
      '<label style="' + LB + '">' + T.ref + '<input data-ref maxlength="80" data-no-titlecase="1" autocomplete="off" style="' + IN + '"></label>' +
      '<label style="' + LB + '">' + T.name + '<input data-nm maxlength="120" data-no-titlecase="1" style="' + IN + '"></label>' +
      '<label style="' + LB + '">' + T.note + '<textarea data-nt maxlength="500" rows="2" data-no-titlecase="1" style="' + IN + '"></textarea></label>' +
      '<div style="' + LB + '">' + T.files + '</div><div style="display:flex;gap:8px;margin:6px 0"><label style="' + BTN + 'flex:1;display:flex;align-items:center;justify-content:center;gap:6px;border:1px solid #94a3b8;background:#fff;color:#0f172a">📷 ' + T.cam + '<input type="file" accept="image/*" capture="environment" hidden></label>' +
      '<label style="' + BTN + 'flex:1;display:flex;align-items:center;justify-content:center;gap:6px;border:1px solid #94a3b8;background:#fff;color:#0f172a">📄 ' + T.pick + '<input type="file" multiple accept="image/*,application/pdf,.heic,.heif" hidden></label></div>' +
      '<div data-l style="font-size:14px"></div><div data-e role="alert" style="display:none;color:#991b1b;font-size:14px;font-weight:600;margin:8px 0"></div>' +
      '<div style="display:flex;gap:10px;margin-top:10px"><button type="button" data-c style="' + BTN + 'flex:1;border:1px solid #94a3b8;background:#fff;color:#0f172a">' + T.cancel + '</button><button type="button" data-s style="' + BTN + 'flex:1.4;border:0;background:#0E7490;color:#fff">' + T.send + '</button></div></div>');
    var F = d.querySelector('[data-f]'), O = d.querySelector('[data-o]'), L = d.querySelector('[data-l]'), E = d.querySelector('[data-e]'), S = d.querySelector('[data-s]');
    function err(m) { E.textContent = m; E.style.display = m ? 'block' : 'none'; }
    function list() { L.innerHTML = files.map(function (f, i) { return '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #e2e8f0"><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(f.name) + '</span><button type="button" data-i="' + i + '" style="border:0;background:none;color:#991b1b;font:inherit;font-weight:700;min-height:36px;cursor:pointer">' + T.rm + '</button></div>'; }).join('');
      L.querySelectorAll('[data-i]').forEach(function (b) { b.onclick = function () { files.splice(+b.dataset.i, 1); list(); }; }); }
    d.querySelectorAll('input[type=file]').forEach(function (inp) { inp.onchange = function () {
      var a = Array.prototype.slice.call(inp.files || []); inp.value = ''; err('');
      a.forEach(function (f) { if (files.length >= MAXN) return; if (!(OKT.test(f.type) || EXT.test(f.name))) return err(T.type + f.name); if (f.size > MAX) return err(T.big + f.name); files.push(f); }); list(); }; });
    O.onclick = function () { F.style.display = 'block'; O.style.display = 'none'; };
    d.querySelector('[data-c]').onclick = function () { F.style.display = 'none'; O.style.display = 'block'; err(''); };
    S.onclick = function () {
      var amt = Number(d.querySelector('[data-amt]').value || 0); if (!(amt > 0) || !files.length) return err(T.need);
      err(''); S.disabled = true; S.textContent = T.wait;
      var meta = [];
      files.reduce(function (p, f0, i) { return p.then(function () { return shrink(f0).then(function (f) {
        return f.arrayBuffer().then(sha).then(function (h) {
          var nm = String(f.name || 'slip').replace(/[^\w.\-]+/g, '_').slice(-80), path = row.tenant_id + '/claims/' + tok + '/' + Date.now() + '-' + i + '-' + nm;
          return sb.storage.from('doc-files').upload(path, f, { contentType: f.type || 'application/octet-stream', upsert: false }).then(function (u) {
            if (u.error) throw u.error; meta.push({ path: path, name: f.name, mime: f.type || '', size: f.size, sha256: h }); });
        }); }); }); }, Promise.resolve()).then(function () {
        var v = function (s) { var x = d.querySelector(s).value.trim(); return x || null; };
        return sb.from('payment_claims').insert({ tenant_id: row.tenant_id, link_id: row.id, invoice_id: row.doc_id, token: tok, amount: Math.round(amt * 100) / 100, paid_on: v('[data-dt]'),
          bank_ref: (v('[data-ref]') || '').slice(0, 80) || null, payer_name: (v('[data-nm]') || '').slice(0, 120) || null, note: (v('[data-nt]') || '').slice(0, 500) || null, files: meta });
      }).then(function (r) {
        if (r.error) throw r.error;
        d.innerHTML = '<div role="status" style="font-size:15px;font-weight:700;color:#166534">✓ ' + T.ok + '</div>';
      }).catch(function () { err(T.fail); S.disabled = false; S.textContent = T.send; });
    };
  }
  function apply(root) {
    if (done || typeof sb === 'undefined' || !/View-only|Paparan sahaja/.test(root.textContent || '')) return;
    done = true;
    sha(new TextEncoder().encode(tok)).then(function (h) { return sb.from('doc_public_links').select('id,tenant_id,doc_type,doc_id,expires_at,revoked_at').eq('token_hash', h).maybeSingle(); }).then(function (q) {
      var row = q && !q.error && q.data; if (!row || row.doc_type !== 'inv' || row.revoked_at || new Date(row.expires_at) <= new Date()) return;
      return sb.from('payment_claims').select('id,status,created_at').eq('link_id', row.id).order('created_at', { ascending: false }).limit(1).then(function (c) {
        if (c.error) return; /* pay_attach_03 not run */
        var last = (c.data || [])[0], bal = balance(root);
        if (last && last.status === 'pending') return box(root, '<div role="status" style="font-size:15px;font-weight:700;color:#0E7490">⏳ ' + esc(T.pend.replace('{d}', fmt(last.created_at))) + '</div>');
        if (bal == null || bal > 0.005) form(root, row, bal || 0);
      });
    }).catch(function () {});
  }
  var r0 = rootEl();
  new MutationObserver(function () { var r = rootEl(); if (r) apply(r); }).observe(r0 || document.body, { childList: true, subtree: true });
  if (r0) apply(r0);
})();
