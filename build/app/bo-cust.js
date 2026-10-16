/* M-Core back-office support - customer tags (VIP / Often late) in the WhatsApp share sheet: reminder tone adapts; best send time from doc_views (>=3 opens). Needs bo_support_03.sql. v1 */
(function () {
  if (!window.BO || !window.WAD || BO.cust) return;
  var B = BO, W = WAD, E = B.esc, t = B.t, CTX = null, ok = null;
  B.add({
    en: { cTags: 'Customer tag', tVip: 'VIP', tLate: 'Often late', tone: 'Reminder tone adjusted for this customer', best: 'Best time to send: around {h} (from {n} opens)' },
    bm: { cTags: 'Tag pelanggan', tVip: 'VIP', tLate: 'Selalu lewat', tone: 'Nada peringatan disesuaikan untuk pelanggan ini', best: 'Masa terbaik hantar: sekitar {h} (dari {n} kali dibuka)' }
  });
  var css = document.createElement('style');
  css.textContent = '#bo-ct{margin:6px 0 2px;display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:12.5px;color:var(--text-2)}#bo-ct button{border:1px solid var(--border-2,var(--border));background:none;color:var(--text);border-radius:99px;padding:4px 11px;font:inherit;font-weight:600;cursor:pointer;min-height:32px}' +
    '#bo-ct button[aria-pressed="true"]{background:var(--primary-light);border-color:var(--primary);color:#155E75}[data-theme="dark"] #bo-ct button[aria-pressed="true"]{color:var(--primary)}#bo-ct .bo-bt{flex-basis:100%;margin-top:2px}';
  document.head.appendChild(css);
  function probe() { if (!ok) ok = Promise.resolve(sb.from('customers').select('id,wa_tags').limit(1)).then(function (r) { if (r && r.error) { console.info('[bo] customer tags hidden until supabase/bo_support_03.sql is run'); return false; } return true; }, function () { return false; }); return ok; }
  var SOFT = { final: 'firm', firm: 'friendly', friendly: 'friendly' }, HARD = { friendly: 'firm', firm: 'final', final: 'final' };
  B.toneKey = function (k, tags) {
    var m = /^reminder_(friendly|firm|final)$/.exec(k || ''); if (!m || !tags || !tags.length) return k;
    if (tags.indexOf('vip') >= 0) return 'reminder_' + SOFT[m[1]];
    if (tags.indexOf('late') >= 0) return 'reminder_' + HARD[m[1]];
    return k;
  };
  function hourLbl(h) { var d = new Date(Date.UTC(2026, 0, 1, (h + 16) % 24)); return d.toLocaleTimeString('en-US', { timeZone: 'Asia/Kuala_Lumpur', hour: 'numeric' }); }
  function load(type, id) {
    var c = { type: type, id: id, cid: null, tags: [], best: null };
    c.p = probe().then(function (y) {
      if (!y) return;
      return Promise.resolve(sb.from(type === 'inv' ? 'invoices' : 'quotations').select('customer_id').eq('id', id).eq('tenant_id', B.tid()).maybeSingle()).then(function (r) {
        c.cid = r && r.data && r.data.customer_id; if (!c.cid) return;
        return Promise.all([
          sb.from('customers').select('wa_tags').eq('id', c.cid).eq('tenant_id', B.tid()).maybeSingle(),
          sb.from('invoices').select('id').eq('tenant_id', B.tid()).eq('customer_id', c.cid).is('deleted_at', null).limit(200),
          sb.from('quotations').select('id').eq('tenant_id', B.tid()).eq('customer_id', c.cid).is('deleted_at', null).limit(200)
        ]).then(function (a) {
          c.tags = (a[0].data && a[0].data.wa_tags) || [];
          var ids = [].concat(a[1].data || [], a[2].data || []).map(function (x) { return x.id; });
          if (!ids.length) return;
          return Promise.resolve(sb.from('doc_views').select('viewed_at').eq('tenant_id', B.tid()).in('doc_id', ids).limit(500)).then(function (v) {
            var hs = {}, n = 0, best = -1;
            ((v && v.data) || []).forEach(function (x) { var h = +new Date(x.viewed_at).toLocaleString('en-GB', { timeZone: 'Asia/Kuala_Lumpur', hour: '2-digit', hour12: false }) % 24; hs[h] = (hs[h] || 0) + 1; n++; });
            Object.keys(hs).forEach(function (h) { if (best < 0 || hs[h] > hs[best]) best = +h; });
            if (n >= 3) c.best = { h: hourLbl(best), n: n };
          });
        });
      });
    }).catch(function () {});
    return c;
  }
  /* sheet hooks */
  var oOpen = W.open;
  W.open = function (o) {
    if (o && (o.docType === 'inv' || o.docType === 'quo') && o.docId && typeof o.build === 'function' && !o._bo) {
      var c = CTX = load(o.docType, o.docId), ob = o.build; o._bo = 1;
      o.build = function (k, lang) { c.k = k; c.lang = lang; c.o = o; c.ob = ob; return c.p.then(function () { return ob(k, lang); }); };
    } else CTX = null;
    return oOpen.apply(this, arguments);
  };
  var oTpl = W.tpl;
  W.tpl = function (k, lang, c) { var nk = CTX && CTX.tags.length && !(c && c.pl) ? B.toneKey(k, CTX.tags) : k; return oTpl.call(this, nk, lang, c); };
  function rebuild() {
    var c = CTX, tx = document.getElementById('wad-tx'); if (!c || !tx || !c.ob) return;
    Promise.resolve(c.ob(c.k, c.lang)).then(function (b) { if (b && b.text != null && tx.isConnected) { tx.value = b.text; if (tx.oninput) tx.oninput(); } });
  }
  function paint() {
    var c = CTX, pm = document.getElementById('wad-pm'); if (!c || !pm || document.getElementById('bo-ct')) return;
    c.p.then(function () {
      if (!c.cid || CTX !== c || !pm.isConnected || document.getElementById('bo-ct')) return;
      var d = document.createElement('div'); d.id = 'bo-ct';
      var tone = /^reminder/.test(c.k || '') && B.toneKey('reminder_firm', c.tags) !== 'reminder_firm';
      d.innerHTML = '<span>' + E(t('cTags')) + ':</span>' + ['vip', 'late'].map(function (g) { return '<button type="button" data-g="' + g + '" aria-pressed="' + (c.tags.indexOf(g) >= 0) + '">' + (g === 'vip' ? '★ ' : '⏱ ') + E(t(g === 'vip' ? 'tVip' : 'tLate')) + '</button>'; }).join('') +
        (tone ? '<span class="bo-bt">' + E(t('tone')) + '</span>' : '') + (c.best ? '<span class="bo-bt">🕒 ' + E(t('best', c.best)) + '</span>' : '');
      pm.parentNode.insertBefore(d, pm.nextSibling);
      d.querySelectorAll('[data-g]').forEach(function (b) {
        b.onclick = function () {
          var g = b.dataset.g, on = c.tags.indexOf(g) < 0, nt = c.tags.filter(function (x) { return x !== g; }).concat(on ? [g] : []);
          if (on) nt = nt.filter(function (x) { return x === g || (g === 'vip' ? x !== 'late' : x !== 'vip'); });
          b.disabled = true;
          Promise.resolve(sb.from('customers').update({ wa_tags: nt }).eq('id', c.cid).eq('tenant_id', B.tid()).select('id')).then(function (r) {
            if (r.error) throw r.error; c.tags = nt; d.remove(); paint(); rebuild();
          }).catch(function (e) { b.disabled = false; B.toast(t('err') + ((e && e.message) || e), 'error'); });
        };
      });
    });
  }
  B.cust = function () { return CTX; };
  new MutationObserver(function () { if (CTX && document.getElementById('wad-pm') && !document.getElementById('bo-ct')) paint(); }).observe(document.body, { childList: true, subtree: true });
})();
