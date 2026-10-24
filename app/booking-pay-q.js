/* M-Core booking payment flow - staff "Payments to review" queue: receipt on the left, invoice + checks on the right, one-tap Verify / Reject.
   Opens from the Sales tabs, from the bell (link {page:'sales', params:{bkpq:1, claim}}), ?page=bkpq&id= and by BKPAYQ.open(id). Mobile: list -> detail with Back. v2 */
(function () {
  var P = window.PAYX, V = window.BKPAYV, A = window.BKPAYA; if (!P || !V || !A || window.BKPAYQ) return;
  var Q = window.BKPAYQ = {}, E = P.esc, t = P.t, S = { list: [], sel: null, el: null, iv: 0 };
  function bm() { return P.bm(); }
  function css() { if (window.BKPAYQCSS) BKPAYQCSS(); }
  function ago(v) { var m = Math.max(0, Math.round((Date.now() - new Date(v)) / 60000)); return m < 60 ? m + ' min' : Math.floor(m / 60) + (bm() ? ' j ' : ' h ') + (m % 60) + ' min'; }
  function kv(k, v) { return v == null || v === '' ? '' : '<div class="bkq-kv"><span>' + E(t(k)) + '</span><b>' + v + '</b></div>'; }
  function item(x, i) {
    return '<button type="button" class="bkq-it' + (S.sel === x ? ' on' : '') + '" data-i="' + i + '"><b>' + E((x.bk && x.bk.customer_name) || x.inv.customer_name || '-') + ' · ' + E(P.money(x.c.amount)) + '</b>' +
      '<small>' + E([x.inv.ref_no, x.bk && x.bk.quote_ref].filter(Boolean).join(' · ')) + '</small><small>' + E(t('qWait', { m: ago(x.c.created_at) })) + '</small></button>';
  }
  function checks(x) {
    if (!x.ck) return '<ul class="bkq-ck"><li class="info"><i class="ti ti-loader"></i>' + E(t('qAiRun')) + '</li></ul>';
    var ic = { ok: 'ti-circle-check', warn: 'ti-alert-triangle', bad: 'ti-alert-octagon', info: 'ti-info-circle' };
    return '<ul class="bkq-ck">' + V.checks(x).map(function (c) { return '<li class="' + c[0] + '"><i class="ti ' + ic[c[0]] + '" aria-hidden="true"></i><span>' + E(c[1]) + '</span></li>'; }).join('') +
      (x.ck === 'noai' ? '<li class="info"><i class="ti ti-eye" aria-hidden="true"></i><span>' + E(t('qAiNo')) + '</span></li>' : '') + '</ul>';
  }
  function detail(x) {
    var f = V.files(x.c)[0], img = f && /^image\//i.test(f.mime || ''), why = V.may(x), n = x.n, bk = x.bk;
    var slip = !f ? '<div class="bkq-ph">' + E(t('qNoFile')) + '</div>' : !x.url ? '<div class="bkq-ph"><i class="ti ti-loader"></i></div>' :
      img ? '<a href="' + E(x.url) + '" target="_blank" rel="noopener"><img class="bkq-img" src="' + E(x.url) + '" alt="' + E(t('qSlip')) + '"></a>' : '<div class="bkq-ph"><i class="ti ti-file-type-pdf"></i> ' + E(f.name || 'PDF') + '</div>';
    return '<div class="bkq-c"><div class="bkq-h"><span>' + E(t('qSlip')) + '</span>' + (x.url ? '<a class="btn btn-outline btn-sm" href="' + E(x.url) + '" target="_blank" rel="noopener"><i class="ti ti-zoom-in"></i> ' + E(t('qZoom')) + '</a>' : '') + '</div>' + slip +
      kv('qSent', E(P.money(x.c.amount)) + ' · ' + E(A.time(x.c.created_at, bm())) + ' (MYT)') + '</div>' +
      '<div class="bkq-c"><div class="bkq-h"><span>' + E(t('qInv')) + ' ' + E(x.inv.ref_no || '') + '</span><button type="button" class="btn btn-outline btn-sm" data-open>' + E(t('qOpen')) + '</button></div>' +
      (bk ? kv('qBk', E((bk.quote_ref || '') + ' · ' + V.ref(x.inv))) + kv('qSvc', x.svc ? E(x.svc.name || '') : '') + kv('qWhen', E(A.time(bk.starts_at, bm())) + ' (MYT)') : '') +
      kv('qTotal', E(P.money(n.total))) + kv('qPaid', E(P.money(n.paid))) + kv('qDue', E(P.money(n.due)) + (n.pct ? ' (' + E(t('qDepN', { p: n.pct })) + ')' : '')) +
      (x.ro ? '<div class="bkq-msg" role="status" style="border-color:var(' + (x.c.status === 'approved' ? '--q-ok' : x.c.status === 'rejected' ? '--q-b' : '--q-w') + ')">' + E(V.roTxt ? V.roTxt(x) : '') + '</div></div>' :
      '<div class="bkq-h" style="margin:14px 0 0">' + E(t('qChecks')) + '</div>' + checks(x) +
      (why ? '<div class="bkq-msg" role="note">' + E(t(why)) + '</div>' : '') +
      '<div class="bkq-act"><div class="bkq-amt"><label for="bkq-a">' + E(t('cAmt')) + '</label><input id="bkq-a" class="form-input" type="number" inputmode="decimal" step="0.01" min="0.01" value="' + Math.min(Number(x.c.amount || 0), n.bal).toFixed(2) + '"' + (why ? ' disabled' : '') + '></div>' +
      '<button type="button" class="btn btn-outline" data-rj' + (why ? ' disabled' : '') + '>' + E(t('qReject')) + '</button><button type="button" class="btn btn-primary" data-ok' + (why ? ' disabled' : '') + '><i class="ti ti-check"></i> ' + E(t('qVerify')) + '</button></div>' +
      '<div class="bkq-rj" hidden><label for="bkq-w" style="font-size:12.5px;color:var(--text-2)">' + E(t('qRejWhy')) + '</label><textarea id="bkq-w" class="form-input" rows="3" maxlength="500" data-no-titlecase="1"></textarea>' +
      '<button type="button" class="btn btn-primary" data-rg style="margin-top:8px;min-height:44px;width:100%">' + E(t('qRejGo')) + '</button></div></div>');
  }
  function paint() {
    var el = S.el; if (!el) return; var l = S.list;
    el.querySelector('.bkq-ls').innerHTML = l.length ? l.map(item).join('') : '<div class="bkq-empty"><i class="ti ti-inbox" style="font-size:28px"></i><p>' + E(t('qEmpty')) + '</p></div>';
    var dt = el.querySelector('.bkq-dt'); dt.innerHTML = S.sel ? detail(S.sel) : ''; el.classList.toggle('det', !!S.sel && Q.mob);
    el.querySelectorAll('.bkq-it').forEach(function (b) { b.onclick = function () { pick(l[+b.dataset.i]); }; });
    var x = S.sel; if (!x) return;
    dt.querySelector('[data-open]').onclick = function () { Q.close(); openPage('sales', { view: 'inv-detail', id: x.inv.id }); };
    if (x.ro) return;
    var rj = dt.querySelector('.bkq-rj');
    dt.querySelector('[data-rj]').onclick = function () { rj.hidden = !rj.hidden; if (!rj.hidden) dt.querySelector('#bkq-w').focus(); };
    dt.querySelector('[data-rg]').onclick = function () { var w = dt.querySelector('#bkq-w').value.trim(); if (w.length < 3) return dt.querySelector('#bkq-w').focus(); act(this, V.reject(x, w), function (u) { P.toast(t('qRejDone', { t: A.time(u, bm()) + ' (MYT)' })); }); };
    dt.querySelector('[data-ok]').onclick = function () { var a = Number(dt.querySelector('#bkq-a').value || 0); if (!(a > 0)) return dt.querySelector('#bkq-a').focus();
      act(this, V.verify(x, a), function (r) { P.toast(r.part ? t('qPart', { t: r.until ? A.time(r.until, bm()) + ' (MYT)' : '-' }) : t('qDone', { n: r.no || '' })); }); };
  }
  function act(btn, pr, ok) {
    var o = btn.innerHTML; S.busy = true; S.el.querySelectorAll('.bkq-act .btn,[data-rg]').forEach(function (b) { b.disabled = true; }); btn.innerHTML = '<i class="ti ti-loader"></i> ' + E(t('qDoing'));
    pr.then(function (r) { S.busy = false; ok(r); S.sel = null; return load(); }, function (e) { S.busy = false; btn.innerHTML = o; P.toast(t('qFail', { e: (e && e.message) || e }), 'error'); paint(); });
  }
  function pick(x) {
    S.sel = x; paint(); if (!x || x.ck) return;
    if (x.ro) { x.ck = 'ro'; return V.url(V.files(x.c)[0]).then(function (u) { x.url = u; if (S.sel === x) paint(); }); }
    V.url(V.files(x.c)[0]).then(function (u) { x.url = u; if (S.sel === x) paint(); return V.dups(x); }).then(function () { return V.ai(x, x.url); })
      .then(function (ai) { x.ck = ai ? 'ai' : 'noai'; if (S.sel === x) paint(); });
  }
  function load() {
    return V.load().then(function (r) {
      var w = S.want, ro = S.sel && S.sel.ro ? S.sel : null, id = w || (S.sel && S.sel.c.id), old = S.list; S.want = null; S.list = r.list || [];
      S.list.forEach(function (x) { var o = old.find(function (y) { return y.c.id === x.c.id; }); if (o) { x.url = o.url; x.ck = o.ck; x.ai = o.ai || x.ai; x.dup = o.dup; x.dupRef = o.dupRef; } });
      S.sel = S.list.find(function (x) { return String(x.c.id) === String(id); }) || (w ? null : ro || (Q.mob ? null : S.list[0] || null));
      if (w && !S.sel && V.one) return V.one(w).then(function (x) { if (!x) P.toast(t('qRoNf'), 'error'); S.sel = x || (Q.mob ? null : S.list[0] || null); paint(); if (S.sel) pick(S.sel); Q.count(); });
      paint(); if (S.sel && !S.sel.ck) pick(S.sel); Q.count();
    }, function (e) { P.toast(t('qFail', { e: (e && e.message) || e }), 'error'); });
  }
  Q.open = function (id) {
    S.want = id ? String(id) : null; css(); if (S.el) return load(); Q.mob = matchMedia('(max-width:899px)').matches;
    var el = S.el = document.createElement('div'); el.className = 'bkq'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'bkq-t');
    el.innerHTML = '<div class="bkq-hd"><button type="button" class="btn btn-outline btn-sm bkq-back" data-b><i class="ti ti-arrow-left"></i> ' + E(t('qBack')) + '</button><div><div class="bkq-ti" id="bkq-t">' + E(t('qTitle')) + '</div><div class="bkq-sub">' + E(t('qSub')) + '</div></div>' +
      '<button type="button" class="btn btn-outline btn-sm" data-x aria-label="' + E(t('close')) + '"><i class="ti ti-x"></i></button></div><div class="bkq-bd"><div class="bkq-ls"></div><div class="bkq-dt" aria-live="polite"></div></div>';
    document.body.appendChild(el);
    el.querySelector('[data-x]').onclick = Q.close; el.querySelector('[data-b]').onclick = function () { S.sel = null; paint(); };
    S.esc = function (e) { if (e.key === 'Escape') Q.close(); }; document.addEventListener('keydown', S.esc);
    S.iv = setInterval(function () { if (!document.hidden && !S.busy) load(); }, 30000);
    return load();
  };
  Q.close = function () { if (!S.el) return; S.el.remove(); S.el = null; S.sel = null; clearInterval(S.iv); document.removeEventListener('keydown', S.esc); };
  Q.count = function () {
    return P.has('payment_claims').then(function (ok) { if (!ok || !P.tid()) return; return sb.from('payment_claims').select('id', { count: 'exact', head: true }).eq('tenant_id', P.tid()).eq('status', 'pending').is('deleted_at', null).then(function (r) {
      document.querySelectorAll('.bkq-n').forEach(function (s) { s.textContent = r.count || ''; s.hidden = !r.count; }); }); }).catch(function () {});
  };
  if (typeof window._salesTabs === 'function') { var st = window._salesTabs; window._salesTabs = function (a) { var h = st.apply(this, arguments), i = h.lastIndexOf('</div>');
    setTimeout(Q.count, 0); return h.slice(0, i) + '<button type="button" class="btn btn-sm btn-outline" style="border:none" onclick="BKPAYQ.open()"><i class="ti ti-receipt-2"></i> ' + E(t('qTab')) + '<span class="bkq-n" hidden></span></button>' + h.slice(i); }; }
  if (typeof window.openPage === 'function') { var op = window.openPage; window.openPage = function (page, params) {
    params = params || {};
    /* Sales queue stays as filter list; prefer Inbox when claim maps to a booking */
    if ((page === 'sales' && params.bkpq) || page === 'bkpq') {
      var cid = params.claim || (page === 'bkpq' && params.id) || null;
      if (cid && window.sb && P.tid()) {
        return sb.from('payment_claims').select('invoice_id').eq('id', cid).eq('tenant_id', P.tid()).maybeSingle().then(function (r) {
          var iid = r.data && r.data.invoice_id;
          if (!iid) { var x = op.call(null, 'sales', {}); Q.open(cid); return x; }
          return sb.from('bookings').select('id').eq('invoice_id', iid).eq('tenant_id', P.tid()).limit(1).then(function (b) {
            var bk = (b.data || [])[0];
            if (bk && window.BKINB) { return op.call(null, 'dashboard', { bkid: bk.id, bktab: 'proof', claim: cid }); }
            var x2 = op.call(null, 'sales', {}); Q.open(cid); return x2;
          });
        }, function () { var x = op.call(null, 'sales', {}); Q.open(cid); return x; });
      }
      var r0 = op.call(this, 'sales', {}); Q.open(cid); return r0;
    }
    Q.close(); return op.apply(this, arguments); }; }
})();
