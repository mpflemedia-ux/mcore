/* M-Core payment attachments - core: EN/BM (LANG.*.payAtt), probe, PA-silent audit, file rules, photo compression, sha256, upload / list / signed URL / soft remove, Record Payment hooks (extra/before/after). Needs pay_attach_01.sql. v1 */
(function () {
  if (window.PAYX) return;
  var P = window.PAYX = { pend: {}, on: false }, rd = {};
  var S = window.PAYX_S || { en: {}, bm: {} };
  P.S = S;
  P.add = function (o) { ['en', 'bm'].forEach(function (l) { Object.keys(o[l] || {}).forEach(function (k) { if (S[l][k] == null) S[l][k] = o[l][k]; }); }); };
  try { if (window.LANG) ['en', 'bm'].forEach(function (l) { if (LANG[l] && !LANG[l].payAtt) LANG[l].payAtt = S[l]; }); } catch (e) {}
  P.bm = function () { return window.APP && APP.language === 'bm'; };
  P.t = function (k, v) { var l = P.bm() ? 'bm' : 'en', d = (window.LANG && LANG[l] && LANG[l].payAtt) || S[l], s = d[k] != null ? d[k] : (S[l][k] != null ? S[l][k] : (S.en[k] || k));
    return v ? String(s).replace(/\{(\w+)\}/g, function (m, x) { return v[x] != null ? v[x] : m; }) : s; };
  P.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); };
  P.tid = function () { return window.APP && APP.tenant && APP.tenant.id; };
  P.uid = function () { return window.APP && APP.user && APP.user.id; };
  P.role = function () { return String((window.APP && APP.user && APP.user.role) || '').toLowerCase(); };
  P.isPA = function () { try { return P.role() === 'platform_admin' || (typeof isPlatformAdmin === 'function' && !!isPlatformAdmin()); } catch (e) { return false; } };
  P.owner = function () { var r = P.role(); return r === 'owner' || r === 'admin' || P.isPA(); };
  P.can = function (kind) { if (P.isPA()) return true; try { return canAccess(kind === 'bill' ? 'purchasing' : 'sales'); } catch (e) { return false; } };
  P.toast = function (m, k) { try { showToast(m, k || 'success'); } catch (e) {} };
  P.money = function (n) { try { return formatRM(n); } catch (e) { return 'RM ' + Number(n || 0).toFixed(2); } };
  P.date = function (v) { try { return formatDate(v); } catch (e) { return String(v || '').slice(0, 10); } };
  P.lock = function () { try { return typeof getBooksLockDate === 'function' ? getBooksLockDate() : null; } catch (e) { return null; } };
  P.locked = function (d) { var l = P.lock(); return !!(l && d && String(d).slice(0, 10) <= l); };
  /* owner / PA may change things dated inside a locked period; everyone else may not */
  P.lockOk = function (d) { return !P.locked(d) || P.role() === 'owner' || P.isPA(); };
  P.has = function (tbl) {
    var k = tbl + '|' + P.tid();
    if (!window.sb) return Promise.resolve(false);
    if (!rd[k]) rd[k] = Promise.resolve(sb.from(tbl).select('id').limit(1)).then(function (r) { if (r && r.error) { console.info('[payx] hidden until SQL for ' + tbl + ' is run'); return false; } return true; }, function () { return false; });
    return rd[k];
  };
  P.ready = function () { return P.has('doc_attachments').then(function (ok) { P.on = ok; return ok; }); };
  /* Activity Log: tenant staff -> auditLog(); platform admin -> platform_admin_audit only (silent in the tenant) */
  P.audit = function (action, table, id) {
    if (P.isPA()) { try { sb.from('platform_admin_audit').insert({ actor_user_id: P.uid(), actor_email: (APP.user && APP.user.email) || null, action: 'pay_' + action + ':' + table, target_tenant_id: P.tid() || null, target_tenant_name: (APP.tenant && APP.tenant.name) || null }).then(function () {}, function () {}); } catch (e) {} return; }
    try { auditLog(action, table, id); } catch (e) {}
  };
  /* ---- file rules ---- */
  var EXT = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', heic: 'image/heic', heif: 'image/heif', pdf: 'application/pdf',
    doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', csv: 'text/csv', txt: 'text/plain' };
  P.MAX = 10485760; P.MAXN = 10; P.ACCEPT = Object.keys(EXT).map(function (x) { return '.' + x; }).join(',') + ',image/*,application/pdf';
  P.mime = function (f) { var e = String(f.name || '').split('.').pop().toLowerCase(); return EXT[e] || (/^image\/(jpeg|png|webp|gif|heic|heif)$/.test(f.type) ? f.type : null); };
  P.check = function (f) { var m = P.mime(f); if (!m) return P.t('type', { n: f.name }); if (f.size > P.MAX) return P.t('big', { n: f.name }); return ''; };
  /* photos over 1.5 MB -> JPEG, long edge 1600 px (HEIC is uploaded as-is: most browsers cannot decode it) */
  P.compress = function (f) {
    var m = P.mime(f);
    if (!/^image\/(jpeg|png|webp)$/.test(m || '') || f.size <= 1572864) return Promise.resolve(f);
    return new Promise(function (res) {
      var u = URL.createObjectURL(f), img = new Image();
      img.onload = function () {
        var s = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(u);
        c.toBlob(function (b) { res(b && b.size < f.size ? new File([b], String(f.name).replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : f); }, 'image/jpeg', 0.82);
      };
      img.onerror = function () { URL.revokeObjectURL(u); res(f); };
      img.src = u;
    });
  };
  P.sha = function (f) {
    return f.arrayBuffer().then(function (b) { return crypto.subtle.digest('SHA-256', b); }).then(function (h) { return Array.prototype.map.call(new Uint8Array(h), function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); }, function () { return null; });
  };
  P.safe = function (n) { return String(n || 'file').normalize('NFKD').replace(/[^\w.\-]+/g, '_').replace(/_+/g, '_').slice(-80) || 'file'; };
  P.kindType = function (kind) { return kind === 'bill' ? 'supplier_payment' : kind === 'claim' ? 'payment_claim' : 'payment'; };
  /* list for many entities at once: { entity_id: [rows] } */
  P.list = function (kind, ids) {
    if (!ids.length) return Promise.resolve({});
    return Promise.resolve(sb.from('doc_attachments').select('id,entity_id,file_name,mime_type,size_bytes,storage_path,source,uploaded_by,created_at,sha256').eq('tenant_id', P.tid()).eq('entity_type', P.kindType(kind)).in('entity_id', ids).is('deleted_at', null).order('created_at', { ascending: true }))
      .then(function (r) { var m = {}; ((r && r.data) || []).forEach(function (x) { (m[x.entity_id] = m[x.entity_id] || []).push(x); }); return m; }, function () { return {}; });
  };
  P.url = function (row, dl) {
    return sb.storage.from('doc-files').createSignedUrl(row.storage_path, 300, dl ? { download: row.file_name } : undefined).then(function (r) { if (r.error || !r.data) throw r.error || new Error('url'); return r.data.signedUrl || r.data.signedURL; });
  };
  /* prepare: validate + compress + hash; returns { ok:[{f,h}], errs:[] } */
  P.prep = function (files, have) {
    var errs = [], ok = [];
    files = Array.prototype.slice.call(files || []);
    if ((have || 0) + files.length > P.MAXN) { errs.push(P.t('many')); files = files.slice(0, Math.max(0, P.MAXN - (have || 0))); }
    return files.reduce(function (p, f) {
      return p.then(function () { var e = P.check(f); if (e) { errs.push(e); return; } return P.compress(f).then(function (g) { return P.sha(g).then(function (h) { ok.push({ f: g, h: h }); }); }); });
    }, Promise.resolve()).then(function () { return { ok: ok, errs: errs }; });
  };
  /* duplicate-slip warning (same sha256 anywhere in the tenant); returns the files the user still wants */
  P.dupCheck = function (items, selfId) {
    var hs = items.map(function (x) { return x.h; }).filter(Boolean);
    if (!hs.length) return Promise.resolve(items);
    return Promise.resolve(sb.from('doc_attachments').select('entity_id,sha256').eq('tenant_id', P.tid()).in('sha256', hs).is('deleted_at', null)).then(function (r) {
      var seen = {}; ((r && r.data) || []).forEach(function (x) { seen[x.sha256] = x.entity_id; });
      return items.filter(function (x) { var e = x.h && seen[x.h]; return !e || confirm(P.t('dup', { n: x.f.name, r: String(e) === String(selfId) ? P.t('dupSelf') : P.t('another') })); });
    }, function () { return items; });
  };
  /* upload + insert rows; ctx = { invoice_id, bill_id, source } */
  P.upload = function (kind, entityId, items, ctx, prog) {
    ctx = ctx || {}; var tid = P.tid(), n = 0, errs = [], folder = kind === 'bill' ? 'supplier-payments' : 'payments';
    return items.reduce(function (p, x, i) {
      return p.then(function () {
        if (prog) prog(i + 1, items.length);
        var path = tid + '/' + folder + '/' + entityId + '/' + new Date().toISOString().replace(/\D/g, '').slice(0, 14) + '-' + Math.random().toString(36).slice(2, 8) + '-' + P.safe(x.f.name), m = P.mime(x.f);
        return sb.storage.from('doc-files').upload(path, x.f, { contentType: m, upsert: false }).then(function (u) {
          if (u.error) throw u.error;
          return sb.from('doc_attachments').insert({ tenant_id: tid, entity_type: P.kindType(kind), entity_id: entityId, invoice_id: ctx.invoice_id || null, bill_id: ctx.bill_id || null, storage_path: path,
            file_name: String(x.f.name).slice(0, 200), mime_type: m, size_bytes: x.f.size, sha256: x.h || null, source: ctx.source || 'staff', uploaded_by: P.isPA() ? null : P.uid() }).select('id').single();
        }).then(function (r) { if (r.error) throw r.error; n++; P.audit('create', 'doc_attachments', r.data && r.data.id); }).catch(function (e) { errs.push(x.f.name + ': ' + ((e && e.message) || e)); });
      });
    }, Promise.resolve()).then(function () { return { n: n, errs: errs }; });
  };
  P.remove = function (row) {
    return sb.from('doc_attachments').update({ deleted_at: new Date().toISOString(), deleted_by: P.isPA() ? null : P.uid() }).eq('id', row.id).eq('tenant_id', P.tid()).then(function (r) { if (r.error) throw r.error; P.audit('delete', 'doc_attachments', row.id); });
  };
  /* ---- Record Payment hooks called from _paySave / _billPaySave (index.html). kind: 'inv' | 'bill' ---- */
  function val(id) { var e = document.getElementById(id); return e ? String(e.value || '').trim() : ''; }
  P.extra = function (kind) {
    if (!P.on) return {};
    var pre = kind === 'bill' ? 'bill-pay-' : 'pay-', sel = document.getElementById(pre + 'method'), o = sel && sel.selectedOptions && sel.selectedOptions[0], ch = (o && o.dataset.ch) || null;
    var x = { bank_ref: val('payx-' + kind + '-ref').slice(0, 80) || null, memo: val('payx-' + kind + '-notes').slice(0, 500) || null, pay_channel: ch, cheque_no: ch === 'cheque' ? (val('payx-' + kind + '-chq').slice(0, 40) || null) : null };
    return x;
  };
  P.befores = [];
  P.before = function (kind) { return P.befores.reduce(function (p, fn) { return p.then(function (ok) { return ok && fn(kind); }); }, Promise.resolve(true)).catch(function () { return true; }); };
  P.afters = [];
  P.after = function (kind, payId, docId) {
    if (!P.on || !payId) return Promise.resolve();
    if (kind === 'inv') P.audit('create', 'payments', payId);
    var items = P.pend[kind] || []; P.pend[kind] = [];
    var go = items.length ? P.upload(kind, payId, items, kind === 'bill' ? { bill_id: docId } : { invoice_id: docId }).then(function (r) {
      if (r.n) P.toast(P.t('upOk', { n: r.n })); if (r.errs.length) P.toast(P.t('upErr') + r.errs.join('; '), 'error');
    }) : Promise.resolve();
    return go.then(function () { return P.afters.reduce(function (p, fn) { return p.then(function () { return fn(kind, payId, docId); }); }, Promise.resolve()); }).catch(function (e) { console.warn('[payx] after', e); });
  };
})();
