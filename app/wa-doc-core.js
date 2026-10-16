/* WhatsApp document share (Phase 1) - core helpers. Needs supabase/wa_doc_01.sql; hides itself until then. v1 */
(function () {
  if (window.WAD) return;
  var W = window.WAD = {}, ready = null;
  var S = window.__WAD_S || { en: {}, bm: {} };
  try { if (window.LANG) ['en', 'bm'].forEach(function (l) { if (LANG[l] && !LANG[l].waDoc) LANG[l].waDoc = S[l]; }); } catch (e) {}
  W.bm = function () { return window.APP && APP.language === 'bm'; };
  W.t = function (k, lang, v) {
    var l = lang || (W.bm() ? 'bm' : 'en'), d = (window.LANG && LANG[l] && LANG[l].waDoc) || S[l], s = d[k] != null ? d[k] : (S.en[k] || k);
    return v ? s.replace(/\{(\w+)\}/g, function (m, x) { return v[x] != null ? v[x] : m; }) : s;
  };
  W.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  W.tid = function () { return window.APP && APP.tenant && APP.tenant.id; };
  W.uid = function () { return (window.APP && APP.user && APP.user.id) || (window.NT && NT.uid && NT.uid()) || null; };
  W.inSupport = function () { try { return !!(window.PAE && PAE.inSupport && PAE.inSupport()); } catch (e) { return false; } };
  W.allowed = function (mod) {
    if (!W.tid() || !window.sb) return false; /* PA has full access inside tenants (Mike, 16 Oct) */
    try { return typeof canAccess !== 'function' || !!canAccess(mod); } catch (e) { return false; }
  };
  W.ready = function () {
    if (!ready) ready = Promise.resolve(sb.from('doc_shares').select('id').limit(1)).then(function (r) {
      if (r && r.error) { console.info('[wa-doc] hidden until supabase/wa_doc_01.sql is run:', r.error.code || r.error.message); return false; }
      return true;
    }, function () { return false; });
    return ready;
  };
  /* phone check: {d: digits for wa.me, st: ok|fix|land|bad|empty, sug} */
  W.phone = function (raw) {
    var s = String(raw || '').trim(), d = s.replace(/\D/g, ''), intl = /^\+|^00/.test(s);
    if (!d) return { d: '', st: 'empty' };
    if (/^00/.test(s)) d = d.slice(2);
    if (intl && d.slice(0, 2) !== '60') return { d: d, st: d.length >= 8 && d.length <= 15 ? 'ok' : 'bad' };
    if (d.charAt(0) === '0') d = '6' + d;
    else if (d.charAt(0) === '1' && d.length >= 9 && d.length <= 10) return { d: '', st: 'fix', sug: '60' + d };
    if (d.slice(0, 2) !== '60') return { d: d, st: d.length >= 8 && d.length <= 15 ? 'ok' : 'bad' };
    if (d.length < 10 || d.length > 12) return { d: '', st: 'bad' };
    if (d.charAt(2) !== '1') return { d: d, st: 'land' };
    return { d: d, st: 'ok' };
  };
  W.fmt = function (d) {
    d = String(d || ''); if (d.slice(0, 3) === '601') return '+60 ' + d.slice(2, 4) + '-' + d.slice(4, d.length - 4) + ' ' + d.slice(-4);
    return d ? '+' + d : '';
  };
  W.mask = function (d) { d = String(d || ''); return d.length >= 8 ? d.slice(0, 4) + '***' + d.slice(-3) : null; };
  W.waUrl = function (d, text) { return 'https://wa.me/' + (d || '') + '?text=' + encodeURIComponent(text || ''); };
  W.money = function (n) { return 'RM ' + Number(n || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  W.date = function (v) { if (!v) return '-'; var x = new Date(String(v).length <= 10 ? v + 'T00:00:00+08:00' : v); return isNaN(x) ? String(v) : x.toLocaleDateString('en-GB', { timeZone: 'Asia/Kuala_Lumpur' }); };
  W.time = function (v) { var x = new Date(v); return isNaN(x) ? '' : x.toLocaleTimeString('en-US', { timeZone: 'Asia/Kuala_Lumpur', hour: 'numeric', minute: '2-digit' }); };
  W.dayKey = function (v) { return new Date(v || Date.now()).toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }); };
  W.daysLate = function (due) { if (!due) return 0; return Math.round((new Date(W.dayKey() + 'T00:00:00Z') - new Date(String(due).slice(0, 10) + 'T00:00:00Z')) / 864e5); };
  W.tier = function (n) { return n > 30 ? 'final' : n > 7 ? 'firm' : 'friendly'; };
  W.company = function () { var t = (window.APP && APP.tenant) || {}; return t.company_name || t.name || 'M-Core'; };
  W.sha = function (s) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(s))).then(function (b) {
      return Array.prototype.map.call(new Uint8Array(b), function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
    });
  };
  W.base = function () { return (location.origin + location.pathname).replace(/index\.html$/, '').replace(/\/?$/, '/'); };
  var TBL = { inv: 'invoices', quo: 'quotations' }, PRM = { inv: 'public_inv', quo: 'public_quo' };
  function newTok() { return (crypto.randomUUID && crypto.randomUUID().replace(/-/g, '')) || (Date.now().toString(36) + Math.random().toString(36).slice(2)); }
  /* ensureLink: reuse the live token, adopt a legacy token (no row yet), or rotate an expired/revoked one */
  W.ensureLink = function (type, id, lang) {
    var tid = W.tid(), tok;
    return sb.from(TBL[type]).select('public_token').eq('id', id).eq('tenant_id', tid).single().then(function (r) {
      if (r.error) throw r.error; tok = r.data && r.data.public_token;
      return tok ? W.sha(tok).then(function (h) { return sb.from('doc_public_links').select('id,expires_at,revoked_at').eq('token_hash', h).maybeSingle().then(function (q) { return { h: h, row: q.data }; }); }) : { row: null };
    }).then(function (x) {
      var live = x.row && !x.row.revoked_at && new Date(x.row.expires_at) > new Date();
      if (live) return x.row;
      var fresh = !tok || x.row; if (fresh) tok = newTok();
      return (fresh ? sb.from(TBL[type]).update({ public_token: tok }).eq('id', id).eq('tenant_id', tid).then(function (u) { if (u.error) throw u.error; }) : Promise.resolve())
        .then(function () { return W.sha(tok); })
        .then(function (h) { return sb.from('doc_public_links').insert({ tenant_id: tid, doc_type: type, doc_id: id, token_hash: h, expires_at: new Date(Date.now() + 30 * 864e5).toISOString(), created_by: W.uid() }).select('id,expires_at,revoked_at').single(); })
        .then(function (i) { if (i.error) throw i.error; return i.data; });
    }).then(function (row) {
      return { id: row.id, expires_at: row.expires_at, token: tok, url: W.base() + '?' + PRM[type] + '=' + encodeURIComponent(tok) + (lang === 'bm' ? '&lang=bm' : '') };
    });
  };
  W.revoke = function (type, id) {
    var now = new Date().toISOString();
    return sb.from('doc_public_links').update({ revoked_at: now }).eq('doc_type', type).eq('doc_id', id).is('revoked_at', null).then(function () {
      return sb.from(TBL[type]).update({ public_token: null }).eq('id', id).eq('tenant_id', W.tid());
    }).then(function (r) { if (r && r.error) throw r.error; });
  };
  W.linkInfo = function (type, id) {
    return sb.from('doc_public_links').select('id,expires_at,revoked_at,created_at').eq('doc_type', type).eq('doc_id', id).order('created_at', { ascending: false }).limit(1)
      .then(function (r) { return (r.data || [])[0] || null; }, function () { return null; });
  };
  W.log = function (o) {
    var row = { tenant_id: W.tid(), doc_type: o.doc_type, doc_id: o.doc_id || null, doc_ref: o.doc_ref || null, template: o.template, lang: o.lang || 'bm', carrier: o.carrier || 'text',
      recipient_kind: o.recipient_kind || 'customer', recipient_label: o.recipient_label ? String(o.recipient_label).slice(0, 200) : null,
      phone_masked: o.walkin ? null : W.mask(o.phone), link_id: o.link_id || null, created_by: W.uid(),
      created_by_name: (window.APP && APP.user && (APP.user.full_name || APP.user.name || APP.user.email)) || null };
    return sb.from('doc_shares').insert(row).then(function (r) { if (r.error) throw r.error; document.dispatchEvent(new CustomEvent('wad:shared', { detail: row })); return r; });
  };
  W.history = function (type, id) {
    return Promise.all([
      sb.from('doc_shares').select('created_at,created_by_name,template').eq('doc_type', type).eq('doc_id', id).is('deleted_at', null).order('created_at', { ascending: false }).limit(50),
      type === 'inv' || type === 'quo' ? sb.from('doc_views').select('viewed_at').eq('doc_type', type).eq('doc_id', id).order('viewed_at', { ascending: false }).limit(1) : Promise.resolve({ data: [] })
    ]).then(function (a) { return { shares: a[0].data || [], view: ((a[1] && a[1].data) || [])[0] || null }; });
  };
  W.sentToday = function (type, id) {
    return sb.from('doc_shares').select('id').eq('doc_type', type).eq('doc_id', id).like('template', 'reminder%').eq('share_day', W.dayKey()).is('deleted_at', null).limit(1)
      .then(function (r) { return !!(r.data && r.data.length); }, function () { return false; });
  };
  W.tpl = function (k, lang, c) { var T = window.__WAD_T || {}, f = (T[lang] || T.en || {})[k]; return f ? f(c) : ''; };
  W.toast = function (m, k) { try { showToast(m, k || 'success'); } catch (e) {} };
})();
