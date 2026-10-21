/* M-Core payment attachments - Phase 4: ZIP of payment slips per month (and optional customer). Client-side store-only ZIP writer (no library, no CDN). v1 */
(function () {
  var P = window.PAYX; if (!P || P.zip) return;
  var CRC = (function () { var t = new Uint32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(b) { var c = 0xFFFFFFFF; for (var i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function dos(d) { return { t: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), d: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate() }; }
  /* files: [{name, data:Uint8Array}] -> Blob (application/zip) */
  P.zip = function (files) {
    var enc = new TextEncoder(), parts = [], cen = [], off = 0, now = dos(new Date());
    files.forEach(function (f) {
      var nm = enc.encode(f.name), crc = crc32(f.data), sz = f.data.length, h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true); h.setUint16(10, now.t, true); h.setUint16(12, now.d, true);
      h.setUint32(14, crc, true); h.setUint32(18, sz, true); h.setUint32(22, sz, true); h.setUint16(26, nm.length, true); h.setUint16(28, 0, true);
      parts.push(h.buffer, nm, f.data);
      var c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true); c.setUint16(12, now.t, true); c.setUint16(14, now.d, true);
      c.setUint32(16, crc, true); c.setUint32(20, sz, true); c.setUint32(24, sz, true); c.setUint16(28, nm.length, true); c.setUint32(42, off, true);
      cen.push(c.buffer, nm); off += 30 + nm.length + sz;
    });
    var cs = cen.reduce(function (s, x) { return s + (x.byteLength != null ? x.byteLength : x.length); }, 0), e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cs, true); e.setUint32(16, off, true);
    return new Blob(parts.concat(cen, [e.buffer]), { type: 'application/zip' });
  };
  function safe(s) { return String(s || '').replace(/[\\/:*?"<>|\x00-\x1f]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 60); }
  function end(m) { var y = +m.slice(0, 4), mo = +m.slice(5, 7), d = new Date(Date.UTC(y, mo, 0)).getUTCDate(); return m + '-' + (d < 10 ? '0' : '') + d; }
  /* month 'YYYY-MM', custId optional; prog(text). Resolves {blob, name, n, skipped} */
  P.zipSlips = function (month, custId, prog) {
    var tid = P.tid(), q = sb.from('payments').select('id,ref_no,payment_date,customer_id,customer_name').eq('tenant_id', tid).gte('payment_date', month + '-01').lte('payment_date', end(month));
    if (custId) q = q.eq('customer_id', custId);
    return Promise.resolve(q).then(function (r) {
      if (r.error) throw r.error; var pays = r.data || [], pm = {}; pays.forEach(function (p) { pm[p.id] = p; });
      if (!pays.length) return [];
      var ids = pays.map(function (p) { return p.id; }), all = [];
      var chunks = []; for (var i = 0; i < ids.length; i += 200) chunks.push(ids.slice(i, i + 200));
      return chunks.reduce(function (pr, ch) { return pr.then(function () { return sb.from('doc_attachments').select('id,entity_id,storage_path,file_name,size_bytes').eq('tenant_id', tid).eq('entity_type', 'payment').in('entity_id', ch).is('deleted_at', null).then(function (a) { if (a.error) throw a.error; all = all.concat(a.data || []); }); }); }, Promise.resolve())
        .then(function () { return all.map(function (a) { a.p = pm[a.entity_id]; return a; }); });
    }).then(function (atts) {
      if (atts.length > 300) throw new Error(P.t('zMany', { n: atts.length }));
      var out = [], skipped = 0, used = {};
      return atts.reduce(function (pr, a, i) { return pr.then(function () {
        if (prog) prog(P.t('zProg', { i: i + 1, n: atts.length }));
        return P.url(a, false).then(function (u) { return fetch(u); }).then(function (res) { if (!res.ok) throw new Error(res.status); return res.arrayBuffer(); }).then(function (buf) {
          var p = a.p || {}, base = [p.payment_date, safe(p.ref_no), safe(p.customer_name)].filter(Boolean).join('_') + '/' + safe(a.file_name), nm = base, k = 1;
          while (used[nm]) nm = base.replace(/(\.[^.\/]+)?$/, '-' + (++k) + '$1'); used[nm] = 1;
          out.push({ name: nm, data: new Uint8Array(buf) });
        }).catch(function () { skipped++; });
      }); }, Promise.resolve()).then(function () {
        return { blob: out.length ? P.zip(out) : null, n: out.length, skipped: skipped, name: 'payment-slips_' + month + (custId && atts[0] && atts[0].p ? '_' + safe(atts[0].p.customer_name).replace(/ /g, '-') : '') + '.zip' };
      });
    });
  };
})();
