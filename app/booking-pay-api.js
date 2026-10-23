/* M-Core booking payment flow - public data layer (no login). Own anon client that sends the invoice pay token in header x-bkpay;
   the bkpay_pub view (booking_pay_01.sql) only returns that one booking. Before the SQL runs: QR + WhatsApp only. v1 */
(function () {
  if (window.BKPAYA) return;
  var A = window.BKPAYA = {}, cl = {}, MAX = 10485760, OKT = /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/i, EXT = /\.(jpe?g|png|webp|heic|heif|pdf)$/i;
  A.client = function (tok) {
    if (cl[tok]) return cl[tok];
    try {
      var url = typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : null, key = typeof SUPABASE_ANON !== 'undefined' ? SUPABASE_ANON : null;
      if (!url || !key || !window.supabase || !supabase.createClient) return null;
      cl[tok] = supabase.createClient(url, key, { global: { headers: { 'x-bkpay': tok } }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'bkpay-' + tok.slice(0, 6) } });
    } catch (e) { return null; }
    return cl[tok];
  };
  A.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); };
  A.rm = function (n) { return 'RM ' + Number(n || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  A.r2 = function (n) { return Math.round(Number(n || 0) * 100) / 100; };
  A.time = function (v, bm) { if (!v) return ''; var d = new Date(v), o = { timeZone: 'Asia/Kuala_Lumpur', hour: 'numeric', minute: '2-digit', hour12: true };
    var dd = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }) === new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' });
    if (!dd) { o.weekday = 'short'; o.day = 'numeric'; o.month = 'short'; }
    return d.toLocaleString(bm ? 'ms-MY' : 'en-MY', o); };
  A.today = function () { return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }); };
  A.phone = function (p) { var d = String(p || '').replace(/\D/g, ''); if (!d) return ''; if (d[0] === '0') d = '6' + d; else if (d[0] === '1') d = '60' + d; return d.length >= 10 ? d : ''; };
  A.wa = function (phone, msg) { var p = A.phone(phone); return 'https://wa.me/' + p + '?text=' + encodeURIComponent(msg); };
  A.sha = function (b) { return crypto.subtle.digest('SHA-256', b).then(function (x) { return Array.prototype.map.call(new Uint8Array(x), function (v) { return ('0' + v.toString(16)).slice(-2); }).join(''); }); };
  A.check = function (f) { if (!(OKT.test(f.type || '') || EXT.test(f.name || ''))) return 'pType'; if (f.size > MAX) return 'pBig'; return ''; };
  /* camera photos: anything over 600 KB -> JPEG, long edge 1600 px (HEIC / PDF as-is) */
  A.shrink = function (f) {
    if (!/^image\/(jpeg|png|webp)$/i.test(f.type || '') || f.size <= 614400) return Promise.resolve(f);
    return new Promise(function (res) {
      var u = URL.createObjectURL(f), im = new Image();
      im.onload = function () { var s = Math.min(1, 1600 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
        var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(u);
        c.toBlob(function (b) { res(b && b.size < f.size ? new File([b], String(f.name || 'receipt').replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : f); }, 'image/jpeg', 0.82); };
      im.onerror = function () { URL.revokeObjectURL(u); res(f); }; im.src = u;
    });
  };
  /* what the customer must pay now: deposit (if the service has one) or the full balance */
  A.need = function (v, inv) {
    var total = Number((v && v.total) != null ? v.total : (inv && inv.total) || 0), paid = Number((v && v.paid_amt) != null ? v.paid_amt : (inv && inv.paid_amt) || 0);
    var pct = v && Number(v.deposit_pct) > 0 && Number(v.deposit_pct) < 100 ? Number(v.deposit_pct) : 0, req = pct ? A.r2(total * pct / 100) : total;
    return { total: total, paid: paid, pct: pct, req: req, due: Math.max(0, A.r2(req - paid)), bal: Math.max(0, A.r2(total - paid)) };
  };
  A.state = function (v, inv) {
    if (!v) return 'basic';
    var n = A.need(v), st = String(v.bk_status || '');
    if (st === 'confirmed' || st === 'completed' || v.inv_status === 'paid' || (n.due <= 0.005 && n.paid > 0)) return 'ok';
    if (st === 'expired' || st === 'cancelled' || st === 'payment_failed') return 'exp';
    if (v.claim_status === 'pending') return 'rev';
    if (v.hold_until && new Date(v.hold_until) < new Date()) return 'exp';
    if (v.claim_status === 'rejected') return 'rej';
    if (v.claim_status === 'approved' && n.paid > 0) return 'part';
    return 'pay';
  };
  A.load = function (tok) {
    var c = A.client(tok);
    var pv = c ? Promise.resolve(c.from('bkpay_pub').select('*').limit(1)).then(function (r) { return r.error ? null : ((r.data || [])[0] || false); }, function () { return null; }) : Promise.resolve(null);
    var pi = typeof sb !== 'undefined' && sb ? Promise.resolve(sb.rpc('get_public_invoice', { p_token: tok })).then(function (r) { return r.error ? null : r.data; }, function () { return null; }) : Promise.resolve(null);
    return Promise.all([pv, pi]).then(function (x) { return { v: x[0], inv: x[1] }; });
  };
  A.link = function (c, v) {
    if (v.link_id) return Promise.resolve(v.link_id);
    var exp = new Date(Date.now() + 30 * 864e5).toISOString();
    return Promise.resolve(c.from('doc_public_links').insert({ tenant_id: v.tenant_id, doc_type: 'inv', doc_id: v.invoice_id, token_hash: v.token_hash, expires_at: exp }).select('id').single()).then(function (r) {
      if (!r.error && r.data) return r.data.id;
      return Promise.resolve(c.from('doc_public_links').select('id,revoked_at,expires_at').eq('token_hash', v.token_hash).maybeSingle()).then(function (q) {
        var d = q && q.data; if (d && !d.revoked_at && new Date(d.expires_at) > new Date()) return d.id; throw new Error('link');
      });
    });
  };
  /* upload one receipt -> payment_claims (pending) -> freeze the hold so the slot is kept while staff review */
  A.send = function (tok, v, file, amt) {
    var c = A.client(tok); if (!c) return Promise.reject(new Error('client'));
    return A.link(c, v).then(function (linkId) {
      return A.shrink(file).then(function (f) {
        return f.arrayBuffer().then(A.sha).then(function (h) {
          var nm = String(f.name || 'receipt').replace(/[^\w.\-]+/g, '_').slice(-80), path = v.tenant_id + '/claims/' + tok + '/' + Date.now() + '-0-' + nm;
          return Promise.resolve(c.storage.from('doc-files').upload(path, f, { contentType: f.type || 'application/octet-stream', upsert: false })).then(function (u) {
            if (u.error) throw u.error;
            return c.from('payment_claims').insert({ tenant_id: v.tenant_id, link_id: linkId, invoice_id: v.invoice_id, token: tok, amount: A.r2(amt), paid_on: A.today(),
              bank_ref: null, payer_name: null, note: ('Booking ' + (v.quote_ref || '') + ' · ref ' + v.pay_ref).slice(0, 500), files: [{ path: path, name: f.name, mime: f.type || '', size: f.size, sha256: h, src: 'bkpay' }] });
          });
        });
      }).then(function (r) {
        if (r.error) { var e = new Error(r.error.message); e.busy = /row-level|policy/i.test(r.error.message || ''); throw e; }
        return Promise.resolve(c.from('bookings').update({ hold_until: null }).eq('id', v.booking_id)).then(function () { return true; }, function () { return true; });
      });
    });
  };
})();
